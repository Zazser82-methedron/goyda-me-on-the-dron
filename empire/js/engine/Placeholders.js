// ===== Процедурные low-poly модели (плейсхолдеры до Blender-GLB) =====
// Стиль повторяет идол-слой «Гойды»: flatShading, гекс-формы, эмиссивные руны.
// Origin КАЖДОЙ модели — в центре основания (низ на y=0), модель растёт вверх.
import * as THREE from 'three';
import { PAL } from '../data/config.js?v=94';

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
// стек тонких «брёвен» вместо сплошной стены — дешёвый лог-кабин силуэт (изба/ратуша/амбар)
function logWall(w, h, d, mA, mB, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  const rows = 4, rh = h / rows;
  for (let i = 0; i < rows; i++) g.add(box(w, rh * 0.84, d, i % 2 ? mB : mA, 0, -h / 2 + rh * (i + 0.5), 0));
  g.position.set(x, y, z);
  return g;
}
// окошко в стене: тёплый огонёк (жилой вид в сумерках) или тёмное стекло; общий кэш материалов
let _winLit = null, _winDark = null;
function windowMesh(w, h, x, y, z, glow = true) {
  if (!_winLit) { _winLit = mat(0x2a1806, { emissive: 0xffb050, emi: 1.4, rough: 0.4 }); _winDark = mat(0x0c1016, { rough: 0.3, metal: 0.1 }); }
  return box(w, h, 0.04, glow ? _winLit : _winDark, x, y, z);
}

// ---- секция-соединитель частокола: 2 бревна + колья от столба к соседней стене (Tiling.js крутит по направлению) ----
// Построена вдоль +Z (на юг); материалы из общего кэша — секции живут в отдельной группе b._conn,
// которую _applyBuildVisual не трогает (не портим shared-материалы прозрачностью).
export function wallConnSegment() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), dk = mat(PAL.woodDk);
  for (const y of [0.36, 0.6]) g.add(box(0.07, 0.07, 0.64, wd, 0, y, 0.3));   // 2 горизонтальных бревна
  for (const z of [0.2, 0.42]) {                                              // заострённые колья между столбами
    g.add(cyl(0.055, 0.065, 0.76, 5, dk, 0, 0.38, z));
    g.add(cone(0.06, 0.15, 5, dk, 0, 0.83, z));
  }
  return g;
}

// ---- тайл дороги под маску соединений (N=1,E=2,S=4,W=8): вытоптанные полосы от центра к соседям ----
export function roadTile(mask) {
  const g = new THREE.Group();
  const d1 = mat(0x6a5a42, { rough: 1 }), d2 = mat(0x7c6c52, { rough: 1 });
  const activeCount = [1, 2, 4, 8].filter(bit => mask & bit).length;
  const baseWidth = activeCount >= 3 ? 0.52 : 0.46;
  const laneWidth = activeCount >= 3 ? 0.42 : 0.36;
  const rayEnd = 0.52;
  const baseHalf = baseWidth * 0.5, laneHalf = laneWidth * 0.5;
  const baseRayLength = rayEnd - baseHalf, laneRayLength = rayEnd - laneHalf;

  // Центральный узел раскрывается только до ширины дороги: у прямой нет квадратной плиты на весь тайл.
  g.add(box(baseWidth, 0.05, baseWidth, d1, 0, 0.025, 0));
  g.add(box(laneWidth, 0.045, laneWidth, d2, 0, 0.052, 0));

  const addRay = (dx, dz) => {
    const horizontal = dx !== 0;
    const baseCenter = baseHalf + baseRayLength * 0.5;
    const laneCenter = laneHalf + laneRayLength * 0.5;
    const curbStart = laneHalf + 0.04;                                         // бордюр не заходит на центральный узел
    const curbLength = rayEnd - curbStart;

    g.add(box(horizontal ? baseRayLength : baseWidth, 0.05, horizontal ? baseWidth : baseRayLength, d1,
      horizontal ? dx * baseCenter : 0, 0.025, horizontal ? 0 : dz * baseCenter));
    g.add(box(horizontal ? laneRayLength : laneWidth, 0.045, horizontal ? laneWidth : laneRayLength, d2,
      horizontal ? dx * laneCenter : 0, 0.052, horizontal ? 0 : dz * laneCenter));

    // Два тёмных бордюра идут вдоль активного луча и обрываются до перекрёстка.
    for (const offset of [-laneHalf - 0.02, laneHalf + 0.02]) {
      g.add(box(horizontal ? curbLength : 0.04, 0.025, horizontal ? 0.04 : curbLength, d1,
        horizontal ? dx * (curbStart + curbLength * 0.5) : offset, 0.082,
        horizontal ? offset : dz * (curbStart + curbLength * 0.5)));
    }

    // Низкие поперечные швы следуют направлению луча, а не фиксированным координатам тайла.
    for (const distance of [0.3, 0.43]) {
      g.add(box(horizontal ? 0.025 : 0.28, 0.012, horizontal ? 0.28 : 0.025, d1,
        horizontal ? dx * distance : 0, 0.08, horizontal ? 0 : dz * distance));
    }
  };

  if (mask & 1) addRay(0, -1);
  if (mask & 2) addRay(1, 0);
  if (mask & 4) addRay(0, 1);
  if (mask & 8) addRay(-1, 0);
  return g;
}

// ---- «усадьба»: тропинка + заборчики между двумя соседними ПОСТРОЕННЫМИ зданиями (Tiling.refreshHomesteads) ----
export function homesteadConn(a, c, grid) {
  const g = new THREE.Group();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // ближние точки на краях футпринтов (в мировых координатах)
  const ax = clamp(c.cx, a.cx - a.w * 0.5, a.cx + a.w * 0.5), az = clamp(c.cz, a.cz - a.h * 0.5, a.cz + a.h * 0.5);
  const bx = clamp(a.cx, c.cx - c.w * 0.5, c.cx + c.w * 0.5), bz = clamp(a.cz, c.cz - c.h * 0.5, c.cz + c.h * 0.5);
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const len = Math.max(0.5, Math.hypot(bx - ax, bz - az) + 0.3);
  const pathM = mat(0x74644c, { rough: 1 }), wd = mat(PAL.wood), dk = mat(PAL.woodDk);
  g.add(box(0.34, 0.04, len, pathM, 0, 0.03, 0));                             // тропинка
  for (const sx of [-0.42, 0.42]) {                                           // низкий заборчик по бокам тропинки
    for (const sz of [-len / 2 + 0.08, len / 2 - 0.08]) g.add(cyl(0.035, 0.045, 0.32, 5, dk, sx, 0.16, sz));
    for (const yy of [0.15, 0.27]) g.add(box(0.045, 0.045, Math.max(0.3, len - 0.16), wd, sx, yy, 0));
  }
  g.position.set(mx, grid.heightAt ? grid.heightAt(mx, mz) : 0, mz);
  g.rotation.y = Math.atan2(bx - ax, bz - az);
  return g;
}

