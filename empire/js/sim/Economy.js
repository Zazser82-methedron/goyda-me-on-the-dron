// ===== Экономика: производство/расход в день, счастье, ВЕРА, таймеры =====
import { SIM_DT, DAY_TICKS } from '../data/config.js?v=11';
import { edictMods } from './Edicts.js?v=11';

const DAY_SECONDS = DAY_TICKS * SIM_DT;   // 8 сек
const FOOD_PER_POP = 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function update(state, dt, ctx) {
  // покадровые таймеры
  state.superTimer = Math.max(0, state.superTimer - dt);
  state.krioTimer = Math.max(0, state.krioTimer - dt);
  state.threatTimer = Math.max(0, state.threatTimer - dt);

  state._dayT = (state._dayT || 0) + dt;
  if (state._dayT >= DAY_SECONDS) { state._dayT -= DAY_SECONDS; onDay(state, ctx); }
}

function onDay(state, ctx) {
  const built = state.buildings.filter(b => b.built);
  let food = 0, gold = 0, faith = 0, happyMod = 0;
  for (const b of built) {
    const p = b.def.produce; if (!p) continue;
    food += p.food || 0; gold += p.gold || 0; faith += p.faith || 0; happyMod += p.happy || 0;
  }
  const em = edictMods(state);
  food += em.food; gold += em.gold; faith += em.faith; happyMod += em.happy;

  const fm = state.faction && state.faction.mods;   // бонусы фракции
  if (fm) { faith *= fm.faithMul || 1; happyMod += fm.happy || 0; }

  state.gain({ food, gold, faith });

  // расход еды
  const cons = state.population * FOOD_PER_POP * em.foodConsMul;
  state.resources.food -= cons;
  let starve = false;
  if (state.resources.food < 0) { starve = true; state.resources.food = 0; }

  // целевое счастье
  const foodBal = food - cons;
  let target = 50;
  target += clamp(foodBal * 3, -20, 20);
  target += Math.min(18, state.resources.faith * 0.08);
  target += Math.min(14, (state.popCap - state.population) * 2);
  target += happyMod;
  if (state.threatTimer > 0) target -= 10;
  if (starve) target -= 28;
  target = clamp(target, 0, 100);
  state.happiness += (target - state.happiness) * 0.34;
  state.happiness = clamp(state.happiness, 0, 100);

  // голод: иногда уходит работник
  if (starve && state.workers().length > 0 && Math.random() < 0.5) {
    const w = state.workers()[0];
    state.removeUnit(w);
    ctx.toast && ctx.toast('☠️ ХОЛОП умер с голоду', { bad: true });
  }

  state.day++;
  if (state.day % 1 === 0) state.save();
  if (ctx.onDay) ctx.onDay(state);
}
