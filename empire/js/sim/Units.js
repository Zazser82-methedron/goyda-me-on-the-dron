// ===== Движение, бой и ИИ юнитов (свои воины + враги). Воркеры — в Jobs.js =====
import { TILE } from '../data/config.js?v=7';
import { findPath, nearestAdj } from '../world/Pathfinding.js?v=7';
import { updateWorker } from './Jobs.js?v=7';
import { bark } from '../data/barks.js?v=7';

export function tileCenter(state, tx, ty) { const w = state.grid.gridToWorld(tx, ty); return { x: w.wx, z: w.wz }; }
function dist2(ax, az, bx, bz) { return (ax - bx) ** 2 + (az - bz) ** 2; }
function bRadius(b) { return Math.max(b.w, b.h) * 0.5 * TILE + 0.3; }

// проложить путь к тайлу (tx,ty); если занят — к ближайшему проходимому соседу
export function setPath(state, u, tx, ty) {
  let path = findPath(state.grid, u.gx ?? state.grid.worldToGrid(u.x, u.z).x, u.gy ?? state.grid.worldToGrid(u.x, u.z).y, tx, ty);
  if (!path) {
    const g = state.grid.worldToGrid(u.x, u.z);
    const adj = nearestAdj(state.grid, tx, ty, 1, 1, g.x, g.y);
    if (adj) path = findPath(state.grid, g.x, g.y, adj.x, adj.y);
  }
  u.path = path; u.pi = 0;
  return !!path;
}

// проложить путь к зданию (footprint) — к ближайшему соседнему тайлу
export function setPathToBuilding(state, u, b) {
  const g = state.grid.worldToGrid(u.x, u.z);
  const adj = nearestAdj(state.grid, b.gx, b.gy, b.w, b.h, g.x, g.y);
  if (!adj) { u.path = null; return false; }
  return setPath(state, u, adj.x, adj.y);
}

// шаг движения вдоль u.path; 'arrived' | 'moving' | 'noPath'
export function moveStep(state, u, dt) {
  if (!u.path) return 'noPath';
  if (u.pi >= u.path.length) return 'arrived';
  const node = u.path[u.pi];
  const c = tileCenter(state, node.x, node.y);
  const dx = c.x - u.x, dz = c.z - u.z;
  const d = Math.hypot(dx, dz);
  const step = u.speed * dt * (state.krioTimer > 0 && u.faction === 'ours' ? 0.6 : 1) * (state.superTimer > 0 && u.faction === 'ours' ? 1.4 : 1);
  if (d <= step) {
    u.x = c.x; u.z = c.z; u.pi++;
  } else {
    u.x += dx / d * step; u.z += dz / d * step; u.dir = Math.atan2(dx, dz);
  }
  const g = state.grid.worldToGrid(u.x, u.z); u.gx = g.x; u.gy = g.y;
  return u.pi >= u.path.length ? 'arrived' : 'moving';
}

// урон сущности (юнит/здание). true если уничтожена.
export function damage(state, target, amt, ctx) {
  if (!target || target.hp <= 0) return true;
  target.hp -= amt;
  if (target.type === 'building' && ctx.flash) ctx.flash(target);
  if (target.hp <= 0) {
    if (target.type === 'unit') {
      if (target.bossKey && ctx.onBossDown) ctx.onBossDown(target);
      state.killUnit(target);
    } else {
      const wasTown = target === state.townhall;
      state.removeBuilding(target);
      if (ctx.toast) ctx.toast('💥 ' + target.def.name + ' разрушен', { bad: true });
      if (wasTown && ctx.onLose) ctx.onLose();
    }
    return true;
  }
  return false;
}

function tryAttack(state, u, target, ctx) {
  if (u.atkT > 0) return;
  u.atkT = u.def.atkCd;
  u.atkAnim = 0.2;                 // выпад-анимация (render)
  const bonus = (state.superTimer > 0 && u.faction === 'ours') ? 1.5 : 1;
  damage(state, target, u.dmg * bonus, ctx);
  if (ctx.sfx) ctx.sfx(u.faction === 'ours' ? 'hit' : 'hitEnemy');
  if (u.barkT <= 0 && Math.random() < 0.25) { ctx.bark && ctx.bark(u, bark('attack')); u.barkT = 3; }
}

function inRange(u, target) {
  if (target.type === 'unit') return dist2(u.x, u.z, target.x, target.z) <= (u.def.range + 0.3) ** 2;
  return dist2(u.x, u.z, target.cx, target.cz) <= (u.def.range + bRadius(target)) ** 2;
}

