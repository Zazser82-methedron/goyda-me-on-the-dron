// ===== Сетка мира: тайлы, координаты, занятость, рельеф =====
import { TILE, GRID_N } from '../data/config.js?v=44';
import { makeNoise, fbm, hashSeed } from './Noise.js?v=44';

export class Grid {
  constructor(n = GRID_N) {
    this.n = n;
    this.tiles = [];
    for (let y = 0; y < n; y++) {
      const row = [];
      for (let x = 0; x < n; x++) {
        row.push({
          x, y,
          type: 'grass', biome: 'grass',   // grass|forest|sand|rock|snow|water
          height: 0,
          occupiedBy: null,
          walkable: true, buildable: true,
          baseWalkable: true, baseBuildable: true,   // природная проходимость (вода/обрыв = false)
          road: false,                                // дорога/мост (ускоряет юнитов)
          explored: false, visible: false,           // туман войны
        });
      }
      this.tiles.push(row);
    }
  }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.n && y < this.n; }
  get(x, y) { return this.inBounds(x, y) ? this.tiles[y][x] : null; }

  // тайл (x,y) -> мировые координаты центра тайла (на плоскости XZ)
  gridToWorld(x, y) {
    return {
      wx: (x - this.n / 2 + 0.5) * TILE,
      wz: (y - this.n / 2 + 0.5) * TILE,
    };
  }

  // мировые координаты -> тайл
  worldToGrid(wx, wz) {
    return {
      x: Math.floor(wx / TILE + this.n / 2),
      y: Math.floor(wz / TILE + this.n / 2),
    };
  }

  // Можно ли поставить footprint w×h с левым-верхним углом (gx,gy)?
  // allowWater=true — для мостов (ставятся на воду).
  canPlace(gx, gy, w, h, allowWater = false) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const t = this.get(gx + dx, gy + dy);
        if (!t || t.occupiedBy !== null) return false;
        if (allowWater) continue;                                  // мост — вода разрешена
        if (!t.buildable || t.type === 'water') return false;
      }
    }
    return true;
  }

  // Пометить footprint занятым (или освободить, если id === null → вернуть природные флаги)
  occupy(gx, gy, w, h, id, opts = {}) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const t = this.get(gx + dx, gy + dy);
        if (!t) continue;
        t.occupiedBy = id;
        if (id === null) { t.walkable = t.baseWalkable !== false; t.buildable = t.baseBuildable !== false; t.road = false; }
        else { t.walkable = !!opts.walkable; t.buildable = false; t.road = !!opts.road; }
      }
    }
  }

  // Центр footprint в мировых координатах (для постановки модели origin-в-основании)
  footprintCenter(gx, gy, w, h) {
    const a = this.gridToWorld(gx, gy);
    const b = this.gridToWorld(gx + w - 1, gy + h - 1);
    return { wx: (a.wx + b.wx) / 2, wz: (a.wz + b.wz) / 2 };
  }

  // ---- рельеф ----
  generateTerrain(terr, seedStr) {
    const n = this.n;
    const noise = makeNoise(hashSeed(seedStr || 'les'));
    const T = Object.assign({ amp: 1.6, water: -0.5, river: 0.05, sand: -0.15, rock: 1.7, snow: 2.7, slopeMax: 0.95 }, terr || {});
    this.terr = T; this.water = T.water;
    this.heights = new Float32Array((n + 1) * (n + 1));
    for (let cy = 0; cy <= n; cy++) {
      for (let cx = 0; cx <= n; cx++) {
        const nx = cx / n, ny = cy / n;
        // площе и плавнее: крупнее волны (зум 3.0), меньше октав (4) — холмы вместо «лумпов»
        let h = fbm(noise, nx * 3.0, ny * 3.0, 4) * T.amp;
        const r = Math.abs(fbm(noise, nx * 2.2 + 31.7, ny * 2.2 + 11.3, 3));   // русла рек
        if (r < T.river) h = Math.min(h, T.water - 0.5);
        this.heights[cy * (n + 1) + cx] = h;
      }
    }
    this.flattenCenter(16, 0.3);   // широкая ровная площадка под стройку (как Тропико)
    const H = (cx, cy) => this.heights[cy * (n + 1) + cx];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const t = this.tiles[y][x];
        const hc = 0.25 * (H(x, y) + H(x + 1, y) + H(x, y + 1) + H(x + 1, y + 1));
        t.height = hc;
        const slope = this.slopeAtCorners(x, y);
        if (hc < T.water) { t.biome = 'water'; t.type = 'water'; t.baseWalkable = false; t.baseBuildable = false; }
        else if (slope > T.slopeMax) { t.biome = 'rock'; t.type = 'rock'; t.baseWalkable = false; t.baseBuildable = false; }
        else {
          t.baseWalkable = true; t.baseBuildable = true;
          t.biome = hc > T.snow ? 'snow' : hc > T.rock ? 'rock' : hc < T.sand ? 'sand' : (Math.random() < 0.18 ? 'forest' : 'grass');
          t.type = t.biome;
        }
        t.walkable = t.baseWalkable; t.buildable = t.baseBuildable; t.occupiedBy = null;
      }
    }
  }

  flattenCenter(rad, level) {
    const n = this.n, c = n / 2;
    for (let cy = 0; cy <= n; cy++) {
      for (let cx = 0; cx <= n; cx++) {
        const d = Math.hypot(cx - c, cy - c);
        const i = cy * (n + 1) + cx;
        if (d < rad) this.heights[i] = level;
        else if (d < rad + 4) { const k = (d - rad) / 4; this.heights[i] = this.heights[i] * k + level * (1 - k); }
      }
    }
  }

  slopeAtCorners(x, y) {
    const n = this.n, H = (cx, cy) => this.heights[cy * (n + 1) + cx];
    const a = H(x, y), b = H(x + 1, y), c = H(x, y + 1), d = H(x + 1, y + 1);
    return Math.max(a, b, c, d) - Math.min(a, b, c, d);
  }

  // высота земли в мировой точке (билинейно по углам) — единый источник Y
  heightAt(wx, wz) {
    if (!this.heights) return 0;
    const n = this.n;
    const fx = wx / TILE + n / 2, fy = wz / TILE + n / 2;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
    x0 = Math.max(0, Math.min(n, x0)); y0 = Math.max(0, Math.min(n, y0));
    const x1 = Math.min(n, x0 + 1), y1 = Math.min(n, y0 + 1);
    const H = (cx, cy) => this.heights[cy * (n + 1) + cx];
    const a = H(x0, y0), b = H(x1, y0), cc = H(x0, y1), d = H(x1, y1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
  }
}
