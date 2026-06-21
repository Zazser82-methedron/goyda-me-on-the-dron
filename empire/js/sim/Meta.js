// ===== Мета-прогрессия: «Доблесть» копится между партиями → бонусы старта новой кампании =====
const META_KEY = 'GOYDA_META';

function def() { return { valor: 0, runs: 0, wins: 0, bestDay: 0, bestDepth: 1 }; }
export function load() {
  try { const m = JSON.parse(localStorage.getItem(META_KEY)); if (m) return Object.assign(def(), m); } catch (e) {}
  return def();
}
function save(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {} }

// награда за завершённую партию (win/lose) → прирост Доблести; прожитые дни + глубина Земель + бонус победы
export function award(state, kind) {
  const m = load();
  const day = Math.floor(state.day || 0);
  const depth = state.portalDepth || 1;
  const gain = day + depth * 5 + (kind === 'win' ? 60 : 0);
  m.valor += gain; m.runs += 1;
  if (kind === 'win') m.wins += 1;
  m.bestDay = Math.max(m.bestDay, day);
  m.bestDepth = Math.max(m.bestDepth, depth);
  save(m);
  return { gain, valor: m.valor, m };
}

// бонусы старта по накопленной Доблести (масштаб с потолком) — применяются к свежей кампании
export function startPerks() {
  const v = load().valor;
  return {
    valor: v,
    gold: Math.min(150, Math.floor(v / 20) * 10),   // +10🪙 за каждые 20 Доблести, до +150
    food: Math.min(120, Math.floor(v / 25) * 10),
    freeRatnik: v >= 120,                            // вольный ратник со старта
    freeOprichnik: v >= 400,                         // и опричник на высокой Доблести
    tier: v >= 400 ? 3 : v >= 120 ? 2 : v >= 40 ? 1 : 0,
  };
}
