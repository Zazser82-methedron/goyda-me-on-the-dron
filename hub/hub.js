// ===== Общий 3D-хаб «Гойды» (GDD_2026.md, пункт D1) =====
// Корень сайта: парящий остров, в центре капище Идола Дрона. Запад — поселение Империи,
// восток — ристалище Арены. Две «двери» внизу ведут в игры. Движок, модели и фактуры —
// те же, что в Империи (empire/js), чтобы хаб выглядел как сама игра.
import * as THREE from 'three';
import { Renderer } from '../empire/js/engine/Renderer.js?v=103';
import { AssetManager } from '../empire/js/engine/AssetManager.js?v=147';
import { shared } from '../empire/js/engine/MaterialLib.js?v=10';

// экспедиция из Империи в Арену, начатая по старой ссылке на корень, — доводим до Арены
try { if (localStorage.getItem('GOYDA_BRIDGE')) { location.replace('arena/'); } } catch (e) {}

const MODELS_URL = new URL('../empire/assets/models/', import.meta.url).href;
const TEX_URL = new URL('../empire/assets/textures/', import.meta.url).href;

// лубочная раскраска крыш и ставен — та же палитра, что GameState.paintBuilding
const PAINT = {
  M_roof: [0xe8583e, 0x3cb074, 0x4f82e0, 0xf0b440, 0xc03a58],
  M_roof_iron: [0x17703a, 0xa8281a, 0x1f4494, 0xb8781a],
  M_shutter: [0xd23a2a, 0x2f9a5a, 0x2f5fc8, 0xe8b030],
};

// ---------- состояние игрока (обе игры делят localStorage) ----------
function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
const ERA = ['I', 'II', 'III'];
const FACTION = { goyda: 'Гойда', oprichnina: 'Опричнина', kochevniki: 'Кочевники', hlad: 'Культ Хлада' };
const RANKS = [[0, 'Холоп'], [60, 'Ратник'], [160, 'Опричник I'], [320, 'Опричник II'], [540, 'Опричник III'], [820, 'Воевода'], [1200, 'Боярин']];

function fillStatus() {
  const meta = readJSON('GOYDA_META');
  const valor = document.getElementById('valor');
  if (meta && meta.valor) { valor.querySelector('b').textContent = meta.valor.toLocaleString('ru-RU'); valor.hidden = false; }

  const save = readJSON('GOYDA_EMPIRE_SAVE_v1');
  const es = document.getElementById('empire-status');
  const eb = document.getElementById('empire-go');
  if (save && save.day) {
    const bits = [`День ${save.day}`];
    if (save.era != null) bits.push(`эпоха ${ERA[save.era] || 'I'}`);
    if (save.faction && FACTION[save.faction]) bits.push(FACTION[save.faction]);
    es.textContent = bits.join(' · ');
    eb.textContent = 'Продолжить правление';
  } else {
    es.textContent = 'Держава ещё не основана';
  }

  const st = readJSON('goyda_stats_v1');
  const as = document.getElementById('arena-status');
  if (st && st.games) {
    let rank = RANKS[0][1];
    for (const [min, name] of RANKS) if ((st.slava || 0) >= min) rank = name;
    as.textContent = `${rank} · слава ${st.slava || 0} · побед ${st.wins || 0}`;
  } else {
    as.textContent = 'Ещё ни одной схватки';
  }
}

// ---------- остров ----------
function edgeR(a) { return 7.2 * (1 + 0.07 * Math.sin(3 * a + 1.3) + 0.045 * Math.sin(7 * a + 0.4) + 0.025 * Math.sin(13 * a)); }
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

