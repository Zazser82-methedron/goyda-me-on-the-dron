// ===== ГОЙДА-ИМПЕРИЯ — точка входа и оркестратор =====
import * as THREE from 'three';
import { Renderer } from './engine/Renderer.js?v=4';
import { RTSCamera } from './engine/RTSCamera.js?v=4';
import { Picker } from './engine/Picker.js?v=4';
import { Loop } from './engine/Loop.js?v=4';
import { AssetManager } from './engine/AssetManager.js?v=4';
import { TerrainMesh } from './world/TerrainMesh.js?v=4';
import { nearestAdj } from './world/Pathfinding.js?v=4';
import { GameState } from './sim/GameState.js?v=4';
import * as Economy from './sim/Economy.js?v=4';
import * as BuildSys from './sim/Buildings.js?v=4';
import * as Waves from './sim/Waves.js?v=4';
import * as Tech from './sim/Tech.js?v=4';
import * as Nature from './sim/Nature.js?v=4';
import * as CardsSys from './sim/Cards.js?v=4';
import { updateUnits } from './sim/Units.js?v=4';
import { toggleEdict } from './sim/Edicts.js?v=4';
import { sfx, toggleMute, isMuted, resumeAudio } from './audio/Sfx.js?v=4';
import { HUD } from './ui/HUD.js?v=4';
import { BuildMenu } from './ui/BuildMenu.js?v=4';
import { Selection } from './ui/Selection.js?v=4';
import { Minimap } from './ui/Minimap.js?v=4';
import { Toasts } from './ui/Toasts.js?v=4';
import { Cards } from './ui/Cards.js?v=4';
import { BUILDINGS } from './data/buildings.js?v=4';
import { RANKS } from './data/ranks.js?v=4';
import { bark } from './data/barks.js?v=4';
import { STORAGE_KEY } from './data/config.js?v=4';
import { getFaction } from './data/factions.js?v=4';
import { getMap } from './data/maps.js?v=4';
import { StartScreen } from './ui/StartScreen.js?v=4';

