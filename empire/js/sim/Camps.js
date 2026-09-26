// ===== Вражьи станы: спавнят набеги, можно сносить =====
import { nearestAdj, floodReachable } from '../world/Pathfinding.js?v=94';
import { UNITS } from '../data/units.js?v=94';
import { spawnBoss } from './Waves.js?v=108';

const SPAWN_EVERY = 32;
const LAIR_SPAWN_EVERY = [0, 56, 46];
const LAIR_BOSS = ['ratnik_fedor', 'voevoda_skuf', 'goyda_batya'];
const RETURN_DAYS = 6;
const RETURN_WARN_DAYS = 1;

function findSpot(g, cx, cy, radius, reach, w = 2, h = 2) {
  for (let r = 0; r <= radius; r++) {
    for (let a = 0; a < 12; a++) {
      const x = cx + Math.round(Math.cos(a / 12 * 6.2832) * r), y = cy + Math.round(Math.sin(a / 12 * 6.2832) * r);
      if (g.canPlace(x, y, w, h) && (!reach || reach.has(y * g.n + x))) return { x, y };
    }
  }
  return null;
}

function campScale(camp, era) {
  const scale = 1 + Math.max(0, era || 0) * 0.15;
  if (camp._hpScale === scale) return;
  const ratio = camp.maxHp ? camp.hp / camp.maxHp : 1;
  camp.maxHp = Math.round((camp.baseHp || 320) * scale);
  camp.hp = Math.max(1, Math.round(camp.maxHp * ratio));
  camp._hpScale = scale;
}

function spawnLair(state, ctx) {
  if (state._lairSpawned || state.era < 1 || !state.townhall) return;
  const g = state.grid, n = g.n, th = state.townhall;
  const reach = state._reach || floodReachable(g, th.gx + (th.w >> 1), th.gy + (th.h >> 1));
  if (reach && !state._reach) state._reach = reach;
  const corners = [[8, 8], [n - 11, 8], [8, n - 11], [n - 11, n - 11]]
    .sort((a, b) => ((b[0] - th.gx) ** 2 + (b[1] - th.gy) ** 2) - ((a[0] - th.gx) ** 2 + (a[1] - th.gy) ** 2));
  for (const [cx, cy] of corners) {
    const spot = findSpot(g, cx, cy, 14, reach, 3, 3);
    if (!spot) continue;
    const lair = state.addCamp(spot.x, spot.y, { w: 3, h: 3, hp: 960, model: 'enemy_lair', lair: true, returnable: false });
    campScale(lair, state.era);
    state._lairSpawned = true;
    ctx.toast && ctx.toast('👑 ЛОГОВО ГОЙДА-БАТИ возникло у дальнего края! 3×3, ' + lair.maxHp + ' HP.', { bad: true, big: true });
    return;
  }
}

function updateReturns(state, ctx) {
  const queue = state._campReturns || (state._campReturns = []);
  for (let i = queue.length - 1; i >= 0; i--) {
    const item = queue[i], left = item.day - state.day;
    if (!item.warned && left <= RETURN_WARN_DAYS) {
      item.warned = true;
      ctx.toast && ctx.toast('⚠️ Орда собирается вернуть лагерь через 1 день.', { bad: true });
    }
    if (left > 0) continue;
    if (!state.grid.canPlace(item.gx, item.gy, item.w, item.h)) { item.day = state.day + 1; item.warned = false; continue; }
    const camp = state.addCamp(item.gx, item.gy, { w: item.w, h: item.h, hp: item.baseHp, returnable: true });
    campScale(camp, state.era);
    queue.splice(i, 1);
    ctx.toast && ctx.toast('🏴 Орда отстроила лагерь на старом месте!', { bad: true, big: true });
  }
}

export function onDestroyed(state, camp, ctx) {
  if (camp.lair) {
    state._lairDestroyed = true;
    state.gain({ gold: 180, faith: 90, gems: 12 });
    ctx.toast && ctx.toast('👑 ЛОГОВО ГОЙДА-БАТИ РАЗРУШЕНО! +180🪙 +90☩ +12💎', { gold: true, big: true });
    return;
  }
  if (!camp.returnable) return;
  const queue = state._campReturns || (state._campReturns = []);
  queue.push({ gx: camp.gx, gy: camp.gy, w: camp.w, h: camp.h, baseHp: camp.baseHp || 320, day: (state.day || 0) + RETURN_DAYS, warned: false });
}

export function spawnCamps(state, count) {
  const g = state.grid, n = g.n;
  // станы — только на суше, связанной с базой (иначе их набеги не дойдут)
  const th = state.townhall;
  const reach = th ? floodReachable(g, th.gx + (th.w >> 1), th.gy + (th.h >> 1)) : null;
  if (reach && !state._reach) state._reach = reach;
  const corners = [[12, 12], [n - 14, 12], [12, n - 14], [n - 14, n - 14], [Math.floor(n / 2), 12], [12, Math.floor(n / 2)]];
  let placed = 0;
  for (const [cx, cy] of corners) {
    if (placed >= count) break;
    const s = findSpot(g, cx, cy, 12, reach);
    if (s) { state.addCamp(s.x, s.y); placed++; }
  }
  if (placed) state._hadCamps = true;
}

export function update(state, dt, ctx) {
  if (state.gameOver) return;
  spawnLair(state, ctx);
  updateReturns(state, ctx);
  const canDefend = state.hasBuilt('kazarma') || state.rankIndex >= 1 || state.soldiers().length > 0;
  for (const camp of state.camps) {
    campScale(camp, state.era);
    camp.spawnT += dt;
    if (!canDefend) continue;
    if (camp.lair) {
      const every = LAIR_SPAWN_EVERY[Math.min(2, Math.max(1, state.era || 1))];
      if (camp.spawnT >= every && state.enemies().length < 68) {
        camp.spawnT = 0;
        const adj = nearestAdj(state.grid, camp.gx, camp.gy, camp.w, camp.h, camp.gx, camp.gy) || { x: camp.gx, y: camp.gy };
        const w = state.grid.gridToWorld(adj.x, adj.y);
        spawnBoss(state, LAIR_BOSS[Math.min(2, state.era || 1)], ctx, { x: w.wx, z: w.wz });
      }
      continue;
    }
    const every = SPAWN_EVERY * (1 - Math.min(2, state.era || 0) * 0.10);
    if (camp.spawnT >= every && state.enemies().length < 68) {
      camp.spawnT = 0;
      const k = ['raider', 'raider_fast', 'raider_heavy'][Math.floor(Math.random() * 3)];
      const def = UNITS[k];
      const adj = nearestAdj(state.grid, camp.gx, camp.gy, 2, 2, camp.gx, camp.gy) || { x: camp.gx, y: camp.gy };
      const w = state.grid.gridToWorld(adj.x, adj.y);
      const hp = Math.round(def.hp * 1.05);
      const u = state.addUnit(k, w.wx, w.wz, { tint: def.tint || 0x401018, hp, maxHp: hp, scale: def.scale || 1 });
      u.speed = def.speed;
    }
  }
  // все станы снесены — награда и ослабление набегов
  if (state._hadCamps && state.camps.length === 0 && !state._campsDone) {
    state._campsDone = true;
    state.gain({ gold: 120, faith: 60 });
    state.nextWaveIn = (state.nextWaveIn || 0) + 60;
    ctx.toast && ctx.toast('🏴 Все вражьи станы снесены! Набеги ослабли. +120🪙 +60☩', { gold: true, big: true });
  }
}
