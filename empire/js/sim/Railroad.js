// ===== Железная дорога: паровоз с вагонами курсирует между двумя связанными СТАНЦИЯМИ =====
// Граф — BFS по тайлам t.rail. Поезд (локомотив + 2 вагона) ездит туда-обратно, стоит ~6с на
// станциях, за каждый рейс приносит золото (больше за длинный путь). Дым из трубы, гудок, чух-чух.
// Пока 1 поезд на карту (первая связанная пара станций); путь перепроверяется на каждой конечной.

function adjRailTiles(state, b) {
  const out = [];
  for (let x = b.gx - 1; x <= b.gx + b.w; x++) {
    for (let y = b.gy - 1; y <= b.gy + b.h; y++) {
      if (x >= b.gx && x < b.gx + b.w && y >= b.gy && y < b.gy + b.h) continue;
      const t = state.grid.get(x, y);
      if (t && t.rail) out.push(t);
    }
  }
  return out;
}

// путь по рельсам между станциями: массив {x,y} или null
export function railPath(state, from, to) {
  const n = state.grid.n;
  const starts = adjRailTiles(state, from);
  const goals = new Set(adjRailTiles(state, to).map(t => t.y * n + t.x));
  if (!starts.length || !goals.size) return null;
  const seen = new Set(), prev = new Map(), q = [];
  for (const t of starts) { const k = t.y * n + t.x; if (!seen.has(k)) { seen.add(k); q.push(k); } }
  let goal = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const cur = q[qi];
    if (goals.has(cur)) { goal = cur; break; }
    const cx = cur % n, cy = (cur - cx) / n;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const k = ny * n + nx;
      if (seen.has(k)) continue;
      if (!state.grid.tiles[ny][nx].rail) continue;
      seen.add(k); prev.set(k, cur); q.push(k);
    }
  }
  if (goal < 0) return null;
  const path = [];
  for (let k = goal; k !== undefined; k = prev.get(k)) path.push({ x: k % n, y: (k - k % n) / n });
  path.reverse();
  return path;
}

// позиция вдоль пути в «тайлах» t → мировые координаты + направление
function sampleAt(state, path, t) {
  const tt = Math.max(0, Math.min(path.length - 1, t));
  const i = Math.min(path.length - 2, Math.floor(tt)), k = tt - i;
  const a = path[i], b = path[i + 1];
  const wa = state.grid.gridToWorld(a.x, a.y), wb = state.grid.gridToWorld(b.x, b.y);
  return {
    x: wa.wx + (wb.wx - wa.wx) * k,
    z: wa.wz + (wb.wz - wa.wz) * k,
    dir: Math.atan2(wb.wx - wa.wx, wb.wz - wa.wz),
  };
}

function place(state, tr, view, t, forwardDir) {
  const p = sampleAt(state, tr.path, t);
  view.position.set(p.x, state.grid.heightAt ? state.grid.heightAt(p.x, p.z) + 0.06 : 0.06, p.z);
  view.rotation.y = forwardDir > 0 ? p.dir : p.dir + Math.PI;   // носом по ходу движения
}

function spawnTrain(state, a, b, path, ctx) {
  const loco = state.assets.get('unit_loco');
  const w1 = state.assets.get('unit_wagon');
  const w2 = state.assets.get('unit_wagon');
  for (const v of [loco, w1, w2]) state.scene.add(v);
  const wheels = [];
  for (const v of [loco, w1, w2]) v.traverse(o => { if (o.name === 'wheel') wheels.push(o); });
  let funnel = null; loco.traverse(o => { if (o.name === 'funnel') funnel = o; });
  const tr = { a, b, path, loco, w1, w2, wheels, funnel, t: 0, dirSign: 1, speed: 3, dwell: 2, chuffT: 0, smokeT: 0 };
  state._train = tr;
  ctx.toast && ctx.toast('🚂 Паровоз вышел на линию: ' + path.length + ' тайлов пути!', { gold: true });
  ctx.sfx && ctx.sfx('whistle');
  return tr;
}

function despawnTrain(state, ctx, msg) {
  const tr = state._train;
  if (!tr) return;
  for (const v of [tr.loco, tr.w1, tr.w2]) state.scene.remove(v);
  state._train = null;
  if (msg && ctx.toast) ctx.toast(msg, { bad: true });
}

function arrive(state, tr, stationB, atEnd, ctx) {
  const reward = Math.min(40, 10 + Math.round(0.5 * tr.path.length));
  state.gain({ gold: reward });
  ctx.float && ctx.float(stationB.cx, stationB.cz, '🚂 +' + reward + '🪙', '#ffd700');
  ctx.sfx && ctx.sfx('deposit');
  tr.dwell = 6;
  // перепроверить путь (рельс могли снести/достроить) — на стоянке
  const p2 = railPath(state, tr.a, tr.b);
  if (!p2) { despawnTrain(state, ctx, '🚂 Путь разобран — паровоз ушёл в депо'); return; }
  tr.path = p2;
  tr.t = atEnd ? p2.length - 1 : 0;   // поезд стоит на той конечной, куда приехал
}

export function update(state, dt, ctx) {
  if (state.gameOver) { return; }
  const tr = state._train;
  if (!tr) {
    // ищем первую пару связанных станций (не каждый тик — раз в ~4с)
    state._railScanT = (state._railScanT === undefined ? 3 : state._railScanT) - dt;
    if (state._railScanT > 0) return;
    state._railScanT = 4;
    const stations = state.buildings.filter(x => x.built && x.kind === 'station');
    for (let i = 0; i < stations.length; i++) {
      for (let j = i + 1; j < stations.length; j++) {
        const p = railPath(state, stations[i], stations[j]);
        if (p && p.length >= 3) { spawnTrain(state, stations[i], stations[j], p, ctx); return; }
      }
    }
    return;
  }
  // станции живы?
  if (!state._byId.get(tr.a.id) || !state._byId.get(tr.b.id)) { despawnTrain(state, ctx, '🚂 Станция разрушена — линия закрыта'); return; }
  // стоянка на конечной
  if (tr.dwell > 0) {
    tr.dwell -= dt;
    if (tr.dwell <= 0) ctx.sfx && ctx.sfx('whistle');   // гудок при отправлении
    return;
  }
  // ход
  tr.t += dt * tr.speed * tr.dirSign;
  if (tr.dirSign > 0 && tr.t >= tr.path.length - 1) { tr.dirSign = -1; arrive(state, tr, tr.b, true, ctx); if (!state._train) return; }
  else if (tr.dirSign < 0 && tr.t <= 0) { tr.dirSign = 1; arrive(state, tr, tr.a, false, ctx); if (!state._train) return; }
  // позиции: локо впереди, вагоны с отставанием ПО ХОДУ
  place(state, tr, tr.loco, tr.t, tr.dirSign);
  place(state, tr, tr.w1, tr.t - 1.05 * tr.dirSign, tr.dirSign);
  place(state, tr, tr.w2, tr.t - 2.1 * tr.dirSign, tr.dirSign);
  // чух-чух + дым из трубы
  tr.chuffT -= dt;
  if (tr.chuffT <= 0) { tr.chuffT = 0.5; ctx.sfx && ctx.sfx('chuff'); }
  tr.smokeT -= dt;
  if (tr.smokeT <= 0 && ctx.smoke && tr.funnel) {
    tr.smokeT = 0.28;
    const wp = tr.loco.position;
    ctx.smoke(wp.x, wp.y + 0.68, wp.z);
  }
}
