// ===== Стартовый экран: выбор фракции и земли =====
import { FACTIONS } from '../data/factions.js?v=94';
import { MAPS } from '../data/maps.js?v=94';

const factionByKey = (key) => FACTIONS.find(f => f.key === key) || FACTIONS[0];
const mapByKey = (key) => MAPS.find(m => m.key === key) || MAPS[0];

export class StartScreen {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('start');
    this.fk = 'goyda';
    this.mk = 'les';
    this._launching = false;
    this._ensureStyles();
  }

  _ensureStyles() {
    if (document.querySelector('link[data-goyda-start-screen]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/start-screen.css?v=105';
    link.dataset.goydaStartScreen = '1';
    document.head.appendChild(link);
  }

  _sfx(name = 'click') { this.game.ctx?.sfx?.(name); }

  _factionTags(f) {
    const tags = [];
    if (f.mods.faithMul > 1) tags.push(`Вера +${Math.round((f.mods.faithMul - 1) * 100)}%`);
    if (f.mods.trainCostMul < 1) tags.push(`Войско −${Math.round((1 - f.mods.trainCostMul) * 100)}%`);
    if (f.mods.gatherMul > 1) tags.push(`Добыча +${Math.round((f.mods.gatherMul - 1) * 100)}%`);
    if (f.mods.gatherMul < 1) tags.push(`Добыча −${Math.round((1 - f.mods.gatherMul) * 100)}%`);
    if (f.mods.startGold) tags.push(`Казна +${f.mods.startGold}`);
    if (f.mods.happy) tags.push(`Настрой ${f.mods.happy > 0 ? '+' : ''}${f.mods.happy}`);
    return tags.slice(0, 3);
  }

  _mapTags(m) {
    const names = { tree: 'Лес', stone: 'Камень', ore: 'Руда' };
    return Object.entries(m.res)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([key, value]) => `${names[key]} ×${value.toFixed(1)}`);
  }

  _updateSelection() {
    const f = factionByKey(this.fk);
    const m = mapByKey(this.mk);
    this.el.style.setProperty('--faction-color', f.color);

    const dossier = this.el.querySelector('#startDossier');
    if (dossier) {
      dossier.innerHTML = `
        <div class="dossier-crest" aria-hidden="true">${f.emoji}</div>
        <div class="dossier-copy">
          <span class="dossier-label">Выбранный путь</span>
          <strong>${f.name}</strong>
          <p>${f.desc}</p>
          <div class="dossier-tags">${this._factionTags(f).map(t => `<span>${t}</span>`).join('')}</div>
        </div>`;
    }

    const summary = this.el.querySelector('#startSummary');
    if (summary) {
      summary.innerHTML = `
        <span class="summary-marker" style="--marker:${f.color}">${f.emoji}</span>
        <span><small>Кампания</small><b>${f.name} · ${m.name}</b></span>
        <span class="summary-terrain">${this._mapTags(m).join(' · ')}</span>`;
    }
  }

  _select(grid, button, key, kind) {
    if (kind === 'faction') this.fk = key;
    else this.mk = key;
    grid.querySelectorAll('.pick').forEach(x => {
      const active = x === button;
      x.classList.toggle('on', active);
      x.setAttribute('aria-pressed', String(active));
    });
    button.animate?.(
      [{ transform: 'translateY(-2px) scale(.97)' }, { transform: 'translateY(-4px) scale(1.02)' }, { transform: 'translateY(-3px) scale(1)' }],
      { duration: 240, easing: 'cubic-bezier(.2,.9,.25,1)' },
    );
    this._sfx();
    this._updateSelection();
  }

  show() {
    this._launching = false;
    document.body.classList.add('start-screen-open');
    document.getElementById('bootlog')?.remove();
    this.el.classList.remove('leaving');
    this.el.style.display = 'flex';
    this.game.lobby.start();   // 3D-сцена: Дрон над миниатюрным поселением, вместо старого CSS-фона
    this.el.innerHTML = `
      <div class="start-shade" aria-hidden="true"></div>

      <div class="start-box">
        <header class="start-head">
          <div class="start-brand">
            <span class="brand-sigil" aria-hidden="true">🗿</span>
            <span><small>Стратегия о живой державе</small><b>ГОЙДА—ИМПЕРИЯ</b></span>
          </div>
          <div class="start-status"><i></i> Новая кампания</div>
        </header>

        <main class="start-layout">
          <section class="start-hero">
            <div class="start-kicker"><span>ДРОН ЗОВЁТ</span><i></i></div>
            <h1>Построй державу.<br><em>Удержи остров.</em></h1>
            <p class="start-lead">Народ живёт своей жизнью, экономика требует решений, а за горизонтом уже собирается вражеская рать.</p>
            <div class="start-pillars" aria-label="Особенности кампании">
              <span><b>01</b> Развивай</span>
              <span><b>02</b> Управляй</span>
              <span><b>03</b> Обороняй</span>
            </div>
            <div class="start-dossier" id="startDossier"></div>
          </section>

          <section class="start-campaign" aria-label="Настройка новой кампании">
            <div class="campaign-title">
              <span><small>Новая игра</small><strong>Соберите свою державу</strong></span>
              <span class="campaign-seal">⚔</span>
            </div>

            <div class="start-step">
              <div class="step-title"><b>1</b><span><strong>Выберите путь</strong><small>Особый стиль развития и войны</small></span></div>
              <div class="start-grid faction-grid" id="fgrid"></div>
            </div>

            <div class="start-step">
              <div class="step-title"><b>2</b><span><strong>Выберите землю</strong><small>Рельеф определит экономику поселения</small></span></div>
              <div class="start-grid map-grid" id="mgrid"></div>
            </div>

            <div class="start-action">
              <div class="start-summary" id="startSummary"></div>
              <button class="start-btn" id="startGo"><span>Начать правление</span><b>➜</b></button>
            </div>
          </section>
        </main>

        <footer class="start-foot">
          <span>Автосохранение включено</span><i></i><span>Мир создаётся заново для каждой кампании</span>
        </footer>
      </div>`;

    const fg = this.el.querySelector('#fgrid');
    const mg = this.el.querySelector('#mgrid');
    FACTIONS.forEach(f => {
      const b = document.createElement('button');
      const active = f.key === this.fk;
      b.className = 'pick faction-pick' + (active ? ' on' : '');
      b.setAttribute('aria-pressed', String(active));
      b.style.setProperty('--pick-color', f.color);
      b.innerHTML = `<span class="p-em">${f.emoji}</span><span class="p-nm">${f.name}</span><span class="p-ds">${this._factionTags(f)[0] || 'Свой путь'}</span><span class="pick-check">✓</span>`;
      b.onclick = () => this._select(fg, b, f.key, 'faction');
      fg.appendChild(b);
    });
    MAPS.forEach(m => {
      const b = document.createElement('button');
      const active = m.key === this.mk;
      b.className = `pick map-pick map-${m.key}` + (active ? ' on' : '');
      b.setAttribute('aria-pressed', String(active));
      b.innerHTML = `<span class="map-art" aria-hidden="true"><i></i><i></i><i></i><em>${m.emoji}</em></span><span class="p-nm">${m.name}</span><span class="p-ds">${this._mapTags(m)[0]}</span><span class="pick-check">✓</span>`;
      b.onclick = () => this._select(mg, b, m.key, 'map');
      mg.appendChild(b);
    });

    this._updateSelection();
    this.el.onpointermove = (e) => {
      const r = this.el.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width - 0.5;
      const my = (e.clientY - r.top) / r.height - 0.5;
      this.game.lobby.setParallax(mx, my);   // параллакс теперь двигает 3D-камеру лобби, не CSS-фон
    };
    this.el.querySelector('#startGo').onclick = () => {
      if (this._launching) return;
      this._launching = true;
      this._sfx('build');
      this.el.classList.add('leaving');
      this.game.lobby.stop();   // сцену лобби убираем ДО того, как buildWorld() начнёт населять ту же scene
      setTimeout(() => {
        document.body.classList.remove('start-screen-open');
        this.el.style.display = 'none';
        this.el.classList.remove('leaving');
        this.game.startWith(this.fk, this.mk);
      }, 420);
    };
  }
}
