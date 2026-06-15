// ===== ГОЙДА-ИМПЕРИЯ — точка входа и оркестратор =====
import * as THREE from 'three';
import { Renderer } from './engine/Renderer.js?v=18';
import { RTSCamera } from './engine/RTSCamera.js?v=18';
import { Picker } from './engine/Picker.js?v=18';
import { Loop } from './engine/Loop.js?v=18';
import { AssetManager } from './engine/AssetManager.js?v=18';
import { TerrainMesh } from './world/TerrainMesh.js?v=18';
import { Fog } from './world/Fog.js?v=18';
import { WorldBase } from './world/WorldBase.js?v=18';
import { Sky } from './world/Sky.js?v=18';
import { nearestAdj } from './world/Pathfinding.js?v=18';
import { GameState } from './sim/GameState.js?v=18';
import * as Economy from './sim/Economy.js?v=18';
import * as BuildSys from './sim/Buildings.js?v=18';
import * as Waves from './sim/Waves.js?v=18';
import * as Tech from './sim/Tech.js?v=18';
import * as Nature from './sim/Nature.js?v=18';
import * as Relics from './sim/Relics.js?v=18';
import * as Camps from './sim/Camps.js?v=18';
import * as Wildlife from './sim/Wildlife.js?v=18';
import * as Research from './sim/Research.js?v=18';
import { updateUnits, damage } from './sim/Units.js?v=18';
import { toggleEdict } from './sim/Edicts.js?v=18';
import { sfx, toggleMute, isMuted, resumeAudio } from './audio/Sfx.js?v=18';
import { HUD } from './ui/HUD.js?v=18';
import { BuildMenu } from './ui/BuildMenu.js?v=18';
import { Selection } from './ui/Selection.js?v=18';
import { Minimap } from './ui/Minimap.js?v=18';
import { ResearchPanel } from './ui/Research.js?v=18';
import { Toasts } from './ui/Toasts.js?v=18';
import { BUILDINGS } from './data/buildings.js?v=18';
import { RANKS } from './data/ranks.js?v=18';
import { bark } from './data/barks.js?v=18';
import { STORAGE_KEY } from './data/config.js?v=18';
import { getFaction } from './data/factions.js?v=18';
import { getMap } from './data/maps.js?v=18';
import { StartScreen } from './ui/StartScreen.js?v=18';

const MODELS = [
  'idol_dron', 'bld_townhall', 'bld_izba', 'bld_ambar', 'bld_roshcha', 'bld_kuznica', 'bld_kazarma',
  'bld_chastokol', 'bld_chastokol_gate', 'bld_church', 'bld_market',
  'res_tree', 'res_stone', 'res_ore', 'unit_kholop', 'unit_ratnik', 'unit_oprichnik',
  'enemy_raider', 'enemy_boss', 'enemy_camp',
];
const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

