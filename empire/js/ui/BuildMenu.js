// ===== Нижняя панель: кнопки построек (призрак-размещение) + указы =====
import { BUILDINGS, BUILD_ORDER } from '../data/buildings.js?v=10';
import { RANKS } from '../data/ranks.js?v=10';
import { RES_LABEL } from '../data/config.js?v=10';
import { EDICTS } from '../sim/Edicts.js?v=10';

export function costStr(cost) {
  const keys = Object.keys(cost || {});
  if (!keys.length) return '<span class="free">даром</span>';
  return keys.map(k => `<span style="color:${RES_LABEL[k].color}">${RES_LABEL[k].icon}${cost[k]}</span>`).join(' ');
}

export class BuildMenu {
  constructor(game) {
    this.game = game;
    this.btnsEl = document.getElementById('buildbtns');
    this.edictsEl = document.getElementById('edicts');
    this._btn = {};
    this._render();
    this._renderEdicts();
  }

  _render() {
    this.btnsEl.innerHTML = '';
    for (const kind of BUILD_ORDER) {
      const d = BUILDINGS[kind];
      const b = document.createElement('button');
      b.className = 'bbtn cat-' + d.cat;
      b.innerHTML = `<span class="bi">${d.icon}</span><span class="bn">${d.name}</span><span class="bc">${costStr(d.cost)}</span>`;
      b.title = d.desc;
      b.onclick = () => {
        if ((d.rank || 0) > this.game.state.rankIndex) { this.game.toasts.show('Откроется в ранге ' + RANKS[d.rank].name, { bad: true }); return; }
        this.game.enterBuild(kind);
      };
      this.btnsEl.appendChild(b);
      this._btn[kind] = b;
    }
  }

  _renderEdicts() {
    this.edictsEl.innerHTML = '<div class="ed-title">УКАЗЫ</div>';
    this._ed = {};
    for (const e of EDICTS) {
      const b = document.createElement('button');
      b.className = 'edbtn';
      b.innerHTML = `<span>${e.icon}</span><span class="edn">${e.name}</span>`;
      b.title = e.desc + '  [' + costStr(e.cost) + ']';
      b.onclick = () => { this.game.toggleEdictUI(e.key); };
      this.edictsEl.appendChild(b);
      this._ed[e.key] = b;
    }
  }

  update() {
    const s = this.game.state;
    for (const kind of BUILD_ORDER) {
      const d = BUILDINGS[kind], b = this._btn[kind];
      const locked = (d.rank || 0) > s.rankIndex;
      const poor = !s.canAfford(d.cost);
      b.classList.toggle('locked', locked);
      b.classList.toggle('poor', !locked && poor);
      b.classList.toggle('active', this.game.buildKind === kind);
    }
    for (const e of EDICTS) this._ed[e.key].classList.toggle('on', !!(s.edicts && s.edicts[e.key]));
  }
}
