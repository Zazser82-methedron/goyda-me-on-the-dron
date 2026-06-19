// ===== Three.js рендерер, сцена, свет, туман — настроение идол-слоя «Гойды» =====
import * as THREE from 'three';
import { PAL } from '../data/config.js?v=36';

export class Renderer {
  constructor(canvas) {
    // alpha:false — канвас НЕПРОЗРАЧНЫЙ (небо рисует scene.background). Прозрачный канвас под
    // пост-обработкой заставлял HUD-панели мерцать при перерисовке поверх канваса.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;        // фильмовый тон + место под bloom
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    // непрозрачный градиент-небо в сцене (нужно для пост-обработки) — заменяет CSS-фон
    this.scene.background = this._skyBg(PAL.sky, PAL.skyLow);
    this.scene.fog = new THREE.FogExp2(PAL.fog, 0.0045);  // даль уходит в светлый сумрак
    this.fxEnabled = false; this.composer = null;

    // Полусферический свет неба/земли — ровная читаемая засветка всей сцены
    this.hemi = new THREE.HemisphereLight(0xcfe0f4, 0x6a5836, 1.45);
    this.scene.add(this.hemi);

    // Мягкий общий подсвет
    this.amb = new THREE.AmbientLight(0xb8a888, 0.55);
    this.scene.add(this.amb);

    // Яркое тёплое «солнце» с тенями
    this.key = new THREE.DirectionalLight(0xfff2dc, 2.3);
    this.key.position.set(40, 64, 28);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    const d = 36;
    const cam = this.key.shadow.camera;
    cam.left = -d; cam.right = d; cam.top = d; cam.bottom = -d;
    cam.near = 1; cam.far = 200; cam.updateProjectionMatrix();
    this.key.shadow.bias = -0.0004;
    this.scene.add(this.key);
    this.scene.add(this.key.target);

    // Холодный контровой подсвет
    this.rim = new THREE.DirectionalLight(0x9ab4d6, 0.6);
    this.rim.position.set(-30, 22, -34);
    this.scene.add(this.rim);

    // Малиновый «дух» у центра — динамически усиливается в СВЕРХ-ГОЙДА
    this.heart = new THREE.PointLight(PAL.crimson, 0.4, 60, 2);
    this.heart.position.set(0, 4, 0);
    this.scene.add(this.heart);

    window.addEventListener('resize', () => this.resize());
  }

  // вертикальный градиент-небо как CanvasTexture
  _skyBg(top, low) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    const hex = (h) => '#' + ('000000' + (h >>> 0).toString(16)).slice(-6);
    g.addColorStop(0, hex(top)); g.addColorStop(1, hex(low));
    x.fillStyle = g; x.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  setSky(top, low) { if (this.scene.background && this.scene.background.dispose) this.scene.background.dispose(); this.scene.background = this._skyBg(top, low); }

  // пост-обработка: bloom + SMAA + тонмаппинг. Ленивая динамическая загрузка с фолбэком —
  // если аддоны не подгрузятся, игра рендерится обычным путём (без чёрного экрана).
  async setupComposer(camera) {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { SMAAPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
        import('three/addons/postprocessing/SMAAPass.js'),
      ]);
      const w = window.innerWidth, h = window.innerHeight;
      const composer = new EffectComposer(this.renderer);
      composer.setPixelRatio(this.renderer.getPixelRatio());
      composer.setSize(w, h);
      composer.addPass(new RenderPass(this.scene, camera));
      // порог высокий → светятся только эмиссивные (идолы/огни/солнце), а НЕ яркий песок/снег
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.4, 1.25);   // сила/радиус/порог
      composer.addPass(this.bloom);
      composer.addPass(new OutputPass());
      composer.addPass(new SMAAPass(w, h));
      this.composer = composer; this._camera = camera; this.fxEnabled = true;
      window.__gboot && window.__gboot('postfx ✓');
    } catch (e) { console.warn('postfx disabled', e); this.composer = null; this.fxEnabled = false; }
  }

  // IBL-окружение (отражения/мягкий свет для PBR) из процедурного RoomEnvironment — без внешних файлов
  async setupEnvironment() {
    try {
      const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
      // компенсируем добавленный IBL-свет, чтобы общая яркость не подскочила
      this.hemi.intensity = 1.05; this.amb.intensity = 0.32;
      this.envReady = true;
      window.__gboot && window.__gboot('env ✓');
    } catch (e) { console.warn('env disabled', e); }
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
    if (this.onResize) this.onResize(window.innerWidth, window.innerHeight);
  }

  // тень следует за камерой — маленький frustum (крупная карта 96² не тормозит)
  updateShadow(tx, tz) {
    this.key.position.set(tx + 36, 64, tz + 26);
    this.key.target.position.set(tx, 0, tz);
    this.key.target.updateMatrixWorld();
  }

  render(camera) {
    if (this.fxEnabled && this.composer) this.composer.render();
    else this.renderer.render(this.scene, camera);
  }
}
