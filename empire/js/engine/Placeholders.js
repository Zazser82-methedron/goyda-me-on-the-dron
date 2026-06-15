// ===== Процедурные low-poly модели (плейсхолдеры до Blender-GLB) =====
// Стиль повторяет идол-слой «Гойды»: flatShading, гекс-формы, эмиссивные руны.
// Origin КАЖДОЙ модели — в центре основания (низ на y=0), модель растёт вверх.
import * as THREE from 'three';
import { PAL } from '../data/config.js?v=12';

const _mats = {};
function mat(color, o = {}) {
  const key = color + '|' + (o.rough ?? 0.9) + '|' + (o.metal ?? 0) + '|' + (o.emissive ?? 0) + '|' + (o.emi ?? 0);
  if (!_mats[key]) {
    _mats[key] = new THREE.MeshStandardMaterial({
      color, flatShading: true,
      roughness: o.rough ?? 0.9, metalness: o.metal ?? 0,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emi ?? 0,
    });
  }
  return _mats[key];
}

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; return me;
}
function cyl(rt, rb, h, seg, m, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; return me;
}
function cone(r, h, seg, m, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);
  me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; return me;
}
function sph(r, m, x = 0, y = 0, z = 0, seg = 10) {
  const me = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), m);
  me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; return me;
}

// ---- центральный идол ДРОН (чудо) ----
function idol() {
  const g = new THREE.Group();
  const stone = mat(PAL.stone, { rough: 0.95, metal: 0.05 });
  const gold = mat(PAL.gold, { rough: 0.35, metal: 0.9 });
  const eye = mat(0x120800, { emissive: PAL.faithCyan, emi: 2.2, rough: 0.4 });
  g.add(cyl(0.55, 0.05, 0.4, 6, stone, 0, 0.2, 0));        // подножие
  g.add(cyl(0.85, 1.15, 3.2, 6, stone, 0, 1.9, 0));        // тело-обелиск
  g.add(box(1.5, 1.2, 1.1, stone, 0, 3.9, 0));             // голова
  g.add(box(1.65, 0.28, 0.3, gold, 0, 4.35, 0.5));         // золотая бровь
  g.add(sph(0.2, eye, -0.42, 3.95, 0.55), sph(0.2, eye, 0.42, 3.95, 0.55));
  const rune = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 6, 16), eye);
  rune.position.set(0, 2.0, 0.92); g.add(rune);
  g.add(cyl(0.07, 0.07, 0.9, 4, gold, 0, 5.0, 0));         // навершие
  return g;
}

// ---- ратуша «Палаты Гойды» (3×3) ----
function townhall() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), st = mat(PAL.stone), rf = mat(PAL.roof), gold = mat(PAL.gold, { rough: 0.4, metal: 0.85 });
  g.add(box(2.6, 0.3, 2.6, st, 0, 0.15, 0));               // фундамент
  g.add(box(2.4, 1.5, 2.4, wd, 0, 1.0, 0));                // корпус
  g.add(box(2.5, 0.16, 2.5, gold, 0, 1.78, 0));            // золотой карниз
  g.add(cone(2.0, 1.4, 4, rf, 0, 2.55, 0));                // крыша
  g.add(cyl(0.06, 0.06, 1.0, 4, gold, 0, 3.6, 0));         // шпиль
  g.add(box(0.5, 0.9, 0.06, mat(PAL.crimson), 0, 1.0, 1.22)); // знамя
  g.add(box(0.5, 0.85, 0.05, mat(PAL.gold, { emissive: PAL.gold, emi: 0.3 }), 0, 1.0, 1.25));
  return g;
}

// ---- изба (1×1, жильё) ----
function izba() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), th = mat(PAL.thatch), dk = mat(PAL.woodDk);
  g.add(box(0.78, 0.6, 0.78, wd, 0, 0.3, 0));
  g.add(cone(0.62, 0.5, 4, th, 0, 0.85, 0));
  g.add(box(0.22, 0.36, 0.05, dk, 0, 0.18, 0.4));          // дверь
  return g;
}