function buildIsland(loader) {
  const g = new THREE.Group();
  const SEG = 96, RINGS = 14;

  // --- травяная макушка: полярная сетка, край чуть скруглён вниз ---
  const pos = [], col = [], uv = [], idx = [];
  const grassA = new THREE.Color(0x5d9a3a), grassB = new THREE.Color(0x7fae44), c = new THREE.Color();
  pos.push(0, 0, 0); col.push(grassA.r, grassA.g, grassA.b); uv.push(0, 0);
  for (let r = 1; r <= RINGS; r++) {
    const k = r / RINGS;
    for (let s = 0; s < SEG; s++) {
      const a = s / SEG * Math.PI * 2, R = edgeR(a) * k;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const y = (hash(x, z) - 0.5) * 0.05 - Math.max(0, k - 0.9) * 1.6;
      pos.push(x, y, z);
      c.copy(grassA).lerp(grassB, hash(z, x) * 0.8);
      if (k > 0.93) c.lerp(new THREE.Color(0x8a6a3c), (k - 0.93) * 9);
      col.push(c.r, c.g, c.b); uv.push(x / 3, z / 3);
    }
  }
  for (let s = 0; s < SEG; s++) idx.push(0, 1 + (s + 1) % SEG, 1 + s);
  for (let r = 1; r < RINGS; r++) {
    const o0 = 1 + (r - 1) * SEG, o1 = 1 + r * SEG;
    for (let s = 0; s < SEG; s++) {
      const s1 = (s + 1) % SEG;
      idx.push(o0 + s, o0 + s1, o1 + s, o0 + s1, o1 + s1, o1 + s);
    }
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  topGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  topGeo.setIndex(idx); topGeo.computeVertexNormals();
  const topMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  loader.load(TEX_URL + 'ground/ground_diff_1k.jpg?v=94', (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    topMat.map = t; topMat.color.setHex(0xd8f0b0); topMat.needsUpdate = true;
  });
  const top = new THREE.Mesh(topGeo, topMat);
  top.receiveShadow = true;
  g.add(top);

  // --- скальное «корневище»: от кромки вниз к острию, слои земли → камень ---
  const LAY = 11, p2 = [], c2 = [], uv2 = [], i2 = [];
  const soil = new THREE.Color(0x6e4a2c), rock = new THREE.Color(0x8d8f94), deep = new THREE.Color(0x4d4f57);
  for (let l = 0; l <= LAY; l++) {
    const k = l / LAY;
    for (let s = 0; s <= SEG; s++) {
      const a = (s % SEG) / SEG * Math.PI * 2;
      const jag = 1 + (hash(s % SEG, l) - 0.5) * 0.22 * Math.min(1, k * 3);
      const R = edgeR(a) * Math.pow(1 - k, 0.85) * jag * (l === 0 ? 1 : 1.0);
      const y = -1.6 * Math.min(1, k * 8) * (l === 0 ? 0 : 1) - k * 6.2 - (hash(a, l) * 0.6) * k;
      p2.push(Math.cos(a) * R, y, Math.sin(a) * R);
      if (k < 0.12) c.copy(soil); else c.copy(rock).lerp(deep, Math.min(1, (k - 0.12) * 1.3));
      c.multiplyScalar(0.85 + hash(s, l * 3) * 0.3);
      c2.push(c.r, c.g, c.b); uv2.push(s / SEG * 14, y / 2.2);
    }
  }
  for (let l = 0; l < LAY; l++) {
    for (let s = 0; s < SEG; s++) {
      const a0 = l * (SEG + 1) + s, b0 = (l + 1) * (SEG + 1) + s;
      i2.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
    }
  }
  let rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
  rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(c2, 3));
  rockGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv2, 2));
  rockGeo.setIndex(i2);
  rockGeo = rockGeo.toNonIndexed(); rockGeo.computeVertexNormals();   // гранёная скала
  const rockMat = shared('M_stone').clone();
  rockMat.vertexColors = true; rockMat.side = THREE.DoubleSide; rockMat.color.setHex(0xffffff);
  const under = new THREE.Mesh(rockGeo, rockMat);
  under.castShadow = true;
  g.add(under);

  // висячие корни-камни под кромкой
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + hash(i, 1) * 0.3, R = edgeR(a) * (0.55 + hash(i, 2) * 0.3);
    const h = 1.2 + hash(i, 3) * 2.2;
    const geo = new THREE.ConeGeometry(0.35 + hash(i, 4) * 0.4, h, 6, 1).toNonIndexed();
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, rockMat);
    m.position.set(Math.cos(a) * R, -2.6 - hash(i, 5) * 2 - h / 2, Math.sin(a) * R);
    m.rotation.x = Math.PI;
    g.add(m);
  }
  return g;
}

// ---------- мелкая сборка ----------
function cloneOwn(obj) { obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.castShadow = o.receiveShadow = true; } }); return obj; }

function paint(obj, seed) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    const pal = PAINT[o.material && o.material.name];
    if (pal) o.material.color.setHex(pal[seed % pal.length]);
  });
}

