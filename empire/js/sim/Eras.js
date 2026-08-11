// ===== Три эпохи: state.era (0/1/2, числовой индекс — как rankIndex) =====
// Переход НЕ по очкам, а по условиям «3 из 5» (см. PHASE2_DESIGN_SPEC.md §1).
// Открывает новые постройки через поле era на BUILDINGS[kind] (гейт — в Buildings.placeBuilding).
import { apply as applyWear } from './Wear.js?v=1';

export const ERA_NAMES = ['Вольная слобода', 'Уездная держава', 'Гойда-индустрия'];
const NEED = 3;   // «3 из 5» условий на переход — как в спеке

function builtKindCount(state, kinds) {
  return state.buildings.reduce((n, b) => n + (b.built && !b.ruined && kinds.includes(b.kind) ? 1 : 0), 0);
}
function metCount(conds) { return conds.reduce((n, c) => n + (c ? 1 : 0), 0); }

// Условия I → II: население 14 · 2 фермы/амбара суммарно · 1 казарма · 40 золота · пережит 1 набег.
// TODO(набеги): «пережит N» аппроксимирован через state.waveNum (волны НАЧАТЫЕ Waves.js, не обязательно
// отбитые победно) — честного счётчика «успешных» набегов сейчас нет, а Waves.js вне моей зоны правок
// в этом заходе. Приближение приемлемо: волна засчитывается, даже если игрок её не отбил идеально.
function condsEra1(state) {
  return [
    (state.population || 0) >= 14,
    builtKindCount(state, ['ferma', 'ambar']) >= 2,
    state.hasBuilt('kazarma'),
    (state.resources.gold || 0) >= 40,
    (state.waveNum || 0) >= 1,
  ];
}
// Условия II → III: население 28 · 2 шахты/кузницы суммарно · церковь+рынок · 120 золота+30 железа · 4 набега.
function condsEra2(state) {
  return [
    (state.population || 0) >= 28,
    builtKindCount(state, ['rudnik', 'kuznica']) >= 2,
    state.hasBuilt('church') && state.hasBuilt('market'),
    (state.resources.gold || 0) >= 120 && (state.resources.iron || 0) >= 30,
    (state.waveNum || 0) >= 4,
  ];
}

// сколько условий уже выполнено — для будущего UI-прогресса (не подключено, просто данные)
export function progress(state) {
  if (state.era === 0) return { need: NEED, have: metCount(condsEra1(state)), of: 5 };
  if (state.era === 1) return { need: NEED, have: metCount(condsEra2(state)), of: 5 };
  return null;
}

function advance(state, ctx, era) {
  state.era = era;
  state.upgradeResets = 0;   // «один дешёвый откат за эпоху» — счётчик обнуляется на новую эпоху (Upgrades.js)
  state.gain({ faith: 20 });
  for (const b of state.buildings) {
    if (!b.built) continue;
    b.wear = Math.min(100, (b.wear ?? 100) + 10);
    applyWear(state, b);
  }
  ctx.hitStop && ctx.hitStop(3);   // «пауза 3с на баннер эпохи» — короткая заморозка сима (рендер живёт как при hit-pause)
  ctx.toast && ctx.toast('🏛️ НОВАЯ ЭПОХА: ' + ERA_NAMES[era] + '! Открыты новые постройки, +20☩, износ всех построек −10.', { gold: true, big: true });
  ctx.sfx && ctx.sfx('rankup');
  // TODO: «камера на Ратушу» (main.js) и «две точки ж/д у края карты» (Эпоха III, world-генерация) —
  // требуют правок вне зоны этой сессии (main.js/GameState.js запрещены).
}

export function update(state, dt, ctx) {
  if (state.era === undefined) state.era = 0;
  if (state.upgradeResets === undefined) state.upgradeResets = 0;
  if (state.gameOver || !state.townhall) return;
  if (state.era === 0 && metCount(condsEra1(state)) >= NEED) advance(state, ctx, 1);
  else if (state.era === 1 && metCount(condsEra2(state)) >= NEED) advance(state, ctx, 2);
}