// ---- гужевая телега (транспорт по дорогам): лошадка + повозка с крутящимися колёсами ----
// Едет вдоль +Z; колёса в view.userData.wheels — рендер-цикл крутит их по скорости.
function cartUnit() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), dk = mat(PAL.woodDk), body = mat(0x8a5a30), sack = mat(0xc8b060);
  // лошадка впереди
  g.add(box(0.22, 0.2, 0.38, body, 0, 0.38, 0.46));
  g.add(box(0.11, 0.15, 0.17, body, 0, 0.58, 0.68));                          // голова
  g.add(box(0.1, 0.08, 0.06, dk, 0, 0.68, 0.6));                              // грива
  for (const [x, z] of [[-0.07, 0.34], [0.07, 0.34], [-0.07, 0.58], [0.07, 0.58]])
    g.add(cyl(0.025, 0.032, 0.28, 4, dk, x, 0.14, z));                        // ноги
  for (const x of [-0.13, 0.13]) g.add(box(0.03, 0.03, 0.42, wd, x, 0.3, 0.12));   // оглобли
  // повозка
  g.add(box(0.36, 0.07, 0.46, wd, 0, 0.28, -0.22));                           // дно
  for (const x of [-0.17, 0.17]) g.add(box(0.03, 0.14, 0.46, dk, x, 0.38, -0.22)); // борта
  g.add(sph(0.11, sack, -0.05, 0.42, -0.14)); g.add(sph(0.09, sack, 0.07, 0.4, -0.32));   // мешки с товаром
  // колёса (геометрия повёрнута — ось вдоль X, качение = rotation.x). Имя 'wheel' — Transport ищет
  // по нему в КЛОНЕ (ссылки в userData нельзя: Object3D.clone() сериализует userData через JSON).
  for (const x of [-0.21, 0.21]) {
    const wg = new THREE.CylinderGeometry(0.13, 0.13, 0.045, 9);
    wg.rotateZ(Math.PI / 2);
    const wh = new THREE.Mesh(wg, dk);
    wh.position.set(x, 0.13, -0.22); wh.castShadow = true; wh.name = 'wheel';
    g.add(wh);
  }
  return g;
}

// ---- тайл рельсов под маску соединений (N=1,E=2,S=4,W=8): гравий + шпалы + пара рельсов к каждому соседу ----
export function railTile(mask) {
  const g = new THREE.Group();
  const grav = mat(0x5c5650, { rough: 1 }), tie = mat(PAL.woodDk), steel = mat(0x9aa0aa, { metal: 0.85, rough: 0.35 });
  g.add(box(0.9, 0.04, 0.9, grav, 0, 0.02, 0));                               // гравийная подушка
  if (!mask) mask = 1 | 4;                                                    // одиночный тайл — прямая N-S
  const dirs = [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]]
    .filter(([bit]) => mask & bit)
    .map(([bit, dx, dz]) => ({ bit, dx, dz }));
  const railGap = 0.14, edgeInner = 0.34;

  const addSegment = (x1, z1, x2, z2, width = 0.05, y = 0.075) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const rail = box(width, 0.045, len, steel, (x1 + x2) / 2, y, (z1 + z2) / 2);
    rail.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    g.add(rail);
  };
  const addTie = (x, z, angle, width = 0.44) => {
    const sleeper = box(width, 0.035, 0.07, tie, x, 0.048, z);
    sleeper.rotation.y = angle;
    g.add(sleeper);
  };
  const addEdgeRails = ({ dx, dz }) => {
    const horiz = dx !== 0, length = 0.52 - edgeInner, center = edgeInner + length / 2;
    for (const off of [-railGap, railGap])
      g.add(box(horiz ? length : 0.05, 0.045, horiz ? 0.05 : length, steel,
        horiz ? dx * center : off, 0.075, horiz ? off : dz * center));
  };
  const addStraight = (vertical) => {
    for (const off of [-railGap, railGap])
      g.add(box(vertical ? 0.05 : 1.04, 0.045, vertical ? 1.04 : 0.05, steel,
        vertical ? off : 0, 0.075, vertical ? 0 : off));
    for (const distance of [-0.38, -0.14, 0.14, 0.38])
      addTie(vertical ? 0 : distance, vertical ? distance : 0, vertical ? 0 : Math.PI / 2);
  };
  const addCorner = (from, to, edgeAtEnd = true) => {
    // The short straight edge stubs preserve the exact neighbouring-tile rail gauge.
    addEdgeRails(from);
    if (edgeAtEnd) addEdgeRails(to);
    const radius = edgeInner, cx = radius * (from.dx + to.dx), cz = radius * (from.dz + to.dz);
    const start = { x: -to.dx, z: -to.dz };
    const turn = from.dx * to.dz - from.dz * to.dx > 0 ? -1 : 1;
    for (const off of [-railGap, railGap]) {
      let px = cx + (radius + off) * start.x, pz = cz + (radius + off) * start.z;
      for (let step = 1; step <= 3; step++) {
        const a = turn * Math.PI * step / 6, ca = Math.cos(a), sa = Math.sin(a);
        const vx = start.x * ca - start.z * sa, vz = start.x * sa + start.z * ca;
        const nx = cx + (radius + off) * vx, nz = cz + (radius + off) * vz;
        addSegment(px, pz, nx, nz);
        px = nx; pz = nz;
      }
    }
    for (let step = 0; step < 3; step++) {
      const a = turn * Math.PI * (step + 0.5) / 6, ca = Math.cos(a), sa = Math.sin(a);
      const vx = start.x * ca - start.z * sa, vz = start.x * sa + start.z * ca;
      const tangentX = turn * -vz, tangentZ = turn * vx;
      addTie(cx + radius * vx, cz + radius * vz, Math.atan2(tangentX, tangentZ));
    }
  };

  if (dirs.length === 1) {
    const { dx, dz } = dirs[0], horiz = dx !== 0;
    for (const off of [-railGap, railGap])
      g.add(box(horiz ? 0.52 : 0.05, 0.045, horiz ? 0.05 : 0.52, steel,
        horiz ? dx * 0.26 : off, 0.075, horiz ? off : dz * 0.26));
    for (const distance of [0.14, 0.38]) addTie(horiz ? dx * distance : 0, horiz ? 0 : dz * distance, horiz ? Math.PI / 2 : 0);
  } else if (dirs.length === 2) {
    const [a, b] = dirs;
    if (a.dx + b.dx === 0 && a.dz + b.dz === 0) addStraight(a.dx === 0);
    else addCorner(a, b);
  } else if (dirs.length === 3) {
    const verticalMain = (mask & 1) && (mask & 4);
    const main = verticalMain ? dirs.filter(d => d.dx === 0) : dirs.filter(d => d.dz === 0);
    const branch = dirs.find(d => !main.includes(d));
    addStraight(verticalMain);
    addCorner(branch, main[1], false);                                        // branch curves into one leg of the main line
    const bladeStart = { x: branch.dx * 0.24 + main[1].dx * 0.05, z: branch.dz * 0.24 + main[1].dz * 0.05 };
    const bladeTip = { x: branch.dx * 0.04 + main[1].dx * 0.18, z: branch.dz * 0.04 + main[1].dz * 0.18 };
    addSegment(bladeStart.x, bladeStart.z, bladeTip.x, bladeTip.z, 0.025, 0.103); // pointed switch tongue
  } else {
    addStraight(true);
    addStraight(false);
    const diamond = [[0, -0.11], [0.11, 0], [0, 0.11], [-0.11, 0]];
    for (let i = 0; i < diamond.length; i++) {
      const [x1, z1] = diamond[i], [x2, z2] = diamond[(i + 1) % diamond.length];
      addSegment(x1, z1, x2, z2, 0.045, 0.103);                               // raised diamond frog
    }
    for (const distance of [-0.26, -0.08, 0.08, 0.26]) {
      addTie(0, distance, 0);
      addTie(distance, 0, Math.PI / 2);
    }
  }
  return g;
}

