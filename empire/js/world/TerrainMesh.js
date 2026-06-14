// ===== Земля: инстансированные тайлы + подсветка наведения + призрак постройки =====
import * as THREE from 'three';
import { TILE, PAL } from '../data/config.js?v=3';

function jitterColor(hex, amt) {
  const c = new THREE.Color(hex);
  const f = 1 + (Math.random() * 2 - 1) * amt;
  c.multiplyScalar(f);
  return c;
}

export class TerrainMesh {
  constructor(scene, grid, pal) {
    this.scene = scene;
    this.grid = grid;
    this.pal = pal || { a: PAL.grass1, b: PAL.grass2, c: PAL.grass3, dirt: PAL.dirt };
    const n = grid.n;

    // тёмная «бездна» под картой
    const voidGeo = new THREE.CircleGeometry(n * TILE * 0.9, 48);
    const voidMesh = new THREE.Mesh(voidGeo, new THREE.MeshStandardMaterial({ color: 0x05030a, roughness: 1 }));
    voidMesh.rotation.x = -Math.PI / 2; voidMesh.position.y = -0.35; voidMesh.receiveShadow = true;
    scene.add(voidMesh);

    // инстансы тайлов
    const geo = new THREE.BoxGeometry(TILE * 0.98, 0.35, TILE * 0.98);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, metalness: 0 });
    this.inst = new THREE.InstancedMesh(geo, mat, n * n);
    this.inst.receiveShadow = true;
    this.inst.castShadow = false;
    const m = new THREE.Matrix4();
    let i = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const t = grid.get(x, y);
        const { wx, wz } = grid.gridToWorld(x, y);
        // лёгкая «грунтовая» вариация: больше травы к центру, грунт к краям
        const edge = Math.max(Math.abs(x - n / 2), Math.abs(y - n / 2)) / (n / 2);
        let base = this.pal.b;
        if (Math.random() < edge * 0.5) { base = this.pal.dirt; t.type = 'dirt'; }
        else if (Math.random() < 0.12) base = (Math.random() < 0.5 ? this.pal.a : this.pal.c);
        m.makeTranslation(wx, -0.175, wz);
        this.inst.setMatrixAt(i, m);
        this.inst.setColorAt(i, jitterColor(base, 0.06));
        t._inst = i;
        i++;
      }
    }
    this.inst.instanceMatrix.needsUpdate = true;
    if (this.inst.instanceColor) this.inst.instanceColor.needsUpdate = true;
    scene.add(this.inst);

    // декор (кусты + валуны) — чисто визуально, инстансами в 2 draw call
    this._scatterDecor(scene, grid, n);

    // подсветка наведения (квадрат)
    const hl = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.96, TILE * 0.96),
      new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.35, depthWrite: false })
    );
    hl.rotation.x = -Math.PI / 2; hl.position.y = 0.03; hl.visible = false;
    scene.add(hl);
    this.hover = hl;

    // призрак постройки (footprint w×h) — модель шарится между кадрами
    this.ghost = new THREE.Group();
    this.ghost.visible = false;
    scene.add(this.ghost);
    this._ghostModel = null;
    this.ghostPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x44ff66, transparent: true, opacity: 0.3, depthWrite: false })
    );
    this.ghostPlane.rotation.x = -Math.PI / 2;
    this.ghost.add(this.ghostPlane);
  }

  _scatterDecor(scene, grid, n) {
    const bushGeo = new THREE.ConeGeometry(0.18, 0.34, 5);
    const rockGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const dmat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 });
    const bn = Math.floor(n * n * 0.03), rn = Math.floor(n * n * 0.012);
    const bushes = new THREE.InstancedMesh(bushGeo, dmat(), bn);
    const rocks = new THREE.InstancedMesh(rockGeo, dmat(), rn);
    bushes.castShadow = bushes.receiveShadow = true;
    rocks.castShadow = rocks.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const fill = (inst, count, cA, cB, yb, sMin, sMax) => {
      for (let i = 0; i < count; i++) {
        const gx = 1 + Math.floor(Math.random() * (n - 2)), gy = 1 + Math.floor(Math.random() * (n - 2));
        const w = grid.gridToWorld(gx, gy);
        const sc = sMin + Math.random() * (sMax - sMin);
        p.set(w.wx + (Math.random() - 0.5) * 0.7, yb * sc, w.wz + (Math.random() - 0.5) * 0.7);
        q.setFromAxisAngle(up, Math.random() * 6.28);
        s.set(sc, sc * (0.8 + Math.random() * 0.5), sc);
        m.compose(p, q, s); inst.setMatrixAt(i, m);
        inst.setColorAt(i, new THREE.Color(Math.random() < 0.5 ? cA : cB).multiplyScalar(0.85 + Math.random() * 0.3));
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    };
    fill(bushes, bn, this.pal.b, this.pal.c, 0.17, 0.6, 1.6);
    fill(rocks, rn, PAL.rock, PAL.rockDk, 0.12, 0.5, 1.4);
    scene.add(bushes); scene.add(rocks);
  }

  setHover(tile) {
    if (!tile) { this.hover.visible = false; return; }
    const { wx, wz } = this.grid.gridToWorld(tile.x, tile.y);
    this.hover.position.set(wx, 0.03, wz);
    this.hover.visible = true;
  }

  // показать призрак footprint w×h с левым-верхним углом (gx,gy); model — кэш на постройку
  setGhost(gx, gy, w, h, ok, model) {
    if (model && model !== this._ghostModel) {
      if (this._ghostModel) this.ghost.remove(this._ghostModel);
      model.traverse(o => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.55; } });
      this.ghost.add(model);
      this._ghostModel = model;
    }
    const c = this.grid.footprintCenter(gx, gy, w, h);
    if (this._ghostModel) this._ghostModel.position.set(c.wx, 0, c.wz);
    this.ghostPlane.scale.set(w * TILE * 0.96, h * TILE * 0.96, 1);
    this.ghostPlane.position.set(c.wx, 0.05, c.wz);
    this.ghostPlane.material.color.setHex(ok ? 0x44ff66 : 0xff3030);
    this.ghost.visible = true;
  }

  hideGhost() {
    if (this._ghostModel) { this.ghost.remove(this._ghostModel); this._ghostModel = null; }
    this.ghost.visible = false;
  }
}
