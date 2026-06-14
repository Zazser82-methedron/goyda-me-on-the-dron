// ===== Райкаст: тайл под курсором (плоскость земли) и сущность под курсором =====
import * as THREE from 'three';

export class Picker {
  constructor(dom) {
    this.dom = dom;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2(0, 0);
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y = 0
    this._hit = new THREE.Vector3();
    this.hasPointer = false;

    dom.addEventListener('pointermove', (e) => {
      const r = dom.getBoundingClientRect();
      this.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      this.hasPointer = true;
    });
  }

  setFromEvent(e) {
    const r = this.dom.getBoundingClientRect();
    this.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.hasPointer = true;
  }

  // мировая точка пересечения с землёй (или null)
  groundPoint(camera) {
    this.ray.setFromCamera(this.ndc, camera);
    const hit = this.ray.ray.intersectPlane(this.groundPlane, this._hit);
    return hit ? this._hit : null;
  }

  // тайл под курсором {x,y} или null
  tileUnder(camera, grid) {
    const p = this.groundPoint(camera);
    if (!p) return null;
    const t = grid.worldToGrid(p.x, p.z);
    return grid.inBounds(t.x, t.y) ? t : null;
  }

  // ближайшая сущность: pickables (Object3D с userData.entity) + инстансные поля нод
  entityUnder(camera, pickables, fields) {
    this.ray.setFromCamera(this.ndc, camera);
    const targets = pickables ? pickables.slice() : [];
    if (fields) for (const f of fields) targets.push(f.inst);
    if (!targets.length) return null;
    const hits = this.ray.intersectObjects(targets, true);
    for (const h of hits) {
      if (h.object.isInstancedMesh && h.instanceId != null) {
        const f = fields && fields.find(ff => ff.inst === h.object);
        const node = f && f.nodeAt(h.instanceId);
        if (node) return node;
        continue;
      }
      let o = h.object;
      while (o) { if (o.userData && o.userData.entity) return o.userData.entity; o = o.parent; }
    }
    return null;
  }
}
