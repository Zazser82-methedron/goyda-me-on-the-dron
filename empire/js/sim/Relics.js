// ===== Идолы-реликвии: ауры по радиусу (slow/aoe/heal). Эконом-идолы — через produce. =====
import { damage } from './Units.js?v=114';

function d2(ax, az, bx, bz) { return (ax - bx) ** 2 + (az - bz) ** 2; }

// Самоцветы не меняют общий каталог: эффект принадлежит конкретному Гипер-идолу и переживает сейв.
export function auraFor(b) {
  const upg = b.def.gemUpgrade;
  if (!upg || b.upg !== upg.key) return b.def.aura;
  const basePower = b._wearBaseAuraPower || b.def.aura.power || 1;
  const wearMul = (b.def.aura.power || 0) / basePower;
  return { ...upg.aura, power: upg.aura.power * wearMul };
}

export function update(state, dt, ctx) {
  if (state.gameOver) return;
  for (const b of state.buildings) {
    if (!b.built || !b.def.aura) continue;
    const aura = auraFor(b);
    if (b._ring) b._ring.scale.setScalar(aura.radius / b.def.aura.radius);
    b._auraT = (b._auraT || 0) + dt;
    if (b._auraT < aura.tick) continue;
    b._auraT = 0;
    apply(state, b, aura, ctx);
  }
}

function apply(state, b, a, ctx) {
  const r2 = a.radius * a.radius;
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
