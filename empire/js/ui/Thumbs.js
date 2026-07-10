// ===== Оффскрин-рендер 3D-превью моделей для меню строительства =====
// Отдельный маленький WebGLRenderer: модель под 3/4-углом, свет — копия основной сцены (Renderer.js),
// чтобы превью совпадало с тем, что реально построится. Кэш по model; если позже доехал настоящий GLB
// (сначала мог быть плейсхолдер) — превью перегенерится при следующем запросе.
import * as THREE from 'three';

const W = 148, H = 108, FOV = 38;

export class Thumbs {
  constructor(assets) {
    this.assets = assets;
    this.cache = new Map();     // model -> { url, wasGlb }
    this._r = null;
  }

  _lazy() {
    if (this._r) return true;
    try {
      this._r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this._r.setSize(W, H);
      this._r.setClearColor(0x000000, 0);                 // прозрачный фон — под карточкой градиент категории
      this._r.outputColorSpace = THREE.SRGBColorSpace;
      this._r.toneMapping = THREE.ACESFilmicToneMapping;
      this._r.toneMappingExposure = 1.02;
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(0xcfe0f4, 0x6a5836, 1.45));
      this.scene.add(new THREE.AmbientLight(0xb8a888, 0.55));
      const key = new THREE.DirectionalLight(0xfff2dc, 2.3); key.position.set(4, 6.4, 2.8); this.scene.add(key);
      const rim = new THREE.DirectionalLight(0x9ab4d6, 0.6); rim.position.set(-3, 2.2, -3.4); this.scene.add(rim);
      this.cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 100);
      return true;
    } catch (e) { this._r = null; return false; }
  }

  // dataURL превью модели (или null, если WebGL-контекст не создался — карточка покажет эмодзи)
  get(model) {
    const isGlb = !this.assets.usingPlaceholder(model);
    const hit = this.cache.get(model);
    if (hit && (hit.wasGlb || !isGlb)) return hit.url;   // перегенерация только когда плейсхолдер сменился на GLB
    if (!this._lazy()) return null;
    try {
      const obj = this.assets.get(model);
      const bb = new THREE.Box3().setFromObject(obj);
      const size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      const rad = Math.max(size.x, size.y, size.z) * 0.5 || 1;
      const dist = rad / Math.tan((FOV / 2) * Math.PI / 180) * 1.4;
      this.cam.position.set(c.x + dist * 0.74, c.y + dist * 0.58, c.z + dist * 0.84);
      this.cam.lookAt(c.x, c.y - size.y * 0.06, c.z);
      this.scene.add(obj);
      this._r.render(this.scene, this.cam);
      this.scene.remove(obj);
      const url = this._r.domElement.toDataURL('image/png');
      this.cache.set(model, { url, wasGlb: isGlb });
      return url;
    } catch (e) { return null; }
  }
}
