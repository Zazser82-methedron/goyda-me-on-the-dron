// ===== Верхняя панель: ресурсы, ранг, Базометр-ВЕРА, население, счастье, день =====
import { RES, RES_LABEL } from '../data/config.js?v=76';
import { RANKS } from '../data/ranks.js?v=76';

export class HUD {
  constructor(game) {
    this.game = game;
    this.resEl = document.getElementById('res');
    this.rankEl = document.getElementById('rankbox');
    this.statusEl = document.getElementById('status');
    this.superBtn = document.getElementById('superBtn');
    this.waveEl = document.getElementById('wavebox');
    this._chips = {};
    this.resEl.innerHTML = RES.map(k =>
      `<span class="chip" title="${RES_LABEL[k].ru}"><b style="color:${RES_LABEL[k].color}">${RES_LABEL[k].icon}</b><i id="r-${k}">0</i></span>`
    ).join('');
    for (const k of RES) this._chips[k] = document.getElementById('r-' + k);
  }

  update() {
    const s = this.game.state;
    for (const k of RES) this._chips[k].textContent = Math.floor(s.resources[k]);

    const r = RANKS[s.rankIndex], next = RANKS[s.rankIndex + 1];
    let meter = '';
    if (next && next.req.faith) {
      const p = Math.min(1, s.resources.faith / next.req.faith);
      const pp = Math.min(1, s.population / (next.req.pop || 1));
      meter = `<div class="bazo" title="до ранга ${next.name}: ВЕРА ${Math.floor(s.resources.faith)}/${next.req.faith}, народ ${s.population}/${next.req.pop}">
        <div class="bazo-fill" style="width:${p * 100}%"></div>
        <div class="bazo-pop" style="width:${pp * 100}%"></div></div>`;
    }
    this.rankEl.innerHTML = `<span class="rank" style="color:${r.color}">${r.icon} ${r.name}</span>${meter}`;

    const hc = s.happiness > 60 ? '#5eff8b' : s.happiness > 35 ? '#ffcc00' : '#ff5050';
    this.statusEl.innerHTML = `👥 <b>${s.population}/${s.popCap}</b> · <span style="color:${hc}">😊 ${Math.round(s.happiness)}%</span> · 📅 <b>${s.day}</b>`;

    if (this.waveEl) {
      const tw = Math.max(0, Math.ceil(s.nextWaveIn || 0));
      const danger = s.threatTimer > 0;
      this.waveEl.innerHTML = danger ? `<span class="threat">🚨 НАБЕГ</span>` : `🏹 волна ч/з ${tw}с`;
    }

    const ready = s.resources.faith >= 40 && s.superTimer <= 0;
    this.superBtn.classList.toggle('ready', ready);
    this.superBtn.classList.toggle('active', s.superTimer > 0);
    this.superBtn.textContent = s.superTimer > 0 ? `СВЕРХ-ГОЙДА ${Math.ceil(s.superTimer)}с` : 'СВЕРХ-ГОЙДА (40☩)';
  }
}