// поставить модель с нормировкой по размеру: size — ширина по большей горизонтальной стороне
function put(parent, assets, name, x, z, size, rotY = 0, seed = 0) {
  const v = cloneOwn(assets.get(name));
  const box = new THREE.Box3().setFromObject(v), s = new THREE.Vector3();
  box.getSize(s);
  const k = size / Math.max(s.x, s.z, 1e-3);
  v.scale.setScalar(k);
  v.position.set(x, -box.min.y * k, z);
  v.rotation.y = rotY;
  paint(v, seed);
  parent.add(v);
  return v;
}

function brazier(parent, x, z, fires) {
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.6, metalness: 0.6 });
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.62, 5), iron);
    const a = i / 3 * Math.PI * 2;
    leg.position.set(Math.cos(a) * 0.11, 0.3, Math.sin(a) * 0.11);
    leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    g.add(leg);
  }
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.14, 10, 1, true), iron);
  bowl.material.side = THREE.DoubleSide;
  bowl.position.y = 0.64; g.add(bowl);
  const fireMat = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a10, emissiveIntensity: 3.2, roughness: 1 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 7), fireMat);
  flame.position.y = 0.86; g.add(flame);
  const light = new THREE.PointLight(0xff8a30, 5, 5, 1.8);
  light.position.y = 1.0; g.add(light);
  g.position.set(x, 0, z);
  g.traverse(o => { if (o.isMesh && o !== flame) o.castShadow = true; });
  parent.add(g);
  fires.push({ flame, light, ph: Math.random() * 10 });
}

function banner(parent, x, z, color, flags) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 2.2, 6), shared('M_plank').clone());
  pole.position.set(x, 1.1, z); pole.castShadow = true; parent.add(pole);
  const geo = new THREE.PlaneGeometry(0.62, 0.9, 8, 4);
  geo.translate(0.31, 0, 0);
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }));
  cloth.position.set(x + 0.03, 1.72, z); cloth.castShadow = true;
  parent.add(cloth);
  flags.push({ cloth, base: geo.attributes.position.array.slice(), ph: Math.random() * 6 });
}

function cloud(scale) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xcfd8e8, emissiveIntensity: 0.25, roughness: 1, flatShading: true });
  const n = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const r = (0.7 + Math.random() * 0.8) * scale;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    m.position.set((i - n / 2) * 0.9 * scale + Math.random() * 0.4, Math.random() * 0.5 * scale, (Math.random() - 0.5) * 1.2 * scale);
    m.scale.y = 0.62;
    g.add(m);
  }
  return g;
}

