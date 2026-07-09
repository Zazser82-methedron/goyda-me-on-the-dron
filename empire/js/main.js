// ===== ГОЙДА-ИМПЕРИЯ — точка входа и оркестратор =====
import * as THREE from 'three';
import { Renderer } from './engine/Renderer.js?v=86';
import * as Quality from './engine/Quality.js?v=86';
import { RTSCamera } from './engine/RTSCamera.js?v=86';
import { Picker } from './engine/Picker.js?v=86';
import { Loop } from './engine/Loop.js?v=86';
import { AssetManager } from './engine/AssetManager.js?v=86';
import { TerrainMesh } from './world/TerrainMesh.js?v=86';
import { WorldBase } from './world/WorldBase.js?v=86';
import { Sky } from './world/Sky.js?v=86';
import { Atmosphere } from './world/Atmosphere.js?v=86';
// Туман войны убран по просьбе игрока (Fog.js больше не используется)
import { nearestAdj } from './world/Pathfinding.js?v=86';
import { GameState } from './sim/GameState.js?v=86';
import * as Economy from './sim/Economy.js?v=86';
import * as BuildSys from './sim/Buildings.js?v=86';
import * as Waves from './sim/Waves.js?v=86';
import * as Tech from './sim/Tech.js?v=86';
import * as Nature from './sim/Nature.js?v=86';
import * as Relics from './sim/Relics.js?v=86';
import * as Camps from './sim/Camps.js?v=86';
import * as Wildlife from './sim/Wildlife.js?v=86';
import * as Events from './sim/Events.js?v=86';
import * as Achievements from './sim/Achievements.js?v=86';
import * as Meta from './sim/Meta.js?v=86';
import * as Research from './sim/Research.js?v=86';
import { updateUnits, damage } from './sim/Units.js?v=86';
import { toggleEdict } from './sim/Edicts.js?v=86';
import { sfx, toggleMute, isMuted, resumeAudio } from './audio/Sfx.js?v=86';
import { AmbientAudio } from './audio/Music.js?v=86';
import { HUD } from './ui/HUD.js?v=86';
import { BuildMenu } from './ui/BuildMenu.js?v=86';
import { Selection } from './ui/Selection.js?v=86';
import { Minimap } from './ui/Minimap.js?v=86';
import { ResearchPanel } from './ui/Research.js?v=86';
import { Toasts } from './ui/Toasts.js?v=86';
import { Leaderboard } from './ui/Leaderboard.js?v=86';
import { BUILDINGS } from './data/buildings.js?v=86';
import { RANKS } from './data/ranks.js?v=86';
import { bark } from './data/barks.js?v=86';
import { STORAGE_KEY } from './data/config.js?v=86';
import { getFaction } from './data/factions.js?v=86';
import { getMap, MAPS } from './data/maps.js?v=86';
import { StartScreen } from './ui/StartScreen.js?v=86';

