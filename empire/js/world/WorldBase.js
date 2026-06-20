// ===== Мир-плита на слонах и черепахе в океане (лор «плоской земли») =====
import * as THREE from 'three';
import { TILE } from '../data/config.js?v=67';
import { makeRippleNormal } from './WaterFx.js?v=67';

const _m = {};
function matStd(c, o = {}) { const k = c + '|' + (o.r ?? 1); if (!_m[k]) _m[k] = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: o.r ?? 1, metalness: o.m ?? 0 }); return _m[k]; }
function box(w, h, d, m, x = 0, y = 0, z = 0) { const e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); e.position.set(x, y, z); return e; }
function cyl(rt, rb, h, s, m, x = 0, y = 0, z = 0) { const e = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m); e.position.set(x, y, z); return e; }
function cone(r, h, s, m, x = 0, y = 0, z = 0) { const e = new THREE.Mesh(new THREE.ConeGeometry(r, h, s), m); e.position.set(x, y, z); return e; }

function elephant(s) {
  const g = new THREE.Group();
  const grey = matStd(0x8a8a93), greyD = matStd(0x6a6a73), white = matStd(0xe8e4d6);
  g.add(box(1.7 * s, 1.2 * s, 2.6 * s, grey, 0, 1.3 * s, 0));
  for (const [x, z] of [[-0.62, -0.85], [0.62, -0.85], [-0.62, 0.85], [0.62, 0.85]]) g.add(cyl(0.3 * s, 0.34 * s, 1.4 * s, 6, greyD, x * s, 0.65 * s, z * s));
  g.add(box(1.15 * s, 1.05 * s, 1.0 * s, grey, 0, 1.6 * s, 1.6 * s));
  g.add(box(1.4 * s, 1.0 * s, 0.12 * s, greyD, -0.78 * s, 1.7 * s, 1.55 * s));
  g.add(box(1.4 * s, 1.0 * s, 0.12 * s, greyD, 0.78 * s, 1.7 * s, 1.55 * s));
  for (let i = 0; i < 4; i++) g.add(cyl((0.2 - 0.035 * i) * s, (0.22 - 0.035 * i) * s, 0.45 * s, 6, grey, 0, (1.45 - 0.32 * i) * s, (2.1 + 0.02 * i) * s));
  g.add(cone(0.13 * s, 0.9 * s, 5, white, -0.36 * s, 1.05 * s, 2.2 * s));
  g.add(cone(0.13 * s, 0.9 * s, 5, white, 0.36 * s, 1.05 * s, 2.2 * s));
  return g;
}

function turtle(s) {
  const g = new THREE.Group();
  const shell = matStd(0x3c5e3a), shellD = matStd(0x2c4a2a), skin = matStd(0x6a7a58);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 9, 0, Math.PI * 2, 0, Math.PI / 2), shell);
  dome.scale.set(s, s * 0.5, s); g.add(dome);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.add(box(0.18 * s, 0.18 * s, 0.18 * s, shellD, Math.cos(a) * 0.55 * s, 0.42 * s, Math.sin(a) * 0.55 * s)); }
  g.add(box(0.6 * s, 0.5 * s, 0.9 * s, skin, 0, 0.12 * s, s * 0.98));
  for (const [x, z] of [[-0.85, -0.6], [0.85, -0.6], [-0.85, 0.6], [0.85, 0.6]]) g.add(box(0.55 * s, 0.28 * s, 1.0 * s, skin, x * s, 0.06 * s, z * s));
  return g;
}

export class WorldBase {
  constructor(scene, grid) {
    this.group = new THREE.Group();
    const n = grid.n, ww = n * TILE;
    let minH = 0;
    if (grid.heights) { minH = Infinity; for (let i = 0; i < grid.heights.length; i++) if (grid.heights[i] < minH) minH = grid.heights[i]; }
    const top = minH - 0.15, THICK = 10;

    // ---- плита-мир со стратами (vertex-color по высоте) ----
    const geo = new THREE.BoxGeometry(ww, THICK, ww, 1, 4, 1);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), cc = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const f = (pos.getY(i) + THICK / 2) / THICK;        // 0 низ .. 1 верх
      cc.setHex(f > 0.82 ? 0x5a4a30 : f > 0.45 ? 0x7a5e44 : 0x44403a);
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const slab = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    slab.position.y = top - THICK / 2;
    slab.receiveShadow = false; slab.castShadow = false;
    this.group.add(slab);

    const slabBottom = top - THICK;

    // ---- черепаха ----
    const tS = ww * 0.42;
    const tur = turtle(tS);
    const turTop = slabBottom - ww * 0.42;     // слоны между плитой и панцирем
    tur.position.set(0, turTop - tS * 0.5, 0);
    this.group.add(tur);

