// ===== Вражьи станы: спавнят набеги, можно сносить =====
import { nearestAdj, floodReachable } from '../world/Pathfinding.js?v=82';
import { UNITS } from '../data/units.js?v=82';

const SPAWN_EVERY = 32;

function findSpot(g, cx, cy, radius, reach) {
  for (let r = 0; r <= radius; r++) {
    for (let a = 0; a < 12; a++) {
      const x = cx + Math.round(Math.cos(a / 12 * 6.2832) * r), y = cy + Math.round(Math.sin(a / 12 * 6.2832) * r);
      if (g.canPlace(x, y, 2, 2) && (!reach || reach.has(y * g.n + x))) return { x, y };
    }
  }
  return null;
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
  const canDefend = state.hasBuilt('kazarma') || state.rankIndex >= 1 || state.soldiers().length > 0;
  for (const camp of state.camps) {
    camp.spawnT += dt;
    if (!canDefend) continue;
    if (camp.spawnT >= SPAWN_EVERY && state.enemies().length < 68) {
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
