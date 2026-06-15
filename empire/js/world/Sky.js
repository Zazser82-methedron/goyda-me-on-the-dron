// ===== Суточный цикл (день/ночь) + погода (дождь/снег) =====
import * as THREE from 'three';

const CYCLE = 220;   // сек на полные сутки (~день 1.8 мин)

export class Sky {
  constructor(scene, rdr) {
    this.scene = scene; this.rdr = rdr;
    this.t = 0.30;                 // старт — утро
    this.wT = 30; this.raining = false; this.wKind = 'rain';
    this.base = {
      keyI: rdr.key.intensity, hemiI: rdr.hemi.intensity, ambI: rdr.amb.intensity,
      keyC: rdr.key.color.clone(), hemiSky: rdr.hemi.color.clone(), fogC: scene.fog.color.clone(),
    };
    this._buildPrecip();
  }

  _buildPrecip() {
    const N = 700; this.N = N;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 72; pos[i * 3 + 1] = Math.random() * 42; pos[i * 3 + 2] = (Math.random() - 0.5) * 72; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo = g;
    this.rainMat = new THREE.PointsMaterial({ color: 0x9fc8ff, size: 0.16, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.30, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.precip = new THREE.Points(g, this.rainMat);
    this.precip.frustumCulled = false; this.precip.renderOrder = 15; this.precip.visible = false;
    this.scene.add(this.precip);
  }

  update(dt, target, mapKey, now) {
    // ---- сутки ----
    this.t += dt / CYCLE; if (this.t >= 1) this.t -= 1;
    const elev = Math.sin(this.t * Math.PI * 2 - Math.PI / 2);   // -1 ночь .. +1 полдень
    const day = Math.max(0, elev);
    const horizon = Math.max(0, 1 - Math.abs(elev) * 1.5);        // рассвет/закат у горизонта
    let bright = 0.12 + 0.88 * day;
    if (this.raining) bright *= 0.72;

    const r = this.rdr;
    r.key.intensity = this.base.keyI * bright;
    r.hemi.intensity = this.base.hemiI * (0.25 + 0.75 * day);
    r.amb.intensity = this.base.ambI * (0.30 + 0.70 * day);

    const kc = new THREE.Color(0x22304f);                        // ночь — холодный синий
    kc.lerp(new THREE.Color(0xff8a44), Math.min(1, horizon * 1.2)); // оранж у горизонта
    kc.lerp(this.base.keyC, day);                                 // белый в зените
    r.key.color.copy(kc);

    r.hemi.color.copy(new THREE.Color(0x1a2238).lerp(this.base.hemiSky, day));

    const fc = new THREE.Color(0x0e1220).lerp(this.base.fogC, Math.max(day, horizon * 0.6));
    if (this.raining) fc.lerp(new THREE.Color(0x59636f), 0.4);
    this.scene.fog.color.copy(fc);

    // ---- погода ----
    this.wT -= dt;
    if (this.wT <= 0) {
      this.raining = !this.raining;
      this.wT = this.raining ? (24 + Math.random() * 26) : (45 + Math.random() * 55);
      if (this.raining) {
        this.wKind = (mapKey === 'gory') ? 'snow' : 'rain';
        this.precip.material = this.wKind === 'snow' ? this.snowMat : this.rainMat;
      }
    }
    const targetOp = this.raining ? (this.wKind === 'snow' ? 0.85 : 0.5) : 0;
    const mat = this.precip.material;
    mat.opacity += (targetOp - mat.opacity) * Math.min(1, dt * 1.5);

    if (mat.opacity > 0.01) {
      this.precip.visible = true;
      this.precip.position.set(target.x, 0, target.z);
      const arr = this.geo.attributes.position.array, snow = this.wKind === 'snow';
      const fall = (snow ? 6 : 30) * dt, drift = snow ? 0.7 : 2.4;
      for (let i = 0; i < this.N; i++) {
        const j = i * 3;
        arr[j + 1] -= fall;
        arr[j] += snow ? Math.sin(now * 0.001 + i) * drift * dt : drift * dt;
        if (arr[j + 1] < 0) { arr[j + 1] += 42; arr[j] = (Math.random() - 0.5) * 72; arr[j + 2] = (Math.random() - 0.5) * 72; }
      }
      this.geo.attributes.position.needsUpdate = true;
    } else { this.precip.visible = false; }
  }
}
