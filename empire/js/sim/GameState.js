// ===== Единый источник правды: ресурсы, сущности, ранги, сейв =====
import * as THREE from 'three';
import { GRID_N, STORAGE_KEY, TILE } from '../data/config.js?v=102';
import { Grid } from '../world/Grid.js?v=96';
import { NodeField } from '../world/NodeField.js?v=127';
import { BUILDINGS } from '../data/buildings.js?v=108';
import { UNITS } from '../data/units.js?v=94';
import { RANKS } from '../data/ranks.js?v=94';
import { buildScaffold, roadApron, railApron } from '../engine/Placeholders.js?v=121';
import * as Tiling from '../world/Tiling.js?v=120';

// Модели, у которых есть облики эпох <model>_e1 / <model>_e2 (tools/blender/build_*.py), по эпохам:
// если облик эпохи не отличается от предыдущего, файла нет и modelFor() берёт ближайший ранний.
// Грузятся лениво — только когда держава дошла до эпохи, чтобы старт не тянул все облики разом.
const ERA_COMMON = ['bld_izba', 'bld_townhall', 'bld_ambar', 'bld_ferma', 'bld_kuznica', 'bld_kazarma',
  'bld_church', 'bld_market', 'bld_banya', 'bld_traktir', 'bld_tower', 'bld_observatory', 'bld_roshcha',
  'bld_izba_plotnika', 'bld_veche', 'bld_lesopilka', 'bld_melnica', 'bld_paseka'];
// Лубочная палитра: крыши и ставни каждого здания крашены по-своему (детерминированно от клетки —
// после загрузки сейва цвет тот же). Тёсовая кровля умножается на фактуру, поэтому цвета светлее.
const PAINT = {
  M_roof: [0xe8583e, 0x3cb074, 0x4f82e0, 0xf0b440, 0xc03a58],
  M_roof_iron: [0x17703a, 0xa8281a, 0x1f4494, 0xb8781a],   // темнее тёса: гладкое железо под AgX выбеливается
  M_shutter: [0xd23a2a, 0x2f9a5a, 0x2f5fc8, 0xe8b030],
};
export const ERA_SKINS = { 1: ERA_COMMON, 2: [...ERA_COMMON, 'bld_rudnik', 'bld_prikaz', 'bld_zastava', 'bld_tamozhnya', 'bld_station'] };

// Порт (roadPort/railPort) задан как {dx,dy} от gx,gy для НЕповёрнутого здания (rot=0).
// При повороте (R при постройке, b.rot 0..3, view.rotation.y = rot*PI/2) визуальный фасад
// уходит в другую сторону — считаем порт от центра footprint той же матрицей, что и модель:
// x' = x*cosθ + z*sinθ, z' = -x*sinθ + z*cosθ (подтверждено эталоном DIR_ROT в world/Tiling.js:
// сегмент стены «вдоль +Z=S» повёрнутый на PI/2 указывает на +X=восток=бит E — совпадает).
// часть модели здания (а не лес/связка стены): поднимаемся до ребёнка view с userData.skin
function isSkinChild(o) {
  for (let p = o; p; p = p.parent) { if (p.userData && p.userData.skin) return true; if (p.userData && p.userData.entity) return false; }
  return false;
}

function rotatePort(port, gx, gy, w, h, rot) {
  const cx = gx + (w - 1) / 2, cy = gy + (h - 1) / 2;
  let ox = port.dx - (w - 1) / 2, oy = port.dy - (h - 1) / 2;
  for (let i = 0, n = ((rot % 4) + 4) % 4; i < n; i++) { const nx = oy, ny = -ox; ox = nx; oy = ny; }
  return { x: Math.round(cx + ox), y: Math.round(cy + oy) };
}

