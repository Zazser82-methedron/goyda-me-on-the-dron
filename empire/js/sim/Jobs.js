// ===== Цикл добытчика: к ноде → добыча → к складу → сдача =====
// Надёжность (2026-09-29): единая функция подхода walkToward с перепрокладкой пути, чёрный список недоступных нод,
// лимит добытчиков на ноду, авто-работа только ТОГО ЖЕ ресурса рядом, автовозврат к делу после приказа «идти».
import { setPath, setPathToBuilding, moveStep } from './Units.js?v=120';
import { RES_LABEL } from '../data/config.js?v=102';
import { bark } from '../data/barks.js?v=94';

function adjacentTo(state, u, ent) {
  const g = state.grid.worldToGrid(u.x, u.z);
  const gx = ent.gx, gy = ent.gy, w = ent.w || 1, h = ent.h || 1;
  return g.x >= gx - 1 && g.x <= gx + w && g.y >= gy - 1 && g.y <= gy + h;
}

// Подход к цели с перепрокладкой пути. Раньше 'arrived' не проверялся: путь мог закончиться НЕ рядом
// с целью (нудж, занятый тайл), и работник вечно «шёл» на месте. Возврат: 'adjacent' | 'moving' | 'fail'.
function walkToward(state, u, target, dt) {
  if (adjacentTo(state, u, target)) { u._arrFail = 0; return 'adjacent'; }
  if (!u.path) { if (!setPathToBuilding(state, u, target)) return 'fail'; }
  const r = moveStep(state, u, dt);
  if (r === 'noPath') return 'fail';
  if (r === 'arrived') {                       // дошёл до конца пути, а цель не рядом — считаем заново, но не бесконечно
    u.path = null;
    if (adjacentTo(state, u, target)) { u._arrFail = 0; return 'adjacent'; }
    if ((u._arrFail = (u._arrFail || 0) + 1) >= 3) { u._arrFail = 0; return 'fail'; }
  }
  return 'moving';
}

// «Чёрный список» недоступных нод: не возвращаться к камню, к которому не пройти, ещё 25 секунд
function isBad(u, node, t) { return u._bad && u._bad[node.id] > t; }
function markBad(u, node, t) { (u._bad ||= {})[node.id] = t + 25; }

const NODE_CAP = { wood: 2, stone: 3, gold: 3 };   // сколько добытчиков одновременно на одной ноде
const AUTO_RADIUS = 34;                            // авто-поиск работы — только рядом, а не через всю карту
const IDLE_RESUME = 8;                             // сек простоя после приказа «идти», после чего работник сам возвращается к делу

// нагрузка на ноды: считается раз за тик (state._jobTick увеличивает updateUnits)
function nodeLoad(state) {
  if (state._loadTick !== state._jobTick) {
    state._loadTick = state._jobTick;
    const m = state._nodeLoad = new Map();
    for (const w of state.units) if (w.faction === 'ours' && w.def.worker && w.job != null) m.set(w.job, (m.get(w.job) || 0) + 1);
  }
  return state._nodeLoad;
}

// склад под ресурс заполнен: носить дальше бессмысленно (state.gain обрезает по cap) — работник ждёт, игрок получает подсказку
function storageFull(state, type) { return (state.resources[type] || 0) >= (state.cap[type] ?? 9999) - 0.5; }
function warnFull(state, ctx, type, T) {
  state._fullWarn = state._fullWarn || {};
  if ((state._fullWarn[type] || -99) > T - 40) return;
  state._fullWarn[type] = T;
  const lbl = RES_LABEL[type];
  if (ctx.toast) ctx.toast((lbl ? lbl.icon + ' ' : '') + 'Склад полон (' + Math.round(state.cap[type]) + ') — потрать ресурс или построй склад/амбар. Холопы ждут.', { bad: true });
}

