// ===== Три пути к победе и политический риск переворота =====
import { ESTATES, adjust } from './Estates.js?v=11';

const LOVE_DAYS = 12;
const COUP_COOLDOWN_DAYS = 8;
const BUYOUT = { gold: 60, faith: 25 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function dataFor(state) {
  const victory = state.victory || (state.victory = { loveDays: 0, lastLoveDay: Math.floor(state.day || 0), winPath: null });
  const coup = state.coup || (state.coup = { lowHappyDays: 0, lastDay: Math.floor(state.day || 0), lastEventDay: -Infinity, pending: false });
  if (victory.loveDays == null) victory.loveDays = 0;
  if (victory.lastLoveDay == null) victory.lastLoveDay = Math.floor(state.day || 0);
  if (coup.lowHappyDays == null) coup.lowHappyDays = 0;
  if (coup.lastDay == null) coup.lastDay = Math.floor(state.day || 0);
  if (coup.lastEventDay == null) coup.lastEventDay = -Infinity;
  return { victory, coup };
}

function estateValues(state) {
  return (state.estates && state.estates.values) || {};
}

function allLoved(state) {
  const values = estateValues(state);
  return state.happiness >= 75 && Object.keys(ESTATES).every(key => (values[key] == null ? 50 : values[key]) >= 60);
}

function lowestEstate(state) {
  const values = estateValues(state);
  return Object.keys(ESTATES).reduce((low, key) => (values[key] == null ? 50 : values[key]) < (values[low] == null ? 50 : values[low]) ? key : low, 'oprichnina');
}

function win(state, ctx, path) {
  if (state.gameOver) return;
  const { victory } = dataFor(state);
  victory.winPath = path;
  ctx.toast && ctx.toast('🌟 Победа: ' + path + '!', { gold: true, big: true });
  ctx.onWin && ctx.onWin(path);
}

function coupLoss(state, ctx) {
  const { coup } = dataFor(state);
  coup.pending = false;
  ctx.onLose && ctx.onLose('coup');
}

function offerCoup(state, ctx, key) {
  const { coup } = dataFor(state);
  coup.pending = true;
  coup.lastEventDay = Math.floor(state.day || 0);
  const estate = ESTATES[key];
  const buyout = () => {
    if (!state.spend || !state.spend(BUYOUT)) { coupLoss(state, ctx); return; }
    adjust(state, key, 15);
    state.happiness = clamp((state.happiness || 0) + 10, 0, 100);
    coup.pending = false;
    ctx.toast && ctx.toast('💰 Смуту откупили: ' + estate.name + ' +15, довольство +10.', { gold: true });
  };
  const suppress = () => {
    const warriors = state.soldiers ? state.soldiers().length : 0;
    if (warriors < 6) { coupLoss(state, ctx); return; }
    adjust(state, key, -10);
    coup.pending = false;
    ctx.toast && ctx.toast('⚔️ Переворот подавлен дружиной. ' + estate.name + ' −10.', { bad: true });
  };
  const event = {
    t: '⚠️ ПЕРЕВОРОТ',
    m: estate.name + ' поднимает смуту. Откупиться, подавить дружиной или потерять державу?',
    choices: [
      { lbl: 'Откупиться: 60🪙 25☩', msg: 'смуту откупили', f: buyout },
      { lbl: 'Подавить: 6 воинов', msg: 'дружина выступает', f: suppress },
      { lbl: 'Игнорировать', msg: 'переворот', f: () => coupLoss(state, ctx) },
    ],
  };
  if (ctx.choiceEvent) ctx.choiceEvent(event);
  else coupLoss(state, ctx);
}

function updateLove(state, victory) {
  const day = Math.floor(state.day || 0);
  if (day <= victory.lastLoveDay) return;
  const days = day - victory.lastLoveDay;
  victory.lastLoveDay = day;
  if (state.era !== 2 || !allLoved(state)) { victory.loveDays = 0; return; }
  victory.loveDays = Math.min(LOVE_DAYS, victory.loveDays + days);
}

function updateCoup(state, ctx, coup) {
  const day = Math.floor(state.day || 0);
  if (day > coup.lastDay) {
    const days = day - coup.lastDay;
    coup.lastDay = day;
    coup.lowHappyDays = state.happiness < 20 ? coup.lowHappyDays + days : 0;
  }
  if (coup.pending || day - coup.lastEventDay < COUP_COOLDOWN_DAYS) return;
  const values = estateValues(state);
  const rebel = Object.keys(ESTATES).find(key => (values[key] == null ? 50 : values[key]) < 10);
  if (rebel || coup.lowHappyDays >= 3) offerCoup(state, ctx, rebel || lowestEstate(state));
}

export function update(state, dt, ctx = {}) {
  if (state.gameOver) return;
  const { victory, coup } = dataFor(state);
  updateLove(state, victory);
  updateCoup(state, ctx, coup);
  if (state.gameOver || state.era !== 2) return;
  if (state.idol && state.idol.built) { win(state, ctx, 'Чудо ДРОНА'); return; }
  if (state._lairDestroyed && state.camps.length === 0) { win(state, ctx, 'Покорение Орды'); return; }
  if (victory.loveDays >= LOVE_DAYS) win(state, ctx, 'Всенародная любовь');
}

export function progressText(state) {
  const victory = (state.victory || {}), idol = state.idol;
  if (state.era !== 2) return 'Путь к победе: нужна III эпоха';
  const wonder = !idol ? 'не заложено' : idol.built ? 'готово' : Math.round((1 - idol.buildLeft / (idol.def.build || 1)) * 100) + '%';
  const lair = state._lairDestroyed ? 'логово ✓' : state.camps.some(c => c.lair) ? 'логово цело' : 'логово ждёт';
  const camps = state.camps.filter(c => !c.lair).length;
  const focus = idol ? 'Чудо' : victory.loveDays >= 6 ? 'Любовь' : state._lairDestroyed ? 'Покорение' : 'Любовь';
  return 'Путь: ' + focus + ' · 🏴 ' + camps + ', ' + lair + ' · ❤ ' + (victory.loveDays || 0) + '/' + LOVE_DAYS + ' · 🗿 ' + wonder;
}

export const VICTORY_RULES = Object.freeze({ LOVE_DAYS, COUP_COOLDOWN_DAYS, BUYOUT });
