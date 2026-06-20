// ===== Движение, бой и ИИ юнитов (свои воины + враги). Воркеры — в Jobs.js =====
import { TILE } from '../data/config.js?v=52';
import { findPath, nearestAdj } from '../world/Pathfinding.js?v=52';
import { updateWorker } from './Jobs.js?v=52';
import { bark } from '../data/barks.js?v=52';

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
  const cur = state.grid.get(u.gx ?? node.x, u.gy ?? node.y);   // текущий тайл
  const roadMul = (cur && cur.road) ? 1.4 : 1;                  // дорога/мост — быстрее
  const step = u.speed * dt * roadMul * (state.krioTimer > 0 && u.faction === 'ours' ? 0.6 : 1) * (state.superTimer > 0 && u.faction === 'ours' ? 1.4 : 1) * (u.slowT > 0 ? 0.5 : 1);
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
  if (ctx.dmgNum) ctx.dmgNum(target, amt);                       // всплывающее число урона
  if (target.type === 'building' && ctx.flash) ctx.flash(target);
  if (target.hp <= 0) {
    if (target.type === 'unit') {
      if (ctx.shake) ctx.shake(target.bossKey ? 0.7 : 0.26);     // тряска на гибели (босс — сильнее)
      if (target.bossKey && ctx.hitStop) ctx.hitStop(0.08);      // hit-pause на смерти босса
      if (target.bossKey && ctx.onBossDown) ctx.onBossDown(target);
      state.killUnit(target);
    } else {
      if (ctx.shake) ctx.shake(0.5);                             // снос здания — заметная тряска
      if (ctx.hitStop) ctx.hitStop(0.05);
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
  let bonus = (state.superTimer > 0 && u.faction === 'ours') ? 1.5 : 1;
  if (u.faction === 'ours' && state.research) bonus *= state.research.dmgMul;   // исследование «СЕЧА»
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

function campInRange(u, camp) { return dist2(u.x, u.z, camp.cx, camp.cz) <= (u.def.range + 1.3) ** 2; }
function nearestCamp(state, u, maxR) {
  let best = null, bd = maxR * maxR;
  for (const c of state.camps) { const d = dist2(u.x, u.z, c.cx, c.cz); if (d < bd) { bd = d; best = c; } }
  return best;
}
function attackCamp(state, u, camp, ctx) {
  if (u.atkT > 0) return;
  u.atkT = u.def.atkCd; u.atkAnim = 0.2;
  camp.hp -= u.dmg * (state.superTimer > 0 ? 1.5 : 1);
  if (ctx.sfx) ctx.sfx('hit');
  if (camp.hp <= 0) { state.removeCamp(camp); state.gain({ gold: 45, faith: 22 }); ctx.toast && ctx.toast('🏴 Стан снесён! +45🪙 +22☩', { gold: true }); }
}

// ---- свои воины: стойки aggro / defend / hold; сносят станы ----
function updateSoldier(state, u, dt, ctx) {
  const stance = u.stance || 'aggro';
  const aggroR = stance === 'aggro' ? 9999 : stance === 'defend' ? 22 : 0;

  // 1) враг по стойке
  const enemy = aggroR > 0 ? nearestEnemyUnit(state, u, aggroR) : null;
  if (enemy) {
    if (inRange(u, enemy)) { faceTarget(u, enemy.x, enemy.z); tryAttack(state, u, enemy, ctx); u.path = null; u.moveOrder = null; return; }
    u.repathT -= dt;
    if (!u.path || u.pi >= u.path.length || u.repathT <= 0) { const eg = state.grid.worldToGrid(enemy.x, enemy.z); setPath(state, u, eg.x, eg.y); u.repathT = 0.45; }
    if (moveStep(state, u, dt) === 'noPath') u.repathT = 0.5;
    return;
  }

  // 2) приказ снести стан (ПКМ по стану)
  if (u.targetCampId) {
    const camp = state.campById(u.targetCampId);
    if (!camp) u.targetCampId = null;
    else {
      if (campInRange(u, camp)) { faceTarget(u, camp.cx, camp.cz); attackCamp(state, u, camp, ctx); u.path = null; }
      else { u.repathT -= dt; if (!u.path || u.repathT <= 0) { setPathToBuilding(state, u, camp); u.repathT = 0.6; } moveStep(state, u, dt); }
      return;
    }
  }

  // 3) приказ идти
  if (u.moveOrder) {
    if (!u.path) { if (!setPath(state, u, u.moveOrder.x, u.moveOrder.y)) { u.moveOrder = null; return; } }
    if (moveStep(state, u, dt) === 'arrived') { u.moveOrder = null; u.path = null; }
    return;
  }

  if (stance === 'hold') { u.path = null; return; }

  // 4) оппортунистично сносим близкий стан (агрессия)
  if (stance === 'aggro') {
    const camp = nearestCamp(state, u, 14);
    if (camp) {
      if (campInRange(u, camp)) { faceTarget(u, camp.cx, camp.cz); attackCamp(state, u, camp, ctx); u.path = null; }
      else { u.repathT -= dt; if (!u.path || u.repathT <= 0) { setPathToBuilding(state, u, camp); u.repathT = 0.7; } moveStep(state, u, dt); }
      return;
    }
  }

  // 5) ралли
  const rally = state.rally || (state.townhall ? { x: state.townhall.cx, z: state.townhall.cz } : null);
  if (rally && dist2(u.x, u.z, rally.x, rally.z) > 49) {
    if (!u.path) { const g = state.grid.worldToGrid(rally.x, rally.z); setPath(state, u, g.x, g.y); }
    if (moveStep(state, u, dt) === 'arrived') u.path = null;
    return;
  }
  u.path = null;
}

function nearestOurUnit(state, u, maxR, workerOnly) {
  let best = null, bd = maxR * maxR;
  for (const e of state.units) {
    if (e.faction !== 'ours' || e.hp <= 0) continue;
    if (workerOnly && !e.def.worker) continue;
    const d = dist2(u.x, u.z, e.x, e.z); if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---- враги (архетипы: обычный / ловкач-flank / верзила-siege / шаман-ranged-kite) ----
function updateEnemy(state, u, dt, ctx) {
  const style = u.def.raidStyle;
  // дальнобойный шаман — стреляет издали, кайтит
  if (u.def.ranged) {
    const t = nearestEnemyUnit(state, u, u.def.range) || nearestOursBuildingInRange(state, u);
    if (t) {
      faceTarget(u, t.x ?? t.cx, t.z ?? t.cz);
      if (u.atkT <= 0) { u.atkT = u.def.atkCd; u.atkAnim = 0.2; if (ctx.tracer) ctx.tracer(u, t); }
      const close = nearestEnemyUnit(state, u, 3);
      if (close) { u.dir = Math.atan2(u.x - close.x, u.z - close.z); u.x += Math.sin(u.dir) * u.speed * dt * 0.6; u.z += Math.cos(u.dir) * u.speed * dt * 0.6; const g = state.grid.worldToGrid(u.x, u.z); u.gx = g.x; u.gy = g.y; }
      u.path = null; return;
    }
  }
  // удар в упор
  const tgtUnit = nearestEnemyUnit(state, u, u.def.range + 0.6);
  if (tgtUnit && inRange(u, tgtUnit)) { faceTarget(u, tgtUnit.x, tgtUnit.z); tryAttack(state, u, tgtUnit, ctx); u.path = null; return; }
  const tgtB = nearestOursBuildingInRange(state, u);
  if (tgtB) { faceTarget(u, tgtB.cx, tgtB.cz); tryAttack(state, u, tgtB, ctx); u.path = null; return; }

  // марш к цели по стилю
  const obj = state.idol || state.townhall;
  let goalUnit = null;
  if (style === 'flank') goalUnit = nearestOurUnit(state, u, 32, true);     // ловкач → добытчики
  else if (style !== 'siege') goalUnit = nearestEnemyUnit(state, u, 6);     // обычные → ближний солдат
  u.repathT -= dt;
  if (goalUnit) { if (!u.path || u.repathT <= 0) { const g = state.grid.worldToGrid(goalUnit.x, goalUnit.z); setPath(state, u, g.x, g.y); u.repathT = 0.6; } }
  else if (obj) { if (!u.path || u.repathT <= 0) { setPathToBuilding(state, u, obj); u.repathT = 0.8; } }
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
    if (u.slowT > 0) u.slowT -= dt;                                // ❄ замедление от КРИО-идола
    if (u.stunT > 0) { u.stunT -= dt; u.path = null; continue; }   // оглушение — стоит
    if (u.faction === 'enemy') updateEnemy(state, u, dt, ctx);
    else if (u.def.worker) updateWorker(state, u, dt, ctx);
    else updateSoldier(state, u, dt, ctx);

    // анти-застревание: нет прогресса при попытке двигаться → репас, потом нудж к свободному тайлу
    const mv = Math.hypot(u.x - u.px, u.z - u.pz);
    if ((u.path && u.pi < u.path.length) || u.moveOrder) {
      if (mv < 0.003) u.stuckT = (u.stuckT || 0) + dt; else u.stuckT = 0;
      if (u.stuckT > 1.3) {
        u.path = null; u.stuckT = 0; u._stuckN = (u._stuckN || 0) + 1;
        if (u._stuckN >= 2) {
          u._stuckN = 0;
          const gx = u.gx ?? state.grid.worldToGrid(u.x, u.z).x, gy = u.gy ?? state.grid.worldToGrid(u.x, u.z).y;
          const adj = nearestAdj(state.grid, gx, gy, 1, 1, gx, gy);
          if (adj) { const w = state.grid.gridToWorld(adj.x, adj.y); u.x = w.wx; u.z = w.wz; }
          if (u.def.worker) u.job = null;
          u.moveOrder = null;
        }
      }
    } else u.stuckT = 0;
  }
}