// видимый перехват ошибок (чтобы «чёрный экран» был диагностируем)
function showFatal(msg) {
  let b = document.getElementById('errbox');
  if (!b) { b = document.createElement('div'); b.id = 'errbox'; document.body.appendChild(b); }
  b.style.display = 'block';
  b.textContent = '⚠ ОШИБКА: ' + msg;
}
window.addEventListener('error', (e) => showFatal((e.message || 'error') + '  @ ' + String(e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => showFatal('promise: ' + ((e.reason && e.reason.message) || e.reason)));

class Game {
  constructor() {
    this.canvas = document.getElementById('c');
    this.rdr = new Renderer(this.canvas);
    this.scene = this.rdr.scene;
    this.cameraRig = new RTSCamera(this.canvas);
    this.camera = this.cameraRig.camera;
    this.picker = new Picker(this.canvas);
    this.assets = new AssetManager();
    this.state = new GameState(this.scene, this.assets);
    this.terrain = null;   // строится при выборе карты (buildWorld)

    this.toasts = new Toasts(document.getElementById('toasts'));
    this.state.onToast = (t, o) => this.toasts.show(t, o);

    this.hud = new HUD(this);
    this.menu = new BuildMenu(this);
    this.selUI = new Selection(this);
    this.minimap = new Minimap(this);
    this.researchUI = new ResearchPanel(this);
    this.startScreen = new StartScreen(this);

    this.buildKind = null;
    this.placing = false;
    this._keepBuild = false;
    this._ghostModels = {};
    this.lastRender = performance.now();
    this._uiT = 0;
    this.tracers = [];
    this.floaters = document.getElementById('floaters');

    this.ctx = this._makeCtx();
    this.rdr.onResize = (w, h) => this.cameraRig.resize(w, h);
    this._input();
    this.loop = new Loop((dt) => this.tick(dt), (a) => this.render(a));
  }

  _makeCtx() {
    return {
      sfx,
      toast: (t, o) => this.toasts.show(t, o),
      bark: (u, text) => this.float(u.x, u.z, text, '#ffe8b5', 1.4),
      float: (x, z, t, c) => this.float(x, z, t, c, 0.6),
      flash: (b) => { b._hit = 0.18; },
      tracer: (u, t) => this.spawnTracer(u, t),
      onLose: () => this.end('lose'),
      onWin: () => this.end('win'),
      onRankUp: () => {},
      spawnBoss: (key) => Waves.spawnBoss(this.state, key, this.ctx),
      onBossDown: (boss) => {
        this.state.gain({ gold: 60, faith: 25 });
        this.toasts.show('☠️ ' + (boss.bossName || 'Босс') + ' повержен! +60🪙 +25☩', { gold: true, big: true });
        sfx('win');
      },
    };
  }

  async boot() {
    const G = window.__gboot || function () {};
    try {
      // модели грузятся в фоне — не блокируют запуск (есть плейсхолдеры)
      this.assets.preload(MODELS).then(c => { this._glb = c; G('models ' + c); }).catch(() => {});
      const save = GameState.load();
      G('save=' + (save && save.buildings ? save.buildings.length : 'none'));
      if (save && save.v === 2 && save.buildings && save.buildings.length) {   // старые сейвы (до рельефа) — старт заново
        try {
          this.state.faction = getFaction(save.faction);
          this.state.mapKey = save.mapKey || 'les';
          this.buildWorld(getMap(this.state.mapKey));
          this._restore(save);
          G('restored'); this._begin(true); return;
        } catch (e) {
          console.warn('restore failed', e);
          try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
          G('restore-failed');
        }
      }
      G('startscreen');
      this.startScreen.show();
    } catch (e) { showFatal('boot: ' + ((e && e.stack) || e)); }
  }

  startWith(fk, mk) {
    this.state.faction = getFaction(fk);
    this.state.mapKey = mk;
    const map = getMap(mk);
    this.buildWorld(map);
    this.initMap(map);
    this._begin(false);
  }

  buildWorld(map) {
    this.map = map;
    this.state.grid.generateTerrain(map.terr, map.key);   // рельеф (высоты/биомы/реки)
    this.terrain = new TerrainMesh(this.scene, this.state.grid, map.pal);
    this.fog = new Fog(this.scene, this.state.grid);       // туман войны
    this.worldBase = new WorldBase(this.scene, this.state.grid);   // плита на слонах+черепахе
    if (map.key === 'neon') this._addNeonSun();
    else this.sky = new Sky(this.scene, this.rdr);                 // суточный цикл + погода (кроме неона)
    Wildlife.spawn(this.state);   // дичь бродит по карте (охота)
  }

  _addNeonSun() {
    const ww = this.state.grid.n;

    // --- полосатое ретровейв-солнце (градиент оранж→розовый + горизонтальные прорези) ---
    const sc = document.createElement('canvas'); sc.width = sc.height = 256;
    const sx = sc.getContext('2d');
    const grad = sx.createLinearGradient(0, 30, 0, 226);
    grad.addColorStop(0, '#ffe07a'); grad.addColorStop(0.34, '#ff9a3c');
    grad.addColorStop(0.62, '#ff4d8d'); grad.addColorStop(1, '#b81e6b');
    sx.save(); sx.beginPath(); sx.arc(128, 128, 100, 0, Math.PI * 2); sx.clip();
    sx.fillStyle = grad; sx.fillRect(0, 0, 256, 256);
    sx.globalCompositeOperation = 'destination-out';     // прорези в нижней половине
    let yy = 138, gap = 5;
    for (let i = 0; i < 10; i++) { sx.fillRect(0, yy, 256, gap); yy += gap + Math.max(3, 13 - i * 0.9); gap += 1.1; }
    sx.restore();
    const sunTex = new THREE.CanvasTexture(sc); sunTex.magFilter = THREE.LinearFilter;
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(ww * 0.62, ww * 0.62),
      new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }));
    sun.position.set(-ww * 0.22, ww * 0.34, -ww * 1.5);
    sun.renderOrder = -5; this.scene.add(sun);

    // --- неон-сетка позади солнца (вертикальная стена-бэкдроп) ---
    const gc = document.createElement('canvas'); gc.width = gc.height = 256;
    const gx = gc.getContext('2d');
    gx.strokeStyle = 'rgba(255,46,192,0.85)'; gx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 24) { gx.beginPath(); gx.moveTo(i, 128); gx.lineTo(i, 256); gx.stroke(); }
    for (let j = 132; j <= 256; j += 18) { gx.beginPath(); gx.moveTo(0, j); gx.lineTo(256, j); gx.stroke(); }
    gx.strokeStyle = 'rgba(64,224,255,0.5)';
    for (let j = 132; j <= 256; j += 36) { gx.beginPath(); gx.moveTo(0, j); gx.lineTo(256, j); gx.stroke(); }
    const gridTex = new THREE.CanvasTexture(gc); gridTex.magFilter = THREE.LinearFilter;
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(ww * 2.4, ww * 1.2),
      new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
    grid.position.set(-ww * 0.22, ww * 0.18, -ww * 1.55);
    grid.renderOrder = -6; this.scene.add(grid);

    // --- звёздное небо ---
    const N = 320, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.5 + 0.05, r = ww * (1.6 + Math.random() * 0.8);
      sp[i * 3] = Math.cos(a) * Math.cos(e) * r;
      sp[i * 3 + 1] = Math.sin(e) * r * 1.1 + ww * 0.15;
      sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r - ww * 0.4;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff0ff, size: ww * 0.012, sizeAttenuation: true, transparent: true, opacity: 0.9, fog: false }));
    this.scene.add(stars);

    // свет/туман в ретровейв-палитру
    const halo = new THREE.PointLight(0xff5aa0, 1.5, ww * 3.5, 1.4); halo.position.copy(sun.position); this.scene.add(halo);
    const dir = new THREE.DirectionalLight(0xff8a5a, 0.7); dir.position.copy(sun.position); this.scene.add(dir);
    if (this.scene.fog) this.scene.fog.color.setHex(0x2a1838);
    this.rdr.hemi.color.setHex(0xffb0d0); this.rdr.hemi.groundColor.setHex(0x3a2050);
    this._neon = { sun, grid, stars };
  }

  _begin(restored) {
    this.cameraRig.focus(0, 0);
    const f = this.state.faction;
    this.toasts.show(restored ? '⚔️ Поход продолжается…' : ('🗿 ' + (f ? f.emoji + ' ' + f.name : 'ГОЙДА') + ' · ' + this.map.name + '. ГОЙДА!'), { big: true, gold: true });
    if (this._glb > 0) this.toasts.show('Blender-моделей: ' + this._glb);
    window.__gboot && window.__gboot('loop ' + (restored ? 'restore' : 'new'));
    this.loop.start();
  }

  initMap(map) {
    const g = this.state.grid, c = Math.floor(g.n / 2);
    this.state.edicts = {};
    const fm = this.state.faction && this.state.faction.mods;
    if (fm && fm.startGold) this.state.resources.gold += fm.startGold;
    // ратуша 3×3 по центру
    this.state.addBuilding('townhall', c - 1, c - 1, { built: true });
    this.state.recomputePop();
    // ресурсы вокруг (подальше от центра)
    const far = (x, y, r) => Math.max(Math.abs(x - c), Math.abs(y - c)) > r;
    const scatter = (kind, count, amount, minR, biomes) => {
      let n = 0, t = 0;
      while (n < count && t < count * 50) {
        t++; const x = ri(2, g.n - 3), y = ri(2, g.n - 3);
        if (!far(x, y, minR) || !g.canPlace(x, y, 1, 1)) continue;
        if (biomes && !biomes.includes(g.get(x, y).biome)) continue;
        this.state.addNode(kind, x, y, amount + ri(-10, 10)); n++;
      }
    };
    // ресурсы по биомам: деревья в зелени, камень/золото в скалах
    const r = (map && map.res) || { tree: 1, stone: 1, ore: 1 };
    scatter('res_tree', Math.round(150 * r.tree), 60, 4, ['grass', 'forest']);
    scatter('res_stone', Math.round(90 * r.stone), 110, 5, ['grass', 'rock', 'sand']);
    scatter('res_ore', Math.round(40 * r.ore), 70, 7, ['rock', 'grass']);
    // стартовые ХОЛОПы
    for (let i = 0; i < 4; i++) {
      const adj = nearestAdj(g, c - 1, c - 1, 3, 3, c - 2 + i, c + 2) || { x: c, y: c + 2 };
      const w = g.gridToWorld(adj.x, adj.y);
      this.state.addUnit('kholop', w.wx, w.wz, {});
    }
    Camps.spawnCamps(this.state, 4);   // вражьи станы по углам
  }

  _restore(s) {
    this.state.resources = Object.assign(this.state.resources, s.res || {});
    this.state.happiness = s.happiness ?? 60;
    this.state.rankIndex = s.rankIndex || 0;
    this.state.day = s.day || 0;
    this.state.edicts = {};
    for (const n of (s.nodes || [])) this.state.addNode(n.kind, n.gx, n.gy, n.amount);
    for (const b of (s.buildings || [])) {
      const bb = this.state.addBuilding(b.kind, b.gx, b.gy, { built: b.built !== false });
      if (b.hp) bb.hp = b.hp;
    }
    for (const u of (s.units || [])) { const uu = this.state.addUnit(u.kind, u.x, u.z, {}); if (u.hp) uu.hp = u.hp; }
    this.state.recomputePop();
  }

  // ---------- ввод ----------
  _input() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => {
      resumeAudio();
      this.picker.setFromEvent(e);
      if (e.button === 0) {            // ЛКМ — выбор / постройка
        this._keepBuild = e.shiftKey;
        if (this.buildKind) { this.placing = true; this._placeAt(); }
        else this._select();
      } else if (e.button === 2) {     // ПКМ — команда (или отмена стройки)
        e.preventDefault();
        if (this.buildKind) { this.buildKind = null; this.terrain.hideGhost(); }
        else this._command();
      }
    });
    cv.addEventListener('pointermove', (e) => {
      this.picker.setFromEvent(e);
      this._pointerMoved = true;
      if (this.placing && this.buildKind && BUILDINGS[this.buildKind].wall) this._placeAt(true);
    });
    window.addEventListener('pointerup', () => { this.placing = false; });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') { this.buildKind = null; this.terrain.hideGhost(); this.state.selected = null; }
      else if (e.code === 'Space') { e.preventDefault(); this.activateSuper(); }
    });
    document.getElementById('superBtn').onclick = () => this.activateSuper();
    const mb = document.getElementById('muteBtn');
    mb.textContent = isMuted() ? '🔇' : '🔊';
    mb.onclick = () => { const m = toggleMute(); mb.textContent = m ? '🔇' : '🔊'; if (!m) sfx('click'); };
    const fb = document.getElementById('fogBtn');
    if (fb) fb.onclick = () => { const on = this.fog ? this.fog.toggle() : false; fb.classList.toggle('on', on); fb.title = on ? 'Туман войны: ВКЛ' : 'Туман войны: ВЫКЛ'; sfx('click'); };
    const tb = document.getElementById('techBtn');
    if (tb) tb.onclick = () => { const open = this.researchUI.toggle(); tb.classList.toggle('on', open); sfx('click'); };
    const rb = document.getElementById('restartBtn');
    if (rb) rb.onclick = () => this.restart();
    const lb = document.getElementById('lobbyBtn');
    if (lb) lb.onclick = () => { if (confirm('Выйти в меню ГОЙДЫ? Поход сохранится.')) location.href = '../'; };
  }

  restart() {
    if (!confirm('Начать игру ЗАНОВО? Текущий поход будет потерян.')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    location.reload();
  }

  _placeAt(silent) {
    const tile = this.picker.tileUnder(this.camera, this.state.grid);
    if (!tile) return;
    const r = BuildSys.placeBuilding(this.state, this.buildKind, tile.x, tile.y, this.ctx);
    if (r.ok) {
      if (!BUILDINGS[this.buildKind].wall && !this._keepBuild) { this.buildKind = null; this.terrain.hideGhost(); }
    } else if (!silent && r.reason) {
      this.toasts.show(r.reason, { bad: true });
      this.placing = false;
    }
  }

  _pickables() {
    const a = [];
    for (const b of this.state.buildings) a.push(b.view);
    for (const u of this.state.units) a.push(u.view);
    for (const c of this.state.camps) a.push(c.view);
    for (const an of this.state.animals) a.push(an.view);
    return a;
  }

  _entUnder() { return this.picker.entityUnder(this.camera, this._pickables(), Object.values(this.state.fields)); }

  // ЛКМ — только выбор
  _select() {
    const ent = this._entUnder();
    this.state.selected = ent || null;
    if (ent) {
      sfx('click');
      if (ent.type === 'unit' && ent.faction === 'ours') this.float(ent.x, ent.z, bark('select'), '#ffe8b5', 1.4);
    }
  }

  // ПКМ — команда выбранному своему юниту (двигаться / рубить / в атаку)
  _command() {
    const sel = this.state.selected;
    if (!(sel && sel.type === 'unit' && sel.faction === 'ours')) return;
    const ent = this._entUnder();
    // рубить ресурс (для добытчика)
    if (ent && ent.type === 'node' && sel.def.worker) {
      sel.huntId = null; sel.job = ent.id; sel.jobType = ent.resType; sel.manualIdle = false; sel.moveOrder = null; sel.path = null; sel.state = 'toNode';
      sfx('click'); this.float(sel.x, sel.z, 'Иду рубить!', '#9effd0', 1.4); return;
    }
    // охота на зверя (любой свой юнит)
    if (ent && ent.type === 'animal') {
      sel.huntId = ent.id; sel.moveOrder = null; sel.path = null; sel._huntTx = null;
      if (sel.def.worker) { sel.job = null; sel.manualIdle = true; }
      sfx('click'); this.float(sel.x, sel.z, 'На охоту! ' + ent.def.icon, '#ffe08a', 1.4); return;
    }
    // в атаку на врага (для воина)
    if (ent && ent.type === 'unit' && ent.faction === 'enemy' && !sel.def.worker) {
      const g = this.state.grid.worldToGrid(ent.x, ent.z);
      sel.huntId = null; sel.moveOrder = { x: g.x, y: g.y }; sel.path = null;
      sfx('click'); this.float(sel.x, sel.z, 'В атаку!', '#ff8a8a', 1.4); return;
    }
    // снести вражий стан (для воина)
    if (ent && ent.type === 'camp' && !sel.def.worker) {
      sel.huntId = null; sel.targetCampId = ent.id; sel.moveOrder = null; sel.path = null;
      sfx('click'); this.float(sel.x, sel.z, 'Снести стан!', '#ff8a8a', 1.4); return;
    }
    // идти на указанную точку (любой свой юнит — куда скажешь)
    const t = this.picker.tileUnder(this.camera, this.state.grid);
    if (t) {
      sel.huntId = null; sel.moveOrder = { x: t.x, y: t.y }; sel.path = null;
      if (sel.def.worker) { sel.job = null; sel.manualIdle = true; }
      sfx('click'); this.float(sel.x, sel.z, 'Идём!', '#9effd0', 1.4);
    }
  }

  enterBuild(kind) { this.buildKind = kind; this.state.selected = null; sfx('click'); }
  train(b, uk) { BuildSys.queueTrain(this.state, b, uk, this.ctx); }
  toggleEdictUI(key) { toggleEdict(this.state, key, this.ctx); }
  setStance(u, st) { u.stance = st; u.path = null; u.moveOrder = null; sfx('click'); }
  research(key) { Research.buy(this.state, key, this.ctx); this.researchUI.refresh(); this.hud.update(); }

  activateSuper() {
    const s = this.state;
    if (s.superTimer > 0) return;
    if (s.resources.faith < 40) { this.toasts.show('Мало ВЕРЫ для СВЕРХ-ГОЙДЫ (нужно 40☩)', { bad: true }); return; }
    s.resources.faith -= 40; s.superTimer = 10;
    sfx('super'); this.toasts.show('🔥 ' + bark('super'), { gold: true, big: true });
  }

  float(wx, wz, text, color = '#fff', y = 1) {
    const v = new THREE.Vector3(wx, y, wz).project(this.camera);
    if (v.z > 1) return;
    const d = document.createElement('div');
    d.className = 'floater'; d.textContent = text; d.style.color = color;
    d.style.left = (v.x * 0.5 + 0.5) * window.innerWidth + 'px';
    d.style.top = (-v.y * 0.5 + 0.5) * window.innerHeight + 'px';
    this.floaters.appendChild(d);
    setTimeout(() => d.remove(), 1150);
  }

  // снаряд шамана: летит к цели, наносит урон по прилёту
  spawnTracer(u, t) {
    if (!this._tracerGeo) this._tracerGeo = new THREE.SphereGeometry(0.14, 6, 5);
    const m = new THREE.Mesh(this._tracerGeo, new THREE.MeshBasicMaterial({ color: 0xff5cf0 }));
    m.position.set(u.x, this.state.grid.heightAt(u.x, u.z) + 0.6, u.z);
    this.scene.add(m);
    this.tracers.push({ m, target: t, dmg: u.dmg, speed: 16 });
  }
  updateTracers(fdt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i], t = tr.target;
      const tx = t.x ?? t.cx, tz = t.z ?? t.cz;
      if (!t || (t.hp ?? 0) <= 0 || tx === undefined) { this.scene.remove(tr.m); this.tracers.splice(i, 1); continue; }
      const ty = this.state.grid.heightAt(tx, tz) + 0.5;
      const dx = tx - tr.m.position.x, dy = ty - tr.m.position.y, dz = tz - tr.m.position.z;
      const d = Math.hypot(dx, dy, dz), step = tr.speed * fdt;
      if (d <= step + 0.4) { damage(this.state, t, tr.dmg, this.ctx); this.scene.remove(tr.m); this.tracers.splice(i, 1); }
      else tr.m.position.set(tr.m.position.x + dx / d * step, tr.m.position.y + dy / d * step, tr.m.position.z + dz / d * step);
    }
  }

  end(kind) {
    if (this.state.gameOver) return;
    this.state.gameOver = kind;
    const ov = document.getElementById('overlay');
    sfx(kind === 'win' ? 'win' : 'lose');
    if (kind === 'win') {
      this.state.rankIndex = RANKS.length - 1;
      try { localStorage.removeItem('GOYDA_EMPIRE_SAVE_v1'); } catch (e) {}
      ov.innerHTML = `<div class="end win"><h1>🌟 АБСОЛЮТ ГОЙДЫ 🌟</h1><p>Идол ДРОН пробуждён. ${bark('win')}</p><button onclick="location.reload()">ВНОВЬ ГОЙДАТЬ</button></div>`;
    } else {
      ov.innerHTML = `<div class="end lose"><h1>💀 ПАЛАТЫ ПАЛИ 💀</h1><p>${bark('lose')} Держава пала на ${this.state.day}-й день.</p><button onclick="(function(){try{localStorage.removeItem('GOYDA_EMPIRE_SAVE_v1')}catch(e){}location.reload()})()">НОВЫЙ ПОХОД</button></div>`;
    }
    ov.style.display = 'flex';
  }

  // ---------- симуляция ----------
  tick(dt) {
    if (this.state.gameOver) return;
    Economy.update(this.state, dt, this.ctx);
    BuildSys.update(this.state, dt, this.ctx);
    updateUnits(this.state, dt, this.ctx);
    Waves.update(this.state, dt, this.ctx);
    Tech.update(this.state, dt, this.ctx);
    Nature.update(this.state, dt, this.ctx);
    Relics.update(this.state, dt, this.ctx);
    Camps.update(this.state, dt, this.ctx);
    Wildlife.update(this.state, dt, this.ctx);
  }

  // ---------- рендер ----------
  render(alpha) {
    if (!this._rendered) { this._rendered = true; window.__gboot && window.__gboot('RENDERING ✓'); }
    const now = performance.now();
    let fdt = (now - this.lastRender) / 1000; if (fdt > 0.1) fdt = 0.1; this.lastRender = now;
    this.cameraRig.update(fdt);
    this.rdr.updateShadow(this.cameraRig.target.x, this.cameraRig.target.z);
    if (this.fog) this.fog.update(this.state, fdt);

    // интерполяция + анимация юнитов (рост/ходьба/выпад)
    for (const u of this.state.units) {
      const v = u.view;
      if (u.grow < 1) { u.grow = Math.min(1, u.grow + fdt * 3.5); v.scale.setScalar(u.growMax * (0.25 + 0.75 * u.grow)); }
      const ix = u.px + (u.x - u.px) * alpha, iz = u.pz + (u.z - u.pz) * alpha;
      const moving = Math.hypot(u.x - u.px, u.z - u.pz) > 0.0025;
      let bob = 0, fwd = 0;
      if (moving) bob = Math.abs(Math.sin(now * 0.016 + u.id * 1.7)) * 0.045;
      if (u.atkAnim > 0) { u.atkAnim -= fdt; fwd = Math.sin((1 - Math.max(0, u.atkAnim) / 0.2) * Math.PI) * 0.16; }
      v.position.set(ix + Math.sin(u.dir) * fwd, this.state.grid.heightAt(ix, iz) + bob, iz + Math.cos(u.dir) * fwd);
      v.rotation.y = u.dir || 0;
      if (u.faction === 'enemy') { const gp = this.state.grid.worldToGrid(u.x, u.z); const t = this.state.grid.get(gp.x, gp.y); v.visible = !this.fog || !this.fog.enabled || !t || t.visible; }   // прячем врага в тумане
    }
    // интерполяция дичи (бродит/убегает) + прячем в тумане
    for (const a of this.state.animals) {
      const v = a.view;
      const ix = a.px + (a.x - a.px) * alpha, iz = a.pz + (a.z - a.pz) * alpha;
      const moving = Math.hypot(a.x - a.px, a.z - a.pz) > 0.0015;
      const bob = moving ? Math.abs(Math.sin(now * 0.02 + a.id * 1.3)) * 0.04 : 0;
      v.position.set(ix, this.state.grid.heightAt(ix, iz) + bob, iz);
      v.rotation.y = a.dir || 0;
      const gp = this.state.grid.worldToGrid(a.x, a.z); const t = this.state.grid.get(gp.x, gp.y);
      v.visible = !this.fog || !this.fog.enabled || !t || t.visible;
    }
    // эффекты смерти (падение+уменьшение)
    for (let i = this.state.fx.length - 1; i >= 0; i--) {
      const f = this.state.fx[i]; f.life -= fdt;
      const t = 1 - Math.max(0, f.life) / f.max;
      if (f.kind === 'death') { f.view.rotation.z = t * 1.5; f.view.position.y = (f.y0 || 0) - t * 0.35; f.view.scale.multiplyScalar(0.965); }
      if (f.life <= 0) { this.scene.remove(f.view); this.state.fx.splice(i, 1); }
    }
    // пульс эмиссии идола
    if (this.state.idol) { const p = 1.4 + Math.sin(now * 0.005) * 0.9; this.state.idol.view.traverse(o => { if (o.isMesh && o.material && o.material.emissiveIntensity > 0) o.material.emissiveIntensity = p; }); }
    // ретровейв-солнце смотрит на камеру + лёгкий пульс
    if (this._neon) {
      this._neon.sun.quaternion.copy(this.camera.quaternion);
      this._neon.grid.quaternion.copy(this.camera.quaternion);
      this._neon.sun.scale.setScalar(1 + Math.sin(now * 0.0012) * 0.025);
    }
    // анимация водопадов с края мира
    if (this.worldBase && this.worldBase.update) this.worldBase.update(fdt);
    // суточный цикл день/ночь + погода (дождь/снег)
    if (this.sky) this.sky.update(fdt, this.cameraRig.target, this.map.key, now);
    // дрожание зданий под уроном
    for (const b of this.state.buildings) {
      if (b._hit > 0) { b._hit -= fdt; const j = b._hit > 0 ? (Math.random() - 0.5) * 0.06 : 0; b.view.position.set(b.cx + j, b.cy || 0, b.cz + j); }
    }
    for (const cp of this.state.camps) { const t = this.state.grid.get(cp.gx, cp.gy); cp.view.visible = !this.fog || !this.fog.enabled || !t || t.explored; }   // станы видны только разведанными
    // «сердце» базы — свет
    const s = this.state;
    const pulse = 0.12 + Math.sin(now * 0.004) * 0.05;
    this.rdr.heart.intensity = s.superTimer > 0 ? 2.4 : (s.threatTimer > 0 ? 0.9 : pulse);
    this.rdr.heart.color.setHex(s.superTimer > 0 ? 0xff3020 : (s.threatTimer > 0 ? 0xff5030 : 0xe0392b));
    if (s.townhall) this.rdr.heart.position.set(s.townhall.cx, (s.townhall.cy || 0) + 4, s.townhall.cz);

    // ховер/призрак
    this._updateHover();
    this.rdr.render(this.camera);

    this._uiT += fdt;
    if (this._uiT > 0.1) { this.hud.update(); this.menu.update(); this.selUI.update(); this._uiT = 0; }
    this.minimap.update(fdt);
    this.updateTracers(fdt);
  }

  _updateHover() {
    const tile = this.picker.tileUnder(this.camera, this.state.grid);
    if (this.buildKind) {
      const d = BUILDINGS[this.buildKind];
      if (tile) {
        const ok = this.state.grid.canPlace(tile.x, tile.y, d.w, d.h) && this.state.canAfford(d.cost) && (d.rank || 0) <= this.state.rankIndex;
        if (!this._ghostModels[this.buildKind]) {
          const m = this.assets.get(d.model);
          m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; } });
          this._ghostModels[this.buildKind] = m;
        }
        this.terrain.setGhost(tile.x, tile.y, d.w, d.h, ok, this._ghostModels[this.buildKind]);
      } else this.terrain.hideGhost();
      this.terrain.setHover(null);
    } else {
      // подсветка зависит от того, что под курсором: ресурс — циан, свой юнит — зелёный, иначе золото.
      // райкаст по сущностям дорогой в лейте → считаем только когда курсор сдвинулся (иначе берём кэш)
      this._hf = (this._hf || 0) + 1;
      if (this._pointerMoved || (this._hf & 7) === 0) { this._hoverEnt = this._entUnder(); this._pointerMoved = false; }
      const ent = this._hoverEnt;
      if (ent && ent.type === 'node') this.terrain.setHover(this.state.grid.get(ent.gx, ent.gy), 0x00eeff);
      else if (ent && ent.type === 'unit' && ent.faction === 'ours') this.terrain.setHover(tile, 0x5eff8b);
      else this.terrain.setHover(tile, 0xffcc00);
      this.terrain.hideGhost();
    }
  }
}

const game = new Game();
window.GOYDA = game;
game.boot();
