// ===== Суточный цикл (день/ночь) + ПОГОДА (ясно/дождь/снег/туман/гроза + ветер) =====
import * as THREE from 'three';

const CYCLE = 220;   // сек на полные сутки (~день 1.8 мин)

// параметры каждого типа погоды: осадки, множитель яркости, множитель тумана, ветер, длительность [мин,макс]
const WEATHER = {
  clear: { precip: null,   bright: 1.0,  fogMul: 1.0, wind: 0.15, dur: [50, 95] },
  rain:  { precip: 'rain', bright: 0.72, fogMul: 1.6, wind: 0.5,  dur: [26, 48] },
  snow:  { precip: 'snow', bright: 0.82, fogMul: 1.5, wind: 0.35, dur: [30, 60] },
  fog:   { precip: null,   bright: 0.7,  fogMul: 3.6, wind: 0.08, dur: [28, 50] },
  storm: { precip: 'rain', bright: 0.5,  fogMul: 2.0, wind: 0.9,  dur: [20, 36] },
};

// «корзина» вероятностей по карте (повтор = больше шанс); снег — только в горах/дефолте
const WEATHER_BY_MAP = {
  gory:    ['clear', 'clear', 'snow', 'snow', 'fog', 'storm'],
  boloto:  ['clear', 'fog', 'fog', 'rain', 'rain', 'storm'],
  step:    ['clear', 'clear', 'clear', 'rain', 'fog', 'storm'],
  les:     ['clear', 'clear', 'rain', 'rain', 'fog', 'storm'],
  neon:    ['clear', 'clear', 'rain', 'storm', 'fog', 'storm'],
  _default:['clear', 'clear', 'rain', 'fog', 'snow', 'storm'],
};

export class Sky {
  constructor(scene, rdr) {
    this.scene = scene; this.rdr = rdr;
    this.t = 0.30;                 // старт — утро
    this.weather = 'clear';
    this.wT = 26 + Math.random() * 20;
    this._bright = 1; this._fogMul = 1; this.wind = 0.15; this._flash = 0;
    this.base = {
      keyI: rdr.key.intensity, hemiI: rdr.hemi.intensity, ambI: rdr.amb.intensity,
      keyC: rdr.key.color.clone(), hemiSky: rdr.hemi.color.clone(),
      fogC: scene.fog.color.clone(), fogD: scene.fog.density,
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

  _pickWeather(mapKey) {
    const bag = WEATHER_BY_MAP[mapKey] || WEATHER_BY_MAP._default;
    let pick = bag[(Math.random() * bag.length) | 0];
    if (pick === this.weather && Math.random() < 0.6) pick = bag[(Math.random() * bag.length) | 0];
    this.weather = pick;
    const d = WEATHER[pick].dur;
    this.wT = d[0] + Math.random() * (d[1] - d[0]);
    if (this.onWeather) this.onWeather(pick);   // опц. колбэк для тоста/звука
  }

  update(dt, target, mapKey, now) {
    // ---- сутки ----
    this.t += dt / CYCLE; if (this.t >= 1) this.t -= 1;
    const elev = Math.sin(this.t * Math.PI * 2 - Math.PI / 2);   // -1 ночь .. +1 полдень
    const day = Math.max(0, elev);
    this.day = day;                                              // наружу — для атмосферы (светлячки/птицы)
    const horizon = Math.max(0, 1 - Math.abs(elev) * 1.5);        // рассвет/закат у горизонта

    // ---- выбор/переход погоды (плавно тянем параметры к целевым) ----
    this.wT -= dt;
    if (this.wT <= 0) this._pickWeather(mapKey);
    const W = WEATHER[this.weather];
    this._bright += (W.bright - this._bright) * Math.min(1, dt * 0.6);
    this._fogMul += (W.fogMul - this._fogMul) * Math.min(1, dt * 0.6);
    this.wind += (W.wind - this.wind) * Math.min(1, dt * 0.8);

    // молния в грозу: редкая яркая вспышка с резким спадом
    if (this.weather === 'storm' && Math.random() < dt * 0.45) this._flash = 1;
    this._flash = Math.max(0, this._flash - dt * 3.2);
    const flash = this._flash * this._flash;

    let bright = (0.12 + 0.88 * day) * this._bright;

    const r = this.rdr;
    r.key.intensity = this.base.keyI * bright + flash * 1.8;
    r.hemi.intensity = this.base.hemiI * (0.25 + 0.75 * day) + flash * 0.6;
    r.amb.intensity = this.base.ambI * (0.30 + 0.70 * day) + flash * 0.5;

    const kc = new THREE.Color(0x22304f);                          // ночь — холодный синий
    kc.lerp(new THREE.Color(0xff8a44), Math.min(1, horizon * 1.2)); // оранж у горизонта
    kc.lerp(this.base.keyC, day);                                   // белый в зените
    if (flash > 0.01) kc.lerp(new THREE.Color(0xcfd8ff), Math.min(1, flash)); // вспышка белит свет
    r.key.color.copy(kc);

    r.hemi.color.copy(new THREE.Color(0x1a2238).lerp(this.base.hemiSky, day));

    // ---- дистанционный туман (FogExp2.density) + цвет ----
    this.scene.fog.density = this.base.fogD * this._fogMul;
    const fc = new THREE.Color(0x0e1220).lerp(this.base.fogC, Math.max(day, horizon * 0.6));
    if (this.weather === 'rain' || this.weather === 'storm') fc.lerp(new THREE.Color(0x59636f), 0.4);
    if (this.weather === 'fog') fc.lerp(new THREE.Color(0xb9bcc6), 0.5);     // молочная дымка
    if (flash > 0.01) fc.lerp(new THREE.Color(0xc8d0e8), Math.min(0.8, flash));
    this.scene.fog.color.copy(fc);

    // ---- осадки ----
    const precipKind = W.precip;
    if (precipKind) {                                              // подменяем материал с переносом текущей прозрачности
      const want = precipKind === 'snow' ? this.snowMat : this.rainMat;
      if (this.precip.material !== want) { want.opacity = this.precip.material.opacity; this.precip.material = want; }
    }
    const targetOp = !precipKind ? 0 : (precipKind === 'snow' ? 0.85 : (this.weather === 'storm' ? 0.7 : 0.5));
    const mat = this.precip.material;
    mat.opacity += (targetOp - mat.opacity) * Math.min(1, dt * 1.5);

    if (mat.opacity > 0.01) {
      this.precip.visible = true;
      this.precip.position.set(target.x, 0, target.z);
      const arr = this.geo.attributes.position.array, snow = precipKind === 'snow';
      const fall = (snow ? 6 : (this.weather === 'storm' ? 42 : 30)) * dt;
      const drift = (snow ? 0.7 : 2.4) + this.wind * 6;            // ветер сносит струи/хлопья вбок
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
