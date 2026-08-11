// ===== Профилировщик производительности: тик/рендер/FPS/draw calls, оверлей по F3 =====
// Подключается опционально в Loop (loop.profiler = ...) — при отсутствии профилировщика
// в Loop нет накладных расходов, кроме одной проверки на null.
import { reachSet } from '../sim/Waves.js?v=96';
import { UNITS } from '../data/units.js?v=94';
import { hostileFor } from '../data/factions.js?v=94';

const HIST = 30;      // скользящее среднее по 30 замерам
const UI_MS = 250;    // оверлей обновляется 4 раза в секунду, не каждый кадр

export class Profiler {
  constructor(renderer, state) {
    this.renderer = renderer;   // THREE.WebGLRenderer — источник renderer.info.render
    this.state = state;         // GameState — источник числа юнитов
    this.enabled = false;       // оверлей скрыт по умолчанию, переключается F3

    // кольцевые буферы без аллокаций в горячем пути
    this._tickBuf = new Float32Array(HIST); this._tickN = 0; this._tickI = 0; this._tickSum = 0;
    this._rendBuf = new Float32Array(HIST); this._rendN = 0; this._rendI = 0; this._rendSum = 0;
    this._t0 = 0;

    this.tickMs = 0; this.renderMs = 0; this.fps = 0;
    this.drawCalls = 0; this.triangles = 0; this.unitCount = 0;

    this._frames = 0; this._fpsLast = performance.now(); this._uiLast = this._fpsLast;

    this._el = null; this._mkOverlay();
    this._onKey = (e) => { if (e.code === 'F3') { e.preventDefault(); this.toggle(); } };
    window.addEventListener('keydown', this._onKey);

    // EffectComposer гоняет несколько внутренних renderer.render() за кадр (RenderPass, bloom,
    // tonemap, grade, tilt, SMAA) — каждый по умолчанию сбрасывает renderer.info.render в начале
    // своего вызова, поэтому без autoReset=false к концу composer.render() в info остаётся только
    // последний проход (полноэкранный треугольник SMAA — отсюда фантомные draws=1 tris=1).
    // Берём сброс на себя: сбрасываем вручную в beginRender(), читаем накопленное в конце кадра.
    if (this.renderer) this.renderer.info.autoReset = false;

    window.__profiler = this;   // ручной доступ из консоли: window.__profiler.snapshot()
  }

  toggle(force) {
    this.enabled = force !== undefined ? force : !this.enabled;
    if (this._el) this._el.style.display = this.enabled ? 'block' : 'none';
  }

  // ---- замеры (вызываются из Loop вокруг update()/render()) ----
  beginTick() { this._t0 = performance.now(); }
  endTick() {
    const ms = performance.now() - this._t0;
    const b = this._tickBuf, i = this._tickI;
    if (this._tickN < HIST) this._tickN++; else this._tickSum -= b[i];
    b[i] = ms; this._tickSum += ms; this._tickI = (i + 1) % HIST;
    this.tickMs = this._tickSum / this._tickN;
  }

  beginRender() { this._t0 = performance.now(); if (this.renderer) this.renderer.info.reset(); }
  endRender() {
    const ms = performance.now() - this._t0;
    const b = this._rendBuf, i = this._rendI;
    if (this._rendN < HIST) this._rendN++; else this._rendSum -= b[i];
    b[i] = ms; this._rendSum += ms; this._rendI = (i + 1) % HIST;
    this.renderMs = this._rendSum / this._rendN;
    this._onFrame();
  }

  // считаем реальные кадры и обновляем «дешёвые» метрики максимум 4 раза в секунду
  _onFrame() {
    this._frames++;
    const now = performance.now();
    if (now - this._uiLast < UI_MS) return;
    const dt = (now - this._fpsLast) / 1000;
    this.fps = dt > 0 ? this._frames / dt : 0;
    this._frames = 0; this._fpsLast = now; this._uiLast = now;
    const info = this.renderer && this.renderer.info;
    this.drawCalls = info ? info.render.calls : 0;
    this.triangles = info ? info.render.triangles : 0;
    this.unitCount = (this.state && this.state.units) ? this.state.units.length : 0;
    if (this.enabled) this._draw();
  }

