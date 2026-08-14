// ===== Износ, руины и ежедневная работа Избы Плотника =====
import { SIM_DT, DAY_TICKS } from '../data/config.js?v=102';

const DAY_SECONDS = DAY_TICKS * SIM_DT;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function condition(b) {
  const wear = b.wear ?? 100;
  if (wear <= 0) return 'ruins';
  if (wear < 30) return 'critical';
  if (wear < 70) return 'worn';
  return 'sound';
}

export function productionMul(b) {
  const c = condition(b);
  return c === 'ruins' ? 0 : c === 'critical' ? 0.55 : c === 'worn' ? 0.8 : 1;
}

export function repairQuote(b) {
  const lost = clamp(100 - (b.wear ?? 100), 0, 100);
  const cost = {};
  for (const k in b._wearBaseDef.cost || {}) cost[k] = Math.ceil(b._wearBaseDef.cost[k] * 0.6 * lost / 100);
  cost.wood = Math.max(2, cost.wood || 0);
  cost.stone = Math.max(1, cost.stone || 0);
  return { cost, time: Math.ceil(lost / 10), wear: lost };
}

export function ruinQuote(b) {
  const cost = {};
  for (const k in b._wearBaseDef.cost || {}) cost[k] = Math.ceil(b._wearBaseDef.cost[k] * 0.5);
  return { cost, time: b._wearBaseDef.build || 0, wear: 100 };
}

export function apply(state, b) {
  if (b.upgrade === undefined) b.upgrade = null;
  if (b.districtId === undefined) b.districtId = null;
  if (b.disabled === undefined) b.disabled = false;
  if (!b._wearBaseDef) {
    b._wearBaseDef = b.def;
    b.def = { ...b.def, aura: b.def.aura ? { ...b.def.aura } : null };
    b._wearBaseMaxHp = b.maxHp || b.def.hp;
    b._wearBasePop = b.def.pop || 0;
    b._wearBaseAuraPower = b.def.aura && b.def.aura.power;
  }
  b.wear = clamp(b.wear ?? 100, 0, 100);
  const mul = productionMul(b);
  const hpMul = mul === 0 ? 0.65 : mul === 0.55 ? 0.65 : mul === 0.8 ? 0.85 : 1;
  b.ruined = mul === 0;
  b.maxHp = Math.round(b._wearBaseMaxHp * hpMul);
  b.hp = Math.min(b.hp, b.maxHp);
  b.def.pop = b.ruined ? 0 : b._wearBasePop;
  if (b.def.aura) b.def.aura.power = b._wearBaseAuraPower * mul;
  if (b.ruined && !b._wearPathOpen && state.grid) {
    state.grid.occupy(b.gx, b.gy, b.w, b.h, b.id, { walkable: true });
    b._wearPathOpen = true;
  } else if (!b.ruined && b._wearPathOpen && state.grid) {
    const d = b._wearBaseDef;
    state.grid.occupy(b.gx, b.gy, b.w, b.h, b.id, { walkable: !!d.walkable, road: !!d.road, rail: !!d.rail });
    b._wearPathOpen = false;
  }
}

function gridDist2(a, b) {
  const ax = a.gx + a.w * 0.5, ay = a.gy + a.h * 0.5;
  const bx = b.gx + b.w * 0.5, by = b.gy + b.h * 0.5;
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

function maintain(state, b, ctx) {
  const c = b._wearBaseDef.carpenter;
  if (!c || b.ruined) return;
  const targets = state.buildings
    .filter(x => x !== b && x.built && !x.ruined && gridDist2(b, x) <= c.radius ** 2)
    .sort((a, z) => gridDist2(b, a) - gridDist2(b, z)).slice(0, c.targets)
    .filter(x => x.wear < 100).sort((a, z) => a.wear - z.wear);
  if (!targets.length) return;
  if (!state.canAfford(c.upkeep)) {
    ctx.toast && ctx.toast('🪚 Плотнику не хватает 3 дерева и 1 камня', { bad: true });
    return;
  }
  state.spend(c.upkeep);
  targets[0].wear = Math.min(100, targets[0].wear + c.repair);
  apply(state, targets[0]);
}

function onDay(state, ctx) {
  for (const b of state.buildings) {
    if (!b.built) continue;
    apply(state, b);
    const hitPenalty = b._wearDamaged ? 5 : 0;
    b._wearDamaged = false;
    if (b._wearBaseDef.wearRate) b.wear = Math.max(0, b.wear - b._wearBaseDef.wearRate - hitPenalty);
    apply(state, b);
  }
  for (const b of state.buildings) maintain(state, b, ctx);
  if (state.recomputePop) state.recomputePop();
  // TODO(районы): districtId и политики требуют отдельного выбора/маркера, поэтому пока не активируются.
}

export function update(state, dt, ctx) {
  for (const b of state.buildings) {
    if (!b.built) continue;
    const wasRuined = b.ruined;
    apply(state, b);
    if (wasRuined !== b.ruined && state.recomputePop) state.recomputePop();
    if ((b.hp ?? 0) < (b._wearLastHp ?? b.hp)) b._wearDamaged = true;
    b._wearLastHp = b.hp;
  }
  state._wearDayT = (state._wearDayT || 0) + dt;
  while (state._wearDayT >= DAY_SECONDS) {
    state._wearDayT -= DAY_SECONDS;
    onDay(state, ctx);
  }
}