// ---- станция (2×2): платформа + депо-домик + семафор и ящики ----
function station() {
  const g = new THREE.Group();
  const st = mat(PAL.stone), wd = mat(PAL.wood), wdk = mat(PAL.woodDk), rf = mat(PAL.roof);
  const lamp = mat(0x102008, { emissive: 0x66ff44, emi: 2.0 });
  g.add(box(1.8, 0.18, 1.8, st, 0, 0.09, 0));                                 // платформа
  g.add(logWall(1.1, 0.7, 0.9, wd, wdk, -0.2, 0.53, -0.35));                  // депо-домик
  g.add(cone(0.85, 0.55, 4, rf, -0.2, 1.16, -0.35));
  g.add(box(0.26, 0.44, 0.05, wdk, -0.2, 0.42, 0.12));                        // дверь на перрон
  g.add(windowMesh(0.2, 0.2, 0.22, 0.66, 0.12));                              // окошко кассы
  g.add(cyl(0.035, 0.045, 0.9, 5, wdk, 0.68, 0.62, 0.55));                    // семафор
  g.add(box(0.16, 0.05, 0.05, wdk, 0.62, 1.02, 0.55));
  g.add(sph(0.06, lamp, 0.55, 1.02, 0.55));                                   // зелёный огонь — путь свободен
  g.add(box(0.24, 0.2, 0.24, wd, 0.55, 0.28, -0.5));                          // ящики с грузом
  g.add(box(0.18, 0.16, 0.18, wdk, 0.32, 0.26, -0.62));
  return g;
}

// ---- паровоз (едет вдоль +Z): котёл + будка + труба (name 'funnel' — из неё идёт дым) + колёса ----
function loco() {
  const g = new THREE.Group();
  const body = mat(0x2e3138, { rough: 0.5, metal: 0.4 }), dk = mat(PAL.woodDk), red = mat(PAL.crimson);
  const gold = mat(PAL.gold, { metal: 0.85, rough: 0.35 });
  g.add(box(0.34, 0.06, 0.78, dk, 0, 0.14, 0));                               // рама
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.48, 10), body);
  boiler.rotation.x = Math.PI / 2; boiler.position.set(0, 0.34, 0.14); boiler.castShadow = true;
  g.add(boiler);
  g.add(box(0.3, 0.36, 0.26, body, 0, 0.35, -0.24));                          // будка машиниста
  g.add(box(0.34, 0.05, 0.3, red, 0, 0.56, -0.24));                           // крыша будки
  const fun = cyl(0.05, 0.075, 0.2, 7, dk, 0, 0.58, 0.3); fun.name = 'funnel'; g.add(fun);   // труба
  g.add(sph(0.055, gold, 0, 0.44, 0.395));                                    // фонарь на морде
  for (const z of [-0.22, 0.02, 0.26]) for (const x of [-0.19, 0.19]) {       // колёса ×6
    const wg = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 9); wg.rotateZ(Math.PI / 2);
    const wh = new THREE.Mesh(wg, dk); wh.position.set(x, 0.1, z); wh.castShadow = true; wh.name = 'wheel';
    g.add(wh);
  }
  return g;
}

// ---- вагон (грузовой, едет вдоль +Z) ----
function wagon() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), dk = mat(PAL.woodDk), sack = mat(0xc8b060);
  g.add(box(0.32, 0.06, 0.66, dk, 0, 0.14, 0));                               // рама
  g.add(box(0.34, 0.2, 0.6, wd, 0, 0.28, 0));                                 // короб
  g.add(sph(0.11, sack, -0.05, 0.44, 0.12)); g.add(sph(0.09, sack, 0.08, 0.42, -0.14));   // груз
  for (const z of [-0.2, 0.2]) for (const x of [-0.18, 0.18]) {
    const wg = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 9); wg.rotateZ(Math.PI / 2);
    const wh = new THREE.Mesh(wg, dk); wh.position.set(x, 0.09, z); wh.castShadow = true; wh.name = 'wheel';
    g.add(wh);
  }
  return g;
}

// ---- строительные леса вокруг площадки w×h тайлов (видны, пока здание строится) ----
export function buildScaffold(w, h) {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), dk = mat(PAL.woodDk);
  const hw = w * 0.5 + 0.14, hh = h * 0.5 + 0.14;
  const ph = Math.max(w, h) * 0.55 + 0.8;                       // высота лесов ~ размеру постройки
  for (const [x, z] of [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]])
    g.add(cyl(0.05, 0.06, ph, 5, dk, x, ph / 2, z));            // угловые столбы
  for (const y of [ph * 0.45, ph * 0.88]) {                     // перекладины по периметру, 2 яруса
    g.add(box(hw * 2 + 0.12, 0.05, 0.05, wd, 0, y, -hh));
    g.add(box(hw * 2 + 0.12, 0.05, 0.05, wd, 0, y, hh));
    g.add(box(0.05, 0.05, hh * 2 + 0.12, wd, -hw, y, 0));
    g.add(box(0.05, 0.05, hh * 2 + 0.12, wd, hw, y, 0));
  }
  const diag = box(0.05, Math.hypot(hw * 2, ph * 0.5), 0.05, wd, 0, ph * 0.5, hh + 0.02);  // диагональ фасада
  diag.rotation.z = Math.atan2(hw * 2, ph * 0.5) * 0.8;
  g.add(diag);
  return g;
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
  const wd = mat(PAL.wood), wdk = mat(PAL.woodDk), st = mat(PAL.stone), rf = mat(PAL.roof), gold = mat(PAL.gold, { rough: 0.4, metal: 0.85 });
  g.add(box(2.6, 0.3, 2.6, st, 0, 0.15, 0));               // фундамент
  g.add(logWall(2.4, 1.5, 2.4, wd, wdk, 0, 1.0, 0));       // брёвна корпуса
  g.add(box(2.5, 0.16, 2.5, gold, 0, 1.78, 0));            // золотой карниз
  g.add(cone(2.0, 1.4, 4, rf, 0, 2.55, 0));                // крыша
  g.add(cyl(0.06, 0.06, 1.0, 4, gold, 0, 3.6, 0));         // шпиль
  g.add(box(0.5, 0.9, 0.06, mat(PAL.crimson), 0, 1.0, 1.22)); // знамя
  g.add(box(0.5, 0.85, 0.05, mat(PAL.gold, { emissive: PAL.gold, emi: 0.3 }), 0, 1.0, 1.25));
  g.add(box(0.42, 0.68, 0.06, wdk, 0, 0.64, 1.21));        // дверь
  g.add(windowMesh(0.32, 0.32, -0.78, 1.35, 1.21));        // окна фасада (тёплый огонёк)
  g.add(windowMesh(0.32, 0.32, 0.78, 1.35, 1.21));
  return g;
}