// ---- амбар (2×2, еда) ----
function ambar() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), th = mat(PAL.thatch), gr = mat(PAL.grass3);
  g.add(box(1.6, 0.8, 1.2, wd, 0, 0.4, -0.2));
  g.add(cone(1.3, 0.7, 4, th, 0, 1.15, -0.2));
  g.add(box(0.7, 0.05, 0.7, gr, 0.5, 0.03, 0.6));          // делянка
  return g;
}

// ---- кузница (1×1, производство) ----
function kuznica() {
  const g = new THREE.Group();
  const st = mat(PAL.stone), dk = mat(PAL.woodDk);
  const ember = mat(0x200800, { emissive: 0xff6010, emi: 2.0 });
  g.add(box(0.8, 0.55, 0.8, st, 0, 0.28, 0));
  g.add(cyl(0.14, 0.16, 0.7, 6, dk, 0.26, 0.85, -0.2));    // труба
  g.add(box(0.3, 0.22, 0.3, ember, 0, 0.12, 0.32));        // горн
  return g;
}

// ---- казарма (2×2, военные) ----
function kazarma() {
  const g = new THREE.Group();
  const st = mat(PAL.stone), rf = mat(PAL.roof), steel = mat(0x9aa0aa, { metal: 0.8, rough: 0.4 });
  g.add(box(1.7, 1.0, 1.5, st, 0, 0.5, 0));
  g.add(cone(1.45, 0.7, 4, rf, 0, 1.35, 0));
  // скрещённые копья
  const s1 = cyl(0.03, 0.03, 1.4, 4, steel, -0.5, 1.0, 0.78); s1.rotation.z = 0.5;
  const s2 = cyl(0.03, 0.03, 1.4, 4, steel, -0.5, 1.0, 0.82); s2.rotation.z = -0.5;
  g.add(s1, s2);
  g.add(box(0.4, 0.7, 0.05, mat(PAL.crimson), 0.55, 0.85, 0.78));
  return g;
}

// ---- церковь-кумирня (2×2, вера) ----
function church() {
  const g = new THREE.Group();
  const st = mat(PAL.stone), wd = mat(PAL.wood);
  const glow = mat(0x101820, { emissive: PAL.faithCyan, emi: 1.8 });
  g.add(box(1.3, 1.0, 1.3, st, 0, 0.5, 0));
  g.add(cone(0.9, 1.8, 6, wd, 0, 1.9, 0));
  g.add(sph(0.28, glow, 0, 3.0, 0));
  return g;
}

// ---- рынок (2×2, золото) ----
function market() {
  const g = new THREE.Group();
  const wd = mat(PAL.woodDk), can = mat(PAL.crimson), gold = mat(PAL.gold, { metal: 0.9, rough: 0.3 });
  g.add(box(1.6, 0.5, 1.6, wd, 0, 0.25, 0));
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) g.add(cyl(0.05, 0.05, 0.8, 4, wd, x, 0.65, z));
  g.add(box(1.7, 0.1, 1.7, can, 0, 1.05, 0));              // навес
  g.add(sph(0.16, gold, 0, 0.65, 0));                      // золото
  return g;
}

// ---- лесопосадка (2×2, сажает деревья) ----
function roshcha() {
  const g = new THREE.Group();
  const soil = mat(PAL.dirt), wd = mat(PAL.woodDk), f1 = mat(PAL.grass3), f2 = mat(PAL.grass2);
  g.add(box(1.7, 0.16, 1.7, soil, 0, 0.08, 0));
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0, 0]]) {
    g.add(cyl(0.04, 0.05, 0.3, 4, wd, x, 0.24, z));
    g.add(cone(0.18, 0.32, 5, Math.random() < 0.5 ? f1 : f2, x, 0.5, z));
  }
  for (const [x, z] of [[-0.82, -0.82], [0.82, -0.82], [-0.82, 0.82], [0.82, 0.82]]) g.add(cyl(0.04, 0.04, 0.42, 4, wd, x, 0.21, z));
  return g;
}

