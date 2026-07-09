// ===== Туман войны: видимость вокруг своих + оверлей-меш по рельефу =====
import * as THREE from 'three';
import { TILE } from '../data/config.js?v=87';

export class Fog {
  constructor(scene, grid) {
    this.grid = grid;
    const n = grid.n;
    // канвас n×n: альфа = туман (0 видно / средн. разведано / 255 не разведано)
    this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = n;
    this.cctx = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;

    // оверлей повторяет рельеф (UV планарно), приподнят над землёй чтобы накрыть деревья/юнитов
    const verts = new Float32Array((n + 1) * (n + 1) * 3);
    const uv = new Float32Array((n + 1) * (n + 1) * 2);
    let vi = 0;
    for (let cy = 0; cy <= n; cy++) {
      for (let cx = 0; cx <= n; cx++) {
        const wx = (cx - n / 2) * TILE, wz = (cy - n / 2) * TILE;
        const h = grid.heights ? grid.heights[cy * (n + 1) + cx] : 0;
        verts[vi * 3] = wx; verts[vi * 3 + 1] = h + 2.2; verts[vi * 3 + 2] = wz;
        uv[vi * 2] = cx / n; uv[vi * 2 + 1] = cy / n;
        vi++;
      }
    }
    const idx = new Uint32Array(n * n * 6); let ii = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const a = y * (n + 1) + x, b = a + 1, c = a + (n + 1), d = c + 1;
      idx[ii++] = a; idx[ii++] = c; idx[ii++] = b; idx[ii++] = b; idx[ii++] = c; idx[ii++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, color: 0x070510 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 20; this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this._t = 0;
    this.enabled = true;          // тумблер (кнопка 🌫️)
    this.UNSEEN = 188;            // мягче, чем глухая чернота 255
    this._fill(this.UNSEEN);      // старт: всё в (мягком) тумане
  }

  // вкл/выкл оверлей; тайлы не трогаем — разведанное остаётся видимым
  toggle() { this.enabled = !this.enabled; this.mesh.visible = this.enabled; return this.enabled; }

  _fill(a) {
    const n = this.grid.n;
    this.cctx.fillStyle = 'rgba(7,5,16,' + (a / 255) + ')';
    this.cctx.fillRect(0, 0, n, n);
    this.tex.needsUpdate = true;
  }

  // разведываем диски вокруг своих; разведанное НАВСЕГДА видно (не гасим обратно).
  // перерисовываем канвас только когда открылись новые тайлы — дёшево в лейте.
  update(state, dt) {
    if (!this.enabled) return;
    this._t += dt; if (this._t < 0.3) return; this._t = 0;
    const g = this.grid, n = g.n;
    let dirty = false;
    const stamp = (cx, cy, r) => {
      const r2 = r * r;
      for (let y = Math.max(0, cy - r); y <= Math.min(n - 1, cy + r); y++) {
        for (let x = Math.max(0, cx - r); x <= Math.min(n - 1, cx + r); x++) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy <= r2) {
            const t = g.tiles[y][x]; t.visible = true;
            if (!t.explored) { t.explored = true; dirty = true; }
          }
        }
      }
    };
    // радиусы обзора заметно больше — туман уже не давит
    for (const b of state.buildings) stamp(b.gx + (b.w >> 1), b.gy + (b.h >> 1), b.kind === 'townhall' ? 20 : (b.kind === 'idol' ? 22 : 13));
    for (const u of state.units) if (u.faction === 'ours') { const gp = g.worldToGrid(u.x, u.z); stamp(gp.x, gp.y, 11); }
    if (dirty) this._redraw();
  }

  _redraw() {
    const g = this.grid, n = g.n, u = this.UNSEEN;
    const img = this.cctx.createImageData(n, n);
    const d = img.data;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const t = g.tiles[y][x]; const i = (y * n + x) * 4;
        d[i] = 7; d[i + 1] = 5; d[i + 2] = 16;
        d[i + 3] = t.explored ? 0 : u;   // разведано → прозрачно навсегда; иначе мягкий туман
      }
    }
    this.cctx.putImageData(img, 0, 0);
    this.tex.needsUpdate = true;
  }
}
