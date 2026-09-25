// ===== Общая библиотека материалов с фактурами (GDD_2026.md §2.3) =====
// Модели из tools/blender/goyda_kit.py несут материалы с именами M_*. Здесь они подменяются
// одним общим материалом на имя: фактура грузится один раз на всю игру, а не в каждом GLB.
// Затенение в углах (AO) запечено в цвет вершин — такие меши получают вариант с vertexColors.
import * as THREE from 'three';
import * as Quality from './Quality.js?v=94';

const BASE = './assets/textures/lib/';
// имя материала → фактура (<tex>_diff.jpg / <tex>_nor.jpg), тон и шероховатость.
// Фото Poly Haven выцветшие — тон (tint) умножается на фактуру и даёт тёплое дерево и золотую солому.
const TEXTURED = {
  M_log:     { tex: 'log',     tint: 0xc08a55, rough: 0.85 },
  M_plank:   { tex: 'plank',   tint: 0xd0a070, rough: 0.85 },
  M_thatch:  { tex: 'thatch',  tint: 0xf0c878, rough: 0.95 },
  M_stone:   { tex: 'stone',   tint: 0xd8d0c0, rough: 0.9 },
  M_plaster: { tex: 'plaster', tint: 0xffffff, rough: 0.9 },
  M_siding:  { tex: 'plaster', tint: 0xf0b848, rough: 0.8 },   // обшивка, крашенная охрой (светлая фактура держит яркий цвет)
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
  } else {
    m = src.clone();   // краска/железо/окна — свой цвет из GLB, без фактуры
    m.flatShading = false;
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
