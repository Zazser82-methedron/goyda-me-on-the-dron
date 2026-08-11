// ===== Чрезвычайные меры: эдикты выживания и милость Идола Дрона =====
import { SIM_DT, DAY_TICKS } from '../data/config.js?v=94';

const DAY_SECONDS = DAY_TICKS * SIM_DT;
const MOBILIZATION = { count: 2, cost: { food: 30, gold: 20 }, happy: 8, cooldown: 4 * DAY_SECONDS, life: 90 };
const GRANARIES = { food: 50, debt: 25, happy: 8, penalty: 2 * DAY_SECONDS, cooldown: 3 * DAY_SECONDS };
const MERCY = { food: 60, faith: 25, foodDay: 8, foodConsMul: 0.5, goldMul: 0.5, duration: 2 * DAY_SECONDS, cooldown: 8 * DAY_SECONDS };

function data(state) {
  return state._antiSpiral || (state._antiSpiral = { mobilizationCd: 0, granariesCd: 0, granaryDebt: 0, granaryPenalty: 0, mercyCd: 0, mercyTimer: 0 });
}

function say(ctx, text, opts) { if (ctx.toast) ctx.toast(text, opts); }

// Мобилизация двух холопов в ратников: false при нехватке цены, людей или кулдауне.
export function mobilize(state, ctx = {}) {
  const d = data(state), workers = state.workers();
  if (d.mobilizationCd > 0) { say(ctx, '📯 Мобилизация ещё не готова', { bad: true }); return false; }
  if (workers.length < MOBILIZATION.count) { say(ctx, '📯 Для мобилизации нужны 2 холопа', { bad: true }); return false; }
  if (!state.canAfford(MOBILIZATION.cost)) { say(ctx, '📯 Нужно 30 еды и 20 золота', { bad: true }); return false; }
  const call = workers.slice(0, MOBILIZATION.count).map(w => ({ x: w.x, z: w.z }));
  state.spend(MOBILIZATION.cost);
  for (const w of workers.slice(0, MOBILIZATION.count)) state.removeUnit(w);
  for (const p of call) {
    const u = state.addUnit('ratnik', p.x, p.z, { hp: 40, maxHp: 80 });
    u._antiSpiralDespawn = MOBILIZATION.life;
  }
  state.happiness = Math.max(0, state.happiness - MOBILIZATION.happy);
  d.mobilizationCd = MOBILIZATION.cooldown;
  if (ctx.sfx) ctx.sfx('edict');
  say(ctx, '📯 Мобилизация: 2 холопа встали в ополчение на 90 секунд', { gold: true });
  return true;
}

// Закрома выдают еду сейчас, а 25 золота удерживаются из будущих налогов.
export function openGranaries(state, ctx = {}) {
  const d = data(state);
  if (d.granariesCd > 0 || d.granaryDebt > 0) { say(ctx, '🥖 Закрома ещё не рассчитались с казной', { bad: true }); return false; }
  state.gain({ food: GRANARIES.food });
  state.happiness = Math.max(0, state.happiness - GRANARIES.happy);
  d.granaryDebt = GRANARIES.debt;
  d.granaryPenalty = GRANARIES.penalty;
  d.granariesCd = GRANARIES.cooldown;
  if (ctx.sfx) ctx.sfx('edict');
  say(ctx, '🥖 Закрома открыты: +50 еды, казна заберёт 25 золота из будущих налогов', { gold: true });
  return true;
}

export function productionMods(state) {
  const d = data(state), mercy = d.mercyTimer > 0;
  return {
    food: mercy ? MERCY.foodDay : 0,
    happy: d.granaryPenalty > 0 ? -GRANARIES.happy : 0,
    foodConsMul: mercy ? MERCY.foodConsMul : 1,
    goldMul: mercy ? MERCY.goldMul : 1,
  };
}

export function applyTaxDebt(state, gold) {
  const d = data(state), paid = Math.min(d.granaryDebt, Math.max(0, gold));
  d.granaryDebt -= paid;
  return gold - paid;
}

function grantMercy(state, ctx, d) {
  state.gain({ food: MERCY.food, faith: MERCY.faith });
  d.mercyTimer = MERCY.duration;
  d.mercyCd = MERCY.cooldown;
  say(ctx, '🗿 Милость Идола Дрона: +60 еды, +25 веры; два дня народ ест вдвое меньше', { gold: true, big: true });
}

// Покадровый таймер и единоразовый автотриггер при населении ниже четверти лимита.
export function update(state, dt, ctx = {}) {
  const d = data(state);
  for (const k of ['mobilizationCd', 'granariesCd', 'granaryPenalty', 'mercyCd', 'mercyTimer']) d[k] = Math.max(0, d[k] - dt);
  for (const u of [...state.units]) {
    if (!u._antiSpiralDespawn) continue;
    u._antiSpiralDespawn -= dt;
    if (u._antiSpiralDespawn <= 0) state.removeUnit(u);
  }
  if (d.mercyCd <= 0 && state.popCap > 0 && state.population > 0 && state.population < state.popCap * 0.25) grantMercy(state, ctx, d);
}
