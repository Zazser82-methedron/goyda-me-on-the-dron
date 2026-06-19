// ===== Процедурная тайловая normal-мапа для ряби воды (озеро/океан) =====
import * as THREE from 'three';

export function makeRippleNormal(size = 128) {
  const S = size;
  const lattice = (P) => { const a = new Float32Array(P * P); for (let i = 0; i < a.length; i++) a[i] = Math.random(); return a; };
  const sm = (t) => t * t * (3 - 2 * t);
  const samp = (lat, P, u, v) => {
    const fx = u * P, fy = v * P, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const at = (x, y) => lat[((y % P) + P) % P * P + ((x % P) + P) % P];
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
  const octs = [{ P: 12, w: 0.6 }, { P: 24, w: 0.3 }, { P: 48, w: 0.1 }].map(o => ({ ...o, lat: lattice(o.P) }));
  const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let h = 0; const u = x / S, v = y / S;
    for (const o of octs) h += samp(o.lat, o.P, u, v) * o.w;
    H[y * S + x] = h;
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(S, S);
  const STR = 2.0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const p = (y * S + x) * 4;
    const hl = H[y * S + ((x - 1 + S) % S)], hr = H[y * S + ((x + 1) % S)];
    const hu = H[((y - 1 + S) % S) * S + x], hd = H[((y + 1) % S) * S + x];
    let nx = -(hr - hl) * STR, ny = -(hd - hu) * STR, nz = 1;
    const inv = 1 / Math.hypot(nx, ny, nz); nx *= inv; ny *= inv; nz *= inv;
    img.data[p] = (nx * 0.5 + 0.5) * 255; img.data[p + 1] = (ny * 0.5 + 0.5) * 255; img.data[p + 2] = (nz * 0.5 + 0.5) * 255; img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t;
}
