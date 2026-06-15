// ===== Единый источник правды: ресурсы, сущности, ранги, сейв =====
import * as THREE from 'three';
import { GRID_N, STORAGE_KEY } from '../data/config.js?v=23';
import { Grid } from '../world/Grid.js?v=23';
import { NodeField } from '../world/NodeField.js?v=23';
import { BUILDINGS } from '../data/buildings.js?v=23';
import { UNITS } from '../data/units.js?v=23';
import { RANKS } from '../data/ranks.js?v=23';

export class GameState {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.grid = new Grid(GRID_N);

    // инстансные поля ресурсов (1 draw call на тип вместо ~800 объектов)
    this.fields = {
      wood: new NodeField(scene, 'res_tree', 700),
      stone: new NodeField(scene, 'res_stone', 300),
      gold: new NodeField(scene, 'res_ore', 250),
    };

    this.resources = { food: 70, wood: 80, stone: 70, iron: 0, gold: 45, gems: 0, faith: 15 };
    this.cap = { food: 400, wood: 400, stone: 400, iron: 300, gold: 400, gems: 150, faith: 999 };

    // исследования (древо технологий) — множители/бонусы
    this.research = { done: {}, gatherMul: 1, dmgMul: 1, hpMul: 1, spdMul: 1, popBonus: 0, foodDay: 0, goldDay: 0, faithDay: 0 };

    this.happiness = 60;
    this.population = 0;
    this.popCap = 0;
    this.rankIndex = 0;
    this.day = 0;
    this.starveAccum = 0;

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
    field.add(n, wx, y, wz, ry, 1);
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
  addCamp(gx, gy) {
    const view = this.assets.get('enemy_camp');
    const c = this.grid.footprintCenter(gx, gy, 2, 2);
    const cy = this.grid.heightAt ? this.grid.heightAt(c.wx, c.wz) : 0;
    view.position.set(c.wx, cy, c.wz);
    this.scene.add(view);
    const camp = { id: this._id++, type: 'camp', gx, gy, w: 2, h: 2, hp: 320, maxHp: 320, view, cx: c.wx, cz: c.wz, cy, spawnT: 0 };
    view.userData.entity = camp;
    this.grid.occupy(gx, gy, 2, 2, camp.id, { walkable: false });
    this.camps.push(camp);
    return camp;
  }
  removeCamp(camp) {
    this.scene.remove(camp.view);
    this.grid.occupy(camp.gx, camp.gy, 2, 2, null);
    this.camps = this.camps.filter(x => x !== camp);
    if (this.selected === camp) this.selected = null;
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

  // ---- здания ----
  addBuilding(kind, gx, gy, opts = {}) {
    const def = BUILDINGS[kind];
    const view = this.assets.get(def.model);
    // персональные материалы на каждое здание (иначе общий кэш сделает прозрачными все)
    view.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
    const c = this.grid.footprintCenter(gx, gy, def.w, def.h);
    const cy = this.grid.heightAt ? this.grid.heightAt(c.wx, c.wz) : 0;
    view.position.set(c.wx, cy, c.wz);
    this.scene.add(view);
    const b = {
      id: this._id++, type: 'building', kind, def, gx, gy, w: def.w, h: def.h,
      hp: def.hp, maxHp: def.hp, view,
      built: opts.built ?? false, buildLeft: opts.built ? 0 : (def.build || 0),
      trainQueue: [], trainLeft: 0,
      cx: c.wx, cz: c.wz, cy,
    };
    view.userData.entity = b;
    this.grid.occupy(gx, gy, def.w, def.h, b.id, { walkable: !!def.walkable });
    this.buildings.push(b); this._byId.set(b.id, b);
    if (def.unique && kind === 'townhall') this.townhall = b;
    if (def.wonder) this.idol = b;
    this._applyBuildVisual(b);
    if (def.aura) {   // кольцо радиуса ауры реликвии
      const rg = new THREE.Mesh(
        new THREE.RingGeometry(def.aura.radius - 0.25, def.aura.radius, 40),
        new THREE.MeshBasicMaterial({ color: 0xcc66ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
      );
      rg.rotation.x = -Math.PI / 2; rg.position.set(c.wx, cy + 0.08, c.wz);
      this.scene.add(rg); b._ring = rg;
    }
    return b;
  }

  _applyBuildVisual(b) {
    const s = b.built ? 1 : 0.35 + 0.65 * (1 - b.buildLeft / (b.def.build || 1));
    b.view.scale.setScalar(b.built ? 1 : Math.max(0.2, s));
    b.view.traverse(o => {
      if (o.isMesh) {
        if (!b.built) { o.material = o.material; o.material.transparent = true; o.material.opacity = 0.7; }
        else if (o.material.transparent && o.material.opacity < 1) { o.material.transparent = false; o.material.opacity = 1; }
      }
    });
  }

  finishBuild(b) {
    b.built = true; b.buildLeft = 0;
    b.view.scale.setScalar(1);
    b.view.traverse(o => { if (o.isMesh && o.material.opacity < 1) { o.material.transparent = false; o.material.opacity = 1; } });
    this.recomputePop();
  }

  removeBuilding(b) {
    this.scene.remove(b.view);
    if (b._ring) this.scene.remove(b._ring);
    this.grid.occupy(b.gx, b.gy, b.w, b.h, null);
    this.buildings = this.buildings.filter(x => x !== b);
    this._byId.delete(b.id);
    if (b === this.townhall) this.townhall = null;
    if (this.selected === b) this.selected = null;
    this.recomputePop();
  }

  buildingsBuilt(kind) { return this.buildings.filter(b => b.built && (kind ? b.kind === kind : true)); }
  hasBuilt(kind) { return this.buildings.some(b => b.built && b.kind === kind); }
  drops() { return this.buildings.filter(b => b.built && b.def.drop); }

  // ---- юниты ----
  addUnit(kind, wx, wz, opts = {}) {
    const def = UNITS[kind];
    const view = this.assets.get(def.model);
    view.position.set(wx, 0, wz);
    if (opts.tint) view.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setHex(opts.tint); } });
    const gm = opts.scale || 1;
    view.scale.setScalar(gm * 0.25);          // вырастает при спавне (анимация в render)
    this.scene.add(view);
    // бонусы исследований применяются к НОВЫМ своим воинам (HP/скорость)
    let hp = (opts.hp ?? def.hp), maxHp = (opts.maxHp ?? def.hp), speed = def.speed;
    const R = this.research;
    if (R && def.faction === 'ours' && !def.worker) { hp = Math.round(hp * R.hpMul); maxHp = Math.round(maxHp * R.hpMul); speed *= R.spdMul; }
    const u = {
      id: this._id++, type: 'unit', kind, def, faction: def.faction, view,
      x: wx, z: wz, px: wx, pz: wz, dir: 0,
      hp, maxHp,
      dmg: def.dmg, speed,
      state: 'idle', path: null, pi: 0, target: null, job: null,
      carry: 0, carryType: null, gatherT: 0, atkT: 0, bossKey: opts.bossKey || null,
      barkT: 0, grow: 0, growMax: gm, atkAnim: 0, stance: 'aggro',
    };
    view.userData.entity = u;
    this.units.push(u); this._byId.set(u.id, u);
    if (def.faction === 'ours') this.recomputePop();
    return u;
  }

