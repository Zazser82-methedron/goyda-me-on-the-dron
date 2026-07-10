// ===== Транспорт по дорогам: телеги РЫНОК → ПАЛАТЫ (торговая выручка) =====
// BFS по тайлам с t.road (дороги+мосты). Телега спавнится у рынка, если тот связан дорогой с ратушей,
// едет по пути и по прибытии приносит золото (больше за длинный маршрут). ≤2 телег одновременно.

// проходимые ДОРОЖНЫЕ тайлы, смежные с footprint здания
function adjRoadTiles(state, b) {
  const out = [];
  for (let x = b.gx - 1; x <= b.gx + b.w; x++) {
    for (let y = b.gy - 1; y <= b.gy + b.h; y++) {
      if (x >= b.gx && x < b.gx + b.w && y >= b.gy && y < b.gy + b.h) continue;
      const t = state.grid.get(x, y);
      if (t && t.road) out.push(t);
    }
  }
  return out;
}

// путь по дорожной сети от здания from до здания to: массив {x,y} или null
export function roadPath(state, from, to) {
  const n = state.grid.n;
  const starts = adjRoadTiles(state, from);
  const goals = new Set(adjRoadTiles(state, to).map(t => t.y * n + t.x));
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
      if (!state.grid.tiles[ny][nx].road) continue;
      seen.add(k); prev.set(k, cur); q.push(k);
    }
  }
  if (goal < 0) return null;
  const path = [];
  for (let k = goal; k !== undefined; k = prev.get(k)) path.push({ x: k % n, y: ((k - k % n) / n) });
  path.reverse();
  return path;
}

function spawnCart(state, market, path) {
  const view = state.assets.get('unit_cart');
  const w0 = state.grid.gridToWorld(path[0].x, path[0].y);
  view.position.set(w0.wx, state.grid.heightAt ? state.grid.heightAt(w0.wx, w0.wz) : 0, w0.wz);
  state.scene.add(view);
  const c = { view, path, t: 0, speed: 1.7, x: w0.wx, z: w0.wz, fromId: market.id, wheels: [] };
  view.traverse(o => { if (o.name === 'wheel') c.wheels.push(o); });   // рендер-цикл крутит их по ходу
  state._carts.push(c);
  return c;
}

export function update(state, dt, ctx) {
  if (!state._carts) state._carts = [];
  if (state.gameOver) return;
  // спавн: периодически, по одному рынку за раз, если есть дорожная связь с ратушей
  state._cartT = (state._cartT === undefined ? 18 : state._cartT) - dt;
  if (state._cartT <= 0) {
    state._cartT = 30 + Math.random() * 12;
    if (state._carts.length < 2 && state.townhall) {
      for (const m of state.buildings) {
        if (m.kind !== 'market' || !m.built) continue;
        if (state._carts.some(c => c.fromId === m.id)) continue;   // от этого рынка телега уже в пути
        const path = roadPath(state, m, state.townhall);
        m._roadOk = !!path;                                        // кэш для панели выбора
        if (path && path.length >= 2) { spawnCart(state, m, path); break; }
      }
    }
  }
  // движение телег вдоль дорожного пути
  for (const c of [...state._carts]) {
    c.t += dt * c.speed;
    const i = Math.floor(c.t);
    if (i >= c.path.length - 1) {                                  // доехала до ратуши — выручка
      const reward = 6 + Math.floor(c.path.length * 0.4);
      state.gain({ gold: reward });
      ctx.float && ctx.float(state.townhall.cx, state.townhall.cz, '🐴 +' + reward + '🪙', '#ffd700');
      ctx.sfx && ctx.sfx('deposit');
      state.scene.remove(c.view);
      state._carts.splice(state._carts.indexOf(c), 1);
      continue;
    }
    const a = c.path[i], b = c.path[i + 1], k = c.t - i;
    const wa = state.grid.gridToWorld(a.x, a.y), wb = state.grid.gridToWorld(b.x, b.y);
    c.x = wa.wx + (wb.wx - wa.wx) * k;
    c.z = wa.wz + (wb.wz - wa.wz) * k;
    c.dir = Math.atan2(wb.wx - wa.wx, wb.wz - wa.wz);
    c.view.position.set(c.x, state.grid.heightAt ? state.grid.heightAt(c.x, c.z) : 0, c.z);
    c.view.rotation.y = c.dir;
  }
}
