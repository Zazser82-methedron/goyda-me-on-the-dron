// ===== Сетка мира: тайлы, преобразование координат, занятость =====
import { TILE, GRID_N } from '../data/config.js?v=5';

export class Grid {
  constructor(n = GRID_N) {
    this.n = n;
    this.tiles = [];
    for (let y = 0; y < n; y++) {
      const row = [];
      for (let x = 0; x < n; x++) {
        row.push({
          x, y,
          type: 'grass',        // grass | dirt | rock | water
          height: 0,            // визуальная вариация высоты (декор)
          occupiedBy: null,     // id сущности (здание/нода), занявшей тайл
          walkable: true,       // проходим ли для юнитов
          buildable: true,      // можно ли строить
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
  canPlace(gx, gy, w, h) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const t = this.get(gx + dx, gy + dy);
        if (!t || !t.buildable || t.occupiedBy !== null || t.type === 'water') return false;
      }
    }
    return true;
  }

  // Пометить footprint занятым (или освободить, если id === null)
  occupy(gx, gy, w, h, id, opts = {}) {
    const walkable = opts.walkable ?? (id === null);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const t = this.get(gx + dx, gy + dy);
        if (!t) continue;
        t.occupiedBy = id;
        t.walkable = walkable;
        t.buildable = (id === null);
      }
    }
  }

  // Центр footprint в мировых координатах (для постановки модели origin-в-основании)
  footprintCenter(gx, gy, w, h) {
    const a = this.gridToWorld(gx, gy);
    const b = this.gridToWorld(gx + w - 1, gy + h - 1);
    return { wx: (a.wx + b.wx) / 2, wz: (a.wz + b.wz) / 2 };
  }
}
