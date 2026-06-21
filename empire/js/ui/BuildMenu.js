// ===== Нижняя панель: вкладки-категории построек + модальная сетка карточек + указы =====
import { BUILDINGS, BUILD_ORDER, CATS } from '../data/buildings.js?v=76';
import { RANKS } from '../data/ranks.js?v=76';
import { RES_LABEL } from '../data/config.js?v=76';
import { EDICTS } from '../sim/Edicts.js?v=76';
import { TECHS } from '../data/tech.js?v=76';

export function costStr(cost) {
  const keys = Object.keys(cost || {});
  if (!keys.length) return '<span class="free">даром</span>';
  return keys.map(k => `<span style="color:${RES_LABEL[k] ? RES_LABEL[k].color : '#fff'}">${RES_LABEL[k] ? RES_LABEL[k].icon : ''}${cost[k]}</span>`).join(' ');
}

// порядок вкладок-категорий и их иконки (имена/цвета берём из CATS)
const CAT_ORDER = ['econ', 'mil', 'def', 'faith', 'relic', 'wonder'];
const CAT_ICON = { econ: '🏠', mil: '⚔️', def: '🛡️', faith: '☩', relic: '🗿', wonder: '🌟' };

// сводка пользы постройки на карточке (что даёт)
function prodStr(d) {
  const out = [];
  if (d.produce) for (const k in d.produce) {
    const icon = RES_LABEL[k] ? RES_LABEL[k].icon : (k === 'happy' ? '😊' : k);
    out.push(`<span style="color:${RES_LABEL[k] ? RES_LABEL[k].color : '#9fef9f'}">+${d.produce[k]}${icon}</span>`);
  }
  if (d.pop) out.push(`<span class="bcard-pop">+${d.pop}👥</span>`);
  if (d.aura) out.push(`<span class="bcard-aura">аура</span>`);
  if (d.wall && d.walkable) out.push(`<span class="bcard-pop">проход</span>`);
  return out.length ? `<span class="bcard-prod">${out.join(' ')}</span>` : '';
}

export class BuildMenu {
  constructor(game) {
    this.game = game;
    this.tabsEl = document.getElementById('buildbtns');
    this.edictsEl = document.getElementById('edicts');
    this.openCat = null;
    this._catBtn = {};
    this._card = {};
    this.catKinds = {};
    this._buildPanel();
    this._renderTabs();
    this._renderEdicts();

    // закрытие панели: ESC и клик мимо
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    window.addEventListener('pointerdown', (e) => {
      if (!this.openCat) return;
      if (this.panelEl.contains(e.target) || this.tabsEl.contains(e.target)) return;
      this.close();
    });
  }

  _buildPanel() {
    const p = document.createElement('div');
    p.id = 'buildpanel';
    p.style.display = 'none';
    p.innerHTML = '<div class="bp-head"><span class="bp-title"></span><button class="bp-close" title="Закрыть (ESC)">✕</button></div><div class="bp-grid"></div>';
    document.getElementById('app').appendChild(p);
    this.panelEl = p;
    this.titleEl = p.querySelector('.bp-title');
    this.gridEl = p.querySelector('.bp-grid');
    p.querySelector('.bp-close').onclick = () => this.close();
  }

