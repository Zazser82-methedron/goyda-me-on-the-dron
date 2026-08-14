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

  // мировая точка на земле; рельеф учитывается дешёвым ray-march по heightAt (без триангуляции)
  groundPoint(camera, grid) {
    this.ray.setFromCamera(this.ndc, camera);
    if (!this.ray.ray.intersectPlane(this.groundPlane, this._hit)) return null;
    if (grid && grid.heights) {
      const o = this.ray.ray.origin, d = this.ray.ray.direction;
      for (let i = 0; i < 5; i++) {
        const h = grid.heightAt(this._hit.x, this._hit.z);
        if (Math.abs(d.y) < 1e-5) break;
        const t = (h - o.y) / d.y;
        if (t < 0) break;
        this._hit.set(o.x + d.x * t, h, o.z + d.z * t);
      }
    }
    return this._hit;
  }

  // тайл под курсором {x,y} или null
  tileUnder(camera, grid) {
    const p = this.groundPoint(camera, grid);
    if (!p) return null;
    const t = grid.worldToGrid(p.x, p.z);
    return grid.inBounds(t.x, t.y) ? t : null;
  }

  // ближайшая сущность: pickables (Object3D с userData.entity) + инстансные поля нод
  entityUnder(camera, pickables, fields) {
    this.ray.setFromCamera(this.ndc, camera);
    const targets = pickables ? pickables.slice() : [];
    if (fields) for (const f of fields) targets.push(f.inst);
    // защита от транзиентного undefined/null (здание/поле в процессе создания-удаления в тот же кадр) —
    // Raycaster.intersectObjects падает на .layers первого же «дырявого» элемента (баг всплыл при
    // наведении курсора во время __stress-спавна большой пачки юнитов)
    const clean = targets.filter(Boolean);
    if (!clean.length) return null;
    const hits = this.ray.intersectObjects(clean, true);
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

  // как entityUnder, но с запасом радиуса вокруг (cx,cy) в пикселях — палец толще курсора, точный райкаст часто мажет
  entityUnderNear(camera, pickables, fields, cx, cy, radiusPx) {
    const r = this.dom.getBoundingClientRect();
    const test = (x, y) => {
      this.ndc.x = ((x - r.left) / r.width) * 2 - 1;
      this.ndc.y = -((y - r.top) / r.height) * 2 + 1;
      return this.entityUnder(camera, pickables, fields);
    };
    let e = test(cx, cy);
    if (e || !radiusPx) return e;
    const k = radiusPx * 0.7071;
    const offs = [[radiusPx, 0], [-radiusPx, 0], [0, radiusPx], [0, -radiusPx], [k, k], [-k, k], [k, -k], [-k, -k]];
    for (const [ox, oy] of offs) { e = test(cx + ox, cy + oy); if (e) return e; }
    return null;
  }
}
