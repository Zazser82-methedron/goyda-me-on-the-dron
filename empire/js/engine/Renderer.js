// ===== Three.js рендерер, сцена, свет, туман — настроение идол-слоя «Гойды» =====
import * as THREE from 'three';
import { PAL } from '../data/config.js?v=12';

export class Renderer {
  constructor(canvas) {
    // alpha:true — сквозь канвас виден CSS-градиент неба
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;        // заметно ярче
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = null;                     // фон рисует CSS
    this.scene.fog = new THREE.FogExp2(PAL.fog, 0.0045);  // даль уходит в светлый сумрак

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

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.onResize) this.onResize(window.innerWidth, window.innerHeight);
  }

  // тень следует за камерой — маленький frustum (крупная карта 96² не тормозит)
  updateShadow(tx, tz) {
    this.key.position.set(tx + 36, 64, tz + 26);
    this.key.target.position.set(tx, 0, tz);
    this.key.target.updateMatrixWorld();
  }

  render(camera) { this.renderer.render(this.scene, camera); }
}