// ---- изба (1×1, жильё) ----
function izba() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), th = mat(PAL.thatch), dk = mat(PAL.woodDk);
  g.add(logWall(0.78, 0.6, 0.78, wd, dk, 0, 0.3, 0));
  g.add(cone(0.62, 0.5, 4, th, 0, 0.85, 0));
  g.add(box(0.22, 0.36, 0.05, dk, 0, 0.18, 0.4));          // дверь
  g.add(windowMesh(0.16, 0.16, -0.22, 0.36, 0.4));         // окошко (тёплый огонёк)
  return g;
}

// ---- изба плотника (1×1, рабочий навес) ----
function izbaPlotnika() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), dk = mat(PAL.woodDk), rf = mat(PAL.roof), st = mat(PAL.stone);
  g.add(box(0.9, 0.035, 0.9, mat(PAL.dirt), 0, 0.018, 0));                         // утоптанный двор
  for (const [x, z] of [[-0.36, -0.3], [0.36, -0.3]])
    g.add(cyl(0.035, 0.045, 0.68, 5, dk, x, 0.34, z));                              // стойки навеса
  const awning = box(0.86, 0.055, 0.48, rf, 0, 0.66, -0.1);
  awning.rotation.x = -0.18; g.add(awning);                                         // низкий односкатный навес
  for (const [y, z] of [[0.13, 0.24], [0.22, 0.24], [0.31, 0.24]]) {
    const log = cyl(0.07, 0.08, 0.6, 7, wd, -0.12, y, z);
    log.rotation.z = Math.PI / 2; g.add(log);                                        // штабель брёвен
  }
  for (const y of [0.15, 0.22, 0.29]) g.add(box(0.42, 0.035, 0.12, dk, 0.28, y, 0.25)); // доски
  const trestleTop = box(0.5, 0.055, 0.12, wd, 0.02, 0.43, 0.1);
  g.add(trestleTop);                                                                  // козлы
  for (const x of [-0.16, 0.16]) {
    const legA = box(0.045, 0.38, 0.045, dk, x, 0.22, 0.1);
    const legB = box(0.045, 0.38, 0.045, dk, x, 0.22, 0.1);
    legA.rotation.z = 0.42; legB.rotation.z = -0.42; g.add(legA, legB);
  }
  const saw = cyl(0.018, 0.018, 0.4, 5, st, 0.02, 0.59, 0.1);
  saw.rotation.z = -0.62; g.add(saw);                                                // пила в козлах
  return g;
}

// ---- баня (1×1, приземистый сруб с трубой и лоханью) ----
function banya() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), dk = mat(PAL.woodDk), rf = mat(PAL.roof), st = mat(PAL.stone);
  g.add(logWall(0.74, 0.42, 0.68, wd, dk, -0.08, 0.21, 0));                          // низкий банный сруб
  const roofA = box(0.84, 0.055, 0.42, rf, -0.08, 0.53, -0.14);
  const roofB = box(0.84, 0.055, 0.42, rf, -0.08, 0.53, 0.14);
  roofA.rotation.x = 0.38; roofB.rotation.x = -0.38; g.add(roofA, roofB);             // двускатная кровля
  g.add(box(0.2, 0.28, 0.045, dk, -0.08, 0.14, 0.35));                                // низкая дверь
  g.add(windowMesh(0.12, 0.12, -0.3, 0.28, 0.35, false));                             // тёмное окошко
  g.add(cyl(0.075, 0.09, 0.38, 7, st, 0.18, 0.78, -0.08));                            // короткая печная труба
  g.add(cyl(0.12, 0.15, 0.2, 8, wd, 0.38, 0.1, 0.26));                                // лохань снаружи
  g.add(cyl(0.135, 0.135, 0.025, 8, dk, 0.38, 0.21, 0.26));                            // обод лохани
  return g;
}

// ---- амбар (2×2, еда) ----
function ambar() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), wdk = mat(PAL.woodDk), th = mat(PAL.thatch), gr = mat(PAL.grass3);
  g.add(logWall(1.6, 0.8, 1.2, wd, wdk, 0, 0.4, -0.2));
  g.add(cone(1.3, 0.7, 4, th, 0, 1.15, -0.2));
  g.add(box(0.7, 0.05, 0.7, gr, 0.5, 0.03, 0.6));          // делянка
  g.add(box(0.36, 0.5, 0.06, wdk, 0, 0.35, 0.4));          // большая дверь
  return g;
}

// ---- путевой пакгауз (2×2, грузовая платформа у рельсов) ----
function sklad() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), wdk = mat(PAL.woodDk), st = mat(PAL.stone), sack = mat(PAL.thatch);
  g.add(box(1.82, 0.12, 1.58, wd, 0, 0.26, 0));                              // поднятый настил
  for (const [x, z] of [[-0.7, -0.58], [-0.7, 0.58], [0.7, -0.58], [0.7, 0.58]])
    g.add(cyl(0.07, 0.09, 0.28, 6, st, x, 0.14, z));                          // опоры пирона
  g.add(box(0.7, 0.06, 0.12, wdk, -0.35, 0.36, -0.52));                       // край платформы
  g.add(box(0.28, 0.22, 0.28, wd, -0.38, 0.43, 0.12));                        // ящик
  g.add(box(0.22, 0.18, 0.22, wdk, -0.1, 0.41, 0.18));                        // стопка ящиков
  g.add(cyl(0.13, 0.16, 0.2, 7, sack, 0.32, 0.4, 0.2));                       // тюк
  g.add(cyl(0.11, 0.14, 0.18, 7, sack, 0.5, 0.39, 0.28));                     // тюк
  g.add(cyl(0.055, 0.065, 0.92, 6, wdk, -0.15, 0.74, -0.28));                 // стойка крана
  const boom = cyl(0.035, 0.045, 0.86, 5, wdk, 0.27, 1.08, -0.28);
  boom.rotation.z = Math.PI / 2; g.add(boom);                                  // стрела
  g.add(cyl(0.014, 0.014, 0.42, 5, wdk, 0.68, 0.81, -0.28));                   // трос
  g.add(box(0.14, 0.09, 0.14, st, 0.68, 0.56, -0.28));                         // груз на крюке
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