// выбрать ноду ПРЕДПОЧИТАЕМОГО типа (без тихого перескока на другой ресурс): ближайшая незагруженная и достижимая
function pickNode(state, u, t) {
  const type = u.jobType || u.pref || 'wood';
  const load = nodeLoad(state);
  let best = null, bd = Infinity;
  for (const n of state.nodes) {
    if (n.depleted || n.resType !== type || isBad(u, n, t)) continue;
    if (storageFull(state, type)) return null;
    const w = state.grid.gridToWorld(n.gx, n.gy);
    let d = (w.wx - u.x) ** 2 + (w.wz - u.z) ** 2;
    if (d > AUTO_RADIUS * AUTO_RADIUS) continue;
    if ((load.get(n.id) || 0) >= (NODE_CAP[type] || 2)) d += 400;   // занятая нода — в хвост очереди, но не запрещена
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

export function updateWorker(state, u, dt, ctx) {
  if (u.gatherT > 0) u.gatherT -= dt;
  if (u._bCd > 0) u._bCd -= dt;   // кулдаун повторного найма на стройку (после «нет пути»)
  const T = state._simT || 0;     // мировое время симуляции (сек) — для чёрного списка нод
  u._waitFull = false;            // выставляется ниже, если стоит из-за полного склада (не считается «свободным»)

  // ── ВНИМАНИЕ: враг рядом — холоп бросает работу и бежит к Палатам (груз держит при себе), потом возвращается к делу ──
  if (!u.moveOrder && (u._fleeing || (state._foes && state._foes.length))) {
    let danger = false;
    if (state._foes) for (const f of state._foes) { if ((f.x - u.x) ** 2 + (f.z - u.z) ** 2 < 8 * 8) { danger = true; break; } }
    if (danger) {
      const th = state.townhall;
      if (th) {
        if (!u._fleeing) { u._fleeing = true; u.path = null; u.state = 'flee'; if (u.barkT <= 0 && ctx.float) { ctx.float(u.x, u.z, '😱 Спасайся!', '#ff9a8a', 1.4); u.barkT = 5; } }
        const r = walkToward(state, u, th, dt);
        if (r === 'fail') u.path = null;
        if (r === 'adjacent') { u.state = 'idle'; u.path = null; }
        return;
      }
    } else if (u._fleeing) { u._fleeing = false; u.path = null; u.state = 'idle'; }   // опасность миновала — обратно к работе
  }

  // ── приказ идти (ПКМ по земле) — приоритет ──
  if (u.moveOrder) {
    if (!u.path) { if (!setPath(state, u, u.moveOrder.x, u.moveOrder.y)) { u.moveOrder = null; } }
    if (u.path && moveStep(state, u, dt) === 'arrived') { u.moveOrder = null; u.path = null; }
    if (u.moveOrder) return;
  }
  // ручной простой (после «иди сюда»/охоты): стоит IDLE_RESUME секунд и САМ возвращается к работе рядом с тем местом,
  // где его оставили. Раньше стоял вечно — «холопы перестают работать».
  if (u.manualIdle && !u.workSite && !u.job && u.carry === 0 && !u.huntId) {
    u.state = 'idle'; u.path = null;
    u.idleT = (u.idleT || 0) + dt;
    if (u.idleT >= IDLE_RESUME) { u.manualIdle = false; u.idleT = 0; }
    else return;
  }

  if (u.carry >= u.def.carry) u.state = 'toDrop';

  // ── ПОСТОЯННАЯ РАБОТА: назначенный холоп идёт к добывающему зданию и остаётся там ──
  let workSite = u.workSite != null ? state.byId(u.workSite) : null;
  if (!workSite || !workSite.built || workSite.type !== 'building' || !workSite.def.workSlots || workSite.ruined) {
    u.workSite = null; workSite = null;   // здание пропало — обычная авто-работа, не вечный простой
  }
  if (workSite && u.carry === 0) {
    const r = walkToward(state, u, workSite, dt);
    if (r === 'adjacent') {
      u.state = 'working'; u.path = null;
      u.dir = Math.atan2(workSite.cx - u.x, workSite.cz - u.z);
      return;
    }
    u.state = 'toWork';
    if (r === 'fail') { u.path = null; u.workSite = null; u.manualIdle = true; u.idleT = 0; }
    return;
  }

  // ── СТРОЙКА: недостроенные здания требуют строителей (приоритет над добычей) ──
  if (u.carry === 0) {
    let site = u.buildSite != null ? state.byId(u.buildSite) : null;
    if (!site || site.built || site.type !== 'building') { u.buildSite = null; site = null; }
    if (!site && !(u._bCd > 0)) {
      // ближайшая стройка с недобором строителей (≤3 на площадку)
      let best = null, bd = Infinity;
      for (const b of state.buildings) {
        if (b.built || (b._builderN || 0) >= 3) continue;
        const d = (b.cx - u.x) ** 2 + (b.cz - u.z) ** 2;
        if (d < bd) { bd = d; best = b; }
      }
      if (best) {
        u.buildSite = best.id; best._builderN = (best._builderN || 0) + 1;   // оптимистично: 4-й в этом же тике не запишется
        u.job = null; u.path = null; site = best;
      }
    }
    if (site) {
      const r = walkToward(state, u, site, dt);
      if (r === 'adjacent') {
        u.state = 'build'; u.path = null;
        u.dir = Math.atan2(site.cx - u.x, site.cz - u.z);   // лицом к стройке (стук молотком — анимация в render)
        return;
      }
      u.state = 'toBuild';
      if (r === 'fail') { u.path = null; u.buildSite = null; u._bCd = 1.5; }   // не добраться — отпустить, попробовать позже
      return;
    }
  } else if (u.buildSite != null) u.buildSite = null;   // с грузом — сперва донеси, площадку освободи

  // ── несём добычу на склад ──
  if (u.state === 'toDrop' && u.carry > 0) {
    const drop = state.nearestDrop(u.x, u.z);
    if (!drop) { u.state = 'idle'; return; }
    const r = walkToward(state, u, drop, dt);
    if (r === 'adjacent') {
      const lbl = RES_LABEL[u.carryType];
      state.gain({ [u.carryType]: u.carry });
      if (ctx.sfx) ctx.sfx('deposit');
      if (ctx.float) ctx.float(drop.cx, drop.cz, '+' + u.carry + ' ' + (lbl ? lbl.icon : ''), lbl ? lbl.color : '#fff');
      u.pref = u.carryType;            // запоминаем, что добывал: после паузы вернётся к тому же ресурсу
      u.carry = 0; u.carryType = null; u.state = 'toNode'; u.path = null;
      return;
    }
    if (r === 'fail') u.path = null;   // склад недосягаем — попробуем ещё раз со следующего тика
    return;
  }

  // ── ищем ноду: своя (по приказу) или авто того же ТИПА, что и раньше ──
  let node = u.job ? state.byId(u.job) : null;
  if (node && (node.depleted || node.type !== 'node')) { node = null; u.job = null; }
  if (!node && !u.manualIdle) {
    node = pickNode(state, u, T);
    if (node) { u.job = node.id; u.jobType = node.resType; u.pref = node.resType; u.path = null; }
  }
  if (!node) {
    u.state = 'idle'; u.path = null;
    const want = u.jobType || u.pref || 'wood';
    if (storageFull(state, want)) { u._waitFull = true; u.idleT = 0; warnFull(state, ctx, want, T); }   // ждёт из-за полного склада
    else u.idleT = (u.idleT || 0) + dt;                                                                   // нет ресурса рядом — «свободный»
    return;
  }
  u.idleT = 0;

  // ── склад под этот ресурс полон — не начинаем добычу впустую (если уже несёт — донесёт) ──
  if (u.carry === 0 && storageFull(state, node.resType)) {
    u.state = 'idle'; u.path = null; u.idleT = 0; u._waitFull = true;
    warnFull(state, ctx, node.resType, T);
    return;
  }

  // ── добыча ──
  if (adjacentTo(state, u, node)) {
    u.state = 'gather'; u.path = null;
    if (u.gatherT <= 0) {
      const gmul = ((state.faction && state.faction.mods.gatherMul) || 1) * (state.research ? state.research.gatherMul : 1);
      const rate = Math.min(u.def.gatherRate * gmul, node.amount, u.def.carry - u.carry);
      node.amount -= rate; u.carry += rate; u.carryType = node.resType; u.gatherT = 0.8;
      if (ctx.sfx) ctx.sfx('gather');
      const s = Math.max(0.25, node.amount / node.maxAmount);
      node.field.setScale(node, 0.45 + 0.55 * s);
      if (node.amount <= 0) {
        if (node.resType === 'wood') { node.depleted = true; node.amount = 0; node.regrow = 0; node.field.setScale(node, 0.22); } // пень — отрастёт
        else state.removeNode(node);                                   // камень/золото конечны
        u.job = null; u.state = 'toDrop';
      } else if (u.carry >= u.def.carry) u.state = 'toDrop';
      if (u.barkT <= 0 && Math.random() < 0.04) { ctx.bark && ctx.bark(u, bark('work')); u.barkT = 6; }
    }
    return;
  }

  // ── идём к ноде ──
  u.state = 'toNode';
  const r = walkToward(state, u, { gx: node.gx, gy: node.gy, w: 1, h: 1 }, dt);
  if (r === 'fail') { markBad(u, node, T); u.job = null; u.path = null; }   // не добраться — выбрать другую, к этой не возвращаться 25 с
}