export class GameState {
  constructor(scene, assets, unitRenderer) {
    this.scene = scene;
    this.assets = assets;
    this.unitRenderer = unitRenderer;   // инстансный рендер юнитов (тело/тень/шеврон) — main.js пишет в него каждый кадр
    this.grid = new Grid(GRID_N);

    // инстансные поля ресурсов (1 draw call на тип вместо ~800 объектов)
    this.fields = {
      wood: new NodeField(scene, 'res_tree', 700, { wind: true }),
      stone: new NodeField(scene, 'res_stone', 300),
      gold: new NodeField(scene, 'res_ore', 250),
    };

    this.resources = { food: 70, wood: 80, stone: 70, iron: 0, tes: 0, bread: 0, mead: 0, gold: 45, gems: 0, faith: 15 };
    this.cap = { food: 400, wood: 400, stone: 400, iron: 300, tes: 200, bread: 200, mead: 200, gold: 400, gems: 150, faith: 999 };
    this.stats = { slain: 0, camps: 0, vets: 0 };   // счётчики похода → Сводка в конце

    // исследования (древо технологий) — множители/бонусы
    this.research = { done: {}, gatherMul: 1, dmgMul: 1, hpMul: 1, spdMul: 1, popBonus: 0, foodDay: 0, goldDay: 0, faithDay: 0 };

    this.happiness = 60;
    this.population = 0;
    this.popCap = 0;
    this.rankIndex = 0;
    this.day = 0;
    this.starveAccum = 0;
    this.estates = { values: { oprichnina: 50, veche: 50, church: 50, kupcy: 50 }, requirements: {}, nextDemandDay: 2, lastDay: 0, lastVecheDay: 0, lastVecheEra: null, agitTarget: null, warnings: {} };
    // Счётчики финальных условий хранятся в сейве; сами лагеря, как и раньше, не хранятся.
    this.victory = { loveDays: 0, lastLoveDay: 0, winPath: null };
    this.coup = { lowHappyDays: 0, lastDay: 0, lastEventDay: -Infinity, pending: false };

    this.buildings = [];
    this.units = [];
    this.nodes = [];
    this.camps = [];              // вражьи станы (спавнят набеги, можно сносить)
    this.animals = [];            // дичь (бродят по карте, на них охотятся)
    this.fx = [];                 // визуальные эффекты (смерть/пуф) — анимируются в render
    this._byId = new Map();
    this._id = 1;

    this.townhall = null;
    this.idol = null;             // здание-чудо (когда построено)
    this.selected = null;
    this.gameOver = null;         // 'win' | 'lose'
    this.faction = null;          // выбранная фракция
    this.mapKey = 'les';          // выбранная локация

    // флаги/таймеры
    this.superTimer = 0;          // СВЕРХ-ГОЙДА (сек)
    this.krioTimer = 0;          // дебафф добычи от Волхва
    this.threatTimer = 0;         // визуальная тревога

    this.onToast = () => {};      // (text, opts) — назначает main
    this.onRankUp = () => {};
    this.onCampDestroyed = () => {};
    this._tmpCol = new THREE.Color();   // переиспользуемый для вычисления оттенков нод
  }

  // ---- ресурсы ----
  canAfford(cost) {
    for (const k in cost) if ((this.resources[k] || 0) < cost[k]) return false;
    return true;
  }
  spend(cost) {
    if (!this.canAfford(cost)) return false;
    for (const k in cost) this.resources[k] -= cost[k];
    return true;
  }
  gain(obj) {
    for (const k in obj) {
      if (this.resources[k] === undefined) continue;
      this.resources[k] = Math.min(this.cap[k] ?? 9999, this.resources[k] + obj[k]);
    }
  }

  byId(id) { return this._byId.get(id); }
  get rank() { return RANKS[this.rankIndex]; }