// ---- ремонтный двор (1×1, открытая мастерская) ----
function remontDvor() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), wdk = mat(PAL.woodDk), st = mat(PAL.stone), rf = mat(PAL.roof), dirt = mat(PAL.dirt);
  const sparks = mat(PAL.goldBright, { emissive: PAL.goldBright, emi: 1.5 });
  g.add(box(0.9, 0.035, 0.9, dirt, 0, 0.018, 0));                              // открытый двор
  for (const [x, z] of [[-0.35, -0.28], [0.35, -0.28], [-0.35, 0.28], [0.35, 0.28]])
    g.add(cyl(0.035, 0.045, 0.72, 5, wdk, x, 0.36, z));                        // навес на столбах
  g.add(box(0.82, 0.06, 0.64, rf, 0, 0.73, 0));                                // лёгкий навес
  g.add(box(0.42, 0.08, 0.24, wd, -0.1, 0.35, 0.12));                          // верстак
  g.add(box(0.06, 0.28, 0.06, wdk, -0.26, 0.18, 0.12));
  g.add(box(0.06, 0.28, 0.06, wdk, 0.06, 0.18, 0.12));
  const wheel = cyl(0.18, 0.18, 0.075, 10, st, -0.12, 0.38, -0.22);
  wheel.rotation.z = Math.PI / 2; g.add(wheel);                                // точильный круг
  g.add(box(0.05, 0.32, 0.05, wdk, 0.25, 0.28, -0.26));                        // стойка инструмента
  g.add(box(0.34, 0.045, 0.05, wdk, 0.12, 0.48, -0.26));                       // перекладина
  const tool = cyl(0.018, 0.018, 0.26, 5, st, 0.06, 0.35, -0.22);
  tool.rotation.z = -0.28; g.add(tool);                                        // подвешенный ключ
  g.add(cyl(0.1, 0.12, 0.22, 8, wd, 0.28, 0.13, 0.22));                        // бочка
  g.add(cyl(0.12, 0.12, 0.05, 8, sparks, -0.22, 0.52, -0.22));                 // искры у круга
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
  g.add(box(0.34, 0.6, 0.06, mat(PAL.woodDk), 0, 0.35, 0.76));   // дверь
  return g;
}

// ---- церковь-кумирня (2×2, вера) ----
function church() {
  const g = new THREE.Group();
  const st = mat(PAL.stone), wd = mat(PAL.wood), wdk = mat(PAL.woodDk);
  const glow = mat(0x101820, { emissive: PAL.faithCyan, emi: 1.8 });
  g.add(box(1.3, 1.0, 1.3, st, 0, 0.5, 0));
  g.add(cone(0.9, 1.8, 6, wd, 0, 1.9, 0));
  g.add(sph(0.28, glow, 0, 3.0, 0));
  g.add(box(0.3, 0.6, 0.06, wdk, 0, 0.35, 0.66));          // дверь
  g.add(windowMesh(0.22, 0.22, 0, 0.85, 0.66, true));      // окно-розетка (тёплый свет)
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

// ---- трактир (2×2, закрытый сруб с вывеской) ----
function traktir() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), dk = mat(PAL.woodDk), rf = mat(PAL.roof), gold = mat(PAL.gold, { metal: 0.8, rough: 0.35 });
  g.add(box(1.86, 0.06, 1.74, mat(PAL.dirt), 0, 0.03, 0));                           // утоптанный двор
  g.add(logWall(1.5, 0.72, 1.22, wd, dk, -0.08, 0.39, -0.03));                        // закрытый сруб
  const roofA = box(1.66, 0.07, 0.78, rf, -0.08, 0.86, -0.25);
  const roofB = box(1.66, 0.07, 0.78, rf, -0.08, 0.86, 0.19);
  roofA.rotation.x = 0.42; roofB.rotation.x = -0.42; g.add(roofA, roofB);             // двускатная кровля
  g.add(box(0.28, 0.42, 0.055, dk, -0.08, 0.24, 0.6));                                // дверь
  g.add(windowMesh(0.22, 0.2, -0.48, 0.48, 0.6, true));                               // тёплое окно
  g.add(box(0.54, 0.055, 0.16, wd, 0.68, 0.28, 0.42));                                // лавка
  g.add(box(0.54, 0.055, 0.16, wd, 0.68, 0.28, 0.68));                                // вторая лавка
  for (const x of [0.5, 0.86]) g.add(cyl(0.11, 0.13, 0.24, 8, dk, x, 0.15, -0.45));    // бочки у стены
  g.add(cyl(0.035, 0.045, 0.78, 5, dk, 0.58, 0.68, 0.64));                            // стойка вывески
  g.add(box(0.34, 0.25, 0.045, dk, 0.58, 0.82, 0.64));                                // доска вывески
  const keg = cyl(0.075, 0.075, 0.055, 8, gold, 0.58, 0.82, 0.675);
  keg.rotation.x = Math.PI / 2; g.add(keg);                                            // золотой знак кружки/бочонка
  return g;
}

// ---- приказ сбора (2×2, каменная приказная изба) ----
function prikazSbora() {
  const g = new THREE.Group();
  const st = mat(PAL.stone), stLt = mat(PAL.stoneLt), dk = mat(PAL.woodDk), rf = mat(PAL.roof);
  const banner = mat(PAL.crimson), gold = mat(PAL.gold, { metal: 0.85, rough: 0.3 });
  g.add(box(1.78, 0.24, 1.56, st, 0, 0.12, 0));                                        // каменный цоколь
  g.add(logWall(1.52, 0.72, 1.24, stLt, st, 0, 0.6, -0.03));                           // кладка приказной избы
  g.add(cone(1.26, 0.58, 4, rf, 0, 1.25, -0.03));                                     // строгая шатровая крыша
  g.add(box(0.48, 0.1, 0.3, stLt, 0, 0.29, 0.78));                                    // ступени
  g.add(box(0.3, 0.44, 0.055, dk, 0, 0.46, 0.61));                                    // входная дверь
  for (const x of [-0.28, 0.28]) g.add(cyl(0.055, 0.065, 0.48, 6, stLt, x, 0.48, 0.69)); // входные столбы
  g.add(cyl(0.025, 0.03, 1.05, 5, dk, -0.58, 1.02, 0.34));                            // древко
  g.add(box(0.34, 0.26, 0.035, banner, -0.42, 1.2, 0.34));                            // уездное знамя
  g.add(sph(0.075, gold, -0.42, 1.2, 0.37));                                          // гербовая печать
  g.add(box(0.24, 0.16, 0.2, dk, 0.58, 0.32, 0.54));                                  // ларь документов
  g.add(box(0.28, 0.035, 0.24, stLt, 0.58, 0.42, 0.54));                              // крышка ларя
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
  // створка на петле: панель смещена в группе → ось вращения у левого края (анимация открытия в render)
  const door = new THREE.Group();
  door.add(box(0.5, 0.7, 0.06, m, 0.25, 0.45, 0));
  door.position.set(-0.25, 0, 0);
  door.name = 'gate_door';
  g.add(door);
  return g;
}

