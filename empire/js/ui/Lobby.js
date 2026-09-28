// ===== 3D-сцена стартового лобби (Фаза 3.1 PLAN_2026.md) =====
// Дрон парит над миниатюрным поселением: синус A=0.2м/T=2.4с, пульс рун через emissiveIntensity
// 0.5->1.5, прожектор сканирует площадку. Использует УЖЕ существующий this.game.rdr/scene/camera —
// отдельного WebGL-контекста не заводим (см. предупреждение в second-brain про 90465d3: второй
// контекст стоил 3 FPS в лейте). Свой rAF-цикл живёт ТОЛЬКО пока не запущен настоящий Loop
// (тот стартует в _begin(), см. main.js) — конфликта с игровым тиком нет.
import * as THREE from 'three';

// Миниатюрная застава вокруг ратуши — переиспользуем реальные модели/плейсхолдеры через AssetManager,
// той же техникой, что addBuilding (клон + собственные материалы, чтобы не красить общий кэш).
const RING = [
  { model: 'bld_izba', angle: 20, radius: 1.55, scale: 0.24 },
  { model: 'bld_melnica', angle: 70, radius: 1.75, scale: 0.24 },
  { model: 'bld_church', angle: 130, radius: 1.7, scale: 0.24 },
  { model: 'bld_ambar', angle: 185, radius: 1.6, scale: 0.22 },
  { model: 'bld_townhall', angle: 235, radius: 1.75, scale: 0.26 },
  { model: 'bld_tower', angle: 285, radius: 1.65, scale: 0.24 },
  { model: 'bld_kuznica', angle: 335, radius: 1.7, scale: 0.22 },
];
// лубочная раскраска крыш/ставен — та же палитра, что GameState.paintBuilding
const PAINT = {
  M_roof: [0xe8583e, 0x3cb074, 0x4f82e0, 0xf0b440, 0xc03a58],
  M_roof_iron: [0x17703a, 0xa8281a, 0x1f4494, 0xb8781a],
  M_shutter: [0xd23a2a, 0x2f9a5a, 0x2f5fc8, 0xe8b030],
};
function paint(obj, seed) {
  obj.traverse(o => {
    const pal = o.isMesh && PAINT[o.material && o.material.name];
    if (pal) o.material.color.setHex(pal[seed % pal.length]);
  });
}

const DRONE_BOB_AMPL = 0.03;     // м, по спеке
const DRONE_BOB_PERIOD = 2.4;   // с, по спеке
const EYE_PULSE_MIN = 0.5, EYE_PULSE_MAX = 1.5;   // emissiveIntensity, по спеке
const EYE_PULSE_PERIOD = 2.0;
const SPOT_SWEEP_PERIOD = 9.0;  // с на полный оборот прожектора над площадкой

function cloneOwnMaterials(obj) {
  obj.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
}

export class Lobby {
  constructor(game) {
    this.game = game;
    this.group = null;
    this.drone = null;
    this.droneEye = null;
    this.droneEyeBase = 1;
    this.spotTarget = null;
    this._t = 0;
    this._running = false;
    this._lastTs = 0;
    this._raf = null;
    this._parX = 0; this._parY = 0;   // параллакс от курсора (0..1 диапазон -0.5..0.5)
  }

  // mx,my: -0.5..0.5 (доля ширины/высоты панели от центра) — тот же сигнал, что раньше двигал CSS-фон
  setParallax(mx, my) { this._parX = mx; this._parY = my; }

