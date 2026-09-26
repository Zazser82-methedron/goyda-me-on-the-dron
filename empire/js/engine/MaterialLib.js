// ===== Общая библиотека материалов с фактурами (GDD_2026.md §2.3) =====
// Модели из tools/blender/goyda_kit.py несут материалы с именами M_*. Здесь они подменяются
// одним общим материалом на имя: фактура грузится один раз на всю игру, а не в каждом GLB.
// Затенение в углах (AO) запечено в цвет вершин — такие меши получают вариант с vertexColors.
import * as THREE from 'three';
import * as Quality from './Quality.js?v=94';

const BASE = './assets/textures/lib/';
// имя материала → фактура (<tex>_diff.jpg / <tex>_nor.jpg), тон и шероховатость.
// Тон (tint) умножается на фактуру. Стиль — сказочно-лубочный (выбор игрока 2026-09-25): медово-золотое
// дерево как хохломская основа, золотая солома, серый камень; крыши и ставни крашеные и у каждого здания
// свой цвет (M_roof / M_roof_iron / M_shutter перекрашивает GameState.paintBuilding).
const TEXTURED = {
  M_log:     { tex: 'log',     tint: 0xe0b278, rough: 0.85 },
  M_plank:   { tex: 'plank',   tint: 0xecca94, rough: 0.85 },
  M_roof:    { tex: 'plank',   tint: 0xffffff, rough: 0.8 },    // тёсовая кровля; цвет задаёт здание
  M_thatch:  { tex: 'thatch',  tint: 0xf0c878, rough: 0.95 },
  M_stone:   { tex: 'rock',    tint: 0xc9ccd0, rough: 0.9 },   // серая скала (прежняя кладка была бурой)
  M_plaster: { tex: 'plaster', tint: 0xffffff, gain: 1.3, rough: 0.9 },   // фото штукатурки сероватое — gain осветляет до побелки
  M_cobble:  { tex: 'cobble',  tint: 0xc4c2bc, rough: 0.95 },   // мощёная дорога
  M_siding:  { tex: 'plaster', tint: 0xf0b848, rough: 0.8 },   // обшивка, крашенная охрой (светлая фактура держит яркий цвет)
};

// Цвета без фактуры, которые в GLB заданы слишком светлыми (линейные значения из goyda_kit.MATS):
// «тёмное» выходило средне-серым, кожа и мех — бежевыми. Правка здесь чинит все модели сразу, без пересборки.
const COLOR_FIX = {
  M_dark: 0x1e1713,     // двери, проёмы, шатёр Логова
  M_leather: 0x3e2616,  // сапоги, ремни, кожаные покрышки юрт
  M_fur: 0x4c3521,      // меховые шапки, шкуры Орды
};

const loader = new THREE.TextureLoader();
const texCache = {};
const matCache = {};
const low = Quality.getTier() === 'low';

function tex(file, srgb) {
  if (texCache[file]) return texCache[file];
  const t = loader.load(BASE + file + '?v=1');
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = low ? 1 : 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache[file] = t;
  return t;
}

// Вернуть общий материал для меша или null, если имя не из библиотеки.
function libMaterial(src, withAO) {
  const name = src && src.name;
  if (!name || !name.startsWith('M_')) return null;
  const key = name + (withAO ? '+ao' : '');
  if (matCache[key]) return matCache[key];
  const t = TEXTURED[name];
  let m;
  if (t) {
    m = new THREE.MeshStandardMaterial({
      name, color: t.tint, roughness: t.rough, metalness: 0,
      map: tex(t.tex + '_diff.jpg', true),
      normalMap: low ? null : tex(t.tex + '_nor.jpg', false),
    });
    if (t.gain) m.color.multiplyScalar(t.gain);   // >1 допустимо: шейдер не зажимает цвет материала
  } else {
    m = src.clone();   // краска/железо/окна — свой цвет из GLB, без фактуры
    m.flatShading = false;
    if (COLOR_FIX[name] != null) m.color.setHex(COLOR_FIX[name]);
  }
  m.vertexColors = withAO;
  matCache[key] = m;
  return m;
}

export function applyLibrary(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const withAO = !!(o.geometry && o.geometry.attributes.color);
    const swap = (mm) => libMaterial(mm, withAO) || mm;
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
}

// Общий материал с фактурой для процедурной геометрии (Placeholders: стены, дороги, заборы).
// Без запечённого AO — у процедурных мешей нет цвета вершин. UV у BoxGeometry 0..1 на грань,
// поэтому масштаб фактуры держится размером детали (~0.5 единицы = один повтор).
export function shared(name) {
  return libMaterial({ name }, false);
}