// ---- ресурсные ноды ----
function tree() {
  // 3-ярусная ель с конусным стволом и градиентом хвои (база для инстанс-вариаций цвета/размера)
  const g = new THREE.Group();
  const tr = mat(PAL.woodDk), f0 = mat(PAL.grass2), f1 = mat(PAL.grass3), f2 = mat(0x82b052);
  g.add(cyl(0.07, 0.12, 0.5, 5, tr, 0, 0.25, 0));
  g.add(cone(0.46, 0.62, 7, f0, 0, 0.62, 0));
  g.add(cone(0.36, 0.55, 7, f1, 0, 0.96, 0));
  g.add(cone(0.24, 0.46, 6, f2, 0, 1.3, 0));
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
  const arm1 = cyl(0.035 * sc, 0.04 * sc, 0.34 * sc, 5, cloth, -0.145 * sc, 0.32 * sc, 0); arm1.rotation.z = 0.14;
  const arm2 = cyl(0.035 * sc, 0.04 * sc, 0.34 * sc, 5, cloth, 0.145 * sc, 0.32 * sc, 0); arm2.rotation.z = -0.14;
  g.add(arm1, arm2);                                                       // руки — читаемее силуэт
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

// ---- ферма (2×2, еда): борозды + подсолнухи + кочаны ----
function ferma() {
  const g = new THREE.Group();
  const soil = mat(PAL.dirt), wd = mat(PAL.woodDk), leaf = mat(PAL.grass3), stalk = mat(0x6a7a30);
  const petal = mat(0xffcc00, { emissive: 0xffcc00, emi: 0.25 }), seed = mat(0x5a3a14);
  g.add(box(1.7, 0.14, 1.7, soil, 0, 0.07, 0));
  for (let i = -2; i <= 2; i++) g.add(box(1.5, 0.05, 0.1, wd, 0, 0.15, i * 0.32));
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.55], [-0.55, 0.6], [0.55, 0.6]]) {
    g.add(cyl(0.03, 0.04, 0.6, 4, stalk, x, 0.45, z));
    g.add(sph(0.13, seed, x, 0.8, z));
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.add(box(0.1, 0.02, 0.05, petal, x + Math.cos(a) * 0.16, 0.8, z + Math.sin(a) * 0.16)); }
  }
  for (const [x, z] of [[0, 0], [-0.3, 0.2], [0.3, -0.2]]) g.add(sph(0.1, leaf, x, 0.2, z));
  return g;
}

// ---- рудник (2×2, железо): скальный холм + рама входа + вагонетка ----
function rudnik() {
  const g = new THREE.Group();
  const rk = mat(PAL.rock), rd = mat(PAL.rockDk), wd = mat(PAL.wood), wdk = mat(PAL.woodDk);
  const iron = mat(0xb8bcc4, { metal: 0.7, rough: 0.45, emissive: 0x223040, emi: 0.2 });
  g.add(sph(0.7, rk, 0, 0.4, -0.2)); g.add(sph(0.5, rd, 0.5, 0.3, 0.1)); g.add(sph(0.45, rk, -0.5, 0.3, 0.2));
  g.add(box(0.1, 0.8, 0.1, wdk, -0.32, 0.4, 0.55)); g.add(box(0.1, 0.8, 0.1, wdk, 0.32, 0.4, 0.55));
  g.add(box(0.85, 0.12, 0.12, wd, 0, 0.82, 0.55));
  g.add(box(0.5, 0.6, 0.08, mat(0x0a0a0c), 0, 0.32, 0.6));
  g.add(box(0.3, 0.18, 0.22, wdk, 0.55, 0.12, 0.6));
  g.add(sph(0.09, iron, 0.55, 0.26, 0.6)); g.add(sph(0.07, iron, 0.62, 0.24, 0.55));
  const pick = cyl(0.02, 0.02, 0.5, 4, wd, -0.6, 0.45, 0.5); pick.rotation.z = 0.5; g.add(pick);
  return g;
}

// ---- самоцветная жила (2×2): скала + светящиеся кристаллы ----
function zhila() {
  const g = new THREE.Group();
  const rk = mat(PAL.rock), rd = mat(PAL.rockDk);
  g.add(sph(0.6, rk, 0, 0.35, 0)); g.add(sph(0.45, rd, 0.45, 0.25, 0.2)); g.add(sph(0.4, rk, -0.4, 0.28, -0.2));
  const cols = [0xff7ce6, 0x66e0ff, 0x9b6bff, 0x66ffcc]; let i = 0;
  for (const [x, y, z, s] of [[0, 0.7, 0, 0.2], [0.35, 0.5, 0.2, 0.14], [-0.3, 0.55, -0.15, 0.16], [0.15, 0.45, -0.35, 0.12], [-0.35, 0.42, 0.3, 0.12]]) {
    const gem = mat(0x120814, { emissive: cols[i % cols.length], emi: 2.2, rough: 0.2, metal: 0.3 });
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), gem); c.position.set(x, y, z); c.castShadow = true; g.add(c); i++;
  }
  return g;
}

// ---- самоцветный идол (1×1, реликвия): тотем + кластер гранёных камней ----
function idolSamotsvet() {
  const g = new THREE.Group();
  const st = mat(PAL.stone, { rough: 0.95 });
  g.add(box(0.5, 0.18, 0.5, st, 0, 0.09, 0));
  g.add(cyl(0.18, 0.26, 0.7, 6, st, 0, 0.5, 0));
  g.add(box(0.4, 0.36, 0.4, st, 0, 1.0, 0));
  g.add(box(0.46, 0.07, 0.46, mat(PAL.gold, { metal: 0.85, rough: 0.3 }), 0, 1.2, 0));
  const cols = [0xff7ce6, 0x66e0ff, 0x9b6bff]; let i = 0;
  for (const [x, y, z, s] of [[0, 1.5, 0, 0.22], [0.16, 1.42, 0.05, 0.13], [-0.14, 1.44, -0.06, 0.12], [0.04, 1.62, -0.1, 0.1]]) {
    const gem = mat(0x120814, { emissive: cols[i % 3], emi: 2.6, rough: 0.2, metal: 0.3 });
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), gem); c.position.set(x, y, z); c.castShadow = true; g.add(c); i++;
  }
  return g;
}

