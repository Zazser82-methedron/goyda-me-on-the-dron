// ===== Сословия: политика державы, требования и собрание Вече =====

const IDOLS = ['idol', 'rel_krio', 'rel_giper', 'rel_shipo', 'rel_obereg', 'rel_goydushka', 'rel_zlato', 'rel_fonk', 'rel_vera', 'rel_samotsvet'];

export const ESTATES = {
  oprichnina: { name: 'Опричнина', icon: '⚔️', color: '#e85a4f', likes: ['kazarma', 'zastava_ostrog', 'tower', 'chastokol'], dislikes: ['traktir'], likeEdicts: ['mob'], dislikeEdicts: ['prazdnik'] },
  veche: { name: 'Вече', icon: '🏛️', color: '#e7bb48', likes: ['izba', 'banya', 'traktir', 'veche'], dislikes: ['prikaz_sbora'], likeEdicts: ['prazdnik'], dislikeEdicts: ['obrok', 'post'] },
  church: { name: 'Церковь Дрона', icon: '☩', color: '#9b76e8', likes: ['church', 'observatory', ...IDOLS], dislikes: ['traktir', 'station'], likeEdicts: ['post'], dislikeEdicts: ['prazdnik'] },
  kupcy: { name: 'Купечество', icon: '🪙', color: '#55c99a', likes: ['market', 'tamozhnya', 'station', 'road', 'rail'], dislikes: [], likeEdicts: ['obrok'], dislikeEdicts: ['mob'] },
};

const KEYS = Object.keys(ESTATES);
const DEMAND_EVERY = 6;
const DEMAND_DAYS = 5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function defaults(day) {
  return {
    values: { oprichnina: 50, veche: 50, church: 50, kupcy: 50 },
    requirements: {}, nextDemandDay: (day || 0) + 2, lastDay: day || 0,
    lastVecheDay: day || 0, lastVecheEra: null, agitTarget: null, warnings: {},
  };
}

function dataFor(state) {
  const base = defaults(state.day);
  const data = state.estates || (state.estates = base);
  data.values = Object.assign(base.values, data.values || {});
  data.requirements = data.requirements || {};
  data.warnings = data.warnings || {};
  if (data.nextDemandDay == null) data.nextDemandDay = base.nextDemandDay;
  if (data.lastDay == null) data.lastDay = state.day || 0;
  if (data.lastVecheDay == null) data.lastVecheDay = state.day || 0;
  return data;
}

function built(state, kind) {
  return state.buildings.filter(b => b.built && !b.ruined && b.kind === kind).length;
}

function countKinds(state, kinds) {
  return state.buildings.reduce((n, b) => n + (b.built && !b.ruined && kinds.includes(b.kind) ? 1 : 0), 0);
}

function change(data, key, amount) {
  data.values[key] = clamp((data.values[key] == null ? 50 : data.values[key]) + amount, 0, 100);
}

function lowest(data) {
  return KEYS.reduce((best, key) => data.values[key] < data.values[best] ? key : best, KEYS[0]);
}

const DEMANDS = {
  oprichnina: [
    { text: 'Построй казарму', test: s => built(s, 'kazarma') >= 1 },
    { text: 'Поставь острожную заставу', test: s => built(s, 'zastava_ostrog') >= 1 },
    { text: 'Держи ГОЙДА-мобилизацию', test: s => !!(s.edicts && s.edicts.mob) },
  ],
  veche: [
    { text: 'Поставь ещё 5 изб', test: s => built(s, 'izba') >= 5 },
    { text: 'Построй баню', test: s => built(s, 'banya') >= 1 },
    { text: 'Отмени оброк', test: s => !(s.edicts && s.edicts.obrok) },
  ],
  church: [
    { text: 'Построй кумирню Дрона', test: s => built(s, 'church') >= 1 },
    { text: 'Воздвигни Идол Веры', test: s => built(s, 'rel_vera') >= 1 },
    { text: 'Соблюдай строгий пост 3 дня', days: 3, test: s => !!(s.edicts && s.edicts.post) },
  ],
  kupcy: [
    { text: 'Построй Торг', test: s => built(s, 'market') >= 1 },
    { text: 'Проложи 8 дорог', test: s => built(s, 'road') >= 8 },
    { text: 'Поставь таможню', test: s => built(s, 'tamozhnya') >= 1 },
  ],
};

function addRequirements(state, data, ctx) {
  if ((state.day || 0) < data.nextDemandDay) return;
  for (const key of KEYS) {
    if (data.requirements[key]) continue;
    const list = DEMANDS[key];
    const available = list.filter(item => item.days || !item.test(state));
    const pick = (available.length ? available : list)[Math.floor(Math.random() * (available.length || list.length))];
    data.requirements[key] = { text: pick.text, dueDay: state.day + DEMAND_DAYS, progress: 0, need: pick.days || 1, index: list.indexOf(pick) };
    ctx.toast && ctx.toast(ESTATES[key].icon + ' Требование ' + ESTATES[key].name + ': ' + pick.text, { big: true });
  }
  data.nextDemandDay = state.day + DEMAND_EVERY;
}

