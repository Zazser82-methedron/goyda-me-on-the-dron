// ===== Стартовый экран: выбор фракции и земли =====
import { FACTIONS } from '../data/factions.js?v=43';
import { MAPS } from '../data/maps.js?v=43';

export class StartScreen {
  constructor(game) { this.game = game; this.el = document.getElementById('start'); this.fk = 'goyda'; this.mk = 'les'; }

  show() {
    this.el.style.display = 'flex';
    this.el.innerHTML = `
      <div class="start-box">
        <h1>🗿 ГОЙДА-ИМПЕРИЯ</h1>
        <div class="start-sub">Подними державу вокруг пробуждающегося идола ДРОНА</div>
        <div class="start-sec">ВЫБЕРИ ФРАКЦИЮ</div>
        <div class="start-grid" id="fgrid"></div>
        <div class="start-sec">ВЫБЕРИ ЗЕМЛЮ</div>
        <div class="start-grid" id="mgrid"></div>
        <button class="start-btn" id="startGo">⚔️ ГОЙДА! НАЧАТЬ</button>
      </div>`;
    const fg = this.el.querySelector('#fgrid'), mg = this.el.querySelector('#mgrid');
    FACTIONS.forEach(f => {
      const b = document.createElement('button');
      b.className = 'pick' + (f.key === this.fk ? ' on' : '');
      b.innerHTML = `<span class="p-em">${f.emoji}</span><span class="p-nm" style="color:${f.color}">${f.name}</span><span class="p-ds">${f.desc}</span>`;
      b.onclick = () => { this.fk = f.key; fg.querySelectorAll('.pick').forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      fg.appendChild(b);
    });
    MAPS.forEach(m => {
      const b = document.createElement('button');
      b.className = 'pick' + (m.key === this.mk ? ' on' : '');
      b.innerHTML = `<span class="p-em">${m.emoji}</span><span class="p-nm">${m.name}</span><span class="p-ds">${m.desc}</span>`;
      b.onclick = () => { this.mk = m.key; mg.querySelectorAll('.pick').forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      mg.appendChild(b);
    });
    this.el.querySelector('#startGo').onclick = () => { this.el.style.display = 'none'; this.game.startWith(this.fk, this.mk); };
  }
}
