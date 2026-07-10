// ===== Исследования: покупка технологий, накопление эффектов в state.research =====
import { TECHS } from '../data/tech.js?v=91';
import { BUILDINGS } from '../data/buildings.js?v=91';

export function init() {
  return { done: {}, gatherMul: 1, dmgMul: 1, hpMul: 1, spdMul: 1, popBonus: 0, foodDay: 0, goldDay: 0, faithDay: 0 };
}

export function buy(state, key, ctx) {
  const t = TECHS[key]; if (!t) return false;
  const R = state.research || (state.research = init());
  if (R.done[key]) { ctx.toast && ctx.toast('Уже изучено', { bad: true }); return false; }
  if ((t.rank || 0) > state.rankIndex) { ctx.toast && ctx.toast('Рано для «' + t.name + '» — нужен ранг выше', { bad: true }); return false; }
  if (t.requiresBuilding && !state.hasBuilt(t.requiresBuilding)) { ctx.toast && ctx.toast('Нужна постройка: ' + BUILDINGS[t.requiresBuilding].name, { bad: true }); return false; }
  if (!state.canAfford(t.cost)) { ctx.toast && ctx.toast('Мало ресурсов на «' + t.name + '»', { bad: true }); return false; }
  state.spend(t.cost);
  R.done[key] = true;
  if (t.unlocksBuilding) ctx.toast && ctx.toast('🏗️ Открыто здание: ' + BUILDINGS[t.unlocksBuilding].name, { gold: true });
  const a = t.apply;
  if (a.gatherMul) R.gatherMul += a.gatherMul;
  if (a.dmgMul) R.dmgMul += a.dmgMul;
  if (a.hpMul) R.hpMul += a.hpMul;
  if (a.spdMul) R.spdMul += a.spdMul;
  if (a.popBonus) { R.popBonus += a.popBonus; state.recomputePop(); }
  if (a.foodDay) R.foodDay += a.foodDay;
  if (a.goldDay) R.goldDay += a.goldDay;
  if (a.faithDay) R.faithDay += a.faithDay;
  ctx.sfx && ctx.sfx('rankup');
  ctx.toast && ctx.toast('🔬 Изучено: ' + t.icon + ' ' + t.name, { gold: true });
  return true;
}