// ---- богатырь (тяжёлый витязь со щитом) ----
function bogatyr() {
  const g = humanoid({ cloth: PAL.stoneLt, acc: PAL.gold, spear: true, helmet: true, cape: true, scale: 1.3 });
  const steel = mat(0x9aa0aa, { metal: 0.8, rough: 0.4 });
  const shield = cyl(0.2, 0.2, 0.05, 8, steel, -0.26, 0.42, 0.06); shield.rotation.x = Math.PI / 2; g.add(shield);
  g.add(box(0.07, 0.07, 0.07, mat(PAL.crimson), -0.26, 0.42, 0.09));
  return g;
}

// ---- дичь ----
function deer() {
  const g = new THREE.Group();
  const body = mat(0x9a6a3a), dark = mat(0x6a4622), light = mat(0xc8a060), antler = mat(0xd8cbb0);
  g.add(box(0.6, 0.32, 0.26, body, 0, 0.55, 0));
  for (const [x, z] of [[-0.22, -0.09], [0.22, -0.09], [-0.22, 0.09], [0.22, 0.09]]) g.add(cyl(0.04, 0.04, 0.45, 4, dark, x, 0.22, z));
  const neck = cyl(0.07, 0.09, 0.32, 5, body, 0.3, 0.78, 0); neck.rotation.z = -0.5; g.add(neck);
  g.add(box(0.2, 0.16, 0.14, light, 0.42, 0.92, 0));
  const a1 = cone(0.03, 0.22, 4, antler, 0.46, 1.08, 0.05); a1.rotation.z = 0.3; g.add(a1);
  const a2 = cone(0.03, 0.22, 4, antler, 0.46, 1.08, -0.05); a2.rotation.z = 0.3; g.add(a2);
  g.add(box(0.05, 0.1, 0.05, light, -0.32, 0.6, 0));
  return g;
}
function boar() {
  const g = new THREE.Group();
  const body = mat(0x3a2e26), dark = mat(0x241c16), tusk = mat(0xe8e0cc);
  g.add(box(0.62, 0.34, 0.3, body, 0, 0.4, 0));
  g.add(box(0.3, 0.28, 0.26, dark, 0.18, 0.46, 0));
  for (const [x, z] of [[-0.2, -0.1], [0.2, -0.1], [-0.2, 0.1], [0.2, 0.1]]) g.add(cyl(0.04, 0.05, 0.3, 4, dark, x, 0.15, z));
  g.add(box(0.18, 0.16, 0.18, body, 0.46, 0.42, 0));
  g.add(box(0.08, 0.08, 0.14, dark, 0.56, 0.4, 0));
  g.add(cone(0.02, 0.1, 4, tusk, 0.54, 0.36, 0.07)); g.add(cone(0.02, 0.1, 4, tusk, 0.54, 0.36, -0.07));
  return g;
}

// ---- обсерватория (2×2): башня + купол + телескоп ----
function observatory() {
  const g = new THREE.Group();
  const wall = mat(PAL.stoneLt), st = mat(PAL.stone), dome = mat(0x9aa6b2, { metal: 0.5, rough: 0.35 });
  const lens = mat(0x081018, { emissive: PAL.faithCyan, emi: 2.0 });
  g.add(cyl(0.75, 0.82, 1.0, 10, wall, 0, 0.5, 0));
  g.add(cyl(0.86, 0.86, 0.12, 10, st, 0, 1.05, 0));
  g.add(sph(0.72, dome, 0, 1.5, 0));
  g.add(box(0.18, 0.7, 0.06, mat(0x10141c), 0, 1.55, 0.66));     // прорезь купола
  const tube = cyl(0.07, 0.07, 0.6, 6, st, 0, 1.62, 0.5); tube.rotation.x = 0.6; g.add(tube);
  g.add(sph(0.09, lens, 0, 1.82, 0.78));
  return g;
}

// ---- вече (2×2): открытый круглый помост, знамёна и колокол схода ----
function veche() {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), dk = mat(PAL.woodDk), cloth = mat(PAL.crimson), bell = mat(PAL.gold, { metal: 0.65, rough: 0.35 });
  g.add(cyl(0.84, 0.84, 0.12, 10, dk, 0, 0.06, 0));
  g.add(cyl(0.74, 0.74, 0.08, 10, wd, 0, 0.14, 0));
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) g.add(box(1.25, 0.035, 0.08, dk, 0, 0.2, 0).rotateY(a));
  g.add(box(0.9, 0.18, 0.42, wd, 0, 0.29, 0.32));
  for (const [x, z] of [[-0.66, -0.48], [0.66, -0.48], [-0.66, 0.48], [0.66, 0.48]]) {
    g.add(cyl(0.045, 0.055, 1.32, 5, dk, x, 0.8, z));
    g.add(cone(0.075, 0.16, 5, dk, x, 1.54, z));
  }
  g.add(box(1.42, 0.09, 0.09, dk, 0, 1.28, -0.48));
  g.add(cyl(0.12, 0.18, 0.22, 8, bell, 0, 1.08, -0.48));
  g.add(sph(0.045, dk, 0, 0.92, -0.48));
  for (const x of [-0.66, 0.66]) g.add(box(0.22, 0.38, 0.025, cloth, x, 1.08, -0.5));
  return g;
}

// ---- агитпункт (2×2): индустриальная трибуна, плакат и рупор на мачте ----
function agitpunkt() {
  const g = new THREE.Group();
  const st = mat(PAL.stone), metal = mat(PAL.rock, { metal: 0.8, rough: 0.38 });
  const dk = mat(PAL.rockDk, { metal: 0.65, rough: 0.42 }), poster = mat(PAL.crimson);
  const sign = mat(PAL.faithCyan, { emissive: PAL.faithCyan, emi: 1.5, metal: 0.35, rough: 0.3 });
  g.add(box(1.62, 0.12, 1.42, st, 0, 0.06, 0));
  g.add(box(1.08, 0.22, 0.58, dk, 0, 0.23, 0.28));
  for (const x of [-0.48, 0.48]) {
    g.add(cyl(0.04, 0.055, 1.35, 5, metal, x, 0.8, -0.5));
    g.add(box(0.06, 0.06, 1.2, metal, x, 0.72, -0.02));
  }
  g.add(box(1.1, 0.72, 0.06, poster, 0, 1.02, -0.52));
  g.add(cyl(0.17, 0.17, 0.075, 8, sign, 0, 1.04, -0.57).rotateX(Math.PI / 2));
  g.add(box(0.72, 0.055, 0.055, sign, 0, 1.48, -0.52));
  g.add(cyl(0.055, 0.07, 1.7, 6, metal, 0, 1.0, 0.2));
  g.add(box(0.48, 0.065, 0.065, metal, 0, 1.58, 0.2));
  const horn = cone(0.27, 0.46, 6, dk, 0, 1.58, 0.43); horn.rotation.x = Math.PI / 2; g.add(horn);
  g.add(cyl(0.08, 0.1, 0.15, 6, metal, 0, 1.58, 0.14).rotateX(Math.PI / 2));
  return g;
}

