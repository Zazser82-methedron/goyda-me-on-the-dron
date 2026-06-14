// ===== Поиск пути по сетке: A* (октиль), без срезания углов =====
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function findPath(grid, sx, sy, gx, gy, maxIter = 5000) {
  if (sx === gx && sy === gy) return [];
  if (!grid.inBounds(gx, gy)) return null;
  const key = (x, y) => y * grid.n + x;
  const h = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
  const came = new Map(), g = new Map(), closed = new Set();
  const open = [{ x: sx, y: sy, f: h(sx, sy) }];
  g.set(key(sx, sy), 0);
  let iter = 0;
  while (open.length && iter++ < maxIter) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (cur.x === gx && cur.y === gy) {
      const path = []; let k = ck, cx = cur.x, cy = cur.y;
      while (came.has(k)) { path.push({ x: cx, y: cy }); const p = came.get(k); cx = p[0]; cy = p[1]; k = key(cx, cy); }
      path.reverse();
      return path;
    }
    closed.add(ck);
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!grid.inBounds(nx, ny)) continue;
      const isGoal = nx === gx && ny === gy;
      const t = grid.get(nx, ny);
      if (!t.walkable && !isGoal) continue;
      if (dx && dy) {
        const t1 = grid.get(cur.x + dx, cur.y), t2 = grid.get(cur.x, cur.y + dy);
        if ((t1 && !t1.walkable) || (t2 && !t2.walkable)) continue;
      }
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const step = (dx && dy) ? Math.SQRT2 : 1;
      const tg = (g.get(ck) ?? Infinity) + step;
      if (tg < (g.get(nk) ?? Infinity)) {
        came.set(nk, [cur.x, cur.y]); g.set(nk, tg);
        const f = tg + h(nx, ny);
        const ex = open.find(o => o.x === nx && o.y === ny);
        if (ex) ex.f = f; else open.push({ x: nx, y: ny, f });
      }
    }
  }
  return null;
}

// ближайший к (fromX,fromY) проходимый тайл, соседний с footprint (gx,gy,w,h)
export function nearestAdj(grid, gx, gy, w, h, fromX, fromY) {
  const cands = [];
  for (let x = gx - 1; x <= gx + w; x++) {
    for (const y of [gy - 1, gy + h]) { const t = grid.get(x, y); if (t && t.walkable) cands.push(t); }
  }
  for (let y = gy; y < gy + h; y++) {
    for (const x of [gx - 1, gx + w]) { const t = grid.get(x, y); if (t && t.walkable) cands.push(t); }
  }
  let best = null, bd = Infinity;
  for (const t of cands) { const d = (t.x - fromX) ** 2 + (t.y - fromY) ** 2; if (d < bd) { bd = d; best = t; } }
  return best;
}
