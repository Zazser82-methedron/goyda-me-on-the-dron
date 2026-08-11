// ===== Постройка, стройка-прогресс и тренировка юнитов =====
import { BUILDINGS } from '../data/buildings.js?v=95';
import { UNITS } from '../data/units.js?v=94';
import { RANKS } from '../data/ranks.js?v=94';
import { nearestAdj } from '../world/Pathfinding.js?v=94';
import { bark } from '../data/barks.js?v=94';
import { edictMods } from './Edicts.js?v=94';
import { apply as applyWear, repairQuote, ruinQuote } from './Wear.js?v=1';

function trainTime(state, kind) {
  const base = UNITS[kind].trainTime;
  const mul = edictMods(state).trainMul * (state.happiness < 35 ? 1.4 : 1);
  return base * mul;
}

function spawnTrained(state, b, kind, ctx) {
  const adj = nearestAdj(state.grid, b.gx, b.gy, b.w, b.h, b.gx, b.gy) || { x: b.gx, y: b.gy };
  const w = state.grid.gridToWorld(adj.x, adj.y);
  const u = state.addUnit(kind, w.wx, w.wz, {});
  ctx.sfx && ctx.sfx('train');
  ctx.bark && ctx.bark(u, bark('spawn'));
  return u;
}

export function update(state, dt, ctx) {
  updateRepairs(state, dt, ctx);
  // пересчёт строителей на площадках (каждый тик со свежих данных — без дрейфа счётчиков)
  let anySite = false;
  for (const b of state.buildings) { if (!b.built) { anySite = true; b._builderN = 0; b._activeBuilders = 0; } }
  if (anySite) {
    for (const u of state.units) {
      if (u.faction !== 'ours' || !u.def.worker || u.buildSite == null) continue;
      const site = state.byId(u.buildSite);
      if (!site || site.built) continue;
      site._builderN++;
      if (u.state === 'build') site._activeBuilders++;
    }
  }
  for (const b of state.buildings) {
    if (!b.built) {
      // СТРОИТЕЛИ ОБЯЗАТЕЛЬНЫ: без них стройка еле капает; 1/2/3 строителя = ×1.15/×1.85/×2.45
      const n = Math.min(b._activeBuilders || 0, b.def.workers || 3);
      const rate = n <= 0 ? 0.15 : (n === 1 ? 1.15 : n === 2 ? 1.85 : 2.45);
      b.buildLeft -= dt * rate;
      const frac = Math.max(0, Math.min(1, 1 - b.buildLeft / (b.def.build || 1)));
      b.view.position.y = (b.cy || 0) - (b._bh || 1) * (1 - frac) * 0.92;   // модель поднимается из земли
      const q = Math.floor(frac * 4);                                       // вехи 25/50/75%
      if (q > (b._q || 0) && q < 4) { b._q = q; ctx.float && ctx.float(b.cx, b.cz, '🔨 ' + q * 25 + '%', '#ffe08a'); }
      if (n > 0) {                                                          // стук молотков + пыль
        b._hamT = (b._hamT || 0) - dt;
        if (b._hamT <= 0) {
          b._hamT = 0.55 + Math.random() * 0.45;
          ctx.sfx && ctx.sfx('hammer');
          ctx.dust && ctx.dust(b.cx + (Math.random() - 0.5) * b.w, (b.cy || 0) + 0.15, b.cz + (Math.random() - 0.5) * b.h);
        }
      }
      if (b.buildLeft <= 0) {
        state.finishBuild(b);
        b._completeAnim = 1;
        ctx.sfx && ctx.sfx('build');
        ctx.burst && ctx.burst(b.cx, (b.cy || 0) + 0.6, b.cz, 0xffcc44, 16);   // салют завершения стройки
        ctx.toast && ctx.toast(b.def.icon + ' ' + b.def.name + ' готов!');
        if (b.def.wonder && ctx.onWin) ctx.onWin();
      }
      continue;
    }
    if (b.ruined) continue;
    if (b.trainQueue.length) {
      b.trainLeft -= dt;
      if (b.trainLeft <= 0) {
        const kind = b.trainQueue.shift();
        spawnTrained(state, b, kind, ctx);
        if (b.trainQueue.length) b.trainLeft = trainTime(state, b.trainQueue[0]);
      }
    }
  }
}

