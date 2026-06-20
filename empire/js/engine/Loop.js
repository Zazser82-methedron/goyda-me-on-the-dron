// ===== Игровой цикл: фиксированный шаг симуляции + рендер с интерполяцией =====
import { SIM_DT } from '../data/config.js?v=44';

export class Loop {
  constructor(update, render, simDt = SIM_DT) {
    this.update = update;     // update(dt) — детерминированный тик симуляции
    this.render = render;     // render(alpha) — alpha ∈ [0,1) для интерполяции
    this.simDt = simDt;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.tickCount = 0;
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
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;          // защита от spiral-of-death (вкладка ушла в фон)
    this.acc += dt;
    let guard = 0;
    while (this.acc >= this.simDt && guard < 8) {
      this.update(this.simDt);
      this.acc -= this.simDt;
      this.tickCount++;
      guard++;
    }
    this.render(this.acc / this.simDt);
    requestAnimationFrame(this._frame);
  }
}