    // ---- 3 слона держат плиту ----
    const eS = ww * 0.10;
    const ePos = [[-ww * 0.22, -ww * 0.18], [ww * 0.24, -ww * 0.05], [-ww * 0.05, ww * 0.24]];
    for (const [x, z] of ePos) { const el = elephant(eS); el.position.set(x, turTop, z); this.group.add(el); }

    // ---- океан ----
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(ww * 4, ww * 4, 1, 1),
      // зеркальный океан — отражает IBL-небо/окружение
      new THREE.MeshStandardMaterial({ color: 0x163e5c, transparent: true, opacity: 0.94, roughness: 0.07, metalness: 0.75, envMapIntensity: 1.6 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = turTop - tS - ww * 0.12;
    const on = makeRippleNormal(128); on.repeat.set(24, 24);   // рябь океана
    ocean.material.normalMap = on; ocean.material.normalScale = new THREE.Vector2(0.28, 0.28); ocean.material.needsUpdate = true;
    this._oceanN = on;
    this.ocean = ocean;
    this.group.add(ocean);

    // ---- водопады с края «плоской земли» (анимированные) ----
    this._buildWaterfalls(top, ww);

    scene.add(this.group);
  }

  // короткие водопады у самой кромки: струи с пеной сверху, тают книзу (не «стеклянный куб»)
  _buildWaterfalls(top, ww) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
    const x = cv.getContext('2d');
    // вертикальные струйки: пена сверху → прозрачно книзу
    for (let i = 0; i < 28; i++) {
      const px = Math.floor(Math.random() * 64), wd = 1 + Math.random() * 2.2;
      const a = 0.4 + Math.random() * 0.4;
      const g = x.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, 'rgba(255,255,255,' + Math.min(1, a + 0.3) + ')');   // пена-гребень
      g.addColorStop(0.3, 'rgba(214,242,255,' + a + ')');
      g.addColorStop(1, 'rgba(170,220,255,0)');                              // тает книзу
      x.fillStyle = g; x.fillRect(px, 0, wd, 128);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 1); tex.magFilter = THREE.LinearFilter;
    this._fallTex = tex;

    const H = ww * 0.2;   // короткий каскад, не на всю высоту
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.5, fog: false });
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.7, depthWrite: false, fog: false });
    const half = ww / 2, yTop = top + 0.25, yC = yTop - H / 2;
    const edges = [
      { x: 0, z: half, ry: 0 },
      { x: 0, z: -half, ry: Math.PI },
      { x: half, z: 0, ry: Math.PI / 2 },
      { x: -half, z: 0, ry: -Math.PI / 2 },
    ];
    // дымка-брызги у подножия каскада
    const mistCv = document.createElement('canvas'); mistCv.width = mistCv.height = 32;
    const mx = mistCv.getContext('2d');
    const mg = mx.createRadialGradient(16, 18, 1, 16, 18, 16); mg.addColorStop(0, 'rgba(255,255,255,0.75)'); mg.addColorStop(1, 'rgba(255,255,255,0)');
    mx.fillStyle = mg; mx.fillRect(0, 0, 32, 32);
    const mistTex = new THREE.CanvasTexture(mistCv);
    this._mist = []; this._t = 0;
    for (const e of edges) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, H), mat);
      m.position.set(e.x, yC, e.z); m.rotation.y = e.ry; m.renderOrder = 8; this.group.add(m);
      // пенный гребень по кромке
      const foam = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.22, 0.45), foamMat);
      foam.position.set(e.x, yTop, e.z); foam.rotation.y = e.ry; this.group.add(foam);
      // ряд мягких клубов брызг у основания
      const along = Math.abs(e.ry) > 1.0;   // ±PI/2 → кромка вдоль оси Z
      for (let k = 0; k < 7; k++) {
        const f = (k / 6 - 0.5) * ww * 0.86;
        const mm = new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.25, fog: false });
        const sp = new THREE.Sprite(mm); sp.scale.set(ww * 0.11, H * 0.55, 1);
        sp.position.set(along ? e.x : f, yC - H * 0.42, along ? f : e.z); sp.renderOrder = 9;
        this.group.add(sp); this._mist.push({ sp, ph: Math.random() * 6.28 });
      }
    }
  }

  update(dt) {
    if (this._fallTex) { this._fallTex.offset.y -= dt * 0.7; if (this._fallTex.offset.y < -10) this._fallTex.offset.y += 10; }
    if (this._oceanN) { this._oceanN.offset.x += dt * 0.01; this._oceanN.offset.y += dt * 0.014; }
    if (this._mist) { this._t += dt; for (const m of this._mist) m.sp.material.opacity = 0.14 + Math.abs(Math.sin(this._t * 0.8 + m.ph)) * 0.22; }
  }
}
