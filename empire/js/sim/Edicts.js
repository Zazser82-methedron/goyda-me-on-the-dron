// ===== Указы (Tropico-слой): тумблеры с трейд-оффами =====
export const EDICTS = [
  { key: 'mob', name: 'ГОЙДА-МОБИЛИЗАЦИЯ', icon: '📯', cost: { faith: 10 },
    mods: { happy: -8, trainMul: 0.7 }, desc: 'Тренировка войск на 30% быстрее, но народ ропщет (−счастье).' },
  { key: 'prazdnik', name: 'ПРАЗДНИК ДРОНА', icon: '🎉', cost: { faith: 8 },
    mods: { happy: 12, gold: -3 }, desc: 'Гуляем! +счастье каждый день, но казна тощает (−3 золота/день).' },
  { key: 'obrok', name: 'ОБРОК', icon: '💰', cost: { faith: 6 },
    mods: { happy: -7, gold: 5 }, desc: 'Жёсткий сбор: +5 золота/день ценой счастья.' },
  { key: 'post', name: 'СТРОГИЙ ПОСТ', icon: '🍲', cost: { faith: 6 },
    mods: { happy: -5, foodConsMul: 0.6 }, desc: 'Народ ест меньше (−40% расхода еды), но недоволен.' },
];

export function edictMods(state) {
  const m = { food: 0, gold: 0, faith: 0, happy: 0, foodConsMul: 1, trainMul: 1 };
  for (const e of EDICTS) {
    if (state.edicts && state.edicts[e.key]) {
      m.food += e.mods.food || 0; m.gold += e.mods.gold || 0; m.faith += e.mods.faith || 0;
      m.happy += e.mods.happy || 0;
      if (e.mods.foodConsMul) m.foodConsMul *= e.mods.foodConsMul;
      if (e.mods.trainMul) m.trainMul *= e.mods.trainMul;
    }
  }
  return m;
}

export function toggleEdict(state, key, ctx) {
  state.edicts = state.edicts || {};
  const e = EDICTS.find(x => x.key === key);
  if (!e) return false;
  if (state.edicts[key]) { state.edicts[key] = false; ctx.toast && ctx.toast('Указ отменён: ' + e.name); return true; }
  if (!state.canAfford(e.cost)) { ctx.toast && ctx.toast('Мало ВЕРЫ на указ', { bad: true }); return false; }
  state.spend(e.cost); state.edicts[key] = true;
  ctx.sfx && ctx.sfx('edict'); ctx.toast && ctx.toast(e.icon + ' Указ введён: ' + e.name);
  return true;
}
