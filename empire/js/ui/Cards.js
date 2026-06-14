// ===== Рука карт в HUD (клик/цифры 1-5 — разыграть) =====
import { CARDS, RARITY_COLOR } from '../data/cards.js';

export class Cards {
  constructor(game) { this.game = game; this.el = document.getElementById('cards'); this._sig = ''; }
  update() {
    const s = this.game.state, h = s.hand || [];
    const sig = h.join(',') + '|' + (s.resources.faith >= 60 ? 'x' : Math.floor(s.resources.faith));
    if (sig === this._sig) return; this._sig = sig;
    this.el.innerHTML = '';
    h.forEach((key, i) => {
      const c = CARDS.find(x => x.key === key); if (!c) return;
      const aff = s.resources.faith >= c.cost;
      const b = document.createElement('button');
      b.className = 'card' + (aff ? '' : ' poor');
      b.style.borderColor = RARITY_COLOR[c.rarity] || '#888';
      b.innerHTML = `<span class="c-key">${i + 1}</span><span class="c-emoji">${c.emoji}</span><span class="c-name">${c.name}</span><span class="c-cost">${c.cost}☩</span>`;
      b.title = c.desc;
      b.onclick = () => this.game.playCard(i);
      this.el.appendChild(b);
    });
  }
}
