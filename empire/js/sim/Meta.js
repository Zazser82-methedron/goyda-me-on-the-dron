// ===== Мета-прогрессия: «Доблесть» копится между партиями и тратится в Палате Доблести на разблокировки =====
const META_KEY = 'GOYDA_META';

function def() { return { valor: 0, runs: 0, wins: 0, bestDay: 0, bestDepth: 1, unlocks: [] }; }
export function load() {
  try { const m = JSON.parse(localStorage.getItem(META_KEY)); if (m) { const d = Object.assign(def(), m); if (!Array.isArray(d.unlocks)) d.unlocks = []; return d; } } catch (e) {}
  return def();
}
function save(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {} }

// награда за завершённую партию (win/lose) → прирост Доблести; прожитые дни + глубина Земель + бонус победы
export function award(state, kind) {
  const m = load();
  const day = Math.floor(state.day || 0);
  const depth = state.portalDepth || 1;
  const gain = Math.round((day + depth * 5 + (kind === 'win' ? 60 : 0)) * (state.mutValor || 1));   // мутаторы множат награду
  m.valor += gain; m.runs += 1;
  if (kind === 'win') m.wins += 1;
  m.bestDay = Math.max(m.bestDay, day);
  m.bestDepth = Math.max(m.bestDepth, depth);
  save(m);
  return { gain, valor: m.valor, m };
}

// Палата Доблести: постоянные разблокировки (покупаются раз, применяются к каждой свежей кампании)
export const SHOP = [
  { id: 'richStart', name: 'Запасливый старт', ic: '📦', cost: 60, desc: '+80🪙 и +60🍖 в начале' },
  { id: 'extraHolops', name: 'Лишние руки', ic: '🧑‍🌾', cost: 90, desc: '+2 холопа в начале' },
  { id: 'freeRatnik', name: 'Вольный ратник', ic: '🗡️', cost: 120, desc: 'Ратник со старта' },
  { id: 'warChest', name: 'Военная казна', ic: '💰', cost: 200, desc: '+120🪙 в начале' },
  { id: 'freeOprichnik', name: 'Вольный опричник', ic: '🛡️', cost: 320, desc: 'Опричник со старта' },
];

export function owned(id) { return load().unlocks.includes(id); }

// прямое начисление Доблести (достижения и пр.)
export function addValor(n) { const m = load(); m.valor += (n || 0); save(m); return m.valor; }

export function buy(id) {
  const m = load(); const item = SHOP.find(s => s.id === id);
  if (!item) return { ok: false, reason: 'no-item' };
  if (m.unlocks.includes(id)) return { ok: false, reason: 'owned' };
  if (m.valor < item.cost) return { ok: false, reason: 'poor' };
  m.valor -= item.cost; m.unlocks.push(id); save(m);
  return { ok: true, valor: m.valor, m };
}

// бонусы старта — по КУПЛЕННЫМ разблокировкам (применяются к свежей кампании)
export function startPerks() {
  const u = load().unlocks;
  return {
    gold: (u.includes('richStart') ? 80 : 0) + (u.includes('warChest') ? 120 : 0),
    food: u.includes('richStart') ? 60 : 0,
    holops: u.includes('extraHolops') ? 2 : 0,
    freeRatnik: u.includes('freeRatnik'),
    freeOprichnik: u.includes('freeOprichnik'),
    any: u.length > 0,
  };
}

// ===== Мутаторы: добровольные испытания — партия тяжелее, но Доблести больше =====
const MUT_KEY = 'GOYDA_MUTATORS';
export const MUTATORS = [
  { id: 'swarm', name: 'Орда', ic: '👹', desc: 'Набеги многочисленнее (×1.5)', count: 1.5, valor: 1.4 },
  { id: 'titans', name: 'Титаны', ic: '🗿', desc: 'Враги живучее (+35% HP)', hp: 1.35, valor: 1.4 },
  { id: 'scarcity', name: 'Скудная земля', ic: '🏜️', desc: 'Скудный старт (−40🍖 −50🪵)', food: -40, wood: -50, valor: 1.3 },
  { id: 'blitz', name: 'Блиц', ic: '⚡', desc: 'Набеги злее (×1.3 число, +20% HP)', count: 1.3, hp: 1.2, valor: 1.6 },
];
export function getMutators() { try { const a = JSON.parse(localStorage.getItem(MUT_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
export function toggleMutator(id) {
  let a = getMutators();
  a = a.includes(id) ? a.filter(x => x !== id) : a.concat(id);
  try { localStorage.setItem(MUT_KEY, JSON.stringify(a)); } catch (e) {}
  return a;
}
// агрегированные эффекты активных мутаторов (множители боя + дельты старта + множитель Доблести)
export function mutatorEffects() {
  const on = getMutators();
  let count = 1, hp = 1, valor = 1, food = 0, wood = 0;
  for (const m of MUTATORS) if (on.includes(m.id)) { count *= m.count || 1; hp *= m.hp || 1; valor *= m.valor || 1; food += m.food || 0; wood += m.wood || 0; }
  return { count, hp, valor, food, wood, active: on };
}