// ---- частокол (1×1, стена) ----
function chastokol() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), wdk = mat(PAL.woodDk);
  for (let i = 0; i < 4; i++) {
    const x = -0.36 + i * 0.24;
    g.add(cyl(0.1, 0.12, 0.9, 5, i % 2 ? wd : wdk, x, 0.45, 0));
    g.add(cone(0.11, 0.2, 5, wdk, x, 0.98, 0));
  }
  g.add(box(0.95, 0.08, 0.1, wdk, 0, 0.6, 0));             // поперечина
  return g;
}
function chastokolGate() {
  const g = chastokol();
  // убрать средние посты — «ворота»
  g.children = g.children.filter((c, i) => i < 2 || i > 5);
  const m = mat(PAL.crimson);
  g.add(box(0.5, 0.7, 0.06, m, 0, 0.45, 0));
  return g;
}

// ---- ресурсные ноды ----
function tree() {
  const g = new THREE.Group();
  const tr = mat(PAL.woodDk), f1 = mat(PAL.grass3), f2 = mat(PAL.grass2);
  g.add(cyl(0.07, 0.1, 0.55, 5, tr, 0, 0.27, 0));
  g.add(cone(0.4, 0.7, 6, f2, 0, 0.7, 0));
  g.add(cone(0.3, 0.55, 6, f1, 0, 1.05, 0));
  return g;
}
function stoneNode() {
  const g = new THREE.Group();
  const rk = mat(PAL.rock), rd = mat(PAL.rockDk);
  g.add(sph(0.32, rk, 0, 0.18, 0)); g.add(sph(0.22, rd, 0.28, 0.12, 0.1));
  g.add(sph(0.18, rk, -0.22, 0.1, -0.15)); g.add(sph(0.14, rd, 0.05, 0.12, -0.28));
  return g;
}
function oreNode() {
  const g = stoneNode();
  const gold = mat(PAL.oreGold, { emissive: PAL.oreGold, emi: 0.5, metal: 0.7, rough: 0.4 });
  g.add(sph(0.1, gold, 0.1, 0.28, 0.05)); g.add(sph(0.07, gold, -0.15, 0.2, 0.12));
  return g;
}

// ---- юниты (гуманоиды) ----
function humanoid(opts = {}) {
  const g = new THREE.Group();
  const sc = opts.scale ?? 1;
  const cloth = mat(opts.cloth ?? PAL.cloth), skin = mat(PAL.skin), acc = mat(opts.acc ?? PAL.woodDk, opts.accMat || {});
  g.add(cyl(0.12 * sc, 0.16 * sc, 0.42 * sc, 6, cloth, 0, 0.27 * sc, 0)); // тело
  g.add(sph(0.12 * sc, skin, 0, 0.56 * sc, 0));                            // голова
  if (opts.helmet) g.add(cone(0.14 * sc, 0.18 * sc, 6, acc, 0, 0.66 * sc, 0));
  if (opts.spear) { const s = cyl(0.02, 0.02, 0.9 * sc, 4, acc, 0.2 * sc, 0.5 * sc, 0); s.add(cone(0.04, 0.12, 4, mat(0x9aa0aa, { metal: 0.8, rough: 0.4 }), 0, 0.5 * sc, 0)); g.add(s); }
  if (opts.tool) g.add(box(0.05, 0.3 * sc, 0.05, acc, 0.18 * sc, 0.4 * sc, 0));
  if (opts.cape) g.add(box(0.28 * sc, 0.4 * sc, 0.04, mat(opts.acc ?? PAL.crimson), 0, 0.3 * sc, -0.14 * sc));
  return g;
}
const kholop = () => humanoid({ cloth: PAL.cloth, acc: PAL.wood, tool: true, scale: 0.95 });
const ratnik = () => humanoid({ cloth: PAL.stoneLt, acc: PAL.crimson, spear: true, helmet: true });
const oprichnik = () => humanoid({ cloth: 0x201018, acc: PAL.crimson, spear: true, cape: true, helmet: true, scale: 1.08 });
const raider = () => humanoid({ cloth: PAL.enemy, acc: PAL.enemyTrim, spear: true, scale: 1.0 });
function bossUnit() {
  const g = humanoid({ cloth: PAL.enemy, acc: PAL.enemyTrim, spear: true, cape: true, helmet: true, scale: 1.7 });
  const horn = mat(PAL.gold, { metal: 0.9, rough: 0.3 });
  g.add(cone(0.08, 0.3, 4, horn, -0.18, 1.1, 0)); g.add(cone(0.08, 0.3, 4, horn, 0.18, 1.1, 0));
  return g;
}