  // ---- ноды ресурсов (инстансные) ----
  addNode(kind, gx, gy, amount) {
    const resType = kind === 'res_tree' ? 'wood' : kind === 'res_stone' ? 'stone' : 'gold';
    const field = this.fields[resType];
    const { wx, wz } = this.grid.gridToWorld(gx, gy);
    const y = this.grid.heightAt ? this.grid.heightAt(wx, wz) : 0;
    const ry = (gx * 1.7 + gy * 0.9) % (Math.PI * 2);
    const n = { id: this._id++, type: 'node', kind, resType, gx, gy, amount, maxAmount: amount, depleted: false, field, instIndex: -1 };
    // детерминированная вариативность вида (размер/высота/оттенок) — стабильна между ребилдами/сейвом
    const hh = (((gx * 73856093) ^ (gy * 19349663)) >>> 0);
    const r1 = (hh & 255) / 255, r2 = ((hh >> 8) & 255) / 255, r3 = ((hh >> 16) & 255) / 255;
    let opt;
    if (kind === 'res_tree') {
      // оттенок хвои: от тёмно- до светло/желтовато-зелёного (умножается на запечённый цвет; ствол ~коричневый остаётся)
      const tint = this._tmpCol.setHSL(0.26 + r3 * 0.08, 0.12 + r2 * 0.2, 0.72 + r1 * 0.26).getHex();   // мягкий разброс, без ухода в желтизну
      opt = { baseSc: 0.8 + r1 * 0.6, aspect: 0.82 + r2 * 0.5, tint };       // размер 0.8..1.4, высота 0.82..1.32
    } else {
      opt = { baseSc: 0.82 + r1 * 0.42, aspect: 0.85 + r2 * 0.4, tint: this._tmpCol.setHSL(0, 0, 0.78 + r2 * 0.22).getHex() };
    }
    field.add(n, wx, y, wz, ry, 1, opt);
    this.grid.occupy(gx, gy, 1, 1, n.id, { walkable: false });
    this.nodes.push(n); this._byId.set(n.id, n);
    return n;
  }

  removeNode(n) {
    if (n.field) n.field.remove(n);
    this.grid.occupy(n.gx, n.gy, 1, 1, null);
    this.nodes = this.nodes.filter(x => x !== n);
    this._byId.delete(n.id);
    if (this.selected === n) this.selected = null;
  }

  // ---- вражьи станы ----
  addCamp(gx, gy, opts = {}) {
    const w = opts.w || 2, h = opts.h || 2;
    const baseHp = opts.hp || 320;
    const view = this.assets.get(opts.model || 'enemy_camp');
    const c = this.grid.footprintCenter(gx, gy, w, h);
    const cy = this.grid.heightAt ? this.grid.heightAt(c.wx, c.wz) : 0;
    view.position.set(c.wx, cy, c.wz);
    this.scene.add(view);
    const camp = { id: this._id++, type: opts.lair ? 'lair' : 'camp', gx, gy, w, h, hp: baseHp, maxHp: baseHp,
      baseHp, view, cx: c.wx, cz: c.wz, cy, spawnT: 0, lair: !!opts.lair, returnable: opts.returnable !== false };
    view.userData.entity = camp;
    this.grid.occupy(gx, gy, w, h, camp.id, { walkable: false });
    this.camps.push(camp);
    return camp;
  }
  removeCamp(camp) {
    this.scene.remove(camp.view);
    this.grid.occupy(camp.gx, camp.gy, camp.w, camp.h, null);
    this.camps = this.camps.filter(x => x !== camp);
    this._byId.delete(camp.id);
    if (this.selected === camp) this.selected = null;
    this.onCampDestroyed(camp);
  }
  campById(id) { return this.camps.find(c => c.id === id); }

  // ---- дичь ----
  addAnimal(kind, def, wx, wz) {
    const view = this.assets.get(def.model);
    const y = this.grid.heightAt ? this.grid.heightAt(wx, wz) : 0;
    view.position.set(wx, y, wz);
    this.scene.add(view);
    const a = {
      id: this._id++, type: 'animal', kind, def, view,
      x: wx, z: wz, px: wx, pz: wz, dir: 0,
      hp: def.hp, maxHp: def.hp, wanderT: 0, tx: wx, tz: wz, hunterId: null, fleeing: false,
    };
    view.userData.entity = a;
    this.animals.push(a); this._byId.set(a.id, a);
    return a;
  }
  removeAnimal(a, fx) {
    this._byId.delete(a.id);
    this.animals = this.animals.filter(x => x !== a);
    if (this.selected === a) this.selected = null;
    if (fx && a.view) { a.view.userData.entity = null; this.fx.push({ view: a.view, kind: 'death', life: 0.5, max: 0.5, y0: a.view.position.y }); }
    else if (a.view) this.scene.remove(a.view);
  }

