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
  { model: 'bld_ambar', angle: 95, radius: 1.7, scale: 0.22 },
  { model: 'bld_church', angle: 165, radius: 1.65, scale: 0.22 },
  { model: 'bld_izba', angle: 235, radius: 1.55, scale: 0.24 },
  { model: 'bld_tower', angle: 305, radius: 1.6, scale: 0.24 },
];

const DRONE_BOB_AMPL = 0.2;     // м, по спеке
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

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._teardown();
  }

  _build() {
    const { scene, assets } = this.game;
    const g = new THREE.Group();
    g.name = 'lobbyScene';

    // круглый подиум — своя геометрия/материал (не из AssetManager), явно освобождается в _teardown
    const platGeo = new THREE.CylinderGeometry(2.35, 2.65, 0.22, 40);
    const platMat = new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.92, metalness: 0.04 });
    const plat = new THREE.Mesh(platGeo, platMat);
    plat.position.y = -0.11;
    plat.receiveShadow = true;
    g.add(plat);
    this._ownGeo = [platGeo]; this._ownMat = [platMat];

    // ратуша — сердце поселения, прямо под Дроном
    const th = assets.get('bld_townhall');
    cloneOwnMaterials(th);
    th.scale.setScalar(0.3);
    th.position.set(0, 0, 0);
    g.add(th);

    // застава по кругу
    for (const b of RING) {
      const view = assets.get(b.model);
      cloneOwnMaterials(view);
      const rad = b.angle * Math.PI / 180;
      view.position.set(Math.cos(rad) * b.radius, 0, Math.sin(rad) * b.radius);
      view.scale.setScalar(b.scale);
      view.rotation.y = -rad + Math.PI;   // фасадом примерно к центру площадки
      g.add(view);
    }

    // Дрон — левитирующий идол над центром. Модель idol_dron — «чудо»-монумент реальной игры
    // (метра 4-5 в высоту на масштабе 1), для диорамы уменьшаем на порядок, а не как здания.
    const drone = assets.get('idol_dron');
    cloneOwnMaterials(drone);
    drone.position.set(0, 1.05, 0);
    drone.scale.setScalar(0.17);
    g.add(drone);
    this.drone = drone;
    drone.traverse(o => {
      if (o.isMesh && o.material && o.material.name === 'idol_eye') {
        this.droneEye = o.material;
        this.droneEyeBase = o.material.emissiveIntensity ?? 1;
      }
    });

    // прожектор Дрона — сканирует площадку медленным кругом
    const spot = new THREE.SpotLight(0x9fe8ff, 5.5, 11, Math.PI / 6.5, 0.45, 1.3);
    spot.position.set(0, 1.05, 0);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(1.7, 0, 0);
    g.add(spotTarget);
    spot.target = spotTarget;
    g.add(spot);
    this.spot = spot; this.spotTarget = spotTarget;

    scene.add(g);
    this.group = g;

    // камера — фиксированный киношный ракурс на диораму (не трогаем cameraRig.target/radius/... —
    // тот пересчитает camera.position с нуля на первом же кадре настоящего Loop после старта партии)
    // диорама смещена в кадре к правому краю (там же, где в разметке #start остаётся видимый зазор
    // у панели) — камера смотрит НЕ в центр группы, а левее её, отчего сама группа уезжает вправо.
    this._camBase = new THREE.Vector3(0.5, 1.9, 5.6);
    this._camLook = new THREE.Vector3(-4.8, 0.65, 0);
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
    this.group = null; this.drone = null; this.droneEye = null; this.spot = null; this.spotTarget = null;
    this._ownGeo = []; this._ownMat = [];
  }

  _loop() {
    if (!this._running) return;
    const now = performance.now();
    let dt = (now - this._lastTs) / 1000; if (dt > 0.1) dt = 0.1;
    this._lastTs = now;
    this._t += dt;

    if (this.drone) {
      this.drone.position.y = 1.05 + Math.sin((this._t / DRONE_BOB_PERIOD) * Math.PI * 2) * DRONE_BOB_AMPL;
      this.drone.rotation.y += dt * 0.22;
    }
    if (this.droneEye) {
      const k = 0.5 + 0.5 * Math.sin((this._t / EYE_PULSE_PERIOD) * Math.PI * 2);
      this.droneEye.emissiveIntensity = EYE_PULSE_MIN + (EYE_PULSE_MAX - EYE_PULSE_MIN) * k;
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