const MODELS = [
  'idol_dron', 'bld_townhall', 'bld_izba', 'bld_ambar', 'bld_roshcha', 'bld_kuznica', 'bld_kazarma',
  'bld_chastokol', 'bld_chastokol_gate', 'bld_church', 'bld_market',
  'res_tree', 'res_stone', 'res_ore', 'unit_kholop', 'unit_ratnik', 'unit_oprichnik',
  'enemy_raider', 'enemy_boss',
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
    this.cards = new Cards(this);
    this.startScreen = new StartScreen(this);

    this.buildKind = null;
    this.placing = false;
    this._keepBuild = false;
    this._ghostModels = {};
    this.lastRender = performance.now();
    this._uiT = 0;
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
      onLose: () => this.end('lose'),
      onWin: () => this.end('win'),
      onRankUp: () => { CardsSys.drawCard(this.state, this.ctx); },
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
      if (save && save.buildings && save.buildings.length) {
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
    this.terrain = new TerrainMesh(this.scene, this.state.grid, map.pal);
  }

  _begin(restored) {
    this.cameraRig.focus(0, 0);
    const f = this.state.faction;
    this.toasts.show(restored ? '⚔️ Поход продолжается…' : ('🗿 ' + (f ? f.emoji + ' ' + f.name : 'ГОЙДА') + ' · ' + this.map.name + '. ГОЙДА!'), { big: true, gold: true });
    if (this._glb > 0) this.toasts.show('Blender-моделей: ' + this._glb);
    for (let i = 0; i < 3; i++) CardsSys.drawCard(this.state, this.ctx, true);   // стартовая рука
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
    const scatter = (kind, count, amount, minR) => {
      let n = 0, t = 0;
      while (n < count && t < count * 40) {
        t++; const x = ri(2, g.n - 3), y = ri(2, g.n - 3);
        if (!far(x, y, minR) || !g.canPlace(x, y, 1, 1)) continue;
        this.state.addNode(kind, x, y, amount + ri(-10, 10)); n++;
      }
    };
    // карта 96² — ресурсы с множителями локации
    const r = (map && map.res) || { tree: 1, stone: 1, ore: 1 };
    scatter('res_tree', Math.round(150 * r.tree), 60, 4);
    scatter('res_stone', Math.round(60 * r.stone), 90, 6);
    scatter('res_ore', Math.round(34 * r.ore), 60, 8);
    // стартовые ХОЛОПы
    for (let i = 0; i < 4; i++) {
      const adj = nearestAdj(g, c - 1, c - 1, 3, 3, c - 2 + i, c + 2) || { x: c, y: c + 2 };
      const w = g.gridToWorld(adj.x, adj.y);
      this.state.addUnit('kholop', w.wx, w.wz, {});
    }
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
      if (e.button !== 0) return;
      this.picker.setFromEvent(e);
      this._keepBuild = e.shiftKey;
      if (this.buildKind) { this.placing = true; this._placeAt(); }
      else this._selectOrOrder();
    });
    cv.addEventListener('pointermove', (e) => {
      this.picker.setFromEvent(e);
      if (this.placing && this.buildKind && BUILDINGS[this.buildKind].wall) this._placeAt(true);
    });
    window.addEventListener('pointerup', () => { this.placing = false; });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') { this.buildKind = null; this.terrain.hideGhost(); this.state.selected = null; }
      else if (e.code === 'Space') { e.preventDefault(); this.activateSuper(); }
      else if (/^Digit[1-5]$/.test(e.code)) { this.playCard(parseInt(e.code.slice(5), 10) - 1); }
    });
    document.getElementById('superBtn').onclick = () => this.activateSuper();
    const mb = document.getElementById('muteBtn');
    mb.textContent = isMuted() ? '🔇' : '🔊';
    mb.onclick = () => { const m = toggleMute(); mb.textContent = m ? '🔇' : '🔊'; if (!m) sfx('click'); };
    const rb = document.getElementById('restartBtn');
    if (rb) rb.onclick = () => this.restart();
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
    for (const n of this.state.nodes) a.push(n.view);
    for (const u of this.state.units) a.push(u.view);
    return a;
  }

  _selectOrOrder() {
    const ent = this.picker.entityUnder(this.camera, this._pickables());
    const sel = this.state.selected;
    if (ent) {
      if (sel && sel.type === 'unit' && sel.def.worker && ent.type === 'node') {
        sel.job = ent.id; sel.jobType = ent.resType; sel.path = null; sel.state = 'toNode';
        this.toasts.show('🧑‍🌾 ХОЛОП → добыча ' + ent.resType); sfx('click'); return;
      }
      this.state.selected = ent; sfx('click');
      if (ent.type === 'unit' && ent.faction === 'ours') this.float(ent.x, ent.z, bark('select'), '#ffe8b5', 1.4);
      return;
    }
    const t = this.picker.tileUnder(this.camera, this.state.grid);
    if (sel && sel.type === 'unit' && sel.faction === 'ours' && !sel.def.worker && t) {
      sel.moveOrder = { x: t.x, y: t.y }; sel.path = null; this.float(sel.x, sel.z, 'Идём!', '#9effd0', 1.4); sfx('click'); return;
    }
    this.state.selected = null;
  }

  enterBuild(kind) { this.buildKind = kind; this.state.selected = null; sfx('click'); }
  train(b, uk) { BuildSys.queueTrain(this.state, b, uk, this.ctx); }
  toggleEdictUI(key) { toggleEdict(this.state, key, this.ctx); }
  setStance(u, st) { u.stance = st; u.path = null; u.moveOrder = null; sfx('click'); }
  playCard(idx) { CardsSys.playCard(this.state, idx, this.ctx); }

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
    CardsSys.update(this.state, dt, this.ctx);
  }

  // ---------- рендер ----------
  render(alpha) {
    if (!this._rendered) { this._rendered = true; window.__gboot && window.__gboot('RENDERING ✓'); }
    const now = performance.now();
    let fdt = (now - this.lastRender) / 1000; if (fdt > 0.1) fdt = 0.1; this.lastRender = now;
    this.cameraRig.update(fdt);

    // интерполяция + анимация юнитов (рост/ходьба/выпад)
    for (const u of this.state.units) {
      const v = u.view;
      if (u.grow < 1) { u.grow = Math.min(1, u.grow + fdt * 3.5); v.scale.setScalar(u.growMax * (0.25 + 0.75 * u.grow)); }
      const ix = u.px + (u.x - u.px) * alpha, iz = u.pz + (u.z - u.pz) * alpha;
      const moving = Math.hypot(u.x - u.px, u.z - u.pz) > 0.0025;
      let bob = 0, fwd = 0;
      if (moving) bob = Math.abs(Math.sin(now * 0.016 + u.id * 1.7)) * 0.045;
      if (u.atkAnim > 0) { u.atkAnim -= fdt; fwd = Math.sin((1 - Math.max(0, u.atkAnim) / 0.2) * Math.PI) * 0.16; }
      v.position.set(ix + Math.sin(u.dir) * fwd, bob, iz + Math.cos(u.dir) * fwd);
      v.rotation.y = u.dir || 0;
    }
    // эффекты смерти (падение+уменьшение)
    for (let i = this.state.fx.length - 1; i >= 0; i--) {
      const f = this.state.fx[i]; f.life -= fdt;
      const t = 1 - Math.max(0, f.life) / f.max;
      if (f.kind === 'death') { f.view.rotation.z = t * 1.5; f.view.position.y = -t * 0.35; f.view.scale.multiplyScalar(0.965); }
      if (f.life <= 0) { this.scene.remove(f.view); this.state.fx.splice(i, 1); }
    }
    // пульс эмиссии идола
    if (this.state.idol) { const p = 1.4 + Math.sin(now * 0.005) * 0.9; this.state.idol.view.traverse(o => { if (o.isMesh && o.material && o.material.emissiveIntensity > 0) o.material.emissiveIntensity = p; }); }
    // дрожание зданий под уроном
    for (const b of this.state.buildings) {
      if (b._hit > 0) { b._hit -= fdt; const j = b._hit > 0 ? (Math.random() - 0.5) * 0.06 : 0; b.view.position.set(b.cx + j, 0, b.cz + j); }
    }
    // «сердце» базы — свет
    const s = this.state;
    const pulse = 0.12 + Math.sin(now * 0.004) * 0.05;
    this.rdr.heart.intensity = s.superTimer > 0 ? 2.4 : (s.threatTimer > 0 ? 0.9 : pulse);
    this.rdr.heart.color.setHex(s.superTimer > 0 ? 0xff3020 : (s.threatTimer > 0 ? 0xff5030 : 0xe0392b));
    if (s.townhall) this.rdr.heart.position.set(s.townhall.cx, 4, s.townhall.cz);

    // ховер/призрак
    this._updateHover();
    this.rdr.render(this.camera);

    this._uiT += fdt;
    if (this._uiT > 0.1) { this.hud.update(); this.menu.update(); this.selUI.update(); this.cards.update(); this._uiT = 0; }
    this.minimap.update(fdt);
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
      this.terrain.setHover(tile);
      this.terrain.hideGhost();
    }
  }
}

const game = new Game();
window.GOYDA = game;
game.boot();
