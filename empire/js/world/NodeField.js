// ===== Инстансное поле ресурсных нод (деревья/камень/золото) =====
// Вместо ~800 отдельных Object3D — по одному InstancedMesh на тип (1 draw call).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildPlaceholder } from '../engine/Placeholders.js?v=83';

// Слить меши плейсхолдера в одну геометрию с запечёнными vertex-color (1 материал).
function bakedGeometry(modelName) {
  const group = buildPlaceholder(modelName);
  group.updateMatrixWorld(true);
  const geos = [];
  group.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    const col = o.material.color ? o.material.color.clone() : new THREE.Color(0xffffff);
    if (o.material.emissive && o.material.emissiveIntensity > 0) col.lerp(o.material.emissive, 0.5);
    const n = g.attributes.position.count;
    const carr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { carr[i * 3] = col.r; carr[i * 3 + 1] = col.g; carr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(carr, 3));
    geos.push(g);
  });
  return mergeGeometries(geos, false) || new THREE.BoxGeometry(0.4, 0.6, 0.4);
}

export class NodeField {
  constructor(scene, modelName, maxCount) {
    const geo = bakedGeometry(modelName);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.0 });
    this.inst = new THREE.InstancedMesh(geo, mat, maxCount);
    this.inst.castShadow = false;
    this.inst.receiveShadow = false;
    this.inst.count = 0;
    this.inst.frustumCulled = false;          // одна большая «куча», не отсекаем
    // per-instance цвет (тонировка-вариативность); белый = без изменений
    this.inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3).fill(1), 3);
    scene.add(this.inst);
    this.slots = [];                          // index -> node
    this.pr = [];                             // index -> {x,y,z,ry,sc,baseSc,aspect}
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
    this._c = new THREE.Color();
  }

  _write(i) {
    const pr = this.pr[i];
    this._p.set(pr.x, pr.y, pr.z);
    this._q.setFromAxisAngle(this._up, pr.ry);
    const b = pr.baseSc * pr.sc;             // baseSc = индивидуальный размер, sc = доля роста (рубка/отрастание)
    this._s.set(b, b * pr.aspect, b);        // aspect — высота: узкие/раскидистые экземпляры
    this._m.compose(this._p, this._q, this._s);
    this.inst.setMatrixAt(i, this._m);
  }

  add(node, x, y, z, ry, sc, opt = {}) {
    const i = this.inst.count;
    if (i >= this.inst.instanceMatrix.count) return -1;   // переполнение — игнор
    this.inst.count = i + 1;
    this.slots[i] = node;
    this.pr[i] = { x, y, z, ry, sc, baseSc: opt.baseSc ?? 1, aspect: opt.aspect ?? 1 };
    node.field = this; node.instIndex = i;
    this._write(i);
    if (opt.tint != null) { this._c.set(opt.tint); this.inst.setColorAt(i, this._c); this.inst.instanceColor.needsUpdate = true; }
    this.inst.instanceMatrix.needsUpdate = true;
    return i;
  }

  setScale(node, sc) {
    const i = node.instIndex; if (i < 0) return;
    this.pr[i].sc = sc; this._write(i);
    this.inst.instanceMatrix.needsUpdate = true;
  }

  setY(node, y) {
    const i = node.instIndex; if (i < 0) return;
    this.pr[i].y = y; this._write(i);
    this.inst.instanceMatrix.needsUpdate = true;
  }

  remove(node) {
    const i = node.instIndex; if (i < 0) return;
    const last = this.inst.count - 1;
    if (i !== last) {
      const moved = this.slots[last];
      this.pr[i] = this.pr[last];
      this.slots[i] = moved;
      if (moved) moved.instIndex = i;
      this.inst.getMatrixAt(last, this._m);
      this.inst.setMatrixAt(i, this._m);
      this.inst.getColorAt(last, this._c);   // перенести и тон вместе с матрицей
      this.inst.setColorAt(i, this._c);
      this.inst.instanceColor.needsUpdate = true;
    }
    this.inst.count = last;
    this.slots[last] = null;
    node.instIndex = -1; node.field = null;
    this.inst.instanceMatrix.needsUpdate = true;
  }

  nodeAt(instanceId) { return this.slots[instanceId] || null; }
}
