// ===== Земля: единый меш-рельеф (1 draw call) + вода + декор + ховер/призрак =====
import * as THREE from 'three';
import { TILE, PAL } from '../data/config.js?v=55';
import { makeRippleNormal } from './WaterFx.js?v=55';

export class TerrainMesh {
  constructor(scene, grid, pal) {
    this.scene = scene;
    this.grid = grid;
    this.pal = pal || { a: PAL.grass1, b: PAL.grass2, c: PAL.grass3, dirt: PAL.dirt };
    const n = grid.n;
    const T = grid.terr || { water: -0.5, sand: -0.15, rock: 1.7, snow: 2.7 };

    // ---- низкочастотное поле-шум для богатого грунта (крупные пятна сухой/сочной травы, землистые проплешины,
    //      пятнистый камень). Детерминируется один раз при постройке. ----
    const NP = 16, nlat = new Float32Array(NP * NP);
    for (let i = 0; i < nlat.length; i++) nlat[i] = Math.random();
    const _sm = t => t * t * (3 - 2 * t);
    this._gnoise = (cx, cy, sc, ox, oy) => {
      const u = cx * sc + ox, v = cy * sc + oy;
      const x0 = Math.floor(u), y0 = Math.floor(v);
      const tx = _sm(u - x0), ty = _sm(v - y0);
      const at = (x, y) => nlat[(((y % NP) + NP) % NP) * NP + (((x % NP) + NP) % NP)];
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    };
    this._tc = new THREE.Color();   // переиспользуемый temp для блендов цвета

    // ---- меш рельефа из углов-высот ----
    const verts = new Float32Array((n + 1) * (n + 1) * 3);
    const cols = new Float32Array((n + 1) * (n + 1) * 3);
    const uvs = new Float32Array((n + 1) * (n + 1) * 2);
    const UVK = 0.25;   // мирово-тайловые UV: одна «плитка» детал-текстуры на ~4 тайла
    const col = new THREE.Color();
    let vi = 0;
    for (let cy = 0; cy <= n; cy++) {
      for (let cx = 0; cx <= n; cx++) {
        const wx = (cx - n / 2) * TILE, wz = (cy - n / 2) * TILE;
        const h = grid.heights ? grid.heights[cy * (n + 1) + cx] : 0;
        verts[vi * 3] = wx; verts[vi * 3 + 1] = h; verts[vi * 3 + 2] = wz;
        this._cornerColor(col, h, T, cx, cy);
        cols[vi * 3] = col.r; cols[vi * 3 + 1] = col.g; cols[vi * 3 + 2] = col.b;
        uvs[vi * 2] = cx * UVK; uvs[vi * 2 + 1] = cy * UVK;
        vi++;
      }
    }
    const idx = new Uint32Array(n * n * 6);
    let ii = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const a = y * (n + 1) + x, b = a + 1, c = a + (n + 1), d = c + 1;
        idx[ii++] = a; idx[ii++] = c; idx[ii++] = b;
        idx[ii++] = b; idx[ii++] = c; idx[ii++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();   // гладкие нормали — чтобы нормал-мапа ловила свет (Тропико-стиль)
    // PBR-земля: процедурные тайловые detail/normal/roughness карты (без внешних ассетов) поверх биом-цвета.
    // envMapIntensity низкий — IBL не должен пересвечивать светлые биомы (песок/снег выгорали)
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, envMapIntensity: 0.3 });
    this._pbrGround(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true; this.mesh.castShadow = false;
    scene.add(this.mesh);

    // ---- вода ----
    const ww = n * TILE;
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(ww, ww, 1, 1),
      // отражает IBL-окружение → читается как настоящая вода
      new THREE.MeshStandardMaterial({ color: 0x2a5874, transparent: true, opacity: 0.82, roughness: 0.1, metalness: 0.6, depthWrite: false, envMapIntensity: 1.5 })
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = (grid.water ?? -0.5) - 0.02;
    // рябь: тайловая normal-мапа, скроллится в update → блики дробятся, вода «живая»
    const wn = makeRippleNormal(128); wn.repeat.set(8, 8);
    this.water.material.normalMap = wn; this.water.material.normalScale = new THREE.Vector2(0.35, 0.35); this.water.material.needsUpdate = true;
    this._waterN = wn;
    scene.add(this.water);

    // ---- декор (кусты + валуны) по высоте ----
    this._scatterDecor(scene, grid, n);

    // ---- подсветка наведения ----
    const hl = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.96, TILE * 0.96),
      new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.4, depthWrite: false })
    );
    hl.rotation.x = -Math.PI / 2; hl.visible = false;
    scene.add(hl); this.hover = hl;

    // ---- призрак постройки ----
    this.ghost = new THREE.Group(); this.ghost.visible = false; scene.add(this.ghost);
    this._ghostModel = null;
    this.ghostPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x44ff66, transparent: true, opacity: 0.32, depthWrite: false })
    );
    this.ghostPlane.rotation.x = -Math.PI / 2;
    this.ghost.add(this.ghostPlane);
  }

  // ---- процедурная PBR-земля: тайловые detail(albedo)/normal/roughness без внешних текстур ----
  _pbrGround(mat) {
    const S = 256;
    // тайловая value-noise: решётка периода P оборачивается по краю канваса → бесшовно
    const lattice = (P) => { const a = new Float32Array(P * P); for (let i = 0; i < a.length; i++) a[i] = Math.random(); return a; };
    const smooth = (t) => t * t * (3 - 2 * t);
    const sample = (lat, P, u, v) => {
      const fx = u * P, fy = v * P;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = smooth(fx - x0), ty = smooth(fy - y0);
      const at = (x, y) => lat[((y % P) + P) % P * P + ((x % P) + P) % P];
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    };
    // высотное поле fbm (3 октавы, каждая периодична → бесшовно)
    const octs = [{ P: 8, w: 0.55 }, { P: 16, w: 0.3 }, { P: 48, w: 0.15 }].map(o => ({ ...o, lat: lattice(o.P) }));
    const H = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let h = 0; const u = x / S, v = y / S;
      for (const o of octs) h += sample(o.lat, o.P, u, v) * o.w;
      H[y * S + x] = h;   // ~0..1
    }
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
    const wrap = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true; return t; };

    // detail/albedo: серый ≈1.0, лёгкая зернистость множит биом-цвет (0.84..1.12)
    const ac = mk(), actx = ac.getContext('2d'), aimg = actx.createImageData(S, S);
    // roughness: чуть выше во впадинах
    const rc = mk(), rctx = rc.getContext('2d'), rimg = rctx.createImageData(S, S);
    // normal: из градиента высот
    const nc = mk(), nctx = nc.getContext('2d'), nimg = nctx.createImageData(S, S);
    const STR = 2.2;   // сила рельефа нормал-мапы
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, p = i * 4;
      const g = 0.84 + H[i] * 0.28;
      const av = Math.max(0, Math.min(255, g * 255));
      aimg.data[p] = aimg.data[p + 1] = aimg.data[p + 2] = av; aimg.data[p + 3] = 255;
      const rv = Math.max(0, Math.min(255, (0.9 - H[i] * 0.18) * 255));
      rimg.data[p] = rimg.data[p + 1] = rimg.data[p + 2] = rv; rimg.data[p + 3] = 255;
      const hl = H[y * S + ((x - 1 + S) % S)], hr = H[y * S + ((x + 1) % S)];
      const hu = H[((y - 1 + S) % S) * S + x], hd = H[((y + 1) % S) * S + x];
      let nx = -(hr - hl) * STR, ny = -(hd - hu) * STR, nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz); nx *= inv; ny *= inv; nz *= inv;
      nimg.data[p] = (nx * 0.5 + 0.5) * 255; nimg.data[p + 1] = (ny * 0.5 + 0.5) * 255; nimg.data[p + 2] = (nz * 0.5 + 0.5) * 255; nimg.data[p + 3] = 255;
    }
    actx.putImageData(aimg, 0, 0); rctx.putImageData(rimg, 0, 0); nctx.putImageData(nimg, 0, 0);

    const aTex = wrap(new THREE.CanvasTexture(ac)); aTex.colorSpace = THREE.SRGBColorSpace;
    mat.map = aTex;
    mat.roughnessMap = wrap(new THREE.CanvasTexture(rc));
    mat.normalMap = wrap(new THREE.CanvasTexture(nc));
    mat.normalScale = new THREE.Vector2(0.72, 0.72);   // сильнее рельеф земли — детали читаются ближним зумом
    mat.needsUpdate = true;
  }

  // анимация ряби воды (зовётся из render-loop)
  update(fdt) {
    if (this._waterN) { this._waterN.offset.x += fdt * 0.015; this._waterN.offset.y += fdt * 0.02; }
  }

  _cornerColor(out, h, T, cx = 0, cy = 0) {
    const p = this.pal, tc = this._tc;
    if (h < T.water) {                                           // подводный грунт
      out.setHex(0x4a4030).multiplyScalar(0.86 + Math.random() * 0.18);
      return out;
    }
    if (h > (T.snow ?? 2.7)) {                                   // снег (притушен, не выгорает)
      out.setHex(0xd2d9e4).multiplyScalar(0.93 + Math.random() * 0.12);
      return out;
    }
    if (h > (T.rock ?? 1.7)) {                                   // камень — пятнистый, тёмные/светлые жилы
      const rk = this._gnoise(cx, cy, 0.4, 11, 7);
      out.setHex(PAL.rock).lerp(tc.setHex(PAL.rockDk || 0x55524c), rk * 0.55);
      out.multiplyScalar(0.85 + Math.random() * 0.22);
      return out;
    }
    if (h < (T.sand ?? -0.15)) {                                 // песок/берег — влажные тёмные пятна у воды
      const wet = this._gnoise(cx, cy, 0.3, 3, 9);
      out.setHex(0xb49a62).multiplyScalar(0.82 + wet * 0.32);
      return out;
    }
    // ---- ТРАВА: крупные пятна сочной/сухой/землистой травы вместо равномерного зелёного ----
    const patch = this._gnoise(cx, cy, 0.16, 0, 0);             // 0..1 — крупные пятна оттенка
    const dry = this._gnoise(cx, cy, 0.26, 21, 13);             // 0..1 — сухость/проплешины земли
    out.setHex(p.b).lerp(tc.setHex(p.c), patch);               // блендим тёмно↔светло-зелёный
    if (dry > 0.6) {                                            // сухие/землистые проплешины
      out.lerp(tc.setHex(p.dirt || 0x8a6a3a), Math.min(1, (dry - 0.6) / 0.32) * 0.7);
    } else if (patch > 0.8) {                                   // редкие очень сочные луга (тёплый зелёный)
      out.lerp(tc.setHex(0x9bbf3a), (patch - 0.8) / 0.2 * 0.38);
    }
    out.multiplyScalar(0.93 + Math.random() * 0.12);           // мелкая зернистость
    return out;
  }

  _scatterDecor(scene, grid, n) {
    const bushGeo = new THREE.ConeGeometry(0.18, 0.34, 5);
    const rockGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const dmat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 });
    const bn = Math.floor(n * n * 0.03), rn = Math.floor(n * n * 0.012);
    const bushes = new THREE.InstancedMesh(bushGeo, dmat(), bn);
    const rocks = new THREE.InstancedMesh(rockGeo, dmat(), rn);
    bushes.castShadow = bushes.receiveShadow = false;
    rocks.castShadow = rocks.receiveShadow = false;
    bushes.frustumCulled = false; rocks.frustumCulled = false;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const fill = (inst, count, cA, cB, yb, sMin, sMax) => {
      let placed = 0;
      for (let attempt = 0; attempt < count * 3 && placed < count; attempt++) {
        const gx = 1 + Math.floor(Math.random() * (n - 2)), gy = 1 + Math.floor(Math.random() * (n - 2));
        const t = grid.get(gx, gy);
        if (!t || t.biome === 'water') continue;
        const w = grid.gridToWorld(gx, gy);
        const sc = sMin + Math.random() * (sMax - sMin);
        const gy0 = grid.heightAt(w.wx, w.wz);
        p.set(w.wx + (Math.random() - 0.5) * 0.7, gy0 + yb * sc, w.wz + (Math.random() - 0.5) * 0.7);
        q.setFromAxisAngle(up, Math.random() * 6.28);
        s.set(sc, sc * (0.8 + Math.random() * 0.5), sc);
        m.compose(p, q, s); inst.setMatrixAt(placed, m);
        inst.setColorAt(placed, new THREE.Color(Math.random() < 0.5 ? cA : cB).multiplyScalar(0.85 + Math.random() * 0.3));
        placed++;
      }
      inst.count = placed;
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    };
    fill(bushes, bn, this.pal.b, this.pal.c, 0.17, 0.6, 1.6);
    fill(rocks, rn, PAL.rock, PAL.rockDk, 0.12, 0.5, 1.4);
    scene.add(bushes); scene.add(rocks);

    // ---- эмиссивные «огни» (факелы/жаровни) — засветятся с пост-обработкой (bloom) ----
    const flameGeo = new THREE.ConeGeometry(0.12, 0.42, 5);
    const flameMat = new THREE.MeshStandardMaterial({ color: 0xff9030, emissive: 0xff5810, emissiveIntensity: 1.7, flatShading: true, roughness: 1 });
    const fn = Math.floor(n * n * 0.0035);
    const flames = new THREE.InstancedMesh(flameGeo, flameMat, fn);
    flames.castShadow = flames.receiveShadow = false; flames.frustumCulled = false;
    fill(flames, fn, 0xff9030, 0xffb840, 0.22, 0.7, 1.3);
    scene.add(flames);

    // ---- цветы (яркие пятна на траве) ----
    const flowerGeo = new THREE.ConeGeometry(0.07, 0.18, 4);
    const fln = Math.floor(n * n * 0.02);
    const flowers = new THREE.InstancedMesh(flowerGeo, dmat(), fln);
    flowers.castShadow = flowers.receiveShadow = false; flowers.frustumCulled = false;
    fill(flowers, fln, 0xff6ec7, 0xffe24a, 0.1, 0.6, 1.2);
    scene.add(flowers);

    // ---- сухие/мёртвые деревья (силуэт-разнообразие; декор, не рубятся) ----
    const deadGeo = new THREE.ConeGeometry(0.11, 0.95, 5);
    const dn = Math.floor(n * n * 0.006);
    const dead = new THREE.InstancedMesh(deadGeo, dmat(), dn);
    dead.castShadow = dead.receiveShadow = false; dead.frustumCulled = false;
    fill(dead, dn, 0x6b5538, 0x564327, 0.47, 0.7, 1.5);
    scene.add(dead);

    // ---- пни (намёк на вырубку — отличаются от ёлок) ----
    const stumpGeo = new THREE.CylinderGeometry(0.15, 0.19, 0.22, 7);
    const sn = Math.floor(n * n * 0.004);
    const stumps = new THREE.InstancedMesh(stumpGeo, dmat(), sn);
    stumps.castShadow = stumps.receiveShadow = false; stumps.frustumCulled = false;
    fill(stumps, sn, 0x6b5740, 0x55462f, 0.11, 0.7, 1.3);
    scene.add(stumps);
  }

  setHover(tile, color) {
    if (!tile) { this.hover.visible = false; return; }
    const { wx, wz } = this.grid.gridToWorld(tile.x, tile.y);
    this.hover.position.set(wx, this.grid.heightAt(wx, wz) + 0.05, wz);
    if (color !== undefined) this.hover.material.color.setHex(color);
    this.hover.visible = true;
  }

  setGhost(gx, gy, w, h, ok, model) {
    if (model && model !== this._ghostModel) {
      if (this._ghostModel) this.ghost.remove(this._ghostModel);
      model.traverse(o => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.55; } });
      this.ghost.add(model);
      this._ghostModel = model;
    }
    const c = this.grid.footprintCenter(gx, gy, w, h);
    const gh = this.grid.heightAt(c.wx, c.wz);
    if (this._ghostModel) this._ghostModel.position.set(c.wx, gh, c.wz);
    this.ghostPlane.scale.set(w * TILE * 0.96, h * TILE * 0.96, 1);
    this.ghostPlane.position.set(c.wx, gh + 0.06, c.wz);
    this.ghostPlane.material.color.setHex(ok ? 0x44ff66 : 0xff3030);
    this.ghost.visible = true;
  }

  hideGhost() {
    if (this._ghostModel) { this.ghost.remove(this._ghostModel); this._ghostModel = null; }
    this.ghost.visible = false;
  }
}