  _draw() {
    if (!this._el) return;
    this._el.textContent =
      'тик:    ' + this.tickMs.toFixed(2) + ' мс\n' +
      'рендер: ' + this.renderMs.toFixed(2) + ' мс\n' +
      'FPS:    ' + this.fps.toFixed(0) + '\n' +
      'draws:  ' + this.drawCalls + '\n' +
      'tris:   ' + this.triangles + '\n' +
      'юниты:  ' + this.unitCount;
  }

  _mkOverlay() {
    const d = document.createElement('div');
    d.id = 'profiler-overlay';
    d.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;padding:8px 10px;' +
      'background:rgba(0,0,0,0.65);color:#9eff9e;font:12px/1.5 monospace;white-space:pre;' +
      'pointer-events:none;border-radius:4px;display:none;';
    document.body.appendChild(d);
    this._el = d;
  }

  // моментальный снимок метрик числами (не строкой) — для консоли/скриптов
  snapshot() {
    return {
      tickMs: this.tickMs, renderMs: this.renderMs, fps: this.fps,
      drawCalls: this.drawCalls, triangles: this.triangles, unitCount: this.unitCount,
    };
  }

  // ---- стресс-сценарий: заспавнить n врагов вокруг базы и через ~3с напечатать замер ----
  // спавн вокруг ратуши переиспользует state.grid/state.addUnit и hostileFor()/reachSet() из Waves.js —
  // сам spawnWave/edgePoints не экспортированы, поэтому набор точек считаем локально, но по той же идее:
  // кольцо проходимых и связанных с базой тайлов вокруг центра.
  stress(n) {
    const state = this.state;
    n = Math.max(1, Math.floor(n) || 50);
    const th = state.townhall;
    if (!th) { console.warn('[__stress] нет ратуши — сначала заложи базу'); return; }
    const grid = state.grid, reach = reachSet(state), hf = hostileFor(state);
    const cgx = th.gx + (th.w >> 1), cgy = th.gy + (th.h >> 1);
    const kinds = ['raider', 'raider', 'raider_fast', 'raider_heavy'];
    let spawned = 0, guard = 0;
    while (spawned < n && guard < n * 20) {
      guard++;
      const ang = Math.random() * Math.PI * 2, rad = 8 + Math.random() * 16;
      const gx = Math.max(0, Math.min(grid.n - 1, Math.round(cgx + Math.cos(ang) * rad)));
      const gy = Math.max(0, Math.min(grid.n - 1, Math.round(cgy + Math.sin(ang) * rad)));
      const t = grid.get(gx, gy);
      if (!t || !t.walkable) continue;
      if (reach && !reach.has(gy * grid.n + gx)) continue;
      const w = grid.gridToWorld(gx, gy);
      const kind = kinds[(Math.random() * kinds.length) | 0];
      const def = UNITS[kind];
      const hp = Math.round(def.hp * hf.raid.hpMul);
      const u = state.addUnit(kind, w.wx, w.wz, { tint: def.tint || hf.raid.tint, hp, maxHp: hp, scale: def.scale || 1 });
      u.speed = def.speed * hf.raid.speedMul;
      spawned++;
    }
    console.log('[__stress] заспавнено ' + spawned + '/' + n + ' врагов, замер через ~3с...');
    setTimeout(() => {
      const s = this.snapshot();
      console.log('[__stress] тик=' + s.tickMs.toFixed(2) + 'мс рендер=' + s.renderMs.toFixed(2) + 'мс FPS=' + s.fps.toFixed(0) +
        ' draws=' + s.drawCalls + ' tris=' + s.triangles + ' юнитов=' + s.unitCount);
    }, 3000);
  }
}
