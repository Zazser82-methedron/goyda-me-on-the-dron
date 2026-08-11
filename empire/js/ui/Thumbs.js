// ===== Оффскрин-рендер 3D-превью моделей для меню строительства =====
// Второй WebGLRenderer не создаём (лишний VRAM + риск потери контекста на мобиле/слабом GPU) —
// рендерим во временный WebGLRenderTarget на ОСНОВНОМ рендерере (Renderer.js), затем один раз
// читаем пиксели в 2D-canvas → dataURL. Свет — копия основной сцены, модель под 3/4-углом,
// чтобы превью совпадало с тем, что реально построится. Кэш по model; если позже доехал
// настоящий GLB (сначала мог быть плейсхолдер) — превью перегенерится при следующем запросе.
//
// Важный нюанс three.js: при рендере в кастомный RenderTarget (не canvas) шейдер всегда кодирует
// цвет в LinearSRGBColorSpace, игнорируя renderer.outputColorSpace, — иначе пиксели после
// readRenderTargetPixels были бы линейными и картинка выглядела бы тусклой/блёклой. Поэтому
// кодируем sRGB вручную через LUT при чтении.
import * as THREE from 'three';

const W = 148, H = 108, FOV = 38;

function linearToSRGB(c) { return c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
const SRGB_LUT = new Uint8ClampedArray(256);
for (let i = 0; i < 256; i++) SRGB_LUT[i] = Math.round(linearToSRGB(i / 255) * 255);

export class Thumbs {
  constructor(assets, renderer) {
    this.assets = assets;
    this._renderer = renderer || null;   // THREE.WebGLRenderer основной сцены — свой контекст не создаём
    this.cache = new Map();              // model -> { url, wasGlb }
    this._rt = null;
  }

  _lazy() {
    if (this._rt) return true;
    if (!this._renderer) return false;
    try {
      this._rt = new THREE.WebGLRenderTarget(W, H);
      this._buf = new Uint8Array(W * H * 4);
      this._canvas = document.createElement('canvas');
      this._canvas.width = W; this._canvas.height = H;
      this._ctx = this._canvas.getContext('2d');
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(0xcfe0f4, 0x6a5836, 1.45));
      this.scene.add(new THREE.AmbientLight(0xb8a888, 0.55));
      const key = new THREE.DirectionalLight(0xfff2dc, 2.3); key.position.set(4, 6.4, 2.8); this.scene.add(key);
      const rim = new THREE.DirectionalLight(0x9ab4d6, 0.6); rim.position.set(-3, 2.2, -3.4); this.scene.add(rim);
      this.cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 100);
      return true;
    } catch (e) { this._rt = null; return false; }
  }

  // dataURL превью модели (или null, если рендер-таргет не создался — карточка покажет эмодзи)
  get(model) {
    const isGlb = !this.assets.usingPlaceholder(model);
    const hit = this.cache.get(model);
    if (hit && (hit.wasGlb || !isGlb)) return hit.url;   // перегенерация только когда плейсхолдер сменился на GLB
    if (!this._lazy()) return null;
    const r = this._renderer;
    const prevTarget = r.getRenderTarget();
    const prevClearColor = new THREE.Color();
    r.getClearColor(prevClearColor);
    const prevClearAlpha = r.getClearAlpha();
    let obj = null;
    try {
      obj = this.assets.get(model);
      const bb = new THREE.Box3().setFromObject(obj);
      const size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      const rad = Math.max(size.x, size.y, size.z) * 0.5 || 1;
      const dist = rad / Math.tan((FOV / 2) * Math.PI / 180) * 1.4;
      this.cam.position.set(c.x + dist * 0.74, c.y + dist * 0.58, c.z + dist * 0.84);
      this.cam.lookAt(c.x, c.y - size.y * 0.06, c.z);
      this.scene.add(obj);

      r.setRenderTarget(this._rt);
      r.setClearColor(0x000000, 0);           // прозрачный фон — под карточкой градиент категории
      r.clear(true, true, true);
      r.render(this.scene, this.cam);
      r.readRenderTargetPixels(this._rt, 0, 0, W, H, this._buf);

      // строки снизу вверх (WebGL) → переворачиваем в top-down для canvas, RGB кодируем в sRGB, альфу не трогаем
      const img = this._ctx.createImageData(W, H);
      const dst = img.data, src = this._buf;
      for (let y = 0; y < H; y++) {
        let si = (H - 1 - y) * W * 4, di = y * W * 4;
        for (let x = 0; x < W; x++, si += 4, di += 4) {
          dst[di] = SRGB_LUT[src[si]]; dst[di + 1] = SRGB_LUT[src[si + 1]]; dst[di + 2] = SRGB_LUT[src[si + 2]];
          dst[di + 3] = src[si + 3];
        }
      }
      this._ctx.putImageData(img, 0, 0);
      const url = this._canvas.toDataURL('image/png');
      this.cache.set(model, { url, wasGlb: isGlb });
      return url;
    } catch (e) {
      return null;
    } finally {
      if (obj) this.scene.remove(obj);         // клон модели (геометрия/материалы шарятся с прототипом — не dispose'им)
      r.setRenderTarget(prevTarget);
      r.setClearColor(prevClearColor, prevClearAlpha);
    }
  }
}
