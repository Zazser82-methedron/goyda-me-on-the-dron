// ===== Цикл добытчика: к ноде → добыча → к складу → сдача =====
import { setPath, setPathToBuilding, moveStep } from './Units.js?v=47';
import { RES_LABEL } from '../data/config.js?v=47';
import { bark } from '../data/barks.js?v=47';

function adjacentTo(state, u, ent) {
  const g = state.grid.worldToGrid(u.x, u.z);
  const gx = ent.gx, gy = ent.gy, w = ent.w || 1, h = ent.h || 1;
  return g.x >= gx - 1 && g.x <= gx + w && g.y >= gy - 1 && g.y <= gy + h;
}

export function updateWorker(state, u, dt, ctx) {
  if (u.gatherT > 0) u.gatherT -= dt;

  // ── приказ идти (ПКМ по земле) — приоритет ──
  if (u.moveOrder) {
    if (!u.path) { if (!setPath(state, u, u.moveOrder.x, u.moveOrder.y)) { u.moveOrder = null; } }
    if (u.path && moveStep(state, u, dt) === 'arrived') { u.moveOrder = null; u.path = null; }
    if (u.moveOrder) return;
  }
  // ручной простой: ХОЛОП стоит, пока не прикажут рубить (ПКМ по ноде)
  if (u.manualIdle && !u.job && u.carry === 0) { u.state = 'idle'; u.path = null; return; }

  if (u.carry >= u.def.carry) u.state = 'toDrop';

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