  _renderTabs() {
    this.tabsEl.innerHTML = '';
    // группируем здания по категориям, сохраняя порядок BUILD_ORDER
    this.catKinds = {};
    for (const kind of BUILD_ORDER) {
      const c = BUILDINGS[kind].cat;
      (this.catKinds[c] = this.catKinds[c] || []).push(kind);
    }
    for (const cat of CAT_ORDER) {
      const kinds = this.catKinds[cat];
      if (!kinds || !kinds.length) continue;
      const meta = CATS[cat] || { name: cat, color: '#caa' };
      const t = document.createElement('button');
      t.className = 'catbtn';
      t.style.setProperty('--cc', meta.color);
      t.innerHTML = `<span class="cb-ic">${CAT_ICON[cat] || '🏗️'}</span><span class="cb-nm">${meta.name}</span>`;
      t.onclick = () => this.toggle(cat);
      this.tabsEl.appendChild(t);
      this._catBtn[cat] = t;
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

  toggle(cat) { if (this.openCat === cat) this.close(); else this.open(cat); }

  open(cat) {
    this.openCat = cat;
    this._renderCards(cat);
    this.panelEl.style.display = 'block';
    for (const k in this._catBtn) this._catBtn[k].classList.toggle('open', k === cat);
  }

  close() {
    if (!this.openCat) return;
    this.openCat = null;
    this.panelEl.style.display = 'none';
    for (const k in this._catBtn) this._catBtn[k].classList.remove('open');
  }

  _renderCards(cat) {
    const meta = CATS[cat] || { name: cat, color: '#caa' };
    this.titleEl.textContent = (CAT_ICON[cat] || '') + ' ' + meta.name;
    this.titleEl.style.color = meta.color;
    this.gridEl.innerHTML = '';
    this._card = {};
    for (const kind of this.catKinds[cat]) {
      const d = BUILDINGS[kind];
      const card = document.createElement('button');
      card.className = 'bcard cat-' + d.cat;
      card.innerHTML =
        `<div class="bcard-top"><span class="bcard-ic">${d.icon}</span><span class="bcard-nm">${d.name}</span></div>` +
        `<div class="bcard-desc">${d.desc || ''}</div>` +
        `<div class="bcard-foot"><span class="bcard-cost">${costStr(d.cost)}</span>${prodStr(d)}</div>` +
        `<div class="bcard-lock"></div>`;
      card.onclick = () => this._pick(kind, d);
      this.gridEl.appendChild(card);
      this._card[kind] = card;
    }
    this._refreshCards();
  }

  _pick(kind, d) {
    const s = this.game.state;
    if ((d.rank || 0) > s.rankIndex) { this.game.toasts.show('Откроется в ранге ' + RANKS[d.rank].name, { bad: true }); return; }
    if (d.requiresTech && !(s.research && s.research.done[d.requiresTech])) { this.game.toasts.show('Изучите технологию: ' + TECHS[d.requiresTech].name, { bad: true }); return; }
    this.game.enterBuild(kind);
    this.close();
  }

  _refreshCards() {
    if (!this.openCat) return;
    const s = this.game.state;
    for (const kind of this.catKinds[this.openCat]) {
      const d = BUILDINGS[kind], card = this._card[kind];
      if (!card) continue;
      const techLock = d.requiresTech && !(s.research && s.research.done[d.requiresTech]);
      const rankLock = (d.rank || 0) > s.rankIndex;
      const locked = rankLock || techLock;
      // антидребезг доступности: ресурсы скачут у границы цены → меняем подсветку только если держится ≈0.4с
      const afford = s.canAfford(d.cost);
      if (card._affShow === undefined) { card._affShow = afford; card._affCnt = 0; }
      if (afford === card._affShow) card._affCnt = 0;
      else if (++card._affCnt >= 4) { card._affShow = afford; card._affCnt = 0; }
      card.classList.toggle('locked', !!locked);
      card.classList.toggle('poor', !locked && !card._affShow);
      card.classList.toggle('active', this.game.buildKind === kind);
      const lockEl = card.querySelector('.bcard-lock');
      if (locked) {
        lockEl.textContent = rankLock ? '🔒 ранг: ' + RANKS[d.rank].name : '🔒 изучить: ' + ((TECHS[d.requiresTech] && TECHS[d.requiresTech].name) || '');
        lockEl.style.display = 'flex';
      } else lockEl.style.display = 'none';
    }
  }

  update() {
    const s = this.game.state;
    // вкладки: затемняем целиком закрытую категорию, подсвечиваем ту, что сейчас строим
    for (const cat of CAT_ORDER) {
      const t = this._catBtn[cat];
      if (!t) continue;
      let unlocked = 0;
      for (const kind of (this.catKinds[cat] || [])) {
        const d = BUILDINGS[kind];
        const techLock = d.requiresTech && !(s.research && s.research.done[d.requiresTech]);
        if (!((d.rank || 0) > s.rankIndex || techLock)) unlocked++;
      }
      t.classList.toggle('alllocked', unlocked === 0);
      const bk = this.game.buildKind;
      t.classList.toggle('building', !!(bk && BUILDINGS[bk] && BUILDINGS[bk].cat === cat));
    }
    this._refreshCards();
    for (const e of EDICTS) this._ed[e.key].classList.toggle('on', !!(s.edicts && s.edicts[e.key]));
  }
}
