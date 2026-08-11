// ===== Uniform spatial hash grid — быстрый поиск ближайших юнитов/зданий без O(N) сканов =====
// Плоские типизированные буферы, переиспользуемые между тиками: rebuild() — counting sort за
// один проход, без единой аллокации в горячем цикле (кроме редкого роста буферов при увеличении
// числа items). Квадродерево намеренно не используется — при постоянном движении агентов оно
// нагружает GC переаллокацией узлов; uniform grid перестраивается «на месте».
export class SpatialHash {
  // cellSize — размер ячейки в мировых единицах; worldMin/worldMax — границы карты по X и Z
  // (элементы за пределами границ просто прижимаются к крайней ячейке — корректность не страдает,
  // страдает только точность разбиения на границе, что не критично).
  constructor(cellSize, worldMin, worldMax) {
    this.cellSize = cellSize;
    this.worldMin = worldMin;
    this.gridW = Math.max(1, Math.ceil((worldMax - worldMin) / cellSize));
    this.cellCount = this.gridW * this.gridW;
    this.cellStart = new Int32Array(this.cellCount + 1);   // префикс-сумма: [start, end) диапазон ячейки в sorted[]
    this._counts = new Int32Array(this.cellCount);         // временный счётчик/курсор (переиспользуется)
    this.sorted = new Int32Array(0);                       // индексы items[], сгруппированные по ячейке
    this._xs = new Float32Array(0);                        // кэш координат по индексу items (не по sorted!)
    this._zs = new Float32Array(0);
    this.items = null;
    this.n = 0;
  }

  _clampCell(x, z) {
    const gw = this.gridW;
    let cx = ((x - this.worldMin) / this.cellSize) | 0;
    let cz = ((z - this.worldMin) / this.cellSize) | 0;
    if (cx < 0) cx = 0; else if (cx >= gw) cx = gw - 1;
    if (cz < 0) cz = 0; else if (cz >= gw) cz = gw - 1;
    return { cx, cz };
  }

  // перестроить индекс за один тик: counting sort, буферы растут только при увеличении n
  rebuild(items, getX, getZ) {
    const n = items.length;
    this.items = items;
    this.n = n;
    if (this._xs.length < n) {                 // ёмкость выросла — расширяем буферы (редко)
      this.sorted = new Int32Array(n);
      this._xs = new Float32Array(n);
      this._zs = new Float32Array(n);
    }
    const gw = this.gridW, cs = this.cellSize, wmin = this.worldMin;
    const counts = this._counts;
    counts.fill(0);
    const xs = this._xs, zs = this._zs;
    // проход 1: считаем координаты + ячейку каждого item, копим гистограмму по ячейкам
    for (let i = 0; i < n; i++) {
      const x = getX(items[i]), z = getZ(items[i]);
      xs[i] = x; zs[i] = z;
      let cx = ((x - wmin) / cs) | 0, cz = ((z - wmin) / cs) | 0;
      if (cx < 0) cx = 0; else if (cx >= gw) cx = gw - 1;
      if (cz < 0) cz = 0; else if (cz >= gw) cz = gw - 1;
      counts[cz * gw + cx]++;
    }
    const start = this.cellStart;
    let acc = 0;
    for (let c = 0; c < this.cellCount; c++) { start[c] = acc; acc += counts[c]; }
    start[this.cellCount] = acc;
    const cursor = counts;                      // counts больше не нужны как счётчики — переиспользуем как курсор записи
    for (let c = 0; c < this.cellCount; c++) cursor[c] = start[c];
    // проход 2: раскладываем индексы items по их диапазонам в sorted[] (координаты уже в xs/zs — без getX/getZ)
    for (let i = 0; i < n; i++) {
      let cx = ((xs[i] - wmin) / cs) | 0, cz = ((zs[i] - wmin) / cs) | 0;
      if (cx < 0) cx = 0; else if (cx >= gw) cx = gw - 1;
      if (cz < 0) cz = 0; else if (cz >= gw) cz = gw - 1;
      this.sorted[cursor[cz * gw + cx]++] = i;
    }
  }

  // ближайший item, для которого filterFn(item, d2) вернул true, в пределах maxDist. null если не найден.
  queryNearest(x, z, maxDist, filterFn) {
    const n = this.n;
    if (n === 0 || maxDist <= 0) return null;
    const gw = this.gridW, cs = this.cellSize;
    const { cx, cz } = this._clampCell(x, z);
    const items = this.items, sorted = this.sorted, start = this.cellStart, xs = this._xs, zs = this._zs;
    let bestIdx = -1, bestD2 = maxDist * maxDist;
    const maxRing = gw;                          // больше колец не требуется — сетка целиком покрыта раньше
    for (let ring = 0; ring <= maxRing; ring++) {
      if (ring > 0) {
        const ringMinDist = (ring - 1) * cs;      // ближайшая теоретически возможная точка в новом кольце
        if (ringMinDist * ringMinDist > bestD2) break;   // дальше точек ближе текущей лучшей уже не найти
      }
      const x0 = Math.max(0, cx - ring), x1 = Math.min(gw - 1, cx + ring);
      const z0 = Math.max(0, cz - ring), z1 = Math.min(gw - 1, cz + ring);
      for (let gz = z0; gz <= z1; gz++) {
        const onEdgeRow = ring === 0 || gz === cz - ring || gz === cz + ring;
        for (let gx = x0; gx <= x1; gx++) {
          if (!onEdgeRow && gx !== cx - ring && gx !== cx + ring) continue;   // внутри кольца — уже посещено раньше
          const c = gz * gw + gx;
          const s = start[c], e = start[c + 1];
          for (let k = s; k < e; k++) {
            const idx = sorted[k];
            const dx = x - xs[idx], dz = z - zs[idx];
            const d2 = dx * dx + dz * dz;
            if (d2 < bestD2 && filterFn(items[idx], d2)) { bestD2 = d2; bestIdx = idx; }
          }
        }
      }
      if (cx - ring <= 0 && cx + ring >= gw - 1 && cz - ring <= 0 && cz + ring >= gw - 1) break;   // сетка накрыта целиком
    }
    return bestIdx >= 0 ? items[bestIdx] : null;
  }

  // все items в радиусе r от (x,z), для которых filterFn(item, d2) (если задан) вернул true.
  // Пишет в переданный переиспользуемый массив out (out.length сбрасывается в 0), возвращает его же.
  queryRadius(x, z, r, out, filterFn) {
    out.length = 0;
    const n = this.n;
    if (n === 0 || r <= 0) return out;
    const gw = this.gridW, cs = this.cellSize;
    const r2 = r * r;
    const { cx, cz } = this._clampCell(x, z);
    const cellR = Math.ceil(r / cs) + 1;
    const x0 = Math.max(0, cx - cellR), x1 = Math.min(gw - 1, cx + cellR);
    const z0 = Math.max(0, cz - cellR), z1 = Math.min(gw - 1, cz + cellR);
    const items = this.items, sorted = this.sorted, start = this.cellStart, xs = this._xs, zs = this._zs;
    for (let gz = z0; gz <= z1; gz++) {
      for (let gx = x0; gx <= x1; gx++) {
        const c = gz * gw + gx;
        const s = start[c], e = start[c + 1];
        for (let k = s; k < e; k++) {
          const idx = sorted[k];
          const dx = x - xs[idx], dz = z - zs[idx];
          const d2 = dx * dx + dz * dz;
          if (d2 <= r2 && (!filterFn || filterFn(items[idx], d2))) out.push(items[idx]);
        }
      }
    }
    return out;
  }
}
