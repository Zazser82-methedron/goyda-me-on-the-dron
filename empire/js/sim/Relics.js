// ===== Идолы-реликвии: ауры по радиусу (slow/aoe/heal). Эконом-идолы — через produce. =====
import { damage } from './Units.js?v=94';

function d2(ax, az, bx, bz) { return (ax - bx) ** 2 + (az - bz) ** 2; }

export function update(state, dt, ctx) {
  if (state.gameOver) return;
  for (const b of state.buildings) {
    if (!b.built || !b.def.aura) continue;
    b._auraT = (b._auraT || 0) + dt;
    if (b._auraT < b.def.aura.tick) continue;
    b._auraT = 0;
    apply(state, b, ctx);
  }
}

function apply(state, b, ctx) {
  const a = b.def.aura, r2 = a.radius * a.radius;
  if (a.effect === 'heal') {
    for (const x of state.buildings) if (x.hp < x.maxHp && d2(x.cx, x.cz, b.cx, b.cz) <= r2) x.hp = Math.min(x.maxHp, x.hp + a.power);
    return;
  }
  for (const e of state.enemies()) {
    if (d2(e.x, e.z, b.cx, b.cz) > r2) continue;
    if (a.effect === 'slow') e.slowT = Math.max(e.slowT || 0, a.tick + 0.6);
    else if (a.effect === 'aoe') damage(state, e, a.power, ctx);
  }
}
