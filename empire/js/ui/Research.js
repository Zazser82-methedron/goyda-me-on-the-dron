// ===== Панель исследований (древо технологий) =====
import { TECHS, TECH_ORDER } from '../data/tech.js?v=94';
import { BUILDINGS } from '../data/buildings.js?v=98';
import { costStr } from './BuildMenu.js?v=94';

export class ResearchPanel {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('research');
    this.open = false;
    if (this.el) this.el.style.display = 'none';
  }

  toggle() {
    this.open = !this.open;
    if (this.el) { this.el.style.display = this.open ? 'block' : 'none'; if (this.open) this.refresh(); }
    return this.open;
  }

  refresh() {
    if (!this.el || !this.open) return;
    const s = this.game.state, R = s.research || {};
    let html = '<div class="rs-title">🔬 ДРЕВО ТЕХНОЛОГИЙ</div><div class="rs-list">';
    for (const k of TECH_ORDER) {
      const t = TECHS[k];
      const done = R.done && R.done[k];
      const rankLock = (t.rank || 0) > s.rankIndex;
      const bldLock = t.requiresBuilding && !s.hasBuilt(t.requiresBuilding);
      const locked = rankLock || bldLock;
      const poor = !done && !locked && !s.canAfford(t.cost);
      const cls = done ? 'done' : locked ? 'locked' : poor ? 'poor' : '';
      const costLbl = done ? '✓ изучено' : bldLock ? '🔒 ' + BUILDINGS[t.requiresBuilding].icon : rankLock ? '🔒 ранг ' + t.rank : costStr(t.cost);
      html += `<button class="rsbtn ${cls}" data-t="${k}" ${done || locked ? 'disabled' : ''}>
        <span class="rs-ic">${t.icon}</span>
        <span class="rs-mid"><b>${t.name}</b><i>${t.desc}</i></span>
        <span class="rs-cost">${costLbl}</span></button>`;
    }
    html += '</div><div class="rs-hint">Каждая технология — один раз навсегда.</div>';
    this.el.innerHTML = html;
    this.el.querySelectorAll('.rsbtn').forEach(b => { b.onclick = () => this.game.research(b.dataset.t); });
  }
}
