// ===== Набеги (Fortnite-слой): волны врагов + именованные боссы =====
import { UNITS } from '../data/units.js?v=50';
import { BOSSES } from '../data/bosses.js?v=50';
import { bark } from '../data/barks.js?v=50';
import { hostileFor } from '../data/factions.js?v=50';
import { floodReachable } from '../world/Pathfinding.js?v=50';

const MAX_ENEMIES = 56;   // мягкий потолок: меньше тормозов в лейте, угроза сохраняется

// связная с базой суша (кэш) — спавним только там, откуда реально можно дойти до ратуши
export function reachSet(state) {
  if (state._reach) return state._reach;
  const th = state.townhall; if (!th) return null;
  state._reach = floodReachable(state.grid, th.gx + (th.w >> 1), th.gy + (th.h >> 1));
  return state._reach;
}

export function update(state, dt, ctx) {
  if (state.gameOver || !state.townhall) return;
  // Набеги начинаются ТОЛЬКО когда игроку есть чем обороняться:
  // построена казарма, ИЛИ достигнут РАТНИК, ИЛИ уже есть воины.
  const canDefend = state.hasBuilt('kazarma') || state.rankIndex >= 1 || state.soldiers().length > 0;
  if (!canDefend) { state.nextWaveIn = undefined; return; }

  if (state.nextWaveIn === undefined) {
    state.nextWaveIn = 28;   // мирная фора после готовности к обороне
    ctx.toast && ctx.toast('🕊️ Скоро придут набеги — ставь ЧАСТОКОЛ и куй дружину.');
  }

  state.nextWaveIn -= dt;
  if (!state._warned && state.nextWaveIn <= 6 && state.nextWaveIn > 0) {
    state._warned = true; state.threatTimer = 6;
    ctx.sfx && ctx.sfx('raid');
    ctx.toast && ctx.toast('⚠️ НАБЕГ через ' + Math.ceil(state.nextWaveIn) + 'с! К стенам!', { bad: true });
  }
  if (state.nextWaveIn <= 0) {
    spawnWave(state, ctx);
    state.waveNum = (state.waveNum || 0) + 1;
    state._warned = false;
    // волны реже и плавнее — игра дольше и спокойнее
    state.nextWaveIn = Math.max(38, 85 - state.rankIndex * 3 - state.waveNum * 0.3);
  }
}

// первая клетка от края внутрь, которая ПРОХОДИМА и СВЯЗАНА с базой (не остров за водой)
function landFromEdge(state, edge, t, reach) {
  const g = state.grid, n = g.n;
  let gx, gy, dx = 0, dy = 0;
  if (edge === 0) { gx = t; gy = 0; dy = 1; }
  else if (edge === 1) { gx = t; gy = n - 1; dy = -1; }
  else if (edge === 2) { gx = 0; gy = t; dx = 1; }
  else { gx = n - 1; gy = t; dx = -1; }
  for (let step = 0; step < n; step++) {
    const tile = g.get(gx, gy);
    if (tile && tile.walkable && (!reach || reach.has(gy * n + gx))) { const w = g.gridToWorld(gx, gy); return { x: w.wx, z: w.wz }; }
    gx += dx; gy += dy;
    if (!g.inBounds(gx, gy)) break;
  }
  return null;
}

function edgePoints(state, count) {
  const res = [];
  const reach = reachSet(state);
  let guard = 0;
  while (res.length < count && guard < count * 14) {
    guard++;
    const p = landFromEdge(state, Math.floor(Math.random() * 4), Math.floor(Math.random() * state.grid.n), reach);
    if (p) res.push({ x: p.x + (Math.random() - 0.5) * 0.4, z: p.z + (Math.random() - 0.5) * 0.4 });
  }
  if (!res.length) {   // запас: тайл рядом с ратушей (точно достижим)
    const th = state.townhall, c = th ? state.grid.gridToWorld(th.gx, th.gy - 2) : state.grid.gridToWorld(3, 3);
    res.push({ x: c.wx, z: c.wz });
  }
  return res;
}

function pickRaider(rank) {
  const r = Math.random();
  if (rank >= 2 && r < 0.14) return 'raider_shaman';
  if (rank >= 1 && r < 0.36) return 'raider_heavy';
  if (r < 0.6) return 'raider_fast';
  return 'raider';
}

function spawnWave(state, ctx) {
  if (state.enemies().length > MAX_ENEMIES) { state.nextWaveIn = 12; return; }
  const count = 2 + state.rankIndex + Math.floor((state.waveNum || 0) / 2);
  const hf = hostileFor(state);
  for (const p of edgePoints(state, count)) {
    const kind = pickRaider(state.rankIndex);
    const def = UNITS[kind];
    const hp = Math.round(def.hp * hf.raid.hpMul);
    const u = state.addUnit(kind, p.x, p.z, { tint: def.tint || hf.raid.tint, hp, maxHp: hp, scale: def.scale || 1 });
    u.speed = def.speed * hf.raid.speedMul;
  }
  if (hf.raid.krio) state.krioTimer = Math.max(state.krioTimer, 8);
  state.threatTimer = 8;
  ctx.sfx && ctx.sfx('raid');
  ctx.toast && ctx.toast('🚨 НАБЕГ ' + hf.emoji + ' ' + hf.name + ' #' + ((state.waveNum || 0) + 1) + '! ' + bark('raid'), { bad: true });
}

export function spawnBoss(state, key, ctx) {
  const b = BOSSES[key]; if (!b || state.gameOver) return;
  const pts = edgePoints(state, 1 + (b.escort || 0));
  const hp = Math.round(UNITS.boss.hp * b.hpMul);
  const boss = state.addUnit('boss', pts[0].x, pts[0].z, { tint: b.tint, hp, maxHp: hp, bossKey: key });
  boss.dmg = Math.round(UNITS.boss.dmg * b.dmgMul);
  boss.bossName = b.name; boss.emoji = b.emoji;
  for (let i = 1; i < pts.length; i++) state.addUnit('raider', pts[i].x, pts[i].z, {});
  if (b.mech === 'krio') { state.krioTimer = 22; ctx.toast && ctx.toast('❄️ ХЛАД ГОЙДЫ: добыча замедлена!', { bad: true }); }
  state.threatTimer = 14;
  ctx.sfx && ctx.sfx('boss');
  ctx.toast && ctx.toast(b.emoji + ' ' + b.name + ': «' + b.taunt + '»', { bad: true, big: true });
}
