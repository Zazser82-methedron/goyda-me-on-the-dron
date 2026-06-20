// ===== Постройка, стройка-прогресс и тренировка юнитов =====
import { BUILDINGS } from '../data/buildings.js?v=46';
import { UNITS } from '../data/units.js?v=46';
import { RANKS } from '../data/ranks.js?v=46';
import { nearestAdj } from '../world/Pathfinding.js?v=46';
import { bark } from '../data/barks.js?v=46';
import { edictMods } from './Edicts.js?v=46';

function trainTime(state, kind) {
  const base = UNITS[kind].trainTime;
  const mul = edictMods(state).trainMul * (state.happiness < 35 ? 1.4 : 1);
  return base * mul;
}

function spawnTrained(state, b, kind, ctx) {
  const adj = nearestAdj(state.grid, b.gx, b.gy, b.w, b.h, b.gx, b.gy) || { x: b.gx, y: b.gy };
  const w = state.grid.gridToWorld(adj.x, adj.y);
  const u = state.addUnit(kind, w.wx, w.wz, {});
  ctx.sfx && ctx.sfx('train');
  ctx.bark && ctx.bark(u, bark('spawn'));
  return u;
}

export function update(state, dt, ctx) {
  for (const b of state.buildings) {
    if (!b.built) {
      b.buildLeft -= dt;
      const frac = Math.min(1, 1 - b.buildLeft / (b.def.build || 1));
      b.view.scale.setScalar(Math.max(0.2, 0.35 + 0.65 * frac));
      if (b.buildLeft <= 0) {
        state.finishBuild(b);
        ctx.sfx && ctx.sfx('build');
        ctx.burst && ctx.burst(b.cx, (b.cy || 0) + 0.6, b.cz, 0xffcc44, 16);   // салют завершения стройки
        ctx.toast && ctx.toast(b.def.icon + ' ' + b.def.name + ' готов!');
        if (b.def.wonder && ctx.onWin) ctx.onWin();
      }
      continue;
    }
    if (b.trainQueue.length) {
      b.trainLeft -= dt;
      if (b.trainLeft <= 0) {
        const kind = b.trainQueue.shift();
        spawnTrained(state, b, kind, ctx);
        if (b.trainQueue.length) b.trainLeft = trainTime(state, b.trainQueue[0]);
      }
    }
  }
}

export function placeBuilding(state, kind, gx, gy, ctx, opts = {}) {
  const def = BUILDINGS[kind];
  if (!def) return { ok: false, reason: 'нет такого здания' };
  if ((def.rank || 0) > state.rankIndex) return { ok: false, reason: 'нужен ранг ' + RANKS[def.rank].name };
  if (def.requiresTech && !(state.research && state.research.done[def.requiresTech])) return { ok: false, reason: 'изучите технологию (через обсерваторию)' };
  if (def.unique && state.buildings.some(b => b.kind === kind)) return { ok: false, reason: 'уже построено' };
  if (!state.grid.canPlace(gx, gy, def.w, def.h, !!def.onWater)) return { ok: false, reason: 'место занято' };
  if (!state.canAfford(def.cost)) return { ok: false, reason: 'мало ресурсов' };
  state.spend(def.cost);
  const b = state.addBuilding(kind, gx, gy, { built: (def.build || 0) <= 0, rotation: opts.rotation || 0 });
  if (b.built) state.recomputePop();
  ctx.sfx && ctx.sfx('place');
  if (def.wonder) {
    ctx.toast && ctx.toast('🗿 ЧУДО заложено! Достройте идол — но ГОЙДА-БАТЯ уже в пути.', { big: true, gold: true });
    ctx.spawnBoss && ctx.spawnBoss('goyda_batya');
  }
  return { ok: true, b };
}

export function queueTrain(state, b, kind, ctx) {
  const def = UNITS[kind];
  if (!def) return false;
  if (def.rank && state.rankIndex < def.rank) { ctx.toast && ctx.toast('Рано: нужен ранг ' + RANKS[def.rank].name, { bad: true }); return false; }
  if (def.needs && !state.hasBuilt(def.needs)) { ctx.toast && ctx.toast('Нужна постройка: ' + BUILDINGS[def.needs].name, { bad: true }); return false; }
  const pending = state.buildings.reduce((s, x) => s + x.trainQueue.length, 0);
  if (state.population + pending >= state.popCap) { ctx.toast && ctx.toast('Нет места — строй ИЗБЫ', { bad: true }); return false; }
  const cmul = (state.faction && state.faction.mods.trainCostMul) || 1;
  const cost = {}; for (const k in def.cost) cost[k] = Math.max(1, Math.round(def.cost[k] * cmul));
  if (!state.canAfford(cost)) { ctx.toast && ctx.toast('Мало ресурсов на ' + def.name, { bad: true }); return false; }
  state.spend(cost);
  if (!b.trainQueue.length) b.trainLeft = trainTime(state, kind);
  b.trainQueue.push(kind);
  ctx.sfx && ctx.sfx('click');
  return true;
}