  start() {
    if (this._running) return;
    this._running = true;
    this._build();
    this._lastTs = performance.now();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  // модели догрузились уже после старта лобби — пересобрать диораму с настоящими GLB вместо коробок-заглушек
  refresh() {
    if (!this._running || this._transitioning) return;
    this._teardown();
    this._build();
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._teardown();
  }

  // ===== 3.2: переход лобби -> игра, 2.2с (PLAN_2026.md) =====
  // 0.0-0.4 импульс Дрона (вспышка глаза + пульс масштаба) · 0.4-1.2 рывок камеры вниз, будто
  // пикируем к поселению · 1.2-1.8 пролёт сквозь облака — непрозрачный оверлей ЦЕЛИКОМ прячет
  // экран, и ИМЕННО тут (не раньше, не позже) вызывается тяжёлый синхронный startWith() —
  // тот же приём, что _portalArrivalFx() в main.js для портала. · 1.8-2.2 выход из облаков, HUD
  // проявляется. С момента вызова startWith() камерой/рендером управляет уже настоящий Loop —
  // свой rAF мы к этому моменту полностью останавливаем, конфликтов нет.
  playTransition(fk, mk) {
    if (this._transitioning) return;
    this._transitioning = true;
    if (this._raf) cancelAnimationFrame(this._raf);

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;'
      + 'background:radial-gradient(circle at 50% 42%,#fbfdff 0%,#dce9f2 55%,#aebfcf 100%);'
      + 'opacity:0;transition:opacity .4s ease-out';
    document.body.appendChild(overlay);

    const t0 = performance.now();
    const diveFrom = this._camBase.clone();
    const diveTo = new THREE.Vector3(0.15, 0.5, 1.3);       // низко над площадкой — «падаем» внутрь мира
    const lookFrom = this._camLook.clone();
    const lookTo = new THREE.Vector3(0, 0.5, -0.4);
    const droneBaseScale = 0.42;

    const stepDive = () => {
      const t = (performance.now() - t0) / 1000;
      if (t < 0.4) {
        // импульс Дрона: глаз вспыхивает к максимуму, силуэт слегка раздувается
        const k = t / 0.4;
        if (this.glowMats) for (const m of this.glowMats) m.emissiveIntensity = this.droneEyeBase + (3.5 - this.droneEyeBase) * Math.sin(k * Math.PI);
        if (this.drone) this.drone.scale.setScalar(droneBaseScale * (1 + 0.3 * Math.sin(k * Math.PI)));
        this.game.rdr.render(this.game.camera);
        this._raf = requestAnimationFrame(stepDive);
        return;
      }
      if (t < 1.2) {
        const k = Math.min(1, (t - 0.4) / 0.8);
        const ek = 1 - Math.pow(1 - k, 3);   // ease-out cubic — рывок резкий вначале, плавно гасится
        this.game.camera.position.lerpVectors(diveFrom, diveTo, ek);
        const look = new THREE.Vector3().lerpVectors(lookFrom, lookTo, ek);
        this.game.camera.lookAt(look);
        this.game.rdr.render(this.game.camera);
        this._raf = requestAnimationFrame(stepDive);
        return;
      }
      // t>=1.2 — облачная завеса: сначала гарантированно закрасить оверлей ДО тяжёлой синхронной
      // работы (иначе браузер не успеет отрисовать непрозрачный кадр перед фризом на buildWorld()).
      overlay.style.transition = 'none';
      overlay.style.opacity = '1';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this._raf = null;
        this.stop();                       // демонтируем сцену лобби, ПОКА экран закрыт облаками
        this.game.startWith(fk, mk);        // тяжёлая синхронная стройка мира — спрятана за оверлеем
        // выход из облаков: 1.8-2.2с
        overlay.style.transition = 'opacity .4s ease-out';
        overlay.style.opacity = '0';
        document.getElementById('hud')?.classList.remove('hud-entering');
        setTimeout(() => { overlay.remove(); this._transitioning = false; }, 420);
      }));
    };
    this._raf = requestAnimationFrame(stepDive);
  }

  _build() {
    const { scene, assets } = this.game;
    const g = new THREE.Group();
    g.name = 'lobbyScene';

    // круглый подиум — своя геометрия/материал (не из AssetManager), явно освобождается в _teardown
    const platGeo = new THREE.CylinderGeometry(2.35, 2.65, 0.22, 40);
    const platMat = new THREE.MeshStandardMaterial({ color: 0x5f8f3a, roughness: 0.95, metalness: 0 })   // зелёная травяная макушка острова;
    const plat = new THREE.Mesh(platGeo, platMat);
    plat.position.y = -0.11;
    plat.receiveShadow = true;
    g.add(plat);
    this._ownGeo = [platGeo]; this._ownMat = [platMat];

    // застава по кругу
    for (const b of RING) {
      const view = assets.get(b.model);
      cloneOwnMaterials(view);
      const rad = b.angle * Math.PI / 180;
      view.position.set(Math.cos(rad) * b.radius, 0, Math.sin(rad) * b.radius);
      view.scale.setScalar(b.scale);
      view.rotation.y = -rad + Math.PI;   // фасадом примерно к центру площадки
      paint(view, RING.indexOf(b) * 3 + 1);
      g.add(view);
    }

    // Дрон — левитирующий идол над центром. Модель idol_dron — «чудо»-монумент реальной игры
    // (метра 4-5 в высоту на масштабе 1), для диорамы уменьшаем на порядок, а не как здания.
    const drone = assets.get('bld_chudo');   // капище Идола Дрона из самой игры — парит над заставой
    cloneOwnMaterials(drone);
    drone.position.set(0, 0.02, 0);
    drone.scale.setScalar(0.42);
    g.add(drone);
    this.drone = drone;
    this.glowMats = [];   // светящиеся руны/глаз — пульсируют
    drone.traverse(o => { if (o.isMesh && o.material && (o.material.emissive && o.material.emissive.getHex() > 0 && o.material.emissiveIntensity > 0.2)) this.glowMats.push(o.material); });
    this.droneEyeBase = 1;

    // прожектор Дрона — сканирует площадку медленным кругом
    const spot = new THREE.SpotLight(0x9fe8ff, 5.5, 11, Math.PI / 6.5, 0.45, 1.3);
    spot.position.set(0, 1.5, 0);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(1.7, 0, 0);
    g.add(spotTarget);
    spot.target = spotTarget;
    g.add(spot);
    this.spot = spot; this.spotTarget = spotTarget;

    const fill = new THREE.HemisphereLight(0xfff0d0, 0x6a7a4a, 1.4);   // мягкая заливка: диорама не тонет в тени
    g.add(fill);
    scene.add(g);
    this.group = g;

    // камера — фиксированный киношный ракурс на диораму (не трогаем cameraRig.target/radius/... —
    // тот пересчитает camera.position с нуля на первом же кадре настоящего Loop после старта партии)
    // диорама смещена в кадре к правому краю (там же, где в разметке #start остаётся видимый зазор
    // у панели) — камера смотрит НЕ в центр группы, а левее её, отчего сама группа уезжает вправо.
    const wideCam = window.innerWidth >= 1400 && window.innerHeight >= 700;
    this._camBase = wideCam ? new THREE.Vector3(0.4, 2.6, 7.4) : new THREE.Vector3(0.5, 1.9, 5.6);
    const wide = window.innerWidth >= 1400 && window.innerHeight >= 700;
    this._camLook = new THREE.Vector3(wide ? -3.0 : -4.8, wide ? 0.85 : 0.65, 0);
    this.game.camera.position.copy(this._camBase);
    this.game.camera.lookAt(this._camLook);
  }

  _teardown() {
    if (!this.group) return;
    // materiaл глаза Дрона — СВОЙ клон (cloneOwnMaterials), но на всякий случай не трогаем
    // прототип в AssetManager.proto — тот вообще не пострадал, мы работали только с клоном.
    this.game.scene.remove(this.group);
    for (const geo of this._ownGeo) geo.dispose();
    for (const mat of this._ownMat) mat.dispose();
    this.group = null; this.drone = null; this.glowMats = null; this.spot = null; this.spotTarget = null;
    this._ownGeo = []; this._ownMat = [];
  }

  _loop() {
    if (!this._running) return;
    const now = performance.now();
    let dt = (now - this._lastTs) / 1000; if (dt > 0.1) dt = 0.1;
    this._lastTs = now;
    this._t += dt;

    if (this.drone) {
      this.drone.position.y = 0.02 + Math.sin((this._t / DRONE_BOB_PERIOD) * Math.PI * 2) * DRONE_BOB_AMPL;
      this.drone.rotation.y += dt * 0.22;
    }
    if (this.glowMats && this.glowMats.length) {
      const k = 0.5 + 0.5 * Math.sin((this._t / EYE_PULSE_PERIOD) * Math.PI * 2);
      const v = EYE_PULSE_MIN + (EYE_PULSE_MAX - EYE_PULSE_MIN) * k;
      for (const m of this.glowMats) m.emissiveIntensity = v;
    }
    if (this.spotTarget) {
      const a = (this._t / SPOT_SWEEP_PERIOD) * Math.PI * 2;
      this.spotTarget.position.set(Math.cos(a) * 1.8, 0, Math.sin(a) * 1.8);
    }
    if (this.game.camera) {
      // лёгкий параллакс камеры от курсора поверх базового ракурса
      const cam = this.game.camera;
      cam.position.set(
        this._camBase.x - this._parX * 1.1,
        this._camBase.y + this._parY * 0.6,
        this._camBase.z - this._parX * 0.5,
      );
      cam.lookAt(this._camLook);
    }

    this.game.rdr.render(this.game.camera);
    this._raf = requestAnimationFrame(() => this._loop());
  }
}
