// ===== Three.js рендерер, сцена, свет, туман — настроение идол-слоя «Гойды» =====
import * as THREE from 'three';
import { PAL } from '../data/config.js';

export class Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PAL.bg);
    this.scene.fog = new THREE.FogExp2(PAL.bg, 0.012);

    // Тёплый эмбиент + золотой ключевой свет (как в «Гойде»)
    this.amb = new THREE.AmbientLight(0x55401e, 1.1);
    this.scene.add(this.amb);

    this.key = new THREE.DirectionalLight(0xffd9a0, 1.6);
    this.key.position.set(18, 32, 14);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    const d = 30;
    const cam = this.key.shadow.camera;
    cam.left = -d; cam.right = d; cam.top = d; cam.bottom = -d;
    cam.near = 1; cam.far = 120;
    this.key.shadow.bias = -0.0004;
    this.scene.add(this.key);
    this.scene.add(this.key.target);

    // Холодный контровой подсвет (славянский сумрак)
    this.rim = new THREE.DirectionalLight(0x2a4a6a, 0.5);
    this.rim.position.set(-16, 12, -18);
    this.scene.add(this.rim);

    // Малиновый «дух» у центра — динамически усиливается в СВЕРХ-ГОЙДА
    this.heart = new THREE.PointLight(PAL.crimson, 0.0, 40, 2);
    this.heart.position.set(0, 4, 0);
    this.scene.add(this.heart);

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.onResize) this.onResize(window.innerWidth, window.innerHeight);
  }

  render(camera) { this.renderer.render(this.scene, camera); }
}
