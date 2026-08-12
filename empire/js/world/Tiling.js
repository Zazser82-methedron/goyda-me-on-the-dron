// ===== Авто-соединение построек =====
// Стены (частокол/ворота) получают секции-соединители к соседям; дороги пересобираются под маску
// (прямая/угол/T/перекрёсток — единая схема «полосы от центра»); мост ориентируется вдоль линии;
// соседние ПОСТРОЕННЫЕ дома объединяются «усадьбой» (тропинка + заборчики).
// Зовётся из GameState.addBuilding/removeBuilding/finishBuild. Рельсы (v94) переиспользуют neighborMask.
import * as THREE from 'three';
import { roadTile, railTile, wallConnSegment, homesteadConn } from '../engine/Placeholders.js?v=96';

const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];                   // N,E,S,W → биты
const DIR_ROT = { 1: Math.PI, 2: Math.PI / 2, 4: 0, 8: -Math.PI / 2 };         // поворот сегмента-соединителя (построен вдоль +Z=S)

export function neighborMask(state, gx, gy, pred) {
  let m = 0;
  for (const [dx, dy, bit] of DIRS) {
    const t = state.grid.get(gx + dx, gy + dy);
    if (!t || t.occupiedBy == null) continue;
    const nb = state.byId(t.occupiedBy);
    if (nb && nb.type === 'building' && pred(nb)) m |= bit;
  }
  return m;
}

const isWallKind = (b) => b.kind === 'chastokol' || b.kind === 'gate';
const isRoadKind = (b) => !!(b.def && b.def.road);
const isRailKind = (b) => !!(b.def && b.def.rail);
const railConnects = (b) => isRailKind(b) || b.kind === 'station';   // рельсы тянутся и к станции

function refreshWall(state, b) {
  const mask = neighborMask(state, b.gx, b.gy, isWallKind);
  if (b._connMask === mask) return;
  b._connMask = mask;
  if (!b._conn) {                                   // 4 сегмента один раз, дальше только видимость по маске
    b._conn = new THREE.Group();
    b._conn.position.set(b.cx, b.cy || 0, b.cz);
    for (const [, , bit] of DIRS) {
      const seg = wallConnSegment();
      seg.rotation.y = DIR_ROT[bit];
      seg.userData.bit = bit;
      b._conn.add(seg);
    }
    state.scene.add(b._conn);
  }
  for (const seg of b._conn.children) seg.visible = !!(mask & seg.userData.bit);
}

function refreshRoad(state, b) {
  const mask = neighborMask(state, b.gx, b.gy, isRoadKind);
  if (b._roadMask === mask) return;
  b._roadMask = mask;
  if (b.kind === 'bridge') {                        // мост не пересобираем — только ориентируем вдоль линии
    if ((mask & (2 | 8)) && !(mask & (1 | 4))) b.view.rotation.y = Math.PI / 2;
    else if (mask & (1 | 4)) b.view.rotation.y = 0;
    return;
  }
  while (b.view.children.length) b.view.remove(b.view.children[0]);   // пересборка вида под маску
  const g = roadTile(mask);
  for (const c of [...g.children]) b.view.add(c);
}

function refreshRail(state, b) {
  const mask = neighborMask(state, b.gx, b.gy, railConnects);
  if (b._railMask === mask) return;
  b._railMask = mask;
  while (b.view.children.length) b.view.remove(b.view.children[0]);   // пересборка вида под маску
  const g = railTile(mask);
  for (const c of [...g.children]) b.view.add(c);
}

function refreshAt(state, gx, gy) {
  const t = state.grid.get(gx, gy);
  if (!t || t.occupiedBy == null) return;
  const b = state.byId(t.occupiedBy);
  if (!b || b.type !== 'building') return;
  if (isWallKind(b)) refreshWall(state, b);
  else if (isRailKind(b)) refreshRail(state, b);
  else if (isRoadKind(b)) refreshRoad(state, b);
}

// соседи для refresh: у 1×1 это 4 клетки, у станции 2×2 — весь периметр (рельсы вокруг переориентируются)
function refreshNeighbors(state, b) {
  const w = b.w || 1, h = b.h || 1;
  for (let x = b.gx - 1; x <= b.gx + w; x++) {
    for (let y = b.gy - 1; y <= b.gy + h; y++) {
      if (x >= b.gx && x < b.gx + w && y >= b.gy && y < b.gy + h) continue;
      refreshAt(state, x, y);
    }
  }
}

export function onPlaced(state, b) {
  if (isWallKind(b)) refreshWall(state, b);
  else if (isRailKind(b)) refreshRail(state, b);
  else if (isRoadKind(b)) refreshRoad(state, b);
  refreshNeighbors(state, b);
}

export function onRemoved(state, b) {
  if (b._conn) { state.scene.remove(b._conn); b._conn = null; }
  refreshNeighbors(state, b);
}

// ---- «усадьбы»: соединители между соседними построенными домами (кап 2 на здание) ----
const HOME_KINDS = new Set(['izba', 'banya', 'ambar', 'ferma', 'kuznica', 'kazarma', 'church', 'market', 'traktir', 'veche', 'observatory', 'townhall']);

export function refreshHomesteads(state) {
  if (!state._homeConn) state._homeConn = new Map();
  const homes = state.buildings.filter(b => b.built && HOME_KINDS.has(b.kind));
  const want = new Map(), cnt = {};
  for (let i = 0; i < homes.length; i++) {
    for (let j = i + 1; j < homes.length; j++) {
      const a = homes[i], c = homes[j];
      // зазор между футпринтами по осям (в тайлах); отрицательный = проекции пересекаются
      const gapX = Math.max(a.gx - (c.gx + c.w), c.gx - (a.gx + a.w));
      const gapY = Math.max(a.gy - (c.gy + c.h), c.gy - (a.gy + a.h));
      if (!((gapX >= 0 && gapX <= 1 && gapY < 0) || (gapY >= 0 && gapY <= 1 && gapX < 0))) continue;
      if ((cnt[a.id] || 0) >= 2 || (cnt[c.id] || 0) >= 2) continue;   // не захламлять двор
      cnt[a.id] = (cnt[a.id] || 0) + 1; cnt[c.id] = (cnt[c.id] || 0) + 1;
      want.set(a.id + '_' + c.id, [a, c]);
    }
  }
  for (const [k, g] of state._homeConn) {                     // убрать неактуальные (снос/разрушение)
    if (!want.has(k)) { state.scene.remove(g); state._homeConn.delete(k); }
  }
  for (const [k, pair] of want) {                             // добавить новые
    if (state._homeConn.has(k)) continue;
    const g = homesteadConn(pair[0], pair[1], state.grid);
    state.scene.add(g); state._homeConn.set(k, g);
  }
}
