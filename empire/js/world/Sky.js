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
    this._bright = 1; this._fogMul = 1; this.wind = 0.15; this.windGust = 0.15; this._flash = 0;
    this._gustPhase = Math.random() * 10;
    this.wetness = 0;              // 0..1 — мокрая земля (нарастает в дождь/грозу, сохнет после); наружу для TerrainMesh
    this.base = {
      keyI: rdr.key.intensity, hemiI: rdr.hemi.intensity, ambI: rdr.amb.intensity,
      keyC: rdr.key.color.clone(), hemiSky: rdr.hemi.color.clone(),
      fogC: scene.fog.color.clone(), fogD: scene.fog.density,
    };
    this._buildPrecip();
    this._sunVec = new THREE.Vector3();
    // палитра неба (предсоздана — не аллоцируем цвета в кадре)
    this._cTopDay = new THREE.Color(0x2f6fc0);   // зенит днём
    this._cHorDay = new THREE.Color(0xd2e4f2);   // горизонт днём
    this._cHorSet = new THREE.Color(0xf2b070);   // горизонт на закате
    this._cSunSet = new THREE.Color(0xff8838);   // солнце на закате
    this._buildDome();
  }

  // Кастомный купол-небо: вертикальный градиент (горизонт→зенит) + солнечный диск/гало.
  // Свой шейдер (а не Preetham-аддон) — предсказуемо рендерится везде, не «молочно-белый», легко тюнится.
  // Купол R=500 следует за камерой; depthTest off + renderOrder -1000 → фон, поверх рисуется всё остальное.
  _buildDome() {
    const geo = new THREE.SphereGeometry(500, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: {
        topC: { value: new THREE.Color(0x2f6fc0) },
        horC: { value: new THREE.Color(0xcfe2f0) },
        sunDir: { value: new THREE.Vector3(0.5, 0.6, 0.4) },
        sunC: { value: new THREE.Color(0xfff0d0) },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 topC, horC, sunDir, sunC; varying vec3 vDir;' +
        'void main(){' +
        '  vec3 dir = normalize(vDir);' +
        '  float h = clamp(dir.y*0.5+0.5, 0.0, 1.0);' +
        '  vec3 sky = mix(horC, topC, pow(h, 0.5));' +
        '  float d = max(dot(dir, normalize(sunDir)), 0.0);' +
        '  float disk = smoothstep(0.9986, 0.9995, d);' +
        '  float halo = pow(d, 90.0)*0.6 + pow(d, 6.0)*0.12;' +
        '  gl_FragColor = vec4(sky + sunC*(disk*1.6 + halo), 1.0);' +
        '}',
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.renderOrder = -1000; this.dome.frustumCulled = false;
    this.scene.add(this.dome);
  }

  // тонкая вертикальная полоса-«капля» вместо круглой точки — читается как дождь, а не летящие камешки
  _rainStreakTex() {
    const s = 32, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(200,222,255,0)');
    g.addColorStop(0.18, 'rgba(200,222,255,0.9)');
    g.addColorStop(0.82, 'rgba(200,222,255,0.9)');
    g.addColorStop(1, 'rgba(200,222,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(s * 0.4, 0, s * 0.2, s);
    const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
  }

  _buildPrecip() {
    const low = this.rdr.tier === 'low';
    const N = low ? 280 : 700; this.N = N;   // меньше частиц на мобиле/слабом железе
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 72; pos[i * 3 + 1] = Math.random() * 42; pos[i * 3 + 2] = (Math.random() - 0.5) * 72; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo = g;
    this.rainMat = new THREE.PointsMaterial({ map: this._rainStreakTex(), color: 0x9fc8ff, size: 0.7, transparent: true, opacity: 0, depthWrite: false, fog: false });
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

  update(dt, target, mapKey, now, camera) {
    // ---- сутки ----
    this.t += dt / CYCLE; if (this.t >= 1) this.t -= 1;
    const elev = Math.sin(this.t * Math.PI * 2 - Math.PI / 2);   // -1 ночь .. +1 полдень
    const day = Math.max(0, elev);
    this.day = day;                                              // наружу — для атмосферы (светлячки/птицы)
    const horizon = Math.max(0, 1 - Math.abs(elev) * 1.5);        // рассвет/закат у горизонта

    // ---- купол-небо: цвета по времени суток + солнце по азимуту key-света, купол едет за камерой ----
    if (this.dome) {
      if (camera) this.dome.position.copy(camera.position);
      const u = this.dome.material.uniforms;
      this._sunVec.set(36, elev * 90 + 6, 26).normalize();      // высота солнца = ход суток
      u.sunDir.value.copy(this._sunVec);
      // зенит: ночь тёмно-синий → день голубой
      u.topC.value.setHex(0x0a1530).lerp(this._cTopDay, day);
      // горизонт: ночь тёмный → день светлый → на закате тёплый
      u.horC.value.setHex(0x10182e).lerp(this._cHorDay, day).lerp(this._cHorSet, horizon * 0.75);
      // солнце: днём тёпло-белое → на закате оранжевое
      u.sunC.value.setHex(0xfff0d0).lerp(this._cSunSet, horizon * 0.6);
    }

    // ---- выбор/переход погоды (плавно тянем параметры к целевым) ----
    this.wT -= dt;
    if (this.wT <= 0) this._pickWeather(mapKey);
    const W = WEATHER[this.weather];
    this._bright += (W.bright - this._bright) * Math.min(1, dt * 0.6);
    this._fogMul += (W.fogMul - this._fogMul) * Math.min(1, dt * 0.6);
    this.wind += (W.wind - this.wind) * Math.min(1, dt * 0.8);

    // порывы ветра: базовый wind пульсирует (2 наложенных синуса) — не ровный поток, а живые порывы
    this._gustPhase += dt;
    const gust = 1 + Math.sin(this._gustPhase * 0.37) * 0.35 + Math.sin(this._gustPhase * 0.91 + 1.7) * 0.15;
    this.windGust = this.wind * Math.max(0.25, gust);

    // мокрая земля: намокает в дождь/грозу, медленно сохнет после — читает TerrainMesh.setWetness()
    const wetTarget = (this.weather === 'rain' || this.weather === 'storm') ? 1 : 0;
    this.wetness += (wetTarget - this.wetness) * Math.min(1, dt * 0.12);

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
    // днём даль уходит в светло-голубую дымку (сливается с атмосферным небом), на закате — тёплую
    this.scene.fog.density = this.base.fogD * this._fogMul;
    const dayFog = new THREE.Color(0x9cbcd8).lerp(new THREE.Color(0xd8b488), horizon * 0.6);
    const fc = new THREE.Color(0x0e1220).lerp(dayFog, Math.max(day, horizon * 0.6));
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
      const drift = (snow ? 0.7 : 2.4) + this.windGust * 6;        // порывистый ветер сносит струи/хлопья вбок
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