  // ---- общий «земляной патч» под здания (ленивая инициализация, 1 текстура/материал/геометрия на все) ----
  _dirtTex() {
    if (this._dTex) return this._dTex;
    const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.5);
    // вытоптанная трава, а не бурое пятно: светлее, прозрачнее (весь город был «коричневым»)
    g.addColorStop(0, 'rgba(120,108,78,0.6)');
    g.addColorStop(0.6, 'rgba(118,112,74,0.35)');
    g.addColorStop(1, 'rgba(118,112,74,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    // рваные края — выгрызаем кляксы по периметру
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 64; i++) {
      const a = Math.random() * 6.283, r = S * (0.33 + Math.random() * 0.2);
      x.beginPath(); x.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, 2 + Math.random() * 7, 0, 6.283);
      x.fillStyle = 'rgba(0,0,0,' + (0.3 + Math.random() * 0.5) + ')'; x.fill();
    }
    x.globalCompositeOperation = 'source-over';
    // тёмные комья земли
    for (let i = 0; i < 44; i++) {
      const px = Math.random() * S, py = Math.random() * S, d = Math.hypot(px - S / 2, py - S / 2) / (S / 2);
      if (d > 0.82) continue;
      x.fillStyle = 'rgba(48,34,20,' + (0.12 + Math.random() * 0.26) * (1 - d) + ')';
      x.beginPath(); x.arc(px, py, 1 + Math.random() * 2.5, 0, 6.283); x.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
    this._dTex = t; return t;
  }
  _dirtMat() {
    if (!this._dMat) this._dMat = new THREE.MeshStandardMaterial({ map: this._dirtTex(), transparent: true, roughness: 1, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return this._dMat;
  }
  _dirtGeo() { if (!this._dGeo) this._dGeo = new THREE.PlaneGeometry(1, 1); return this._dGeo; }

  // ---- здания ----
  addBuilding(kind, gx, gy, opts = {}) {
    const def = BUILDINGS[kind];
    const skin = this.modelFor(def);
    const view = this.assets.get(skin);
    // персональные материалы на каждое здание (иначе общий кэш сделает прозрачными все)
    view.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
    for (const ch of view.children) ch.userData.skin = true;   // части модели — их меняет reskin() при смене эпохи
    const c = this.grid.footprintCenter(gx, gy, def.w, def.h);
    // мост садится на уровень воды, остальное — на рельеф
    const cy = def.bridge ? (this.grid.water ?? -0.5) : (this.grid.heightAt ? this.grid.heightAt(c.wx, c.wz) : 0);
    view.position.set(c.wx, cy, c.wz);
    const rot = opts.rotation || 0;
    view.rotation.y = rot * Math.PI / 2;          // поворот постройки (R при размещении)
    this.scene.add(view);
    const b = {
      id: this._id++, type: 'building', kind, def, gx, gy, w: def.w, h: def.h,
      hp: def.hp, maxHp: def.hp, view, rot,
      built: opts.built ?? false, buildLeft: opts.built ? 0 : (def.build || 0),
      trainQueue: [], trainLeft: 0,
      cx: c.wx, cz: c.wz, cy, skin,
    };
    this.paintBuilding(b);
    if (def.roadPort) b.roadPortTile = rotatePort(def.roadPort, gx, gy, def.w, def.h, rot);
    if (def.railPort) b.railPortTile = rotatePort(def.railPort, gx, gy, def.w, def.h, rot);
    const addPortApron = (portTile, makeApron, field) => {
      const portWorld = this.grid.gridToWorld(portTile.x, portTile.y);
      const dx = c.wx - portWorld.wx, dz = c.wz - portWorld.wz;
      const dist = Math.hypot(dx, dz) || 1;
      // Порт-клетка всегда ровно на 0.5 тайла ЗА краем футпринта (по построению rotatePort) —
      // независимо от размера здания. Раньше апрон ставился долей (*0.7) от ПОЛНОГО расстояния
      // до центра, а это расстояние растёт с площадью здания — для 2×2 он проваливался на
      // ~0.55 тайла ВНУТРЬ футпринта. Правильно — фиксированный отступ от порта к краю (середина
      // зазора шириной 0.5 тайла), не зависящий от размера здания.
      const OFFSET = 0.25 * TILE;
      const ax = portWorld.wx + (dx / dist) * OFFSET;
      const az = portWorld.wz + (dz / dist) * OFFSET;
      const apron = makeApron();
      apron.rotation.y = Math.atan2(dx, dz);
      apron.position.set(ax, this.grid.heightAt ? this.grid.heightAt(ax, az) : 0, az);
      this.scene.add(apron); b[field] = apron;
    };
    if (b.roadPortTile) addPortApron(b.roadPortTile, roadApron, '_roadApron');
    if (b.railPortTile) addPortApron(b.railPortTile, railApron, '_railApron');
    view.userData.entity = b;
    // «затоптанный» земляной патч под зданием — мягко вписывает постройку в траву (нет жёсткого стыка)
    if (!def.bridge && !def.onWater && !def.road) {
      const dp = new THREE.Mesh(this._dirtGeo(), this._dirtMat());
      dp.rotation.x = -Math.PI / 2;
      const sz = (Math.max(def.w, def.h) + 0.5) * TILE;
      dp.scale.set(sz, sz, 1);
      dp.position.set(c.wx, cy + 0.03, c.wz);
      dp.renderOrder = 1; dp.receiveShadow = false;
      this.scene.add(dp); b._dirt = dp;
    }
    // стройплощадка: леса вокруг + высота модели (для подъёма из земли по мере стройки)
    if (!b.built) {
      const bb = new THREE.Box3().setFromObject(view);
      b._bh = Math.max(0.6, bb.max.y - bb.min.y);
      const sc = buildScaffold(def.w, def.h);
      sc.position.set(c.wx, cy, c.wz);
      this.scene.add(sc); b._scaffold = sc;
    }
    this.grid.occupy(gx, gy, def.w, def.h, b.id, { walkable: !!def.walkable, road: !!def.road, rail: !!def.rail });
    this.buildings.push(b); this._byId.set(b.id, b);
    if (def.unique && kind === 'townhall') this.townhall = b;
    if (def.wonder) this.idol = b;
    this._applyBuildVisual(b);
    if (def.aura) {   // кольцо радиуса ауры реликвии — цвет по типу эффекта
      const AC = { slow: 0x66ddff, heal: 0x66ff88, aoe: 0xff6633 };
      const rc = AC[def.aura.effect] || 0xcc66ff;
      const rg = new THREE.Mesh(
        new THREE.RingGeometry(def.aura.radius - 0.28, def.aura.radius, 48),
        new THREE.MeshBasicMaterial({ color: rc, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
      );
      rg.rotation.x = -Math.PI / 2; rg.position.set(c.wx, cy + 0.08, c.wz);
      rg.visible = false;   // видно только при выборе постройки — переключает ui/Selection.js
      this.scene.add(rg); b._ring = rg;
    }
    Tiling.onPlaced(this, b);                       // авто-соединение: стены/дороги + обновить соседей
    if (b.built) Tiling.refreshHomesteads(this);    // «усадьбы» (built сразу — напр. рестор сейва)
    return b;
  }

  // Облик постройки по эпохе (GDD §3.9): <model>_e1 / _e2, если такая модель загружена; иначе базовая.
  modelFor(def) {
    for (let e = this.era || 0; e > 0; e--) {
      const name = def.model + '_e' + e;
      if (this.assets.isGlb[name]) return name;
    }
    return def.model;
  }

  // Перестроить облик уже стоящего здания (переход эпохи). Меняются только части модели —
  // леса, связки стен и прочие навешанные группы (без userData.skin) остаются.
  reskin(b) {
    const name = this.modelFor(b.def);
    if (!b.view || b.skin === name) return;
    const fresh = this.assets.get(name);
    fresh.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
    for (const ch of [...b.view.children]) if (ch.userData.skin) b.view.remove(ch);
    for (const ch of [...fresh.children]) { ch.userData.skin = true; b.view.add(ch); }
    b.skin = name;
    this.paintBuilding(b);
    this._applyBuildVisual(b);
  }

  reskinAll() { for (const b of this.buildings) this.reskin(b); }

  paintBuilding(b) {
    const h = (b.gx * 73856093) ^ (b.gy * 19349663);
    b.view.traverse(o => {
      if (!o.isMesh || !o.userData.skin && !isSkinChild(o)) return;
      const pal = PAINT[o.material && o.material.name];
      if (pal) o.material.color.setHex(pal[((h >>> 0) + pal.length * 7) % pal.length]);
    });
  }

  loadEraSkins(era) {
    if (!era) return Promise.resolve(0);
    const names = (ERA_SKINS[era] || []).map(m => m + '_e' + era).filter(n => !this.assets.isGlb[n]);
    return this.assets.preload(names);
  }

  // Переход эпохи: догрузить облики и перестроить здания (до загрузки остаётся прежний облик).
  reskinForEra() { return this.loadEraSkins(this.era || 0).then(() => this.reskinAll()).catch(() => {}); }

  _applyBuildVisual(b) {
    // стройка: модель ПОДНИМАЕТСЯ из земли (не скейл) — часть под рельефом прячет depth-тест
    if (!b.built) {
      const frac = Math.max(0, Math.min(1, 1 - b.buildLeft / (b.def.build || 1)));
      b.view.scale.setScalar(1);
      b.view.position.y = b.cy - (b._bh || 1) * (1 - frac) * 0.92;
      b.view.traverse(o => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.85; } });
    } else {
      b.view.scale.setScalar(1);
      b.view.position.y = b.cy;
      b.view.traverse(o => { if (o.isMesh && o.material.transparent && o.material.opacity < 1) { o.material.transparent = false; o.material.opacity = 1; } });
    }
  }

  finishBuild(b) {
    b.built = true; b.buildLeft = 0;
    b.view.scale.setScalar(1);
    b.view.position.set(b.cx, b.cy, b.cz);
    if (b._scaffold) { this.scene.remove(b._scaffold); b._scaffold = null; }
    b.view.traverse(o => { if (o.isMesh && o.material.opacity < 1) { o.material.transparent = false; o.material.opacity = 1; } });
    this.recomputePop();
    Tiling.refreshHomesteads(this);                 // достроили — мог появиться «двор» с соседом
  }

  removeBuilding(b) {
    // Освободить всех, чьи постоянные/временные назначения указывали на сносимое здание.
    for (const u of this.units) {
      if (u.buildSite === b.id) u.buildSite = null;
      if (u.repairSite === b.id) u.repairSite = null;
      if (u.workSite === b.id) {
        u.workSite = null;
        if (u.state === 'working' || u.state === 'toWork') { u.state = 'idle'; u.path = null; u.manualIdle = true; }
      }
    }
    this.scene.remove(b.view);
    if (b._ring) this.scene.remove(b._ring);
    if (b._dirt) this.scene.remove(b._dirt);
    if (b._roadApron) this.scene.remove(b._roadApron);
    if (b._railApron) this.scene.remove(b._railApron);
    if (b._scaffold) { this.scene.remove(b._scaffold); b._scaffold = null; }
    this.grid.occupy(b.gx, b.gy, b.w, b.h, null);
    this.buildings = this.buildings.filter(x => x !== b);
    this._byId.delete(b.id);
    if (b === this.townhall) this.townhall = null;
    if (this.selected === b) this.selected = null;
    this.recomputePop();
    Tiling.onRemoved(this, b);                      // убрать соединители, обновить соседей и «усадьбы»
    Tiling.refreshHomesteads(this);
  }

  buildingsBuilt(kind) { return this.buildings.filter(b => b.built && (kind ? b.kind === kind : true)); }
  hasBuilt(kind) { return this.buildings.some(b => b.built && b.kind === kind); }
  drops() { return this.buildings.filter(b => b.built && b.def.drop); }

  // ---- юниты ----
  // Рендер тела/тени/шеврона юнита — инстансный (UnitRenderer, world/UnitRenderer.js): здесь юнит только
  // данные, никакого Object3D/клона GLB на юнита больше нет (это и было источником 2500+ draw call).
  // Тинт фракции хранится как u.tint и применяется в render() через InstancedMesh.setColorAt (не клон материала).
  addUnit(kind, wx, wz, opts = {}) {
    const def = UNITS[kind];
    // бонусы исследований применяются к НОВЫМ своим воинам (HP/скорость)
    let hp = (opts.hp ?? def.hp), maxHp = (opts.maxHp ?? def.hp), speed = def.speed;
    const R = this.research;
    if (R && def.faction === 'ours' && !def.worker) { hp = Math.round(hp * R.hpMul); maxHp = Math.round(maxHp * R.hpMul); speed *= R.spdMul; }
    const u = {
      id: this._id++, type: 'unit', kind, def, faction: def.faction,
      x: wx, z: wz, px: wx, pz: wz, dir: 0,
      hp, maxHp,
      dmg: def.dmg, speed,
      state: 'idle', path: null, pi: 0, target: null, job: null,
      carry: 0, carryType: null, gatherT: 0, atkT: 0, bossKey: opts.bossKey || null,
      barkT: 0, grow: 0, growMax: opts.scale || 1, atkAnim: 0, stance: 'aggro',
      tint: opts.tint || null,
    };
    this.units.push(u); this._byId.set(u.id, u);
    if (def.faction === 'ours') this.recomputePop();
    return u;
  }

  removeUnit(u) {
    // инстанс просто перестанет писаться в UnitRenderer со следующего кадра — убирать явно нечего
    u.buildSite = null; u.repairSite = null; u.workSite = null;
    this.units = this.units.filter(x => x !== u);
    this._byId.delete(u.id);
    if (this.selected === u) this.selected = null;
    if (u.faction === 'ours') this.recomputePop();
  }

  // смерть с анимацией: убираем из логики сразу, а «труп» (падение+уменьшение) дорисовывает render()
  // через fx-запись unit-death — она несёт достаточно данных (модель/id/тинт/позиция), чтобы UnitRenderer
  // мог продолжать писать этот инстанс ещё 0.5с, хотя юнита уже нет в state.units.
  killUnit(u) {
    u.buildSite = null; u.repairSite = null; u.workSite = null;
    this.units = this.units.filter(x => x !== u);
    this._byId.delete(u.id);
    if (this.selected === u) this.selected = null;
    if (u.faction === 'ours') this.recomputePop();
    const y0 = this.grid.heightAt ? this.grid.heightAt(u.x, u.z) : 0;
    this.fx.push({
      kind: 'unit-death', life: 0.5, max: 0.5, y0,
      x: u.x, z: u.z, dir: u.dir || 0, tint: u.tint || null,
      id: u.id, def: { model: u.def.model },
      curScale: (u.growMax || 1) * (1 + 0.07 * (u.vet || 0)),
    });
  }

  ours() { return this.units.filter(u => u.faction === 'ours'); }
  enemies() { return this.units.filter(u => u.faction === 'enemy'); }
  soldiers() { return this.units.filter(u => u.faction === 'ours' && !u.def.worker); }
  workers() { return this.units.filter(u => u.faction === 'ours' && u.def.worker); }

  recomputePop() {
    this.popCap = this.buildings.filter(b => b.built).reduce((s, b) => s + (b.def.pop || 0), 0)
      + (this.research ? this.research.popBonus : 0);
    this.population = this.ours().length;
  }

  nearestDrop(x, z) {
    let best = null, bd = Infinity;
    for (const b of this.drops()) {
      const d = (b.cx - x) ** 2 + (b.cz - z) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  nearestNode(x, z, resType) {
    let best = null, bd = Infinity;
    for (const n of this.nodes) {
      if (n.depleted) continue;
      if (resType && n.resType !== resType) continue;
      const w = this.grid.gridToWorld(n.gx, n.gy);
      const d = (w.wx - x) ** 2 + (w.wz - z) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  // ---- сейв ----
  serialize() {
    const inTransitCargo = new Map();
    for (const cart of this._carts || []) {
      inTransitCargo.set(cart.fromId, (inTransitCargo.get(cart.fromId) || 0) + (cart.cargo || 0));
    }
    return {
      v: 2, res: this.resources, happiness: this.happiness, rankIndex: this.rankIndex, day: this.day,
      era: this.era || 0,   // эпоха раньше не сохранялась: после перезагрузки держава откатывалась в I эпоху
      estates: this.estates, victory: this.victory, coup: this.coup,
      faction: this.faction ? this.faction.key : 'goyda', mapKey: this.mapKey || 'les',
      buildings: this.buildings.map(b => ({ kind: b.kind, gx: b.gx, gy: b.gy, built: b.built, hp: b.hp, rot: b.rot || 0, pendingCargo: (b._pendingCargo || 0) + (inTransitCargo.get(b.id) || 0) })),
      nodes: this.nodes.map(n => ({ kind: n.kind, gx: n.gx, gy: n.gy, amount: n.amount })),
      units: this.units.filter(u => u.faction === 'ours').map(u => ({ kind: u.kind, x: u.x, z: u.z, hp: u.hp })),
    };
  }
  save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.serialize())); } catch (e) {} }
  static load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; } }
}