// ---- сторожевая башня (1×1): зубцы + жаровня ----
function tower() {
  const g = new THREE.Group();
  const st = mat(PAL.stone), dk = mat(PAL.rockDk), wd = mat(PAL.woodDk);
  const fire = mat(0x200800, { emissive: 0xff6010, emi: 2.0 });
  g.add(cyl(0.3, 0.36, 1.6, 8, st, 0, 0.8, 0));
  g.add(cyl(0.37, 0.37, 0.1, 8, dk, 0, 1.6, 0));
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; g.add(box(0.12, 0.18, 0.12, dk, Math.cos(a) * 0.32, 1.68, Math.sin(a) * 0.32)); }
  g.add(box(0.22, 0.18, 0.22, fire, 0, 1.78, 0));
  g.add(box(0.16, 0.3, 0.05, wd, 0, 0.15, 0.34));
  g.add(cyl(0.02, 0.02, 0.5, 4, wd, 0, 2.0, 0));                 // флагшток
  g.add(box(0.18, 0.12, 0.02, mat(PAL.crimson), 0.1, 2.15, 0));  // флаг
  return g;
}

// ---- дорога (1×1, мощёная плита) ----
function road() {
  const g = new THREE.Group();
  const d1 = mat(0x6a5a42, { rough: 1 }), d2 = mat(0x7c6c52, { rough: 1 });
  g.add(box(0.96, 0.06, 0.96, d1, 0, 0.03, 0));
  for (const [x, z] of [[-0.26, -0.2], [0.22, 0.26], [0.3, -0.3], [-0.2, 0.3]]) g.add(box(0.16, 0.04, 0.16, d2, x, 0.06, z));
  return g;
}

// ---- мост (1×1, настил с перилами и сваями; садится на уровень воды) ----
export function bridgeTile(mask, endMask) {
  const g = new THREE.Group();
  const wd = mat(PAL.wood), dk = mat(PAL.woodDk), st = mat(PAL.stone), stLt = mat(PAL.stoneLt);
  if (!mask) { mask = 1 | 4; endMask = 1 | 4; }                 // одиночный мост — прямая N-S с обоими берегами
  const eastWest = !!(mask & (2 | 8)) && !(mask & (1 | 4));
  const deckWidth = 0.68, deckLength = 1.06, deckY = 0.25;
  const deck = (w, h, d, m, along = 0, y = deckY, across = 0) => {
    g.add(box(eastWest ? d : w, h, eastWest ? w : d, m,
      eastWest ? along : across, y, eastWest ? across : along));
  };

  deck(deckWidth, 0.1, deckLength, wd);                          // вытянутый настил вдоль фактической оси
  for (let along = -0.42; along <= 0.42; along += 0.21) deck(deckWidth - 0.06, 0.035, 0.05, dk, along, 0.317);

  // Перила остаются только по бокам пролёта: стойки и два продольных поручня.
  for (const across of [-0.31, 0.31]) {
    deck(0.045, 0.055, deckLength, dk, 0, 0.48, across);
    deck(0.035, 0.045, deckLength, dk, 0, 0.37, across);
    for (const along of [-0.46, 0, 0.46]) deck(0.05, 0.32, 0.05, dk, along, 0.39, across);
  }

  deck(0.18, 0.11, deckLength - 0.08, dk, 0, 0.115);              // продольная балка снизу
  for (const along of [-0.34, 0.34]) {
    for (const across of [-0.23, 0.23]) deck(0.09, 0.58, 0.09, dk, along, -0.04, across);
  }

  const addEnd = (bit, sign) => {
    if (!(endMask & bit)) return;
    const abutmentAt = sign * 0.42, rampAt = sign * 0.47;
    deck(deckWidth + 0.1, 0.28, 0.12, st, abutmentAt, 0.14);       // заметный каменный устой
    deck(deckWidth + 0.18, 0.06, 0.18, stLt, abutmentAt, 0.31);    // верхняя плита устоя
    const ramp = eastWest
      ? box(0.16, 0.055, deckWidth - 0.08, wd, rampAt, 0.15, 0)
      : box(deckWidth - 0.08, 0.055, 0.16, wd, 0, 0.15, rampAt);
    if (eastWest) ramp.rotation.z = -sign * 0.48;
    else ramp.rotation.x = sign * 0.48;
    g.add(ramp);                                                   // короткий скос к уровню дороги
  };
  if (eastWest) { addEnd(8, -1); addEnd(2, 1); }
  else { addEnd(1, -1); addEnd(4, 1); }
  return g;
}

function bridge() { return bridgeTile(1 | 4, 1 | 4); }

const BUILDERS = {
  idol_dron: idol, bld_townhall: townhall, bld_izba: izba, bld_izba_plotnika: izbaPlotnika, bld_banya: banya, bld_ambar: ambar, bld_sklad: sklad, bld_roshcha: roshcha,
  enemy_camp: enemyCamp,
  bld_kuznica: kuznica, bld_remdvor: remontDvor, bld_kazarma: kazarma, bld_church: church, bld_market: market, bld_traktir: traktir, bld_prikaz: prikazSbora,
  bld_ferma: ferma, bld_rudnik: rudnik, bld_zhila: zhila, bld_veche: veche, bld_observatory: observatory, bld_agitpunkt: agitpunkt, bld_tower: tower,
  bld_road: road, bld_bridge: bridge,
  bld_chastokol: chastokol, bld_chastokol_gate: chastokolGate,
  res_tree: tree, res_stone: stoneNode, res_ore: oreNode,
  unit_kholop: kholop, unit_ratnik: ratnik, unit_oprichnik: oprichnik, unit_bogatyr: bogatyr,
  unit_cart: cartUnit, unit_loco: loco, unit_wagon: wagon,
  bld_rail: () => railTile(2 | 8), bld_station: station,
  animal_deer: deer, animal_boar: boar,
  enemy_raider: raider, enemy_boss: bossUnit,
  idol_krio: relicIdol(0x00eeff), idol_giper: relicIdol(0xff3020), idol_shipo: relicIdol(0x66ff44),
  idol_obereg: relicIdol(0xffcc00), idol_food: relicIdol(0x88ff66), idol_gold: relicIdol(0xffd040),
  idol_fonk: relicIdol(0xff00bb), idol_vera: relicIdol(0x00eeff), idol_samotsvet: idolSamotsvet,
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