function checkRequirements(state, data, ctx) {
  for (const key of KEYS) {
    const req = data.requirements[key];
    if (!req) continue;
    const item = DEMANDS[key][req.index];
    if (item && item.test(state)) req.progress++;
    if (req.progress >= req.need) {
      change(data, key, 12); delete data.requirements[key];
      ctx.toast && ctx.toast('✅ ' + ESTATES[key].name + ': требование исполнено (+12)', { gold: true });
    } else if (state.day >= req.dueDay) {
      change(data, key, -8); delete data.requirements[key];
      ctx.toast && ctx.toast('⚠️ ' + ESTATES[key].name + ': требование провалено (−8)', { bad: true });
    }
  }
}

function updateRelations(state, data) {
  for (const key of KEYS) {
    const e = ESTATES[key];
    const good = countKinds(state, e.likes);
    const bad = countKinds(state, e.dislikes);
    const goodEdicts = e.likeEdicts.reduce((n, k) => n + (state.edicts && state.edicts[k] ? 1 : 0), 0);
    const badEdicts = e.dislikeEdicts.reduce((n, k) => n + (state.edicts && state.edicts[k] ? 1 : 0), 0);
    const value = data.values[key];
    const drift = Math.sqrt(good) * 0.45 - Math.sqrt(bad) * 0.55 + goodEdicts * 1.1 - badEdicts * 1.25;
    data.values[key] = clamp(value + drift + (50 - value) * 0.035, 0, 100);
  }
}

function applyEffects(state, data, ctx) {
  const mods = { goldMul: 1, dmgMul: 1, happy: 0, faith: 0 };
  for (const key of KEYS) {
    const value = data.values[key];
    const poor = value <= 20;
    if (value >= 70) {
      if (key === 'kupcy') mods.goldMul *= 1.15;
      if (key === 'oprichnina') mods.dmgMul *= 1.10;
      if (key === 'veche') mods.happy += 4;
      if (key === 'church') mods.faith += 3;
    } else if (poor) {
      if (key === 'kupcy') mods.goldMul *= 0.90;
      if (key === 'oprichnina') mods.dmgMul *= 0.92;
      if (key === 'veche') mods.happy -= 4;
      if (key === 'church') mods.faith -= 2;
      if (!data.warnings[key]) {
        data.warnings[key] = true;
        ctx.toast && ctx.toast('⚠️ ' + ESTATES[key].icon + ' ' + ESTATES[key].name + ' ропщет — отношение ' + Math.round(value), { bad: true, big: true });
      }
    }
    if (value > 25) data.warnings[key] = false;
  }
  state.estateMods = mods;
}

function callVeche(state, data, ctx) {
  if (!built(state, 'veche')) { data.lastVecheEra = state.era || 0; return; }
  const eraChanged = data.lastVecheEra != null && data.lastVecheEra !== (state.era || 0);
  if (!eraChanged && state.day - data.lastVecheDay < 12) return;
  data.lastVecheDay = state.day;
  data.lastVecheEra = state.era || 0;
  const rivals = {
    oprichnina: ['veche', 'kupcy'], veche: ['oprichnina', 'church'],
    church: ['kupcy', 'veche'], kupcy: ['church', 'oprichnina'],
  };
  const support = key => {
    change(data, key, 20);
    for (const rival of rivals[key]) change(data, rival, -10);
    data.agitTarget = key;
  };
  const event = {
    t: '🏛️ Собрание Вече', m: 'Кому Государь даст слово? Поддержанные получат вес, соперники затаят обиду.',
    choices: KEYS.map(key => ({ lbl: ESTATES[key].icon + ' ' + ESTATES[key].name, msg: 'поддержано ' + ESTATES[key].name, f: () => support(key) })),
  };
  if (ctx.choiceEvent) ctx.choiceEvent(event);
  else event.choices[0].f(state);
}

export function update(state, dt, ctx = {}) {
  const data = dataFor(state);
  const eraChanged = data.lastVecheEra != null && data.lastVecheEra !== (state.era || 0);
  if ((state.day || 0) <= data.lastDay) {
    if (eraChanged && built(state, 'veche')) callVeche(state, data, ctx);
    return;
  }
  data.lastDay = state.day;
  updateRelations(state, data);
  if (built(state, 'agitpunkt')) change(data, data.agitTarget && ESTATES[data.agitTarget] ? data.agitTarget : lowest(data), 1);
  checkRequirements(state, data, ctx);
  addRequirements(state, data, ctx);
  applyEffects(state, data, ctx);
  callVeche(state, data, ctx);
}