const MODELS = [
  'idol_dron', 'bld_townhall', 'bld_izba', 'bld_ambar', 'bld_roshcha', 'bld_kuznica', 'bld_kazarma',
  'bld_chastokol', 'bld_church', 'bld_market',   // ВОРОТА — процедурный плейсхолдер (со створкой-анимацией)
  'res_tree', 'res_stone', 'res_ore', 'unit_kholop', 'unit_ratnik', 'unit_oprichnik',
  'enemy_raider', 'enemy_boss', 'enemy_camp',
  // детальные идолы-реликвии (каждый со своим силуэтом, Blender GLB)
  'idol_krio', 'idol_giper', 'idol_shipo', 'idol_obereg', 'idol_food', 'idol_gold', 'idol_fonk', 'idol_vera', 'idol_samotsvet',
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
    this.leaderboard = new Leaderboard(this);
    this.startScreen = new StartScreen(this);

    this.buildKind = null;
    this._buildRot = 0;            // поворот призрака/постройки (0..3 = 0/90/180/270°)
    this.placing = false;
    this._keepBuild = false;
    this._orderPending = false;    // «🎯 ПРИКАЗ» взведён — следующий тап/клик = команда (мобила без ПКМ)
    this._ghostModels = {};
    this.lastRender = performance.now();
    this._uiT = 0;
    this.tracers = [];
    this._uShadows = []; this._aShadows = [];   // пулы мягких теней-пятен под юнитами/дичью
    this._vetMarkers = [];                       // пул шевронов-звёзд ★ над ветеранами
    this.floaters = document.getElementById('floaters');
    this._hitStop = 0;          // таймер hit-pause (сек реального времени)
    this._ripples = [];         // кольца-подтверждения команд
    this._fltCount = 0;         // бюджет всплывающих чисел за кадр (анти-спам DOM)
    this.music = new AmbientAudio();   // процедурная фоновая музыка + звук окружения

    this.ctx = this._makeCtx();
    this.rdr.onResize = (w, h) => this.cameraRig.resize(w, h);
    if (this.rdr.tier !== 'low') {          // low-тир (мобила): без тяжёлой пост-обработки и IBL — ради плавности
      this.rdr.setupComposer(this.camera);  // пост-обработка (bloom/SMAA/тонмаппинг), ленивая + фолбэк
      this.rdr.setupEnvironment();          // IBL-отражения для PBR (вода/металл/идолы)
    }
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
      burst: (x, y, z, col, n) => { this.atmo && this.atmo.burst(x, y, z, col, n); this.cameraRig.addShake(Math.min(0.4, (n || 8) * 0.012)); },
      tracer: (u, t, opt) => this.spawnTracer(u, t, opt),
      shake: (a) => this.cameraRig.addShake(a),                       // тряска камеры (game-feel)
      dmgNum: (target, amt, kind) => this.dmgNumber(target, amt, kind),  // всплывающее число урона/лечения
      hitStop: (t) => { this._hitStop = Math.max(this._hitStop, t); },   // короткая пауза симуляции на сильных ударах
      choiceEvent: (ev) => this.choiceEvent(ev),                          // событие-выбор (модалка)
      onLose: () => this.end('lose'),
      onWin: () => this.end('win'),
      onRankUp: (ri) => this._boonDraft(ri),
      spawnBoss: (key) => Waves.spawnBoss(this.state, key, this.ctx),
      onBossDown: (boss) => {
        this.state.gain({ gold: 60, faith: 25 });
        this.toasts.show('☠️ ' + (boss.bossName || 'Босс') + ' повержен! +60🪙 +25☩', { gold: true, big: true });
        sfx('win'); this.cameraRig.addShake(0.85); this._hitStop = Math.max(this._hitStop, 0.07);
      },
    };
  }

  async boot() {
    const G = window.__gboot || function () {};
    try {
      // модели грузятся в фоне — не блокируют запуск (есть плейсхолдеры)
      this.assets.preload(MODELS).then(c => { this._glb = c; G('models ' + c); }).catch(() => {});
      // ПОРТАЛ ДРОНА: прибытие на новую Землю (перенос ресурсов+ранга+дружины) — до обычного сейва
      const portal = (() => { try { return JSON.parse(localStorage.getItem('GOYDA_EMPIRE_PORTAL')); } catch (e) { return null; } })();
      if (portal && portal.mapKey) {
        try { localStorage.removeItem('GOYDA_EMPIRE_PORTAL'); } catch (_) {}
        try {
          this._portalArrivalFx();                      // оверлей-воронка сразу — маскирует reload, пока строится мир
          this.state.faction = getFaction(portal.faction);
          this.state.mapKey = portal.mapKey;
          this.state.portalDepth = portal.depth || 2;   // до initMap: глубокие Земли богаче залежами
          const map = getMap(portal.mapKey);
          this.buildWorld(map);
          this.initMap(map);                            // свежая ратуша + стартовые холопы + ресурсы (щедрее по глубине)
          for (const k in (portal.res || {})) {         // перенос ресурсов, но не выше складских лимитов (cap)
            if (this.state.resources[k] !== undefined) this.state.resources[k] = Math.min(this.state.cap[k] ?? 9999, portal.res[k]);
          }
          this.state.rankIndex = portal.rankIndex || 0;
          this.state.day = portal.day || 0;
          this.state.happiness = portal.happiness ?? 60;
          const g = this.state.grid, c = Math.floor(g.n / 2);   // высадка дружины кольцом у ратуши
          for (const a of (portal.army || [])) {
            const adj = nearestAdj(g, c - 1, c - 1, 3, 3, c + ri(-3, 3), c + ri(2, 5)) || { x: c, y: c + 3 };
            const w = g.gridToWorld(adj.x, adj.y);
            const uu = this.state.addUnit(a.kind, w.wx, w.wz, {});
            if (a.maxHp) uu.maxHp = a.maxHp;
            if (a.hp) uu.hp = a.hp;
            if (a.vet) uu.vet = a.vet;
            if (a.kills) uu.kills = a.kills;
          }
          this.state.recomputePop();
          const dBonus = (this.state.portalDepth || 1) - 1;   // награда за глубину — в ВЕРУ (cap 999, не упрётся в склад)
          if (dBonus > 0) this.state.gain({ faith: dBonus * 18 });
          this._portalArrival = true;                   // тост прибытия в _begin
          G('portal depth ' + this.state.portalDepth); this._begin(false); return;
        } catch (e) { console.warn('portal failed', e); try { localStorage.removeItem(STORAGE_KEY); } catch (_) {} }
      }
      const save = GameState.load();
      G('save=' + (save && save.buildings ? save.buildings.length : 'none'));
      if (save && save.v === 2 && save.buildings && save.buildings.length) {   // старые сейвы (до рельефа) — старт заново
        try {
          this.state.faction = getFaction(save.faction);
          this.state.mapKey = save.mapKey || 'les';
          this.buildWorld(getMap(this.state.mapKey));
          this._restore(save);
          this._checkArenaReturn();                     // награда за победы в карточной арене, пока был там
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
    this._applyMetaPerks();          // бонусы старта за накопленную Доблесть (только свежая кампания)
    this._applyMutators();           // активные мутаторы-испытания (тяжелее, но Доблести больше)
    this._begin(false);
  }

  // мутаторы: множители боя + дельты старта + множитель Доблести (только свежая кампания)
  _applyMutators() {
    const e = Meta.mutatorEffects();
    this.state.mutCount = e.count; this.state.mutHp = e.hp; this.state.mutValor = e.valor;
    if (e.food) this.state.resources.food = Math.max(0, this.state.resources.food + e.food);
    if (e.wood) this.state.resources.wood = Math.max(0, this.state.resources.wood + e.wood);
    if (e.active.length) {
      const ics = e.active.map(id => (Meta.MUTATORS.find(m => m.id === id) || {}).ic || '').join('');
      this.toasts.show('🎲 Испытания ' + ics + ' активны · Доблесть ×' + e.valor.toFixed(2), { gold: true });
    }
  }

  // мета-прогрессия: бонусы старта по накопленной Доблести (ресурсы + вольные воины)
  _applyMetaPerks() {
    const p = Meta.startPerks();
    if (!p.any) return;
    if (p.gold || p.food) this.state.gain({ gold: p.gold, food: p.food });
    const g = this.state.grid, c = Math.floor(g.n / 2);
    const spawnNear = (kind) => {
      const adj = nearestAdj(g, c - 1, c - 1, 3, 3, c + ri(-3, 3), c + ri(2, 5)) || { x: c, y: c + 3 };
      const w = g.gridToWorld(adj.x, adj.y); this.state.addUnit(kind, w.wx, w.wz, {});
    };
    for (let i = 0; i < (p.holops || 0); i++) spawnNear('kholop');
    if (p.freeRatnik) spawnNear('ratnik');
    if (p.freeOprichnik) spawnNear('oprichnik');
    this.state.recomputePop();
    this._metaPerks = p;             // тост в _begin
  }

  // Палата Доблести: тратим накопленную Доблесть на постоянные разблокировки
  _metaShop() {
    if (this._shopEl) return;
    sfx('edict');
    const render = () => {
      const m = Meta.load();
      const rows = Meta.SHOP.map(s => {
        const has = m.unlocks.includes(s.id);
        const afford = m.valor >= s.cost;
        const bg = has ? '#1e3a1e' : afford ? '#241840' : '#2a1620';
        const border = has ? '#5cc85c' : afford ? '#9a5cff' : '#7a4a4a';
        const label = has ? '✓ Открыто' : afford ? 'Купить · ' + s.cost + '⭐' : 'Нужно ' + s.cost + '⭐';
        const dim = has || !afford;
        return '<button data-buy="' + s.id + '" ' + (dim ? 'disabled' : '') + ' style="display:block;width:100%;margin:5px 0;padding:9px 12px;border-radius:9px;border:1px solid ' + border + ';background:' + bg + ';color:#f0e6ff;cursor:' + (dim ? 'default' : 'pointer') + ';font:inherit;text-align:left;opacity:' + (dim ? '0.75' : '1') + '">'
          + s.ic + ' <b>' + s.name + '</b> <span style="opacity:.7">— ' + s.desc + '</span><div style="font-size:12px;margin-top:3px;color:#cbb8e8">' + label + '</div></button>';
      }).join('');
      const onMut = Meta.getMutators();
      const muts = Meta.MUTATORS.map(mt => {
        const act = onMut.includes(mt.id);
        return '<button data-mut="' + mt.id + '" style="display:block;width:100%;margin:5px 0;padding:8px 12px;border-radius:9px;border:1px solid ' + (act ? '#ff5cf0' : '#5a4a7a') + ';background:' + (act ? '#3a0e2e' : '#1a1430') + ';color:#f0e6ff;cursor:pointer;font:inherit;text-align:left">'
          + (act ? '☑ ' : '☐ ') + mt.ic + ' <b>' + mt.name + '</b> <span style="opacity:.7">— ' + mt.desc + '</span> <span style="color:#ffd84a">⭐×' + (mt.valor || 1) + '</span></button>';
      }).join('');
      this._shopEl.innerHTML = '<div style="font-size:19px;font-weight:800;margin-bottom:2px">⭐ Палата Доблести</div>'
        + '<div style="opacity:.85;margin-bottom:10px">Доблесть: <b>' + m.valor + '</b> · побед ' + m.wins + ' · лучшая Земля №' + m.bestDepth + '. Разблокировки постоянны и действуют с новой кампании.</div>'
        + rows
        + '<div style="margin:12px 0 2px;font-weight:700">🎲 Испытания (мутаторы)</div><div style="opacity:.7;font-size:12px;margin-bottom:6px">Тяжелее, но Доблести больше. Вступают в силу с новой кампании.</div>'
        + muts
        + '<button data-buy="__close" style="margin-top:8px;padding:7px 16px;border-radius:8px;border:1px solid #555;background:#1a1626;color:#cbb8e8;cursor:pointer;font:inherit">Закрыть</button>';
      this._shopEl.querySelectorAll('button').forEach(b => b.onclick = () => {
        if (b.dataset.mut) { Meta.toggleMutator(b.dataset.mut); sfx('click'); render(); return; }
        const id = b.dataset.buy;
        if (id === '__close') { this._shopEl.remove(); this._shopEl = null; sfx('click'); return; }
        const r = Meta.buy(id);
        if (r.ok) { sfx('rankup'); this.toasts.show('⭐ Открыто: ' + (Meta.SHOP.find(s => s.id === id) || {}).name + '. Действует с новой кампании.', { gold: true }); render(); }
        else { sfx('deny'); }
      });
    };
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:120;background:linear-gradient(180deg,#1b1430,#0e0820);border:2px solid #9a5cff;border-radius:14px;padding:16px 18px;max-width:440px;width:88%;box-shadow:0 14px 50px rgba(60,10,140,.6);color:#ece0ff;text-align:center;font-size:14px;max-height:80vh;overflow:auto';
    document.getElementById('app').appendChild(el);
    this._shopEl = el; render();
  }

  // Торг на рынке: продать излишки за золото / докупить нужное (с наценкой-спредом). Нужен построенный рынок.
  _tradePanel() {
    if (this._tradeEl) return;
    const hasMarket = this.state.buildings.some(b => b.built && (b.kind === 'market' || b.kind === 'traktir'));
    if (!hasMarket) { this.toasts.show('🛒 Нужен РЫНОК для торга', { bad: true }); sfx('deny'); return; }
    sfx('edict');
    const TRADE = [
      { k: 'wood', ic: '🪵', name: 'Лес', sell: 0.3, buy: 0.8 },
      { k: 'stone', ic: '🪨', name: 'Камень', sell: 0.35, buy: 0.9 },
      { k: 'iron', ic: '⛓️', name: 'Железо', sell: 0.7, buy: 1.6 },
      { k: 'gems', ic: '💎', name: 'Самоцветы', sell: 1.5, buy: 3.5 },
      { k: 'food', ic: '🍖', name: 'Еда', sell: 0.25, buy: 0.7 },
    ];
    const CHUNK = 25;
    const render = () => {
      const r = this.state.resources, cap = this.state.cap;
      const rows = TRADE.map(t => {
        const sg = Math.round(CHUNK * t.sell), bg = Math.round(CHUNK * t.buy);
        const canSell = (r[t.k] || 0) >= CHUNK, canBuy = r.gold >= bg && (r[t.k] || 0) < (cap[t.k] || 400);
        return '<div style="display:flex;align-items:center;gap:6px;margin:5px 0">'
          + '<div style="flex:1;text-align:left">' + t.ic + ' <b>' + t.name + '</b> <span style="opacity:.6">' + Math.floor(r[t.k] || 0) + '</span></div>'
          + '<button data-sell="' + t.k + '" ' + (canSell ? '' : 'disabled') + ' style="padding:6px 9px;border-radius:7px;border:1px solid #5cc85c;background:' + (canSell ? '#1e3a1e' : '#222') + ';color:#dfffe0;cursor:' + (canSell ? 'pointer' : 'default') + ';font:inherit;opacity:' + (canSell ? '1' : '.5') + '">−' + CHUNK + '→+' + sg + '🪙</button>'
          + '<button data-buy="' + t.k + '" ' + (canBuy ? '' : 'disabled') + ' style="padding:6px 9px;border-radius:7px;border:1px solid #c8922e;background:' + (canBuy ? '#2c2113' : '#222') + ';color:#ffe6a8;cursor:' + (canBuy ? 'pointer' : 'default') + ';font:inherit;opacity:' + (canBuy ? '1' : '.5') + '">+' + CHUNK + '←−' + bg + '🪙</button>'
          + '</div>';
      }).join('');
      this._tradeEl.innerHTML = '<div style="font-size:19px;font-weight:800;margin-bottom:2px">🛒 Торг на рынке</div>'
        + '<div style="opacity:.85;margin-bottom:10px">Золото: <b>' + Math.floor(r.gold) + '</b>🪙. Продавай излишки, докупай нужное (с наценкой).</div>'
        + rows
        + '<button data-close="1" style="margin-top:8px;padding:7px 16px;border-radius:8px;border:1px solid #555;background:#1a1626;color:#cbb8e8;cursor:pointer;font:inherit">Закрыть</button>';
      this._tradeEl.querySelectorAll('button').forEach(b => b.onclick = () => {
        if (b.dataset.close) { this._tradeEl.remove(); this._tradeEl = null; sfx('click'); return; }
        const r2 = this.state.resources, cap2 = this.state.cap;
        if (b.dataset.sell) {
          const t = TRADE.find(x => x.k === b.dataset.sell);
          if ((r2[t.k] || 0) >= CHUNK) { r2[t.k] -= CHUNK; this.state.gain({ gold: Math.round(CHUNK * t.sell) }); sfx('deposit'); render(); }
        } else if (b.dataset.buy) {
          const t = TRADE.find(x => x.k === b.dataset.buy), cost = Math.round(CHUNK * t.buy);
          if (r2.gold >= cost && (r2[t.k] || 0) < (cap2[t.k] || 400)) { r2.gold -= cost; r2[t.k] = Math.min(cap2[t.k] || 400, (r2[t.k] || 0) + CHUNK); sfx('place'); render(); }
        }
      });
    };
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:120;background:linear-gradient(180deg,#1b1430,#0e0820);border:2px solid #c8922e;border-radius:14px;padding:16px 18px;max-width:420px;width:88%;box-shadow:0 14px 50px rgba(60,10,140,.6);color:#ece0ff;text-align:center;font-size:14px;max-height:80vh;overflow:auto';
    document.getElementById('app').appendChild(el);
    this._tradeEl = el; render();
  }

  // Дары Гойды: на возвышении эпохи — выбор 1 из 3 баффов (рогалик-слой; эффекты через живые множители research)
  _boonDraft(rankIndex) {
    if (this._boonEl) return;   // редкий случай двойного возвышения — пропускаем
    const BOONS = [
      { id: 'gather', ic: '⛏️', name: 'Тороватые руки', desc: '+25% добычи', f: (s) => { s.research.gatherMul *= 1.25; } },
      { id: 'might', ic: '⚔️', name: 'Сеча', desc: '+20% урона дружины', f: (s) => { s.research.dmgMul *= 1.2; } },
      { id: 'tithe', ic: '🪙', name: 'Подати', desc: '+5 золота в день', f: (s) => { s.research.goldDay += 5; } },
      { id: 'harvest', ic: '🌾', name: 'Урожай', desc: '+4 еды в день', f: (s) => { s.research.foodDay += 4; } },
      { id: 'grace', ic: '☩', name: 'Благодать', desc: '+3 веры в день', f: (s) => { s.research.faithDay += 3; } },
      { id: 'bounty', ic: '🎁', name: 'Щедрый дар', desc: '+120🪙 +80🍖 сразу', f: (s) => { s.gain({ gold: 120, food: 80 }); } },
    ];
    const pool = BOONS.slice(); const pick = [];
    while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    sfx('rankup');
    const wasSpeed = this.loop.speed; this._setSpeed(0);   // пауза на выбор дара
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:130;background:linear-gradient(180deg,#241840,#0e0820);border:2px solid #ffd84a;border-radius:14px;padding:16px 18px;max-width:440px;width:90%;box-shadow:0 14px 50px rgba(140,100,10,.5);color:#ece0ff;text-align:center;font-size:14px';
    el.innerHTML = '<div style="font-size:19px;font-weight:800;margin-bottom:2px">🎁 ДАР ГОЙДЫ за возвышение</div>'
      + '<div style="opacity:.85;margin-bottom:10px">Выбери благословение державе:</div>'
      + pick.map(b => '<button data-boon="' + b.id + '" style="display:block;width:100%;margin:5px 0;padding:11px 12px;border-radius:9px;border:1px solid #ffd84a;background:#2c2113;color:#ffe6a8;cursor:pointer;font:inherit;text-align:left">'
        + b.ic + ' <b>' + b.name + '</b> <span style="opacity:.8">— ' + b.desc + '</span></button>').join('');
    document.getElementById('app').appendChild(el);
    this._boonEl = el;
    el.querySelectorAll('button').forEach(btn => btn.onclick = () => {
      const boon = pick.find(b => b.id === btn.dataset.boon);
      if (boon) { try { boon.f(this.state); } catch (e) {} this.toasts.show('🎁 Дар принят: ' + boon.name + ' — ' + boon.desc, { gold: true, big: true }); sfx('super'); }
      el.remove(); this._boonEl = null; this._setSpeed(wasSpeed || 1);
    });
  }

  buildWorld(map) {
    this.map = map;
    this.state.grid.generateTerrain(map.terr, map.key);   // рельеф (высоты/биомы/реки)
    this.terrain = new TerrainMesh(this.scene, this.state.grid, map.pal, this.rdr.tier);
    this.worldBase = new WorldBase(this.scene, this.state.grid);   // плита на слонах+черепахе
    if (map.key === 'neon') this._addNeonSun();
    else {
      this.sky = new Sky(this.scene, this.rdr);                    // суточный цикл + погода (кроме неона)
      const WMSG = { rain: '🌧️ Зарядил дождь', snow: '🌨️ Повалил снег', fog: '🌫️ Пал туман', storm: '⛈️ Надвигается ГРОЗА', clear: '☀️ Распогодилось' };
      let _first = true;                                            // не тостим стартовую «ясно»
      this.sky.onWeather = (w) => { if (_first) { _first = false; return; } if (WMSG[w]) this.toasts.show(WMSG[w]); };
    }
    this.atmo = new Atmosphere(this.scene, this.state.grid, map.key, this.rdr.tier);   // дым/искры/птицы/облака/светлячки (меньше на low)
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
    this.rdr.setSky(0x241250, 0x6a2c54);   // тёмно-фиолетовое ретровейв-небо
    this.rdr.hemi.color.setHex(0xffb0d0); this.rdr.hemi.groundColor.setHex(0x3a2050);
    this._neon = { sun, stars };
  }

  _begin(restored) {
    this.cameraRig.focus(0, 0);
    // стартовый кадр: ближе + кинематографичный 3/4-наклон (детализация видна сразу),
    // с мягким въездом-зумом от чуть дальше (короткое вступление, без рывка)
    const cam = this.cameraRig;
    cam.radius = 26; cam.polar = 1.04; cam.azimuth = Math.PI * 0.22;
    cam._radius = 40; cam._polar = 0.92; cam._azimuth = cam.azimuth;
    const f = this.state.faction;
    if (this._arenaReturn) {
      const d = this._arenaReturn.delta; this._arenaReturn = null;
      if (d > 0) this.toasts.show('🏆 Возврат из арены ГОЙДЫ: ' + d + ' побед(ы)! Награда +' + (d * 30) + '🪙 +' + (d * 16) + '☩ +' + (d * 20) + '🍖', { big: true, gold: true });
      else this.toasts.show('🌀 Возврат из карточной арены. Поход продолжается!', { gold: true });
    } else if (this._portalArrival) {
      this.toasts.show('🌀 Портал Дрона: высадка на ' + this.map.emoji + ' ' + this.map.name + ' · Земля №' + (this.state.portalDepth || 2) + '! ' + bark('win'), { big: true, gold: true });
      this._portalArrival = false;
    } else this.toasts.show(restored ? '⚔️ Поход продолжается…' : ('🗿 ' + (f ? f.emoji + ' ' + f.name : 'ГОЙДА') + ' · ' + this.map.name + '. ГОЙДА!'), { big: true, gold: true });
    if (this._metaPerks) {
      const p = this._metaPerks; this._metaPerks = null;
      const bits = [];
      if (p.gold) bits.push('+' + p.gold + '🪙');
      if (p.food) bits.push('+' + p.food + '🍖');
      if (p.holops) bits.push('+' + p.holops + '🧑‍🌾');
      if (p.freeRatnik) bits.push('+ратник');
      if (p.freeOprichnik) bits.push('+опричник');
      this.toasts.show('⭐ Палата Доблести · бонус старта: ' + bits.join(' '), { gold: true });
    }
    if (this._glb > 0) this.toasts.show('Blender-моделей: ' + this._glb);
    window.__gboot && window.__gboot('loop ' + (restored ? 'restore' : 'new'));
    this.music.start();   // фоновая музыка (стартует на пользовательском жесте — старт-экран)
    if (!restored) this._maybeTutorial();   // подсказки новичку (только первый раз)
    this._season = ['summer', 'autumn', 'winter', 'spring'][Math.floor(Math.random() * 4)];   // сезон партии (тон грейда)
    this._seasonApplied = false;
    if ((this.state.portalDepth || 1) > 1) this._showLandBadge();   // индикатор глубины портала
    this.loop.start();
  }

  // постоянный бейдж глубины портала (Земля №N) — только на прыжках через портал
  _showLandBadge() {
    let el = document.getElementById('landBadge');
    if (!el) {
      el = document.createElement('div'); el.id = 'landBadge';
      el.style.cssText = 'position:fixed;left:8px;top:74px;z-index:40;background:linear-gradient(180deg,#241840,#160e2a);border:1px solid #9a5cff;border-radius:8px;padding:4px 9px;color:#e6d8ff;font:700 12px/1.3 inherit;box-shadow:0 4px 14px rgba(60,10,140,.5);pointer-events:none';
      document.getElementById('app').appendChild(el);
    }
    el.textContent = '🌀 Земля №' + (this.state.portalDepth || 1) + ' · набеги жёстче, но земля щедрей';
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
    const rich = 1 + ((this.state.portalDepth || 1) - 1) * 0.2;   // глубокие Земли: залежи щедрее (амуниция награды портала)
    const scatter = (kind, count, amount, minR, biomes) => {
      let n = 0, t = 0;
      while (n < count && t < count * 50) {
        t++; const x = ri(2, g.n - 3), y = ri(2, g.n - 3);
        if (!far(x, y, minR) || !g.canPlace(x, y, 1, 1)) continue;
        if (biomes && !biomes.includes(g.get(x, y).biome)) continue;
        this.state.addNode(kind, x, y, Math.round((amount + ri(-10, 10)) * rich)); n++;
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
      const bb = this.state.addBuilding(b.kind, b.gx, b.gy, { built: b.built !== false, rotation: b.rot || 0 });
      if (b.hp) bb.hp = b.hp;
    }
    for (const u of (s.units || [])) { const uu = this.state.addUnit(u.kind, u.x, u.z, {}); if (u.hp) uu.hp = u.hp; }
    this.state.recomputePop();
  }

  // ---------- ввод ----------
  _input() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;   // тач обрабатывается отдельно (_touchInput)
      resumeAudio();
      this.picker.setFromEvent(e);
      if (e.button === 0) {            // ЛКМ — выбор / постройка / (если взведён 🎯 ПРИКАЗ) — команда
        this._keepBuild = e.shiftKey;
        if (this._orderPending) { this._orderPending = false; this._command(); this._syncOrderBtn(); }
        else if (this.buildKind) { this.placing = true; this._placeAt(); }
        else this._select();
      } else if (e.button === 2) {     // ПКМ — команда (или отмена стройки)
        e.preventDefault();
        if (this.buildKind) { this.buildKind = null; this.terrain.hideGhost(); }
        else this._command();
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.picker.setFromEvent(e);
      this._pointerMoved = true;
      if (this.placing && this.buildKind && BUILDINGS[this.buildKind].wall) this._placeAt(true);
    });
    window.addEventListener('pointerup', () => { this.placing = false; });
    this._touchInput();
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') { this.buildKind = null; this.terrain.hideGhost(); this.state.selected = null; this._orderPending = false; }
      else if (e.code === 'Space') { e.preventDefault(); this.activateSuper(); }
      else if (e.code === 'KeyR' && this.buildKind) { this._buildRot = ((this._buildRot || 0) + 1) % 4; sfx('click'); }   // R — повернуть постройку
      else if (e.code === 'KeyP') { this._setSpeed(this.loop.speed > 0 ? 0 : (this._lastSpeed || 1)); }                  // P — пауза/продолжить
      else if (e.code === 'Digit1') this._setSpeed(1);
      else if (e.code === 'Digit2') this._setSpeed(2);
      else if (e.code === 'Digit3') this._setSpeed(3);
    });
    document.getElementById('superBtn').onclick = () => this.activateSuper();
    const mb = document.getElementById('muteBtn');
    mb.textContent = isMuted() ? '🔇' : '🔊';
    mb.onclick = () => { const m = toggleMute(); mb.textContent = m ? '🔇' : '🔊'; if (!m) sfx('click'); };
    const db = document.getElementById('diffBtn');
    if (db) {
      const order = ['easy', 'normal', 'hard'];
      this.state.difficulty = (() => { try { return localStorage.getItem('GOYDA_DIFF'); } catch (e) { return null; } })() || 'normal';
      const refresh = () => { const d = Waves.DIFF[this.state.difficulty] || Waves.DIFF.normal; db.textContent = d.emoji; db.title = 'Сложность набегов: ' + d.name + ' (нажми — сменить)'; };
      refresh();
      db.onclick = () => {
        const i = order.indexOf(this.state.difficulty || 'normal');
        this.state.difficulty = order[(i + 1) % order.length];
        try { localStorage.setItem('GOYDA_DIFF', this.state.difficulty); } catch (e) {}
        refresh(); sfx('click');
        const d = Waves.DIFF[this.state.difficulty];
        this.toasts.show('Сложность набегов: ' + d.emoji + ' ' + d.name, { gold: this.state.difficulty !== 'hard', bad: this.state.difficulty === 'hard' });
      };
    }
    const tb = document.getElementById('techBtn');
    if (tb) tb.onclick = () => { const open = this.researchUI.toggle(); tb.classList.toggle('on', open); sfx('click'); };
    const xb = document.getElementById('fxBtn');
    if (xb) {
      const low0 = this.rdr.tier === 'low';
      xb.classList.toggle('on', !low0); xb.textContent = low0 ? '⚡' : '✨';
      xb.title = low0 ? 'Качество: ⚡ Плавно (Low) — нажми для Красиво (High)' : 'Качество: ✨ Красиво (High) — нажми для Плавно (Low), если тормозит';
      xb.onclick = () => { const t = Quality.toggleTier(); sfx('click'); this.toasts.show('Качество: ' + (t === 'low' ? '⚡ Плавно (Low)' : '✨ Красиво (High)') + ' — перезапуск…', { gold: true }); setTimeout(() => location.reload(), 700); };
    }
    const rb = document.getElementById('restartBtn');
    if (rb) rb.onclick = () => this.restart();
    const pb = document.getElementById('portalBtn');
    if (pb) pb.onclick = () => this._portalMenu();
    const vb = document.getElementById('valorBtn');
    if (vb) vb.onclick = () => this._metaShop();
    const trb = document.getElementById('tradeBtn');
    if (trb) trb.onclick = () => this._tradePanel();
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
    const r = BuildSys.placeBuilding(this.state, this.buildKind, tile.x, tile.y, this.ctx, { rotation: this._buildRot || 0 });
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

  // cx,cy (экранные px) переданы только с тача — тогда, если точный райкаст промазал, пробуем с запасом радиуса
  // (палец толще курсора мыши; так тап-цели юнитов/ресурсов эффективно крупнее)
  _entUnder(cx, cy) {
    const list = this._pickables(), fields = Object.values(this.state.fields);
    const exact = this.picker.entityUnder(this.camera, list, fields);
    if (exact || cx === undefined) return exact;
    return this.picker.entityUnderNear(this.camera, list, fields, cx, cy, 22);
  }

  // ТАЧ-управление: тап = выбор/постройка; двойной тап (или взведённый 🎯 ПРИКАЗ) = команда;
  // 1 палец drag = пан; 2 пальца — щипок = зум, твист = поворот камеры
  _touchInput() {
    const cv = this.canvas, R = this.cameraRig;
    let sx = 0, sy = 0, lx = 0, ly = 0, t0 = 0, moved = false, pinch = false, pinchD = 0, pinchA = 0;
    let lastTap = null;   // { t, x, y } — для двойного тапа
    const dist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
    const angle = (ts) => Math.atan2(ts[1].clientY - ts[0].clientY, ts[1].clientX - ts[0].clientX);
    cv.addEventListener('touchstart', (e) => {
      resumeAudio();
      if (e.touches.length === 1) {
        const t = e.touches[0]; sx = lx = t.clientX; sy = ly = t.clientY; t0 = performance.now(); moved = false; pinch = false;
      } else if (e.touches.length >= 2) { pinch = true; pinchD = dist(e.touches); pinchA = angle(e.touches); }
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (pinch && e.touches.length >= 2) {
        const d = dist(e.touches), a = angle(e.touches);
        if (pinchD > 0 && d > 0) R.zoomBy(pinchD / d);
        let da = a - pinchA; if (da > Math.PI) da -= Math.PI * 2; else if (da < -Math.PI) da += Math.PI * 2;
        R.rotateBy(-da);
        pinchD = d; pinchA = a;
        return;
      }
      if (e.touches.length === 1) {
        const t = e.touches[0], dx = t.clientX - lx, dy = t.clientY - ly; lx = t.clientX; ly = t.clientY;
        if (!moved && (Math.abs(t.clientX - sx) > 9 || Math.abs(t.clientY - sy) > 9)) moved = true;
        if (moved) R.panDrag(dx, dy);
      }
    }, { passive: false });
    cv.addEventListener('touchend', (e) => {
      if (!moved && !pinch && (performance.now() - t0) < 420) {   // короткий тап
        this.picker.setFromEvent({ clientX: sx, clientY: sy });
        const now = performance.now();
        if (this._orderPending) {                                  // взведён 🎯 ПРИКАЗ → команда сразу
          this._orderPending = false; this._command(sx, sy); this._syncOrderBtn(); lastTap = null;
        } else {
          const dbl = lastTap && (now - lastTap.t < 320) && Math.hypot(sx - lastTap.x, sy - lastTap.y) < 40;
          if (dbl && lastTap.sel) {   // двойной тап по цели → команда юниту, что был выбран ДО этого тапа
            this.state.selected = lastTap.sel;   // первый тап пары мог его переселектить/сбросить — вернём
            this._command(sx, sy); lastTap = null;
          } else {
            const selBefore = this.state.selected;
            if (this.buildKind) { this.placing = true; this._placeAt(); this.placing = false; }
            else this._select(sx, sy);
            lastTap = { t: now, x: sx, y: sy, sel: (selBefore && selBefore.type === 'unit' && selBefore.faction === 'ours') ? selBefore : null };
          }
        }
      }
      if (e.touches.length === 0) { pinch = false; moved = false; }
    }, { passive: false });
    cv.addEventListener('touchcancel', () => { pinch = false; moved = false; });
  }

  // ЛКМ / тап — только выбор
  _select(cx, cy) {
    const ent = this._entUnder(cx, cy);
    this.state.selected = ent || null;
    if (ent) {
      sfx('click');
      if (ent.type === 'unit' && ent.faction === 'ours') this.float(ent.x, ent.z, bark('select'), '#ffe8b5', 1.4);
    }
  }

  // ПКМ / 🎯 ПРИКАЗ / двойной тап — команда выбранному своему юниту (двигаться / рубить / в атаку)
  _command(cx, cy) {
    const sel = this.state.selected;
    if (!(sel && sel.type === 'unit' && sel.faction === 'ours')) return;
    const ent = this._entUnder(cx, cy);
    // рубить ресурс (для добытчика)
    if (ent && ent.type === 'node' && sel.def.worker) {
      sel.huntId = null; sel.job = ent.id; sel.jobType = ent.resType; sel.manualIdle = false; sel.moveOrder = null; sel.path = null; sel.state = 'toNode';
      sfx('click'); this.float(sel.x, sel.z, 'Иду рубить!', '#9effd0', 1.4);
      { const w = this.state.grid.gridToWorld(ent.gx, ent.gy); this.orderRipple(w.wx, w.wz, 0x9effd0); } return;
    }
    // охота на зверя (любой свой юнит)
    if (ent && ent.type === 'animal') {
      sel.huntId = ent.id; sel.moveOrder = null; sel.path = null; sel._huntTx = null;
      if (sel.def.worker) { sel.job = null; sel.manualIdle = true; }
      sfx('click'); this.float(sel.x, sel.z, 'На охоту! ' + ent.def.icon, '#ffe08a', 1.4);
      this.orderRipple(ent.x, ent.z, 0xffe08a); return;
    }
    // в атаку на врага (для воина)
    if (ent && ent.type === 'unit' && ent.faction === 'enemy' && !sel.def.worker) {
      const g = this.state.grid.worldToGrid(ent.x, ent.z);
      sel.huntId = null; sel.moveOrder = { x: g.x, y: g.y }; sel.path = null;
      sfx('click'); this.float(sel.x, sel.z, 'В атаку!', '#ff8a8a', 1.4);
      this.orderRipple(ent.x, ent.z, 0xff6a6a); return;
    }
    // снести вражий стан (для воина)
    if (ent && ent.type === 'camp' && !sel.def.worker) {
      sel.huntId = null; sel.targetCampId = ent.id; sel.moveOrder = null; sel.path = null;
      sfx('click'); this.float(sel.x, sel.z, 'Снести стан!', '#ff8a8a', 1.4);
      this.orderRipple(ent.cx, ent.cz, 0xff6a6a); return;
    }
    // идти на указанную точку (любой свой юнит — куда скажешь)
    const t = this.picker.tileUnder(this.camera, this.state.grid);
    if (t) {
      sel.huntId = null; sel.moveOrder = { x: t.x, y: t.y }; sel.path = null;
      if (sel.def.worker) { sel.job = null; sel.manualIdle = true; }
      sfx('click'); this.float(sel.x, sel.z, 'Идём!', '#9effd0', 1.4);
      { const w = this.state.grid.gridToWorld(t.x, t.y); this.orderRipple(w.wx, w.wz, 0x9effd0); }
    }
  }

  enterBuild(kind) { this.buildKind = kind; this.state.selected = null; this._orderPending = false; sfx('click'); }

  // взвести/снять 🎯 ПРИКАЗ (кнопка в панели выбора) — следующий тап/клик станет командой (замена ПКМ на тач)
  _armOrder() {
    const sel = this.state.selected;
    if (!(sel && sel.type === 'unit' && sel.faction === 'ours')) return;
    this._orderPending = !this._orderPending;
    sfx('click');
    if (this._orderPending) this.toasts.show('🎯 Укажи цель на карте — идти / рубить / охотиться / в атаку', { gold: true });
    this._syncOrderBtn();
  }
  _syncOrderBtn() {
    const b = this.selUI.el.querySelector('.ord-btn');
    if (b) b.classList.toggle('armed', !!this._orderPending);
  }
  train(b, uk) { BuildSys.queueTrain(this.state, b, uk, this.ctx); }
  toggleEdictUI(key) { toggleEdict(this.state, key, this.ctx); }
  setStance(u, st) { u.stance = st; u.path = null; u.moveOrder = null; sfx('click'); }
  research(key) { Research.buy(this.state, key, this.ctx); this.researchUI.refresh(); this.menu.update(); this.hud.update(); }

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

  // всплывающее число урона/лечения над целью (бюджет за кадр против DOM-спама)
  dmgNumber(target, amt, kind) {
    if (this._fltCount > 8) return;
    const x = target.x ?? target.cx, z = target.z ?? target.cz;
    if (x === undefined) return;
    const n = Math.max(1, Math.round(amt));
    const col = kind === 'heal' ? '#7dffa0'
      : (target.faction === 'ours' || target.type === 'building') ? '#ff7a6b' : '#ffe24a';
    const gy = (this.state.grid.heightAt ? this.state.grid.heightAt(x, z) : 0) + 1.25;
    this._fltCount++;
    this.float(x + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5, (kind === 'heal' ? '+' : '−') + n, col, gy);
  }

  // анимированное кольцо под выбранной сущностью (пульс + вращение, цвет по типу)
  _updateSelRing(alpha, now) {
    const sel = this.state.selected;
    if (!sel || sel.hp === 0) { if (this._selRing) this._selRing.visible = false; return; }
    if (!this._selRing) {
      const geo = new THREE.RingGeometry(0.5, 0.62, 40);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      this._selRing = new THREE.Mesh(geo, mat);
      this._selRing.rotation.x = -Math.PI / 2; this._selRing.renderOrder = 5;
      this.scene.add(this._selRing);
    }
    const r = this._selRing;
    let x, z, rad = 0.8, col = 0xffd24a;
    if (sel.type === 'unit' || sel.type === 'animal') {
      x = sel.px + (sel.x - sel.px) * alpha; z = sel.pz + (sel.z - sel.pz) * alpha;
      rad = sel.type === 'animal' ? 1.0 : 0.85;
      col = sel.faction === 'enemy' ? 0xff5050 : (sel.type === 'animal' ? 0xffe08a : 0xffd24a);
    } else if (sel.type === 'building' || sel.type === 'camp') {
      x = sel.cx; z = sel.cz; rad = Math.max(sel.w || 2, sel.h || 2) * 0.78;
      col = sel.type === 'camp' ? 0xff5050 : 0xffd24a;
    } else if (sel.type === 'node') {
      const w = this.state.grid.gridToWorld(sel.gx, sel.gy); x = w.wx; z = w.wz; rad = 0.7; col = 0x66e0ff;
    } else { r.visible = false; return; }
    const gy = this.state.grid.heightAt(x, z);
    r.position.set(x, gy + 0.07, z);
    r.scale.setScalar(rad * (1 + Math.sin(now * 0.006) * 0.07));
    r.rotation.z = now * 0.0011;
    r.material.color.setHex(col);
    r.visible = true;
  }

  // расходящееся кольцо-подтверждение команды (на земле под точкой приказа)
  orderRipple(wx, wz, color = 0x9effd0) {
    if (!this._ripGeo) this._ripGeo = new THREE.RingGeometry(0.16, 0.3, 28);
    const m = new THREE.Mesh(this._ripGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.rotation.x = -Math.PI / 2;
    const gy = this.state.grid.heightAt(wx, wz);
    m.position.set(wx, gy + 0.09, wz); m.renderOrder = 6;
    this.scene.add(m); this._ripples.push({ m, t: 0 });
  }
  updateRipples(fdt) {
    for (let i = this._ripples.length - 1; i >= 0; i--) {
      const r = this._ripples[i]; r.t += fdt; const k = r.t / 0.55;
      if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); this._ripples.splice(i, 1); continue; }
      r.m.scale.setScalar(0.5 + k * 3.6);
      r.m.material.opacity = 0.9 * (1 - k);
    }
  }

  // низкополигональный караван (верблюд + повозка) — оживляет мир, периодически пересекает карту
  _caravanMesh() {
    const g = new THREE.Group();
    const M = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
    const brown = M(0x9a7850), dk = M(0x5a4630), cloth = M(0xb83c3c);
    const box = (w, h, d, m, x, y, z) => { const e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); e.position.set(x, y, z); return e; };
    const sph = (r, m, x, y, z) => { const e = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), m); e.position.set(x, y, z); return e; };
    const cyl = (r, h, m, x, y, z) => { const e = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), m); e.position.set(x, y, z); return e; };
    g.add(box(0.45, 0.4, 1.0, brown, 0, 0.7, 0));                                            // тело верблюда
    g.add(sph(0.17, brown, 0, 0.95, -0.18)); g.add(sph(0.17, brown, 0, 0.95, 0.18));         // горбы
    g.add(box(0.16, 0.5, 0.16, brown, 0, 0.9, 0.58)); g.add(sph(0.13, brown, 0, 1.15, 0.66)); // шея+голова
    for (const [x, z] of [[-0.16, -0.32], [0.16, -0.32], [-0.16, 0.32], [0.16, 0.32]]) g.add(cyl(0.05, 0.5, dk, x, 0.28, z));
    g.add(box(0.7, 0.4, 0.7, dk, 0, 0.45, -1.1)); g.add(box(0.76, 0.34, 0.76, cloth, 0, 0.78, -1.1)); // повозка + тюк
    for (const x of [-0.38, 0.38]) { const w = cyl(0.18, 0.08, dk, x, 0.2, -1.1); w.rotation.z = Math.PI / 2; g.add(w); }   // колёса
    g.scale.setScalar(0.95);
    return g;
  }
  _updateCaravan(fdt) {
    const c = this._caravan;
    if (!c) {
      this._caravanT = (this._caravanT == null ? 45 : this._caravanT) - fdt;
      if (this._caravanT > 0) return;
      this._caravanT = 75 + Math.random() * 70;
      if (!this._caravanObj) this._caravanObj = this._caravanMesh();
      const half = this.state.grid.n / 2 - 2, horiz = Math.random() < 0.5, off = () => (Math.random() - 0.5) * half * 1.3;
      const a = horiz ? { x: -half, z: off() } : { x: off(), z: -half };
      const b = horiz ? { x: half, z: off() } : { x: off(), z: half };
      this._caravan = { m: this._caravanObj, a, b, t: 0, dur: 30 + Math.random() * 12 };
      this.scene.add(this._caravanObj);
      return;
    }
    c.t += fdt;
    const k = c.t / c.dur;
    if (k >= 1) {
      this.scene.remove(c.m); this._caravan = null;
      const reward = 25 + Math.floor(Math.random() * 20);
      this.state.gain({ gold: reward });
      this.toasts.show('🐫 Караван прошёл державу — торговля +' + reward + ' 🪙', { gold: true });
      return;
    }
    const x = c.a.x + (c.b.x - c.a.x) * k, z = c.a.z + (c.b.z - c.a.z) * k;
    c.m.position.set(x, this.state.grid.heightAt(x, z), z);
    c.m.rotation.y = Math.atan2(c.b.x - c.a.x, c.b.z - c.a.z);
  }

  // подсказки новичку — серия тостов на первой партии (гейт по localStorage, один раз)
  _maybeTutorial() {
    let done = false;
    try { done = localStorage.getItem('GOYDA_TUT') === '1'; } catch (e) {}
    if (done) return;
    try { localStorage.setItem('GOYDA_TUT', '1'); } catch (e) {}
    const tips = [
      ['👋 Добро пожаловать в ГОЙДА-ИМПЕРИЮ! Веди державу к пробуждению идола ДРОН.', 1],
      ['🖱️ ЛКМ — выбрать. ПКМ — приказ: идти / рубить / в атаку.', 6],
      ['🏗️ Снизу — меню построек: ИЗБЫ (жильё), АМБАР/ФЕРМА (еда), КАЗАРМА (войско).', 12],
      ['🌳 Холопы добывают ресурс — ПКМ по дереву/камню/золоту. Копи и развивайся!', 18],
      ['⚔️ Волнами идут набеги — ставь ЧАСТОКОЛ и тренируй воинов. ГОЙДА!', 24],
    ];
    for (const [t, d] of tips) setTimeout(() => { if (!this.state.gameOver) this.toasts.show(t, { big: true, gold: true }); }, d * 1000);
  }

  // скорость игры / пауза (P, 1/2/3) — QoL для менеджмента; рендер/музыка идут в реальном времени
  _setSpeed(s) {
    this.loop.speed = s;
    if (s > 0) this._lastSpeed = s;
    this.toasts.show(s === 0 ? '⏸️ Пауза — P продолжить' : '⏩ Скорость ×' + s, {});
    sfx('click');
  }

  // трекер целей: текущая задача игрока (ведёт новичка, показывает прогресс)
  _currentObjective() {
    const s = this.state;
    const has = k => s.buildings.some(b => b.kind === k);
    const workers = s.units.filter(u => u.faction === 'ours' && u.def.worker).length;
    const soldiers = s.units.filter(u => u.faction === 'ours' && !u.def.worker).length;
    if (!has('izba')) return '🏠 Построй ИЗБУ — жильё для народа';
    if (!has('ambar') && !has('ferma')) return '🌾 Построй АМБАР или ФЕРМУ — еда';
    if (workers < 3) return '🧑‍🌾 Натренируй ХОЛОПов: ' + workers + '/3';
    if (!has('kazarma')) return '⚔️ Построй КАЗАРМУ — куй дружину';
    if (soldiers < 5) return '🛡️ Собери дружину: ' + soldiers + '/5';
    if (s.rankIndex < 2) return '📈 Дорасти до ранга ' + ((RANKS[2] && RANKS[2].name) || '2');
    if (s._hadCamps && s.camps.length > 0) return '🏴 Снеси вражьи станы — осталось ' + s.camps.length;
    if (!s.idol) return '🗿 Заложи ЧУДО (идол ДРОН) или снеси все станы — ПОБЕДА';
    return '🗿 Дострой ЧУДО — пробуди ДРОНА!';
  }
  _updateObjective() {
    if (!this._objEl) {
      const e = document.createElement('div'); e.id = 'objective';
      e.style.cssText = 'position:fixed;left:10px;top:54px;z-index:40;background:rgba(20,14,8,.82);border:1px solid #c8922e;border-left:3px solid #ffcc44;border-radius:7px;padding:5px 10px;color:#f0e3c8;font-size:12px;max-width:46vw;pointer-events:none;box-shadow:0 3px 12px rgba(0,0,0,.4)';
      document.getElementById('hud').appendChild(e); this._objEl = e;
    }
    if (this.state.gameOver) { this._objEl.style.display = 'none'; return; }
    this._objEl.style.display = 'block';
    const t = '🎯 ' + this._currentObjective();
    if (this._objEl.textContent !== t) this._objEl.textContent = t;
  }

  // сезон партии — мягкий сдвиг цветокоррекции (тепло/насыщенность) + тост; вариативность между играми
  _applySeason() {
    const S = {
      summer: { w: 0.005, s: 0.06, name: '☀️ Лето' },
      autumn: { w: 0.014, s: 0.0, name: '🍂 Осень' },
      winter: { w: -0.012, s: -0.13, name: '❄️ Зима' },
      spring: { w: 0.002, s: 0.05, name: '🌸 Весна' },
    }[this._season] || { w: 0, s: 0, name: '' };
    const g = this.rdr.grade.uniforms;
    g.warmth.value = 0.016 + S.w;
    g.saturation.value = 1.18 + S.s;
    if (S.name) this.toasts.show(S.name + ' в державе', { gold: true });
  }

  // событие-выбор: модалка с вариантами + таймер авто-решения (по истечении — последний/отказ)
  choiceEvent(ev) {
    if (this._evtEl) { this._evtEl.remove(); this._evtEl = null; cancelAnimationFrame(this._evtRaf); }
    sfx('rankup');
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;top:74px;transform:translateX(-50%);z-index:60;background:linear-gradient(180deg,#231a12,#150e07);border:2px solid #c8922e;border-radius:12px;padding:12px 16px;max-width:460px;box-shadow:0 10px 34px rgba(0,0,0,.6);color:#f0e3c8;text-align:center;font-size:14px';
    const btns = ev.choices.map((c, i) => `<button data-i="${i}" style="margin:4px;padding:8px 13px;border-radius:8px;border:1px solid #c8922e;background:#2c2113;color:#ffe6a8;cursor:pointer;font:inherit">${c.lbl}</button>`).join('');
    el.innerHTML = `<div style="font-size:17px;font-weight:700;margin-bottom:3px">${ev.t}</div><div style="opacity:.85;margin-bottom:9px">${ev.m}</div><div>${btns}</div><div class="evt-bar" style="height:3px;background:#c8922e;margin-top:9px;border-radius:2px;width:100%"></div>`;
    document.getElementById('app').appendChild(el);
    this._evtEl = el;
    const resolve = (i) => {
      if (!this._evtEl) return;
      cancelAnimationFrame(this._evtRaf);
      const c = ev.choices[i] || ev.choices[ev.choices.length - 1];
      try { c.f(this.state); } catch (e) {}
      this.toasts.show(ev.t + ' — ' + (c.msg || c.lbl), { gold: true });
      sfx('click');
      el.remove(); this._evtEl = null;
    };
    el.querySelectorAll('button').forEach(b => b.onclick = () => resolve(+b.dataset.i));
    const dur = 16000, t0 = performance.now(), bar = el.querySelector('.evt-bar');
    const tick = () => {
      if (!this._evtEl) return;
      const k = Math.min(1, (performance.now() - t0) / dur);
      bar.style.width = (100 - k * 100) + '%';
      if (k >= 1) { resolve(ev.choices.length - 1); return; }   // авто-решение = отказ
      this._evtRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  // снаряд: летит к цели, наносит урон по прилёту. opt.arrow=стрела (ориентируется по полёту), иначе шар-сгусток
  // ---------- ПОРТАЛ ДРОНА: прыжок на новую Землю (перенос ресурсов+ранга+дружины) ----------
  _portalMenu() {
    if (this.state.gameOver || this._portalEl) return;
    sfx('edict');
    const wasSpeed = this.loop.speed; this._setSpeed(0);                 // пауза на время выбора
    const cur = this.state.mapKey;
    const dests = MAPS.filter(m => m.key !== cur);
    const army = this.state.units.filter(u => u.faction === 'ours').length;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:120;background:linear-gradient(180deg,#1b1430,#0e0820);border:2px solid #9a5cff;border-radius:14px;padding:16px 18px;max-width:440px;width:88%;box-shadow:0 14px 50px rgba(60,10,140,.6);color:#ece0ff;text-align:center;font-size:14px';
    const rows = dests.map(m => `<button data-k="${m.key}" style="display:block;width:100%;margin:5px 0;padding:9px 12px;border-radius:9px;border:1px solid #7a4ad0;background:#241840;color:#f0e6ff;cursor:pointer;font:inherit;text-align:left">${m.emoji} <b>${m.name}</b> <span style="opacity:.7">— ${m.desc}</span></button>`).join('');
    el.innerHTML = '<div style="font-size:19px;font-weight:800;margin-bottom:4px">🌀 Портал Дрона</div>'
      + '<div style="opacity:.85;margin-bottom:10px">Прыжок на новую Землю. Переносишь <b>ресурсы, ранг и дружину</b> (' + army + ' ед., ветеранство сохранится). Постройки остаются здесь — базу ставишь заново.</div>'
      + '<button data-k="__arena" style="display:block;width:100%;margin:0 0 9px;padding:11px 12px;border-radius:9px;border:2px solid #ff5cf0;background:linear-gradient(135deg,#3a0e2e,#1a0820);color:#ffd6f4;cursor:pointer;font:inherit;font-weight:800">⚔️ В КАРТОЧНУЮ АРЕНУ ГОЙДЫ <span style="opacity:.8;font-weight:400">— бой картами в мире «Гойды» (поход сохранится)</span></button>'
      + '<div style="opacity:.6;font-size:12px;margin:2px 0 6px">…или прыжок на новую Землю:</div>'
      + rows
      + '<button data-k="__rand" style="display:block;width:100%;margin:5px 0;padding:9px 12px;border-radius:9px;border:1px solid #c8922e;background:#2c2113;color:#ffe6a8;cursor:pointer;font:inherit">🎲 Случайная Земля</button>'
      + '<button data-k="__cancel" style="margin-top:8px;padding:7px 16px;border-radius:8px;border:1px solid #555;background:#1a1626;color:#cbb8e8;cursor:pointer;font:inherit">Отмена</button>';
    document.getElementById('app').appendChild(el);
    this._portalEl = el;
    const close = () => { if (this._portalEl) { this._portalEl.remove(); this._portalEl = null; } this._setSpeed(wasSpeed || 1); };
    el.querySelectorAll('button').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (k === '__cancel') { sfx('click'); close(); return; }
      if (k === '__arena') { this._portalEl.remove(); this._portalEl = null; this._toArena(); return; }
      let dest = k;
      if (k === '__rand') dest = dests[Math.floor(Math.random() * dests.length)].key;
      this._portalEl.remove(); this._portalEl = null;
      this._doPortal(dest);
    });
  }

  // мост в карточную «ГОЙДУ»: сохраняем поход, кладём контекст, прыгаем порталом в корневую игру
  _toArena() {
    const s = this.state;
    try { s.save(); } catch (e) {}                       // RTS-поход сохранится — вернёшься тем же
    const army = s.units.filter(u => u.faction === 'ours').length;
    const bridge = { from: 'empire', day: Math.floor(s.day || 0), rankIndex: s.rankIndex || 0, depth: s.portalDepth || 1, army, gold: Math.round(s.resources.gold || 0) };
    try { localStorage.setItem('GOYDA_BRIDGE', JSON.stringify(bridge)); } catch (e) {}
    // метка вылазки: запоминаем победы карточной, чтобы на возврате наградить за прирост (петля награды)
    let cardWins = 0; try { const st = JSON.parse(localStorage.getItem('goyda_stats_v1')); cardWins = (st && st.wins) || 0; } catch (e) {}
    try { localStorage.setItem('GOYDA_ARENA_TRIP', JSON.stringify({ cardWins })); } catch (e) {}
    this._portalSwirl(() => { location.href = '../'; });
  }

  // возврат из карточной арены: награда за прирост побед, пока был там (обе игры делят localStorage)
  _checkArenaReturn() {
    let trip = null; try { trip = JSON.parse(localStorage.getItem('GOYDA_ARENA_TRIP')); } catch (e) {}
    if (!trip) return;
    try { localStorage.removeItem('GOYDA_ARENA_TRIP'); } catch (e) {}
    let wins = 0; try { const st = JSON.parse(localStorage.getItem('goyda_stats_v1')); wins = (st && st.wins) || 0; } catch (e) {}
    const delta = Math.max(0, wins - (trip.cardWins || 0));
    this._arenaReturn = { delta };
    if (delta > 0) this.state.gain({ gold: delta * 30, faith: delta * 16, food: delta * 20 });
  }

  _doPortal(destKey) {
    const s = this.state;
    const army = s.units.filter(u => u.faction === 'ours').map(u => ({ kind: u.kind, hp: Math.round(u.hp), maxHp: u.maxHp, vet: u.vet || 0, kills: u.kills || 0 }));
    const payload = {
      faction: s.faction ? s.faction.key : 'goyda', mapKey: destKey,
      res: s.resources, rankIndex: s.rankIndex, day: s.day, happiness: s.happiness,
      army, depth: (s.portalDepth || 1) + 1,
    };
    try { localStorage.setItem('GOYDA_EMPIRE_PORTAL', JSON.stringify(payload)); } catch (e) {}
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}          // обычный сейв не должен перехватить boot
    this._portalSwirl(() => location.reload());
  }

  // воронка раскрывается на весь экран → reload (новый мир грузится под прикрытием)
  _portalSwirl(done) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;overflow:hidden;background:rgba(10,2,24,0);transition:background .5s';
    const core = document.createElement('div');
    core.style.cssText = 'position:absolute;left:50%;top:50%;width:14px;height:14px;border-radius:50%;transform:translate(-50%,-50%);background:conic-gradient(from 0deg,#ff5cf0,#7a30ff,#28d0ff,#9cff5c,#ff5cf0);box-shadow:0 0 80px 30px #7a30ff';
    ov.appendChild(core); document.body.appendChild(ov);
    sfx('super');
    requestAnimationFrame(() => { ov.style.background = 'rgba(10,2,24,.45)'; });
    const t0 = performance.now(), dur = 1150;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const sc = 1 + k * k * 240;
      core.style.transform = 'translate(-50%,-50%) scale(' + sc + ') rotate(' + (k * 1000) + 'deg)';
      core.style.filter = 'blur(' + (1 + k * 5) + 'px) hue-rotate(' + (k * 360) + 'deg)';
      if (k >= 1) { done && done(); return; }
      requestAnimationFrame(tick);
    };
    tick();
  }

  // прибытие: непрозрачный портальный оверлей гаснет, открывая новый мир
  _portalArrivalFx() {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;background:radial-gradient(circle at 50% 50%,#9a5cff 0%,#3a1080 42%,#0e0820 100%);opacity:1;transition:opacity 1s ease-out';
    document.body.appendChild(ov);
    requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.opacity = '0'; }));
    setTimeout(() => ov.remove(), 1200);
  }

  spawnTracer(u, t, opt = {}) {
    let m;
    if (opt.arrow) {
      if (!this._arrowGeo) { this._arrowGeo = new THREE.CylinderGeometry(0.04, 0.012, 0.62, 5); this._arrowGeo.rotateX(Math.PI / 2); }   // длинная ось → +Z
      m = new THREE.Mesh(this._arrowGeo, new THREE.MeshBasicMaterial({ color: opt.color || 0xffe08a }));
    } else {
      if (!this._tracerGeo) this._tracerGeo = new THREE.SphereGeometry(0.14, 6, 5);
      m = new THREE.Mesh(this._tracerGeo, new THREE.MeshBasicMaterial({ color: opt.color || 0xff5cf0 }));
    }
    m.position.set(u.x, this.state.grid.heightAt(u.x, u.z) + 0.6, u.z);
    this.scene.add(m);
    this.tracers.push({ m, target: t, dmg: opt.dmg ?? u.dmg, speed: opt.speed || 16, arrow: !!opt.arrow, owner: opt.owner });
  }
  updateTracers(fdt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i], t = tr.target;
      const tx = t.x ?? t.cx, tz = t.z ?? t.cz;
      if (!t || (t.hp ?? 0) <= 0 || tx === undefined) { this.scene.remove(tr.m); this.tracers.splice(i, 1); continue; }
      const ty = this.state.grid.heightAt(tx, tz) + 0.5;
      const dx = tx - tr.m.position.x, dy = ty - tr.m.position.y, dz = tz - tr.m.position.z;
      const d = Math.hypot(dx, dy, dz), step = tr.speed * fdt;
      if (d <= step + 0.4) { damage(this.state, t, tr.dmg, this.ctx, tr.owner); this.scene.remove(tr.m); this.tracers.splice(i, 1); }
      else { tr.m.position.set(tr.m.position.x + dx / d * step, tr.m.position.y + dy / d * step, tr.m.position.z + dz / d * step); if (tr.arrow) tr.m.lookAt(tx, ty, tz); }
    }
  }

  end(kind) {
    if (this.state.gameOver) return;
    this.state.gameOver = kind;
    const ov = document.getElementById('overlay');
    sfx(kind === 'win' ? 'win' : 'lose');
    try { this.music && (kind === 'win' ? this.music.victory() : this.music.defeat()); } catch (e) {}
    let metaLine = '';
    try { const r = Meta.award(this.state, kind); metaLine = `<p style="opacity:.85">⭐ +${r.gain} Доблести (всего ${r.valor}) — бонусы следующей кампании</p>`; } catch (e) {}
    const S = this.state, st = S.stats || {};   // Сводка похода
    const summary = `<div id="runsummary" style="margin:10px auto;max-width:330px;display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;font-size:13px;opacity:.92;text-align:left">`
      + `<span>📅 Дней: <b>${Math.floor(S.day || 0)}</b></span><span>🌀 Земля №<b>${S.portalDepth || 1}</b></span>`
      + `<span>🌊 Набегов: <b>${S.waveNum || 0}</b></span><span>💀 Повержено: <b>${st.slain || 0}</b></span>`
      + `<span>🏴 Станов: <b>${st.camps || 0}</b></span><span>⭐ Ветеранов: <b>${st.vets || 0}</b></span></div>`;
    if (kind === 'win') {
      this.state.rankIndex = RANKS.length - 1;
      try { localStorage.removeItem('GOYDA_EMPIRE_SAVE_v1'); } catch (e) {}
      ov.innerHTML = `<div class="end win"><h1>🌟 АБСОЛЮТ ГОЙДЫ 🌟</h1><p>Идол ДРОН пробуждён. ${bark('win')}</p>${summary}${metaLine}<button onclick="location.reload()">ВНОВЬ ГОЙДАТЬ</button></div>`;
    } else {
      ov.innerHTML = `<div class="end lose"><h1>💀 ПАЛАТЫ ПАЛИ 💀</h1><p>${bark('lose')} Держава пала на ${this.state.day}-й день.</p>${summary}${metaLine}<button onclick="(function(){try{localStorage.removeItem('GOYDA_EMPIRE_SAVE_v1')}catch(e){}location.reload()})()">НОВЫЙ ПОХОД</button></div>`;
    }
    ov.style.display = 'flex';
    try { this.leaderboard.onGameEnd(kind); } catch (e) { console.warn('leaderboard', e); }   // итог → онлайн-таблица
  }

  // ---------- симуляция ----------
  tick(dt) {
    if (this.state.gameOver) return;
    if (this._hitStop > 0) return;          // hit-pause: рендер живёт (тряска), сим заморожен
    Economy.update(this.state, dt, this.ctx);
    BuildSys.update(this.state, dt, this.ctx);
    updateUnits(this.state, dt, this.ctx);
    Waves.update(this.state, dt, this.ctx);
    Tech.update(this.state, dt, this.ctx);
    Nature.update(this.state, dt, this.ctx);
    Relics.update(this.state, dt, this.ctx);
    Camps.update(this.state, dt, this.ctx);
    Wildlife.update(this.state, dt, this.ctx);
    Events.update(this.state, dt, this.ctx);   // случайные события мира
    Achievements.update(this.state, dt, this.ctx);   // вехи-достижения
    // 2-е условие победы: КОНКВЕСТ — снести ВСЕ вражьи станы (альтернатива чуду-идолу)
    if (!this.state.gameOver) {
      if (this.state.camps.length) this.state._hadCamps = true;
      else if (this.state._hadCamps && Math.floor(this.state.day) >= 8) {
        this.toasts.show('🏴 Все вражьи станы снесены — ПОБЕДА ЗАВОЕВАНИЕМ!', { gold: true, big: true });
        this.end('win');
      }
    }
  }

  // мягкая тень-пятно под объектом (пул, ленивое создание ресурсов)
  _blobShadow(i, pool) {
    if (!this._blobGeo) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const cx = cv.getContext('2d'); const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(0.65, 'rgba(0,0,0,0.26)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
      this._blobTex = new THREE.CanvasTexture(cv);
      this._blobGeo = new THREE.PlaneGeometry(1, 1);
      this._blobMat = new THREE.MeshBasicMaterial({ map: this._blobTex, transparent: true, depthWrite: false, opacity: 0.55, fog: true });
    }
    if (!pool[i]) { const m = new THREE.Mesh(this._blobGeo, this._blobMat); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; this.scene.add(m); pool[i] = m; }
    return pool[i];
  }

  // шеврон-звёзды ★ над ветераном (billboard-спрайт; уровень = число звёзд)
  _vetMarker(i, level) {
    if (!this._vetTex) {
      this._vetTex = {};
      for (let lv = 1; lv <= 3; lv++) {
        const cv = document.createElement('canvas'); cv.width = 40 * lv; cv.height = 44;
        const cx = cv.getContext('2d');
        cx.font = 'bold 30px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        for (let s = 0; s < lv; s++) {
          const x = 20 + s * 40;
          cx.lineWidth = 5; cx.strokeStyle = 'rgba(30,14,0,0.92)'; cx.strokeText('★', x, 24);
          cx.fillStyle = '#ffd84a'; cx.fillText('★', x, 24);
        }
        const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.LinearFilter;
        this._vetTex[lv] = tex;
      }
    }
    if (!this._vetMarkers[i]) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, fog: false }));
      m.renderOrder = 6; this.scene.add(m); this._vetMarkers[i] = m;
    }
    const sp = this._vetMarkers[i], lv = Math.min(3, level);
    if (sp._lv !== lv) { sp.material.map = this._vetTex[lv]; sp.material.needsUpdate = true; sp.scale.set(0.3 * lv, 0.3, 1); sp._lv = lv; }
    return sp;
  }

  // ---------- рендер ----------
  render(alpha) {
    if (!this._rendered) { this._rendered = true; window.__gboot && window.__gboot('RENDERING ✓'); }
    const now = performance.now();
    let fdt = (now - this.lastRender) / 1000; if (fdt > 0.1) fdt = 0.1; this.lastRender = now;
    if (this._hitStop > 0) this._hitStop = Math.max(0, this._hitStop - fdt);   // hit-pause тает в реальном времени
    this._fltCount = 0;                                                        // сброс бюджета чисел урона за кадр
    if (this.rdr.grade && !this._seasonApplied) { this._applySeason(); this._seasonApplied = true; }   // тон сезона (когда composer готов)
    this.cameraRig.update(fdt);
    this.rdr.updateShadow(this.cameraRig.target.x, this.cameraRig.target.z);
    if (this.fog) this.fog.update(this.state, fdt);

    // интерполяция + анимация юнитов (рост/ходьба/выпад) + тень-пятно + пыль
    const units = this.state.units;
    for (let ui = 0; ui < units.length; ui++) {
      const u = units[ui], v = u.view;
      if (u.grow < 1) { u.grow = Math.min(1, u.grow + fdt * 3.5); v.scale.setScalar(u.growMax * (0.25 + 0.75 * u.grow)); u._vetApplied = false; }
      else if (!u._vetApplied) { v.scale.setScalar(u.growMax * (1 + 0.07 * (u.vet || 0))); u._vetApplied = true; }   // ветеран заметно крупнее
      if (!u._noCast) { v.traverse(o => { if (o.isMesh) o.castShadow = false; }); u._noCast = true; }   // тень даёт пятно, не shadow-map
      const ix = u.px + (u.x - u.px) * alpha, iz = u.pz + (u.z - u.pz) * alpha;
      const gy = this.state.grid.heightAt(ix, iz);
      const moving = Math.hypot(u.x - u.px, u.z - u.pz) > 0.0025;
      let bob = 0, fwd = 0;
      if (moving) bob = Math.abs(Math.sin(now * 0.016 + u.id * 1.7)) * 0.045;
      if (u.atkAnim > 0) { u.atkAnim -= fdt; fwd = Math.sin((1 - Math.max(0, u.atkAnim) / 0.2) * Math.PI) * 0.16; }
      v.position.set(ix + Math.sin(u.dir) * fwd, gy + bob, iz + Math.cos(u.dir) * fwd);
      v.rotation.y = u.dir || 0;
      let vis = true;
      if (u.faction === 'enemy') { const gp = this.state.grid.worldToGrid(u.x, u.z); const t = this.state.grid.get(gp.x, gp.y); vis = !this.fog || !this.fog.enabled || !t || t.visible; v.visible = vis; }
      const sh = this._blobShadow(ui, this._uShadows);
      sh.visible = vis; sh.position.set(ix, gy + 0.04, iz); const ss = (u.growMax || 1) * 0.78; sh.scale.set(ss, ss, ss);
      if (moving && vis) { u._dustT = (u._dustT || 0) - fdt; if (u._dustT <= 0) { this.atmo && this.atmo.spawnDust(ix, gy, iz); u._dustT = 0.26; } }
      if (u.faction === 'ours' && (u.vet || 0) > 0 && vis) {        // шеврон ветерана над головой
        const mk = this._vetMarker(ui, u.vet); mk.visible = true;
        mk.position.set(v.position.x, gy + bob + 1.05 * (u.growMax || 1) + 0.4, v.position.z);
      } else if (this._vetMarkers[ui]) this._vetMarkers[ui].visible = false;
    }
    for (let i = units.length; i < this._uShadows.length; i++) this._uShadows[i].visible = false;
    for (let i = units.length; i < this._vetMarkers.length; i++) this._vetMarkers[i].visible = false;
    // интерполяция дичи (бродит/убегает) + тень-пятно + прячем в тумане
    const animals = this.state.animals;
    for (let ai = 0; ai < animals.length; ai++) {
      const a = animals[ai], v = a.view;
      const ix = a.px + (a.x - a.px) * alpha, iz = a.pz + (a.z - a.pz) * alpha;
      const gy = this.state.grid.heightAt(ix, iz);
      const moving = Math.hypot(a.x - a.px, a.z - a.pz) > 0.0015;
      const bob = moving ? Math.abs(Math.sin(now * 0.02 + a.id * 1.3)) * 0.04 : 0;
      v.position.set(ix, gy + bob, iz);
      v.rotation.y = a.dir || 0;
      const gp = this.state.grid.worldToGrid(a.x, a.z); const t = this.state.grid.get(gp.x, gp.y);
      const vis = !this.fog || !this.fog.enabled || !t || t.visible; v.visible = vis;
      const sh = this._blobShadow(ai, this._aShadows);
      sh.visible = vis; sh.position.set(ix, gy + 0.04, iz); sh.scale.set(0.7, 0.7, 0.7);
    }
    for (let i = animals.length; i < this._aShadows.length; i++) this._aShadows[i].visible = false;
    // эффекты смерти (падение+уменьшение)
    for (let i = this.state.fx.length - 1; i >= 0; i--) {
      const f = this.state.fx[i]; f.life -= fdt;
      const t = 1 - Math.max(0, f.life) / f.max;
      if (f.kind === 'death') {
        if (!f._burst && this.atmo) { f._burst = true; this.atmo.burst(f.view.position.x, (f.y0 || 0) + 0.4, f.view.position.z, 0xff7744, 9); }
        f.view.rotation.z = t * 1.5; f.view.position.y = (f.y0 || 0) - t * 0.35; f.view.scale.multiplyScalar(0.965);
      }
      if (f.life <= 0) { this.scene.remove(f.view); this.state.fx.splice(i, 1); }
    }
    // пульс эмиссии идола
    if (this.state.idol) { const p = 1.4 + Math.sin(now * 0.005) * 0.9; this.state.idol.view.traverse(o => { if (o.isMesh && o.material && o.material.emissiveIntensity > 0) o.material.emissiveIntensity = p; }); }
    // живые идолы-реликвии: медленно вращаются + парят; кольцо ауры дышит и крутится
    for (const b of this.state.buildings) {
      if (!b.built || !b.def) continue;
      if (b.def.cat === 'relic') {
        b.view.rotation.y += fdt * 0.5;
        if (!(b._hit > 0)) b.view.position.y = (b.cy || 0) + Math.sin(now * 0.002 + b.cx) * 0.06;
      }
      if (b._ring) {
        b._ring.rotation.z += fdt * 0.35;
        b._ring.material.opacity = 0.14 + Math.abs(Math.sin(now * 0.003 + b.cx)) * 0.16;
        const sc = 1 + Math.sin(now * 0.004 + b.cz) * 0.02; b._ring.scale.set(sc, sc, 1);
      }
    }
    // ретровейв-солнце смотрит на камеру + лёгкий пульс
    if (this._neon) {
      this._neon.sun.quaternion.copy(this.camera.quaternion);
      this._neon.sun.scale.setScalar(1 + Math.sin(now * 0.0012) * 0.025);
    }
    // анимация водопадов/океана с края мира + рябь озёр
    if (this.worldBase && this.worldBase.update) this.worldBase.update(fdt);
    if (this.terrain && this.terrain.update) this.terrain.update(fdt);
    // суточный цикл день/ночь + погода (дождь/снег)
    if (this.sky) this.sky.update(fdt, this.cameraRig.target, this.map.key, now, this.camera);
    // фоновая музыка/окружение: ночь, тревога (набег), погода; гром на вспышке молнии
    if (this.music) {
      const night = this.sky ? 1 - (this.sky.day || 0) : 0.4;
      this.music.update(night, this.state.threatTimer > 0 ? 1 : 0, this.sky ? this.sky.weather : 'clear');
      const fl = this.sky ? this.sky._flash : 0;
      if (fl > 0.6 && (this._lastFlash || 0) <= 0.6) this.music.thunder();
      this._lastFlash = fl;
    }
    // атмосфера: дым/искры/птицы/облака/светлячки (ночь = 1-день; неон без цикла → лёгкие сумерки)
    if (this.atmo) this.atmo.update(fdt, now, this.state.buildings, this.cameraRig.target, this.sky ? 1 - (this.sky.day || 0) : 0.45);
    this._updateCaravan(fdt);   // торговый караван пересекает карту (жизнь + бонус золота)
    // дрожание зданий под уроном
    for (const b of this.state.buildings) {
      if (b._hit > 0) { b._hit -= fdt; const j = b._hit > 0 ? (Math.random() - 0.5) * 0.06 : 0; b.view.position.set(b.cx + j, b.cy || 0, b.cz + j); }
    }
    // анимация калитки: открывается, когда рядом свой юнит, иначе плавно закрывается
    for (const b of this.state.buildings) {
      if (b.kind !== 'gate' || !b.built) continue;
      let near = false;
      for (const u of this.state.units) { if (u.faction === 'ours' && Math.abs(u.x - b.cx) < 2 && Math.abs(u.z - b.cz) < 2) { near = true; break; } }
      b._gateOpen = Math.max(0, Math.min(1, (b._gateOpen || 0) + (near ? 1 : -1) * fdt * 3));
      const door = b.view.getObjectByName('gate_door');
      if (door) door.rotation.y = b._gateOpen * Math.PI * 0.62;
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
    this._updateSelRing(alpha, now);   // анимированное кольцо под выбранным
    this.updateRipples(fdt);           // кольца-подтверждения команд
    this.rdr.render(this.camera);

    this._uiT += fdt;
    if (this._uiT > 0.1) { this.hud.update(); this.menu.update(); this.selUI.update(); this._updateObjective(); this._uiT = 0; }
    this.minimap.update(fdt);
    this.updateTracers(fdt);
  }

  _updateHover() {
    const tile = this.picker.tileUnder(this.camera, this.state.grid);
    if (this.buildKind) {
      const d = BUILDINGS[this.buildKind];
      if (tile) {
        const ok = this.state.grid.canPlace(tile.x, tile.y, d.w, d.h, !!d.onWater) && this.state.canAfford(d.cost) && (d.rank || 0) <= this.state.rankIndex && (!d.requiresTech || (this.state.research && this.state.research.done[d.requiresTech]));
        if (!this._ghostModels[this.buildKind]) {
          const m = this.assets.get(d.model);
          m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; } });
          this._ghostModels[this.buildKind] = m;
        }
        this.terrain.setGhost(tile.x, tile.y, d.w, d.h, ok, this._ghostModels[this.buildKind]);
        const gm = this._ghostModels[this.buildKind]; if (gm) gm.rotation.y = (this._buildRot || 0) * Math.PI / 2;   // показываем поворот
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
