// ===== Мир-плита на слонах и черепахе в океане (лор «плоской земли») =====
import * as THREE from 'three';
import { TILE } from '../data/config.js?v=11';

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
      new THREE.MeshStandardMaterial({ color: 0x1c4a6a, transparent: true, opacity: 0.9, roughness: 0.25, metalness: 0.2 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = turTop - tS - ww * 0.12;
    this.ocean = ocean;
    this.group.add(ocean);

    scene.add(this.group);
  }
}
