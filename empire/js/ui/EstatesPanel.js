// ===== Панель сословий: отношение и поручения Вече =====
import { ESTATES } from '../sim/Estates.js?v=5';

const KEYS = Object.keys(ESTATES);

function mood(value) {
  if (value <= 20) return 'bad';
  if (value >= 70) return 'good';
  return 'mid';
}

export class EstatesPanel {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('estatesPanel');
    this.open = false;
    this.el.style.display = 'none';
  }

  toggle() {
    this.open = !this.open;
    this.el.style.display = this.open ? 'block' : 'none';
    return this.open;
  }

  update() {
    if (!this.open) return;
    const s = this.game.state;
    const data = s.estates || { values: {}, requirements: {} };
    const rows = KEYS.map(key => {
      const e = ESTATES[key], value = Math.round((data.values && data.values[key]) == null ? 50 : data.values[key]);
      return `<div class="estate-row"><span class="estate-icon">${e.icon}</span><b>${e.name}</b><span>${value}</span><div class="estate-meter"><i class="${mood(value)}" style="width:${value}%"></i></div></div>`;
    }).join('');
    const reqs = KEYS.map(key => {
      const req = data.requirements && data.requirements[key];
      if (!req) return '';
      const left = Math.max(0, req.dueDay - (s.day || 0));
      const streak = req.need > 1 ? ` · ${req.progress || 0}/${req.need}` : '';
      return `<div class="estate-req">${ESTATES[key].icon} <b>${ESTATES[key].name}:</b> ${req.text}<span>${left} дн.${streak}</span></div>`;
    }).join('') || '<div class="estate-empty">Новые требования скоро поступят.</div>';
    this.el.innerHTML = `<div class="estates-head"><b>🏛️ СОСЛОВИЯ</b><button title="Закрыть">×</button></div><div class="estate-list">${rows}</div><div class="estates-sub">ТРЕБОВАНИЯ</div>${reqs}`;
    this.el.querySelector('button').onclick = () => this.toggle();
  }
}