  removeUnit(u) {
    this.scene.remove(u.view);
    this.units = this.units.filter(x => x !== u);
    this._byId.delete(u.id);
    if (this.selected === u) this.selected = null;
    if (u.faction === 'ours') this.recomputePop();
  }

  // смерть с анимацией: убираем из логики, view остаётся для падения (render)
  killUnit(u) {
    this.units = this.units.filter(x => x !== u);
    this._byId.delete(u.id);
    if (this.selected === u) this.selected = null;
    if (u.faction === 'ours') this.recomputePop();
    if (u.view) { u.view.userData.entity = null; this.fx.push({ view: u.view, kind: 'death', life: 0.5, max: 0.5, y0: u.view.position.y }); }
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
    return {
      v: 2, res: this.resources, happiness: this.happiness, rankIndex: this.rankIndex, day: this.day,
      faction: this.faction ? this.faction.key : 'goyda', mapKey: this.mapKey || 'les',
      buildings: this.buildings.map(b => ({ kind: b.kind, gx: b.gx, gy: b.gy, built: b.built, hp: b.hp })),
      nodes: this.nodes.map(n => ({ kind: n.kind, gx: n.gx, gy: n.gy, amount: n.amount })),
      units: this.units.filter(u => u.faction === 'ours').map(u => ({ kind: u.kind, x: u.x, z: u.z, hp: u.hp })),
    };
  }
  save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.serialize())); } catch (e) {} }
  static load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; } }
}