function updateRepairs(state, dt, ctx) {
  for (const b of state.buildings) {
    if (!b.repairLeft) continue;
    const worker = state.byId(b.repairWorkerId);
    if (!worker || !worker.def.worker) continue;
    const delta = Math.min(dt, b.repairLeft);
    b.repairLeft -= delta;
    b.wear = Math.min(100, b.wear + b._repairRate * delta);
    applyWear(state, b);
    if (b.repairLeft > 0) continue;
    b.wear = 100; b.ruined = false;
    applyWear(state, b);
    worker.repairSite = null;
    b.repairWorkerId = null; b._repairRate = 0;
    state.recomputePop();
    ctx.toast && ctx.toast((b._wearBaseDef.icon || '🪚') + ' ' + b._wearBaseDef.name + ' восстановлена');
  }
}

export function startRepair(state, b, ctx) {
  if (!b || !b.built || b.repairLeft) return { ok: false, reason: 'ремонт недоступен' };
  applyWear(state, b);
  if (b.wear >= 100) return { ok: false, reason: 'износ не требуется' };
  const worker = state.workers().find(u => !u.buildSite && !u.repairSite);
  if (!worker) return { ok: false, reason: 'нужен свободный рабочий' };
  const quote = b.ruined ? ruinQuote(b) : repairQuote(b);
  if (!state.canAfford(quote.cost)) return { ok: false, reason: 'мало ресурсов', quote };
  state.spend(quote.cost);
  worker.repairSite = b.id;
  b.repairWorkerId = worker.id;
  b.repairLeft = quote.time;
  b._repairRate = quote.time ? quote.wear / quote.time : quote.wear;
  if (!quote.time) { b.repairLeft = Number.EPSILON; }
  return { ok: true, quote };
}

export function placeBuilding(state, kind, gx, gy, ctx, opts = {}) {
  const def = BUILDINGS[kind];
  if (!def) return { ok: false, reason: 'нет такого здания' };
  if ((def.rank || 0) > state.rankIndex) return { ok: false, reason: 'нужен ранг ' + RANKS[def.rank].name };
  if (def.requiresTech && !(state.research && state.research.done[def.requiresTech])) return { ok: false, reason: 'изучите технологию (через обсерваторию)' };
  if (def.unique && state.buildings.some(b => b.kind === kind)) return { ok: false, reason: 'уже построено' };
  if (!state.grid.canPlace(gx, gy, def.w, def.h, !!def.onWater)) return { ok: false, reason: 'место занято' };
  if (!state.canAfford(def.cost)) return { ok: false, reason: 'мало ресурсов' };
  state.spend(def.cost);
  const b = state.addBuilding(kind, gx, gy, { built: (def.build || 0) <= 0, rotation: opts.rotation || 0 });
  b.wear = 100; b.upgrade = null; b.districtId = null; b.disabled = false;
  applyWear(state, b);
  if (b.built) state.recomputePop();
  ctx.sfx && ctx.sfx('place');
  if (def.wonder) {
    ctx.toast && ctx.toast('🗿 ЧУДО заложено! Достройте идол — но ГОЙДА-БАТЯ уже в пути.', { big: true, gold: true });
    ctx.spawnBoss && ctx.spawnBoss('goyda_batya');
  }
  return { ok: true, b };
}

export function queueTrain(state, b, kind, ctx) {
  const def = UNITS[kind];
  if (!def) return false;
  if (def.rank && state.rankIndex < def.rank) { ctx.toast && ctx.toast('Рано: нужен ранг ' + RANKS[def.rank].name, { bad: true }); return false; }
  if (def.needs && !state.hasBuilt(def.needs)) { ctx.toast && ctx.toast('Нужна постройка: ' + BUILDINGS[def.needs].name, { bad: true }); return false; }
  const pending = state.buildings.reduce((s, x) => s + x.trainQueue.length, 0);
  if (state.population + pending >= state.popCap) { ctx.toast && ctx.toast('Нет места — строй ИЗБЫ', { bad: true }); return false; }
  const cmul = (state.faction && state.faction.mods.trainCostMul) || 1;
  const cost = {}; for (const k in def.cost) cost[k] = Math.max(1, Math.round(def.cost[k] * cmul));
  if (!state.canAfford(cost)) { ctx.toast && ctx.toast('Мало ресурсов на ' + def.name, { bad: true }); return false; }
  state.spend(cost);
  if (!b.trainQueue.length) b.trainLeft = trainTime(state, kind);
  b.trainQueue.push(kind);
  ctx.sfx && ctx.sfx('click');
  return true;
}
