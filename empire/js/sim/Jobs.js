// ===== Цикл добытчика: к ноде → добыча → к складу → сдача =====
import { setPath, setPathToBuilding, moveStep } from './Units.js?v=104';
import { RES_LABEL } from '../data/config.js?v=94';
import { bark } from '../data/barks.js?v=94';

function adjacentTo(state, u, ent) {
  const g = state.grid.worldToGrid(u.x, u.z);
  const gx = ent.gx, gy = ent.gy, w = ent.w || 1, h = ent.h || 1;
  return g.x >= gx - 1 && g.x <= gx + w && g.y >= gy - 1 && g.y <= gy + h;
}

export function updateWorker(state, u, dt, ctx) {
  if (u.gatherT > 0) u.gatherT -= dt;
  if (u._bCd > 0) u._bCd -= dt;   // кулдаун повторного найма на стройку (после «нет пути»)

  // ── приказ идти (ПКМ по земле) — приоритет ──
  if (u.moveOrder) {
    if (!u.path) { if (!setPath(state, u, u.moveOrder.x, u.moveOrder.y)) { u.moveOrder = null; } }
    if (u.path && moveStep(state, u, dt) === 'arrived') { u.moveOrder = null; u.path = null; }
    if (u.moveOrder) return;
  }
  // ручной простой: ХОЛОП стоит, пока не прикажут рубить (ПКМ по ноде)
  if (u.manualIdle && !u.job && u.carry === 0) { u.state = 'idle'; u.path = null; return; }

  if (u.carry >= u.def.carry) u.state = 'toDrop';

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
      if (adjacentTo(state, u, site)) {
        u.state = 'build'; u.path = null;
        u.dir = Math.atan2(site.cx - u.x, site.cz - u.z);   // лицом к стройке (стук молотком — анимация в render)
        return;
      }
      u.state = 'toBuild';
      if (!u.path) setPathToBuilding(state, u, site);
      if (moveStep(state, u, dt) === 'noPath') { u.path = null; u.buildSite = null; u._bCd = 1.5; }   // не добраться — отпустить, попробовать позже
      return;
    }
  } else if (u.buildSite != null) u.buildSite = null;   // с грузом — сперва донеси, площадку освободи

  // ── несём добычу на склад ──
  if (u.state === 'toDrop' && u.carry > 0) {
    const drop = state.nearestDrop(u.x, u.z);
    if (!drop) { u.state = 'idle'; return; }
    if (adjacentTo(state, u, drop)) {
      const lbl = RES_LABEL[u.carryType];
      state.gain({ [u.carryType]: u.carry });
      if (ctx.sfx) ctx.sfx('deposit');
      if (ctx.float) ctx.float(drop.cx, drop.cz, '+' + u.carry + ' ' + (lbl ? lbl.icon : ''), lbl ? lbl.color : '#fff');
      u.carry = 0; u.carryType = null; u.state = 'toNode'; u.path = null;
      return;
    }
    if (!u.path) setPathToBuilding(state, u, drop);
    if (moveStep(state, u, dt) === 'noPath') u.path = null;
    return;
  }

  // ── ищем ноду ──
  let node = u.job ? state.byId(u.job) : null;
  if (node && (node.depleted || node.type !== 'node')) node = null;
  if (!node && !u.manualIdle) {
    node = state.nearestNode(u.x, u.z, u.jobType || null) || state.nearestNode(u.x, u.z, null);
    if (node) { u.job = node.id; u.jobType = node.resType; }
  }
  if (!node) { u.state = 'idle'; u.path = null; return; }

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
  if (!u.path) setPathToBuilding(state, u, { gx: node.gx, gy: node.gy, w: 1, h: 1 });
  if (moveStep(state, u, dt) === 'noPath') { u.job = null; u.path = null; }
}
