// ===== Игровой цикл: фиксированный шаг симуляции + рендер с интерполяцией =====
import { SIM_DT } from '../data/config.js?v=94';

export class Loop {
  constructor(update, render, simDt = SIM_DT) {
    this.update = update;     // update(dt) — детерминированный тик симуляции
    this.render = render;     // render(alpha) — alpha ∈ [0,1) для интерполяции
    this.simDt = simDt;
    this.acc = 0;
    this.last = 0;
    this.speed = 1;            // множитель скорости симуляции (0 = пауза, 1/2/3); рендер не масштабируется
    this.running = false;
    this.tickCount = 0;
    this.profiler = null;      // опциональный Profiler — при null замеры не выполняются вовсе
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._frame);
  }

  stop() { this.running = false; }

  _frame(now) {
    if (!this.running) return;
    // Скрытая вкладка не должна тратить CPU/GPU и копить симуляционные тики.
    // При возврате кадр сразу продолжается с актуального времени без рывка.
    if (document.hidden) {
      this.last = now; this.acc = 0;
      requestAnimationFrame(this._frame);
      return;
    }
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;          // защита от spiral-of-death (вкладка ушла в фон)
    this.acc += dt * this.speed;       // пауза/ускорение симуляции (рендер по-прежнему каждый кадр)
    let guard = 0;
    const p = this.profiler;           // локальная ссылка: при null — ни одного вызова performance.now()
    while (this.acc >= this.simDt && guard < 12) {
      if (p) p.beginTick();
      this.update(this.simDt);
      if (p) p.endTick();
      this.acc -= this.simDt;
      this.tickCount++;
      guard++;
    }
    if (p) p.beginRender();
    this.render(this.acc / this.simDt);
    if (p) p.endRender();
    requestAnimationFrame(this._frame);
  }
}
