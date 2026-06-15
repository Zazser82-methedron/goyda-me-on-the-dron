// ===== Земля: единый меш-рельеф (1 draw call) + вода + декор + ховер/призрак =====
import * as THREE from 'three';
import { TILE, PAL } from '../data/config.js?v=8';

export class TerrainMesh {
  constructor(scene, grid, pal) {
    this.scene = scene;
    this.grid = grid;
    this.pal = pal || { a: PAL.grass1, b: PAL.grass2, c: PAL.grass3, dirt: PAL.dirt };
    const n = grid.n;
    const T = grid.terr || { water: -0.5, sand: -0.15, rock: 1.7, snow: 2.7 };

    // ---- меш рельефа из углов-высот ----
    const verts = new Float32Array((n + 1) * (n + 1) * 3);
    const cols = new Float32Array((n + 1) * (n + 1) * 3);
    const col = new THREE.Color();
    let vi = 0;
    for (let cy = 0; cy <= n; cy++) {
      for (let cx = 0; cx <= n; cx++) {
        const wx = (cx - n / 2) * TILE, wz = (cy - n / 2) * TILE;
        const h = grid.heights ? grid.heights[cy * (n + 1) + cx] : 0;
        verts[vi * 3] = wx; verts[vi * 3 + 1] = h; verts[vi * 3 + 2] = wz;
        this._cornerColor(col, h, T);
        cols[vi * 3] = col.r; cols[vi * 3 + 1] = col.g; cols[vi * 3 + 2] = col.b;
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
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.97, metalness: 0 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true; this.mesh.castShadow = false;
    scene.add(this.mesh);

    // ---- вода ----
    const ww = n * TILE;
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(ww, ww, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x2c5e7e, transparent: true, opacity: 0.72, roughness: 0.18, metalness: 0.1, depthWrite: false })
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = (grid.water ?? -0.5) - 0.02;
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

  _cornerColor(out, h, T) {
    const p = this.pal;
    if (h < T.water) out.setHex(0x4a4030);                       // подводный грунт
    else if (h > (T.snow ?? 2.7)) out.setHex(0xe8eef4);          // снег
    else if (h > (T.rock ?? 1.7)) out.setHex(PAL.rock);          // камень
    else if (h < (T.sand ?? -0.15)) out.setHex(0xcab277);        // песок
    else out.setHex(Math.random() < 0.5 ? p.b : p.c);           // трава/лес
    out.multiplyScalar(0.9 + Math.random() * 0.2);
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
