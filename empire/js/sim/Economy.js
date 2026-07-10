// ===== Экономика: производство/расход в день, счастье, ВЕРА, таймеры =====
import { SIM_DT, DAY_TICKS } from '../data/config.js?v=92';
import { edictMods } from './Edicts.js?v=92';

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
  // суммируем производство по всем ресурсным ключам (включая железо/самоцветы)
  const prod = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0, gems: 0, faith: 0 };
  let happyMod = 0;
  for (const b of built) {
    const p = b.def.produce; if (!p) continue;
    for (const k in p) { if (k === 'happy') happyMod += p.happy; else if (prod[k] !== undefined) prod[k] += p[k]; }
  }
  const em = edictMods(state);
  prod.food += em.food; prod.gold += em.gold; prod.faith += em.faith; happyMod += em.happy;

  const R = state.research;   // бонусы исследований в день
  if (R) { prod.food += R.foodDay; prod.gold += R.goldDay; prod.faith += R.faithDay; }

  const fm = state.faction && state.faction.mods;   // бонусы фракции
  if (fm) { prod.faith *= fm.faithMul || 1; happyMod += fm.happy || 0; }

  const food = prod.food;   // для баланса счастья/голода ниже
  if (prod.gold) prod.gold *= 0.78 + state.happiness / 100 * 0.44;   // довольный народ платит больше податей (0.78..1.22)
  state.gain(prod);

  // расход еды
  const cons = state.population * FOOD_PER_POP * em.foodConsMul;
  state.resources.food -= cons;
  let starve = false;
  if (state.resources.food < 0) { starve = true; state.resources.food = 0; }

  // РЫНОК: торговля излишками — что копится сверх 85% склада, продаём за золото (экономический смысл рынка)
  const markets = built.filter(b => b.kind === 'market' || b.kind === 'traktir').length;
  if (markets > 0) {
    const rate = { wood: 0.25, stone: 0.3, iron: 0.6, gems: 1.2 };
    let earned = 0;
    for (const k in rate) {
      const overflow = (state.resources[k] || 0) - (state.cap[k] || 400) * 0.85;
      if (overflow > 0) { const sell = Math.min(overflow, 20 * markets); state.resources[k] -= sell; earned += sell * rate[k]; }
    }
    if (earned > 0) {
      state.gain({ gold: Math.round(earned) });
      if (earned > 10 && Math.random() < 0.4) ctx.toast && ctx.toast('🛒 Рынок сбыл излишки: +' + Math.round(earned) + '🪙', { gold: true });
    }
  }

  // целевое счастье
  const foodBal = food - cons;
  let target = 50;
  target += clamp(foodBal * 3, -20, 20);
  target += Math.min(18, state.resources.faith * 0.08);
  target += Math.min(14, (state.popCap - state.population) * 2);
  // удобства: церковь/рынок радуют народ (Тропико-слой нужд)
  const amen = state.buildings.reduce((n, b) => n + (b.built && (b.kind === 'church' || b.kind === 'market') ? 1 : 0), 0);
  target += Math.min(12, amen * 3);
  target += happyMod;
  if (state.threatTimer > 0) target -= 10;
  if (starve) target -= 28;
  target = clamp(target, 0, 100);
  state.happiness += (target - state.happiness) * 0.34;
  state.happiness = clamp(state.happiness, 0, 100);

  // последствия счастья: ропот / бегство недовольных / приток веры при высоком духе
  if (state.happiness < 30) {
    if (!state._unrest) { state._unrest = true; ctx.toast && ctx.toast('😠 Народ ропщет! Дайте еды, стройте церковь/рынок', { bad: true, big: true }); }
  } else if (state.happiness > 45) state._unrest = false;
  if (state.happiness < 22 && state.workers().length > 1 && Math.random() < 0.15) {
    state.removeUnit(state.workers()[0]);
    ctx.toast && ctx.toast('🚪 Недовольный холоп сбежал из державы', { bad: true });
  }
  if (state.happiness > 82) state.gain({ faith: 1 });

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