function nearestEnemyUnit(state, u, maxR) {
  let best = null, bd = maxR * maxR;
  for (const e of state.units) {
    if (e.faction === u.faction || e.hp <= 0) continue;
    const d = dist2(u.x, u.z, e.x, e.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ближайшая своя постройка/стена в пределах досягаемости врага
function nearestOursBuildingInRange(state, u) {
  let best = null, bd = Infinity;
  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    const reach = (u.def.range + bRadius(b)) ** 2;
    const d = dist2(u.x, u.z, b.cx, b.cz);
    if (d <= reach && d < bd) { bd = d; best = b; }
  }
  return best;
}

function faceTarget(u, tx, tz) { u.dir = Math.atan2(tx - u.x, tz - u.z); }

// ---- свои воины: стойки aggro (по умолч.) / defend / hold ----
function updateSoldier(state, u, dt, ctx) {
  const stance = u.stance || 'aggro';
  const aggroR = stance === 'aggro' ? 9999 : stance === 'defend' ? 22 : 0;

  // 1) ищем врага по стойке и идём на него
  const enemy = aggroR > 0 ? nearestEnemyUnit(state, u, aggroR) : null;
  if (enemy) {
    if (inRange(u, enemy)) { faceTarget(u, enemy.x, enemy.z); tryAttack(state, u, enemy, ctx); u.path = null; u.moveOrder = null; return; }
    u.repathT -= dt;
    if (!u.path || u.pi >= u.path.length || u.repathT <= 0) {
      const eg = state.grid.worldToGrid(enemy.x, enemy.z);
      setPath(state, u, eg.x, eg.y); u.repathT = 0.45;
    }
    if (moveStep(state, u, dt) === 'noPath') u.repathT = 0.5;
    return;
  }

  // 2) приказ игрока идти
  if (u.moveOrder) {
    if (!u.path) { if (!setPath(state, u, u.moveOrder.x, u.moveOrder.y)) { u.moveOrder = null; return; } }
    if (moveStep(state, u, dt) === 'arrived') { u.moveOrder = null; u.path = null; }
    return;
  }

  // 3) стойка «стоять» — не двигаемся
  if (stance === 'hold') { u.path = null; return; }

  // 4) вернуться к точке сбора (ралли/ратуша)
  const rally = state.rally || (state.townhall ? { x: state.townhall.cx, z: state.townhall.cz } : null);
  if (rally && dist2(u.x, u.z, rally.x, rally.z) > 49) {
    if (!u.path) { const g = state.grid.worldToGrid(rally.x, rally.z); setPath(state, u, g.x, g.y); }
    if (moveStep(state, u, dt) === 'arrived') u.path = null;
    return;
  }
  u.path = null;
}

// ---- враги ----
function updateEnemy(state, u, dt, ctx) {
  // что-то своё в пределах удара? — бей
  const tgtUnit = nearestEnemyUnit(state, u, u.def.range + 0.6);
  if (tgtUnit && inRange(u, tgtUnit)) { faceTarget(u, tgtUnit.x, tgtUnit.z); tryAttack(state, u, tgtUnit, ctx); u.path = null; return; }
  const tgtB = nearestOursBuildingInRange(state, u);
  if (tgtB) { faceTarget(u, tgtB.cx, tgtB.cz); tryAttack(state, u, tgtB, ctx); u.path = null; return; }

  // иначе — марш к цели (идол > ратуша); если рядом солдат — на него
  const soldier = nearestEnemyUnit(state, u, 6);
  const obj = state.idol || state.townhall;
  u.repathT -= dt;
  if (soldier) {
    if (!u.path || u.repathT <= 0) { setPath(state, u, soldier.gx ?? state.grid.worldToGrid(soldier.x, soldier.z).x, soldier.gy ?? state.grid.worldToGrid(soldier.x, soldier.z).y); u.repathT = 0.6; }
  } else if (obj) {
    if (!u.path || u.repathT <= 0) { setPathToBuilding(state, u, obj); u.repathT = 0.8; }
  }
  if (u.path) moveStep(state, u, dt);
}

export function updateUnits(state, dt, ctx) {
  for (const u of state.units) {
    u.px = u.x; u.pz = u.z;
    if (u.atkT > 0) u.atkT -= dt;
    if (u.barkT > 0) u.barkT -= dt;
    if (u.repathT === undefined) u.repathT = 0;
    if (u.poisonT > 0) {                              // ☠ ГОЙДО-ЯД
      u.poisonT -= dt; u._poiT = (u._poiT || 0) + dt;
      if (u._poiT >= 1) { u._poiT = 0; u.hp -= (u.poisonDmg || 5); if (u.hp <= 0) { state.killUnit(u); continue; } }
    }
    if (u.stunT > 0) { u.stunT -= dt; u.path = null; continue; }   // ❄ КРИО — стоит
    if (u.faction === 'enemy') updateEnemy(state, u, dt, ctx);
    else if (u.def.worker) updateWorker(state, u, dt, ctx);
    else updateSoldier(state, u, dt, ctx);
  }
}
