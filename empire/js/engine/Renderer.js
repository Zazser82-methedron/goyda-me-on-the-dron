// ===== Three.js рендерер, сцена, свет, туман — настроение идол-слоя «Гойды» =====
import * as THREE from 'three';
import { PAL } from '../data/config.js?v=58';

// Цветокоррекция (пост): контраст вокруг 0.5, насыщенность, лёгкий тёплый тон, мягкая виньетка.
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.12 }, saturation: { value: 1.18 }, warmth: { value: 0.016 }, vignette: { value: 0.36 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader:
    'uniform sampler2D tDiffuse; uniform float contrast, saturation, warmth, vignette; varying vec2 vUv;' +
    'void main(){' +
    '  vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb;' +
    '  c = (c - 0.5) * contrast + 0.5;' +                                  // контраст
    '  float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, saturation);' + // насыщенность
    '  c += vec3(warmth, warmth * 0.25, -warmth);' +                       // тёплый тон
    '  vec2 d = vUv - 0.5; float v = smoothstep(0.9, 0.32, length(d));' +
    '  c *= mix(1.0, v, vignette);' +                                      // виньетка
    '  gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a);' +
    '}',
};

// Tilt-shift / псевдо-DoF: резкая горизонтальная полоса, размытие к верху/низу → эффект «миниатюры/диорамы».
const TILTSHIFT_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    focus: { value: 0.58 },     // центр резкости по вертикали (0 верх .. 1 низ)
    band: { value: 0.16 },      // полуширина резкой полосы
    strength: { value: 7.0 },   // макс. радиус размытия по краям (пиксели)
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader:
    'uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float focus, band, strength; varying vec2 vUv;' +
    'void main(){' +
    '  float dy = abs(vUv.y - focus);' +
    '  float b = clamp((dy - band) * 2.4, 0.0, 1.0); b *= b;' +            // 0 в полосе → 1 к краям (мягкий старт)
    '  vec2 px = (b * strength) / resolution;' +
    '  vec4 s = texture2D(tDiffuse, vUv) * 0.227;' +                       // 9 отсчётов, гаусс-подобные веса
    '  s += texture2D(tDiffuse, vUv + vec2(px.x, 0.0)) * 0.123;' +
    '  s += texture2D(tDiffuse, vUv - vec2(px.x, 0.0)) * 0.123;' +
    '  s += texture2D(tDiffuse, vUv + vec2(0.0, px.y)) * 0.123;' +
    '  s += texture2D(tDiffuse, vUv - vec2(0.0, px.y)) * 0.123;' +
    '  s += texture2D(tDiffuse, vUv + px * 1.5) * 0.07;' +
    '  s += texture2D(tDiffuse, vUv - px * 1.5) * 0.07;' +
    '  s += texture2D(tDiffuse, vUv + vec2(px.x, -px.y) * 1.5) * 0.07;' +
    '  s += texture2D(tDiffuse, vUv + vec2(-px.x, px.y) * 1.5) * 0.07;' +
    '  gl_FragColor = s;' +
    '}',
};

export class Renderer {
  constructor(canvas) {
    // alpha:false — канвас НЕПРОЗРАЧНЫЙ (небо рисует scene.background). Прозрачный канвас под
    // пост-обработкой заставлял HUD-панели мерцать при перерисовке поверх канваса.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;        // было 1.25 — сцена пересвечивалась/«белила»
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._shadowSize = 2048;                          // чётче тени (было 1024)

    this.scene = new THREE.Scene();
    // непрозрачный градиент-небо в сцене (нужно для пост-обработки) — заменяет CSS-фон
    this.scene.background = this._skyBg(PAL.sky, PAL.skyLow);
    // дистанционный туман тоньше (0.0045 → 0.0026) — даль больше не тонет в белой дымке при отдалении
    this.scene.fog = new THREE.FogExp2(PAL.fog, 0.0026);
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
    this.key.shadow.mapSize.set(this._shadowSize, this._shadowSize);
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
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { SMAAPass }, { ShaderPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
        import('three/addons/postprocessing/SMAAPass.js'),
        import('three/addons/postprocessing/ShaderPass.js'),
      ]);
      const w = window.innerWidth, h = window.innerHeight;
      const composer = new EffectComposer(this.renderer);
      composer.setPixelRatio(this.renderer.getPixelRatio());
      composer.setSize(w, h);
      composer.addPass(new RenderPass(this.scene, camera));
      // порог высокий → светятся только эмиссивные (идолы/огни/солнце), а НЕ яркий песок/снег
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.4, 1.35);   // сила/радиус/порог (порог↑ — меньше «белит»)
      composer.addPass(this.bloom);
      composer.addPass(new OutputPass());   // тонмаппинг+sRGB → дальше грейд работает по финальной картинке
      // цветокоррекция: контраст + насыщенность + тёплый тон + виньетка — «дорогая» подача, убирает вымытость
      this.grade = new ShaderPass(GRADE_SHADER);
      composer.addPass(this.grade);
      // tilt-shift диорама: резкая полоса в центре, мягкое размытие к краям («миниатюра»)
      this.tilt = new ShaderPass(TILTSHIFT_SHADER);
      this.tilt.uniforms.resolution.value.set(w, h);
      composer.addPass(this.tilt);
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
    if (this.tilt) this.tilt.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
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
