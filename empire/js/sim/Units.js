// ===== Движение, бой и ИИ юнитов (свои воины + враги). Воркеры — в Jobs.js =====
import { TILE, GRID_N } from '../data/config.js?v=94';
import { findPath, nearestAdj } from '../world/Pathfinding.js?v=94';
import { updateWorker } from './Jobs.js?v=94';
import { bark } from '../data/barks.js?v=94';
import { SpatialHash } from './SpatialHash.js?v=94';

export function tileCenter(state, tx, ty) { const w = state.grid.gridToWorld(tx, ty); return { x: w.wx, z: w.wz }; }
function dist2(ax, az, bx, bz) { return (ax - bx) ** 2 + (az - bz) ** 2; }
function bRadius(b) { return Math.max(b.w, b.h) * 0.5 * TILE + 0.3; }

// ---- пространственный индекс: убирает O(N²) полных сканов state.units/state.buildings ----
// Размер ячейки 8 ≈ 1.14× максимальной дальности атаки/агро среди юнитов (ШАМАН-ГОЙДЫ range=7.0,
// data/units.js) — типовой поиск (атака, кайт, ближний бой) укладывается в 3×3 ячейки; более
// редкие дальние запросы (стойка defend r=22, фланг r=32, aggro r=9999) сами расширяются кольцами
// в queryNearest — тоже на порядки дешевле полного скана. Границы — вся карта + запас на джиттер.
const HASH_CELL = 8;
const WORLD_HALF = GRID_N / 2 * TILE + 4;
const unitsHash = new SpatialHash(HASH_CELL, -WORLD_HALF, WORLD_HALF);
const buildingsHash = new SpatialHash(HASH_CELL, -WORLD_HALF, WORLD_HALF);
let buildingsMaxBR = 0.3;   // max bRadius() среди текущих зданий — верхняя граница поиска для nearestOursBuildingInRange
const getUX = u => u.x, getUZ = u => u.z;
const getBX = b => b.cx, getBZ = b => b.cz;

// ---- time-slicing ИИ-решений: не в бою — цель/поведение пересчитываются не каждый тик ----
// Период 3 тика × SIM_DT(0.1с) = до 0.3с задержки реакции для юнита БЕЗ цели в упор — незаметно
// глазом, зато режет спрос на широкие queryNearest (aggro r=9999, фланг r=32) в разы на простое.
// Фаза берётся из u.id (уникален и стабилен на весь жизненный цикл юнита) — юниты равномерно
// размазаны по тикам периода, а не все разом "просыпаются" на одном кадре (без пиковой нагрузки).
// state.tickCount нет (счётчик тиков живёт в engine/Loop.js у самого Loop, не в GameState) —
// поэтому считаем локально, инкремент раз за вызов updateUnits (= ровно раз за тик симуляции).
const AI_THINK_PERIOD = 3;
let aiTick = 0;

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

// ветеранство своих воинов: за убийства растёт ранг (★) — +урон/+HP/подлечка, видимо крупнее
const VET_KILLS = [3, 8, 16];                                    // пороги до ранга 1/2/3
function promoteVeteran(state, u, ctx) {
  u.kills = (u.kills || 0) + 1;
  const lvl = u.vet || 0;
  if (lvl < 3 && u.kills >= VET_KILLS[lvl]) {
    u.vet = lvl + 1;
    if (lvl === 0 && state.stats) state.stats.vets++;            // новый ветеран — в сводку
    u.maxHp = Math.round((u.maxHp || u.def.hp || u.hp) * 1.12);  // +12% макс HP за ранг
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.35);             // подлечить наградой
    u._vetApplied = false;                                       // render обновит масштаб-маркер
    if (ctx.float) ctx.float(u.x, u.z, '⭐ ВЕТЕРАН ' + '★'.repeat(u.vet), '#ffe08a');
    if (ctx.sfx) ctx.sfx('rankup');
  }
}

// Награда за карточную экспедицию: опыт получает небольшая группа наименее
// закалённых воинов, поэтому портал помогает растить дружину, а не только склад.
export function awardExpeditionValor(state, steps, ctx) {
  steps = Math.max(0, Math.min(3, Math.round(steps || 0)));
  if (!steps) return [];
  const fighters = state.units
    .filter(u => u.faction === 'ours' && u.def && u.def.atk > 0)
    .sort((a, b) => ((a.vet || 0) - (b.vet || 0)) || ((a.kills || 0) - (b.kills || 0)))
    .slice(0, 3);
  for (const u of fighters) for (let i = 0; i < steps; i++) promoteVeteran(state, u, ctx || {});
  return fighters;
}