// ---------- сцена ----------
async function main() {
  fillStatus();
  const canvas = document.getElementById('c');
  const R = new Renderer(canvas);
  const { scene } = R;
  R.setSky(0x4a86d0, 0xf6dcae);
  scene.fog = new THREE.Fog(0xe9d8b8, 34, 80);
  // тень только на остров: узкая камера — чёткие тени
  const sc = R.key.shadow.camera;
  sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.updateProjectionMatrix();
  R.key.position.set(14, 22, 10); R.key.target.position.set(0, 0, 0); R.key.target.updateMatrixWorld();
  R.renderer.shadowMap.autoUpdate = true;
  R.heart.intensity = 0;

  const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200);
  R.onResize = (w, h) => { camera.aspect = w / h; camera.updateProjectionMatrix(); layoutCam(); };
  R.setupEnvironment();
  R.setupComposer(camera);

  const assets = new AssetManager();
  assets.base = MODELS_URL;
  const loader = new THREE.TextureLoader();

  const world = new THREE.Group();
  scene.add(world);
  world.add(buildIsland(loader));

  // облака: пояс под островом и пара над горизонтом
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const cl = cloud(0.8 + Math.random() * 1.1);
    const a = i / 16 * Math.PI * 2 + Math.random() * 0.3, r = 10 + Math.random() * 9;
    cl.userData = { a, r, y: -4 - Math.random() * 5, v: 0.012 + Math.random() * 0.02 };
    scene.add(cl); clouds.push(cl);
  }

  await assets.preload(['bld_chudo', 'bld_townhall', 'bld_izba', 'bld_church', 'bld_melnica', 'bld_ambar',
    'bld_tower', 'bld_chastokol', 'unit_ratnik', 'enemy_raider', 'unit_luchnik', 'unit_kholop', 'unit_oprichnik_kon']);

  const fires = [], flags = [];
  // центр — капище Идола Дрона на мощёном круге
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), shared('M_cobble').clone());
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true;
  world.add(plaza);
  const chudo = put(world, assets, 'bld_chudo', 0, 0, 3.0, Math.PI * 0.25);
  // белёный постамент под солнцем хаба выбеливается — притушим до известняка
  chudo.traverse(o => { if (o.isMesh && /white|plaster/i.test(o.material.name)) o.material.color.multiplyScalar(0.62); });

  // запад — Империя: Палаты, избы, церковь, мельница, амбар, башня
  const W = new THREE.Group(); world.add(W);
  put(W, assets, 'bld_townhall', -4.2, -0.6, 2.3, Math.PI * 0.5, 1);
  put(W, assets, 'bld_church', -3.0, -3.3, 1.9, Math.PI * 0.2, 2);
  put(W, assets, 'bld_izba', -5.6, 1.9, 1.15, Math.PI * 0.62, 0);
  put(W, assets, 'bld_izba', -3.6, 2.7, 1.15, Math.PI * 0.85, 3);
  put(W, assets, 'bld_ambar', -1.6, 3.9, 1.3, Math.PI * 0.95, 4);
  const mill = put(W, assets, 'bld_melnica', -6.1, -2.4, 1.35, Math.PI * 0.35, 2);
  put(W, assets, 'bld_tower', -1.2, -5.2, 1.0, 0, 1);
  put(W, assets, 'unit_kholop', -2.4, 1.3, 0.34, 1.2);
  put(W, assets, 'unit_kholop', -2.9, 0.9, 0.34, -0.4);
  put(W, assets, 'unit_luchnik', -1.9, -2.2, 0.34, 2.4);
  const sails = mill.getObjectByName('melnica_kryla');

  // восток — Арена: утоптанный круг, частокол, жаровни, бойцы друг против друга
  const E = new THREE.Group(); E.position.set(4.3, 0, 0.3); world.add(E);
  const ring = new THREE.Mesh(new THREE.CircleGeometry(1.9, 36), new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 1 }));
  loader.load(TEX_URL + 'ground/ground_diff_1k.jpg?v=94', (t) => { t.colorSpace = THREE.SRGBColorSpace; ring.material.map = t; ring.material.needsUpdate = true; });
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; ring.receiveShadow = true; E.add(ring);
  const border = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.08, 6, 40), shared('M_log').clone());
  border.rotation.x = Math.PI / 2; border.position.y = 0.06; border.castShadow = true; E.add(border);
  for (let i = 0; i < 16; i++) {           // полукольцо кольев за спиной ристалища
    const a = -Math.PI * 0.55 + i / 15 * Math.PI * 1.1;
    const h = 0.55 + hash(i, 9) * 0.15;
    const kol = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, h, 6), shared('M_log').clone());
    kol.position.set(Math.cos(a) * 2.35, h / 2, Math.sin(a) * 2.35); kol.castShadow = true; E.add(kol);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 6), kol.material);
    tip.position.set(kol.position.x, h + 0.07, kol.position.z); E.add(tip);
  }
  brazier(E, -1.35, -1.55, fires); brazier(E, -1.35, 1.55, fires);
  banner(E, 2.1, -1.25, 0xc8302a, flags); banner(E, 2.1, 1.25, 0x2f5fc8, flags);
  const hero = put(E, assets, 'unit_ratnik', -0.45, 0.05, 0.42, Math.PI * 0.5);
  const foe = put(E, assets, 'enemy_raider', 0.5, -0.05, 0.42, -Math.PI * 0.5);
  put(E, assets, 'unit_oprichnik_kon', 0.9, 2.9, 0.5, -2.6);

  // деревья по кромке — ельник на обоих краях, центр и дороги свободны
  const treeSpots = [];
  for (let i = 0; i < 44; i++) {
    const a = hash(i, 11) * Math.PI * 2, k = 0.72 + hash(i, 12) * 0.2;
    const x = Math.cos(a) * edgeR(a) * k, z = Math.sin(a) * edgeR(a) * k;
    if (Math.hypot(x - 4.3, z - 0.3) < 2.9 || Math.hypot(x, z) < 2.6) continue;
    if (z > 3.2 && Math.abs(x) < 2.4) continue;   // вид камеры на площадь не загораживаем
    treeSpots.push([x, z]);
  }
  for (const [x, z] of treeSpots) {
    const t = cloneOwn(assets.get('res_tree'));
    t.position.set(x, 0, z); t.scale.setScalar(0.55 + hash(x, z) * 0.35); t.rotation.y = hash(z, x) * 6;
    world.add(t);
  }

  // дорожки от площади к двум сторонам
  const roadMat = shared('M_cobble').clone(); roadMat.color.setHex(0xd9c9a8);
  for (const [x, len, rot] of [[-2.4, 2.4, 0], [2.1, 0.9, 0.12]]) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.7), roadMat);
    road.rotation.set(-Math.PI / 2, 0, rot); road.position.set(x, 0.015, 0.05); road.receiveShadow = true;
    world.add(road);
  }

  // ---------- камера: медленный облёт; наведение на дверь разворачивает к её стороне ----------
  let az = -0.15, azTarget = -0.15, idle = 0, focus = 0, focusTarget = 0;
  let rad = 17.5, height = 7.8, lookY = -1.6;
  // остров держим в верхних ~2/3 кадра — низ экрана занимают двери
  // на узком (портретном) экране дистанция подбирается так, чтобы остров влез по ширине
  function layoutCam() {
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    rad = Math.max(23.5, 8.0 / Math.tan(hfov / 2));
    height = rad * 0.45; lookY = -2.6 - (rad - 23.5) * 0.16;
    scene.fog.near = rad + 10; scene.fog.far = rad * 2 + 34;   // туман от дистанции — дальний остров не тонет в дымке
  }
  layoutCam();
  const look = new THREE.Vector3();
  document.querySelectorAll('.door').forEach(d => {
    d.addEventListener('pointerenter', () => { focusTarget = d.dataset.side === 'empire' ? -1 : 1; });
    d.addEventListener('pointerleave', () => { focusTarget = 0; });
    d.addEventListener('focus', () => { focusTarget = d.dataset.side === 'empire' ? -1 : 1; });
    d.addEventListener('click', (ev) => { ev.preventDefault(); dive(d.dataset.side, d.getAttribute('href')); });
  });

  let diving = null;
  function dive(side, href) {
    if (diving) return;
    diving = { t: 0, side, href };
    document.body.classList.add('leaving');
    setTimeout(() => { location.href = href; }, 850);
  }

  document.body.classList.add('ready');
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    idle += dt;
    focus += (focusTarget - focus) * Math.min(1, dt * 2.6);
    azTarget = -0.15 + Math.sin(idle * 0.07) * 0.35 + focus * 0.55;
    az += (azTarget - az) * Math.min(1, dt * 1.8);
    let r = rad - Math.abs(focus) * 2.2, h = height - Math.abs(focus) * 0.8;
    look.set(focus * 3.2, lookY, 0);
    if (diving) {
      diving.t += dt;
      const k = Math.min(1, diving.t / 0.85), e = k * k * (3 - 2 * k);
      const sx = diving.side === 'empire' ? -1 : 1;
      r = THREE.MathUtils.lerp(r, 5.5, e); h = THREE.MathUtils.lerp(h, 2.2, e);
      look.x = THREE.MathUtils.lerp(look.x, sx * 4.2, e);
    }
    camera.position.set(look.x + Math.sin(az) * r, h, Math.cos(az) * r);
    camera.lookAt(look);

    world.position.y = Math.sin(t * 0.5) * 0.12;    // остров чуть покачивается в потоке
    chudo.traverse(o => { if (o.isMesh && o.material.emissiveIntensity > 0.2) o.material.emissiveIntensity = 1.2 + Math.sin(t * 2.2) * 0.5; });
    if (sails) sails.rotation.z = t * 0.9;
    for (const f of fires) {
      const n = 1 + Math.sin(t * 13 + f.ph) * 0.08 + Math.sin(t * 29 + f.ph * 2) * 0.05;
      f.flame.scale.set(1, n, 1); f.light.intensity = 4.2 * n;
    }
    for (const f of flags) {
      const p = f.cloth.geometry.attributes.position, b = f.base;
      for (let i = 0; i < p.count; i++) {
        const x = b[i * 3];
        p.array[i * 3 + 2] = Math.sin(x * 7 - t * 4 + f.ph) * 0.06 * x * 1.6;
      }
      p.needsUpdate = true;
    }
    // бойцы на ристалище переминаются
    hero.position.y = Math.abs(Math.sin(t * 3.1)) * 0.03; foe.position.y = Math.abs(Math.sin(t * 3.1 + 1.4)) * 0.03;
    for (const cl of clouds) {
      const u = cl.userData; u.a += u.v * dt;
      cl.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.3 + u.r) * 0.2, Math.sin(u.a) * u.r);
    }
    R.render(camera);
    requestAnimationFrame(frame);
  }
  frame();
  window.__hub = { scene, camera, assets };
}

main().catch(e => { console.error(e); document.body.classList.add('ready', 'no3d'); });