// ---- идол-реликвия (тотем со светящимся кристаллом цвета эффекта) ----
function relicIdol(col) {
  return () => {
    const g = new THREE.Group();
    const st = mat(PAL.stone, { rough: 0.95 });
    const crystal = mat(0x120810, { emissive: col, emi: 2.4, rough: 0.3 });
    g.add(box(0.5, 0.18, 0.5, st, 0, 0.09, 0));
    g.add(cyl(0.16, 0.24, 0.7, 6, st, 0, 0.5, 0));
    g.add(box(0.36, 0.34, 0.36, st, 0, 0.96, 0));
    g.add(box(0.42, 0.07, 0.42, mat(PAL.gold, { metal: 0.85, rough: 0.3 }), 0, 1.14, 0));
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), crystal); cr.position.set(0, 1.4, 0); cr.castShadow = true; g.add(cr);
    return g;
  };
}

// ---- вражий стан (2×2): тёмные шатры, тотем-череп, костёр ----
function enemyCamp() {
  const g = new THREE.Group();
  const wd = mat(PAL.woodDk), dk = mat(PAL.enemy), bone = mat(0xd8d0c0), fire = mat(0x200800, { emissive: 0xff5010, emi: 1.8 });
  g.add(cone(0.7, 1.0, 6, dk, -0.5, 0.5, -0.5));
  g.add(cone(0.6, 0.85, 6, dk, 0.55, 0.42, 0.4));
  g.add(cyl(0.07, 0.08, 1.6, 5, wd, 0, 0.8, 0.6));
  g.add(sph(0.22, bone, 0, 1.65, 0.6));
  g.add(box(0.4, 0.16, 0.4, fire, 0, 0.08, -0.3));
  for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) g.add(cyl(0.08, 0.09, 0.7, 5, wd, x, 0.35, z));
  return g;
}

const BUILDERS = {
  idol_dron: idol, bld_townhall: townhall, bld_izba: izba, bld_ambar: ambar, bld_roshcha: roshcha,
  enemy_camp: enemyCamp,
  bld_kuznica: kuznica, bld_kazarma: kazarma, bld_church: church, bld_market: market,
  bld_chastokol: chastokol, bld_chastokol_gate: chastokolGate,
  res_tree: tree, res_stone: stoneNode, res_ore: oreNode,
  unit_kholop: kholop, unit_ratnik: ratnik, unit_oprichnik: oprichnik,
  enemy_raider: raider, enemy_boss: bossUnit,
  idol_krio: relicIdol(0x00eeff), idol_giper: relicIdol(0xff3020), idol_shipo: relicIdol(0x66ff44),
  idol_obereg: relicIdol(0xffcc00), idol_food: relicIdol(0x88ff66), idol_gold: relicIdol(0xffd040),
  idol_fonk: relicIdol(0xff00bb), idol_vera: relicIdol(0x00eeff),
};

export function buildPlaceholder(name) {
  const fn = BUILDERS[name];
  if (fn) return fn();
  // дефолт — цветной бокс
  const g = new THREE.Group();
  g.add(box(0.7, 0.7, 0.7, mat(PAL.crimson), 0, 0.35, 0));
  return g;
}

export function hasPlaceholder(name) { return !!BUILDERS[name]; }
