// ===== Земля: инстансированные тайлы + подсветка наведения + призрак постройки =====
import * as THREE from 'three';
import { TILE, PAL } from '../data/config.js';

function jitterColor(hex, amt) {
  const c = new THREE.Color(hex);
  const f = 1 + (Math.random() * 2 - 1) * amt;
  c.multiplyScalar(f);
  return c;
}

export class TerrainMesh {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
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
        let base = PAL.grass2;
        if (Math.random() < edge * 0.5) { base = PAL.dirt; t.type = 'dirt'; }
        else if (Math.random() < 0.12) base = (Math.random() < 0.5 ? PAL.grass1 : PAL.grass3);
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