// урон сущности (юнит/здание). true если уничтожена. attacker — кто бьёт (для ветеранства).
export function damage(state, target, amt, ctx, attacker) {
  if (!target || target.hp <= 0) return true;
  target.hp -= amt;
  if (ctx.dmgNum) ctx.dmgNum(target, amt);                       // всплывающее число урона
  if (target.type === 'building' && ctx.flash) ctx.flash(target);
  if (target.hp <= 0) {
    if (target.type === 'unit') {
      if (attacker && attacker.faction === 'ours' && target.faction === 'enemy') { promoteVeteran(state, attacker, ctx); if (state.stats) state.stats.slain++; }
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
  if (u.vet) bonus *= 1 + 0.13 * u.vet;                                         // бонус ветерана (+13%/ранг)
  const dmg = u.dmg * bonus;
  if (u.def.ranged && ctx.tracer) {              // дальний бой: летит стрела, урон по прилёту
    ctx.tracer(u, target, { dmg, arrow: true, speed: 24, owner: u, color: u.faction === 'ours' ? 0xffe08a : 0xff5cf0 });
    if (ctx.sfx) ctx.sfx(u.faction === 'ours' ? 'bow' : 'hitEnemy');
    if (u.barkT <= 0 && Math.random() < 0.25) { ctx.bark && ctx.bark(u, bark('attack')); u.barkT = 3; }
    return;
  }
  damage(state, target, dmg, ctx, u);
  if (ctx.sfx) ctx.sfx(u.faction === 'ours' ? 'hit' : 'hitEnemy');
  if (u.barkT <= 0 && Math.random() < 0.25) { ctx.bark && ctx.bark(u, bark('attack')); u.barkT = 3; }
}

function inRange(u, target) {
  if (target.type === 'unit') return dist2(u.x, u.z, target.x, target.z) <= (u.def.range + 0.3) ** 2;
  return dist2(u.x, u.z, target.cx, target.cz) <= (u.def.range + bRadius(target)) ** 2;
}

// ближайший враждебный юнит в радиусе maxR (та же семантика, что и старый линейный скан:
// строгое сравнение d<bd, поэтому при точном совпадении дистанций побеждает найденный раньше)
function nearestEnemyUnit(state, u, maxR) {
  return unitsHash.queryNearest(u.x, u.z, maxR, (e) => e.faction !== u.faction && e.hp > 0);
}

// ближайшая своя постройка/стена в пределах досягаемости врага. Порог зависит от размера самого
// здания (bRadius), поэтому границу поиска в хэше берём с запасом (buildingsMaxBR — максимум по
// всем текущим зданиям), а точный критерий d²<=reach(b) проверяем в фильтре для каждого кандидата.
function nearestOursBuildingInRange(state, u) {
  const searchR = u.def.range + buildingsMaxBR;
  return buildingsHash.queryNearest(u.x, u.z, searchR, (b, d2) => b.hp > 0 && d2 <= (u.def.range + bRadius(b)) ** 2);
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
  if (camp.hp <= 0) { state.removeCamp(camp); if (state.stats) state.stats.camps++; state.gain({ gold: 45, faith: 22 }); ctx.toast && ctx.toast('🏴 Стан снесён! +45🪙 +22☩', { gold: true }); }
}

// ---- свои воины: стойки aggro / defend / hold; сносят станы ----
// canThink: разрешён ли в этот тик широкий поиск новой цели (троттлится вне боя, см. AI_THINK_PERIOD)
function updateSoldier(state, u, dt, ctx, canThink) {
  const stance = u.stance || 'aggro';
  const aggroR = stance === 'aggro' ? 9999 : stance === 'defend' ? 22 : 0;

  // 1) враг по стойке — поиск (широкий, вплоть до всей карты на aggro) троттлится вне боя;
  // если враг уже найден — u._aiActive держит юнит на full rate, пока враг не потерян/не убит
  if (aggroR > 0 && canThink) {
    const enemy = nearestEnemyUnit(state, u, aggroR);
    u._aiActive = !!enemy;
    if (enemy) {
      if (inRange(u, enemy)) { faceTarget(u, enemy.x, enemy.z); tryAttack(state, u, enemy, ctx); u.path = null; u.moveOrder = null; return; }
      u.repathT -= dt;
      if (!u.path || u.pi >= u.path.length || u.repathT <= 0) { const eg = state.grid.worldToGrid(enemy.x, enemy.z); setPath(state, u, eg.x, eg.y); u.repathT = 0.45; }
      if (moveStep(state, u, dt) === 'noPath') u.repathT = 0.5;
      return;
    }
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

  // 4) оппортунистично сносим близкий стан (агрессия) — тоже троттлится вне боя
  if (stance === 'aggro' && canThink) {
    const camp = nearestCamp(state, u, 14);
    if (camp) {
      u._aiActive = true;
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
  return unitsHash.queryNearest(u.x, u.z, maxR, (e) => e.faction === 'ours' && e.hp > 0 && (!workerOnly || e.def.worker));
}

// ---- враги (архетипы: обычный / ловкач-flank / верзила-siege / шаман-ranged-kite) ----
// canThink: разрешён ли в этот тик пересчёт цели/поведения (троттлится, пока враг не в бою вплотную,
// см. AI_THINK_PERIOD); движение по уже выбранному пути идёт в любом случае, каждый тик
function updateEnemy(state, u, dt, ctx, canThink) {
  if (!canThink) {                          // не наш тик решения и не в бою — просто доходим по старому пути
    u.repathT -= dt;
    if (u.path) moveStep(state, u, dt);
    return;
  }
  const style = u.def.raidStyle;
  // дальнобойный шаман — стреляет издали, кайтит
  if (u.def.ranged) {
    const t = nearestEnemyUnit(state, u, u.def.range) || nearestOursBuildingInRange(state, u);
    if (t) {
      u._aiActive = true;
      faceTarget(u, t.x ?? t.cx, t.z ?? t.cz);
      if (u.atkT <= 0) { u.atkT = u.def.atkCd; u.atkAnim = 0.2; if (ctx.tracer) ctx.tracer(u, t); }
      const close = nearestEnemyUnit(state, u, 3);
      if (close) { u.dir = Math.atan2(u.x - close.x, u.z - close.z); u.x += Math.sin(u.dir) * u.speed * dt * 0.6; u.z += Math.cos(u.dir) * u.speed * dt * 0.6; const g = state.grid.worldToGrid(u.x, u.z); u.gx = g.x; u.gy = g.y; }
      u.path = null; return;
    }
  }
  // удар в упор
  const tgtUnit = nearestEnemyUnit(state, u, u.def.range + 0.6);
  if (tgtUnit && inRange(u, tgtUnit)) { u._aiActive = true; faceTarget(u, tgtUnit.x, tgtUnit.z); tryAttack(state, u, tgtUnit, ctx); u.path = null; return; }
  const tgtB = nearestOursBuildingInRange(state, u);
  if (tgtB) { u._aiActive = true; faceTarget(u, tgtB.cx, tgtB.cz); tryAttack(state, u, tgtB, ctx); u.path = null; return; }
  u._aiActive = false;                      // нет цели в упор — дальше можно троттлить

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
  // индекс перестраивается раз за тик (не на каждый запрос) — юниты и здания раздельно, здания
  // меняются редко, но перестройка на ~100 зданий на порядки дешевле полного скана на каждый запрос
  unitsHash.rebuild(state.units, getUX, getUZ);
  buildingsHash.rebuild(state.buildings, getBX, getBZ);
  buildingsMaxBR = 0.3;
  for (const b of state.buildings) { const r = bRadius(b); if (r > buildingsMaxBR) buildingsMaxBR = r; }
  aiTick++;   // ровно раз за тик симуляции — база для распределения ИИ-решений по кадрам

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
    // юнит уже в бою (u._aiActive с прошлого тика) — full rate; иначе троттлим по фазе от u.id
    // (u.id стабилен и уникален на весь жизненный цикл юнита — фазы размазаны без пиковой нагрузки)
    const canThink = u._aiActive || (u.id + aiTick) % AI_THINK_PERIOD === 0;
    if (u.faction === 'enemy') updateEnemy(state, u, dt, ctx, canThink);
    else if (u.def.worker) updateWorker(state, u, dt, ctx);
    else updateSoldier(state, u, dt, ctx, canThink);

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
