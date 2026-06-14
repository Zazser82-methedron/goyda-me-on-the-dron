// ===== Рука карт-способностей: набор, добор, розыгрыш =====
import { CARDS } from '../data/cards.js?v=6';

const HAND_MAX = 5;
const DRAW_EVERY = 32;   // сек — автодобор карты

export function update(state, dt, ctx) {
  if (state.gameOver) return;
  state.hand = state.hand || [];
  state._drawT = (state._drawT || 0) + dt;
  if (state._drawT >= DRAW_EVERY && state.hand.length < HAND_MAX) { state._drawT = 0; drawCard(state, ctx); }
}

export function drawCard(state, ctx, silent) {
  state.hand = state.hand || [];
  if (state.hand.length >= HAND_MAX) return;
  const c = CARDS[Math.floor(Math.random() * CARDS.length)];
  state.hand.push(c.key);
  if (!silent && ctx && ctx.toast) ctx.toast('🃏 Карта в руке: ' + c.name);
}

export function playCard(state, idx, ctx) {
  state.hand = state.hand || [];
  const key = state.hand[idx]; if (!key) return false;
  const c = CARDS.find(x => x.key === key); if (!c) return false;
  if (state.resources.faith < c.cost) { ctx.toast && ctx.toast('Мало ВЕРЫ для «' + c.name + '» (' + c.cost + '☩)', { bad: true }); return false; }
  state.resources.faith -= c.cost;
  state.hand.splice(idx, 1);
  try { c.effect(state, ctx); } catch (e) { console.warn('card effect', e); }
  ctx.sfx && ctx.sfx('super');
  ctx.toast && ctx.toast(c.emoji + ' ' + c.name + '!', { gold: true, big: true });
  return true;
}
