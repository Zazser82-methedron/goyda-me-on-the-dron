// ===== Панель выбранной сущности: HP, тренировка, инфо =====
import { UNITS } from '../data/units.js?v=94';
import { RES_LABEL } from '../data/config.js?v=94';
import { costStr } from './BuildMenu.js?v=94';
import { roadPath } from '../sim/Transport.js?v=94';
import { railPath } from '../sim/Railroad.js?v=94';

function hpBar(hp, max) {
  const p = Math.max(0, Math.min(1, hp / max));
  const col = p > 0.5 ? '#5eff8b' : p > 0.25 ? '#ffcc00' : '#ff5050';
  return `<div class="hpbar"><div class="hpfill" id="sel-hp" style="width:${p * 100}%;background:${col}"></div></div>`;
}

export class Selection {
  constructor(game) { this.game = game; this.el = document.getElementById('selection'); this.curId = null; this._ringOn = null; }

  // радиус ауры (b._ring, GameState.placeBuilding) виден ТОЛЬКО пока постройка выбрана —
  // раньше кольцо добавлялось в сцену насовсем и никогда не скрывалось (жалоба: «много
  // радиусов загромождают экран»). Переключаем visible на уже существующем меше, без
  // create/destroy geometry — дёшево, ноль аллокаций на клик.
  _syncRing(sel) {
    if (this._ringOn && this._ringOn !== (sel && sel._ring)) this._ringOn.visible = false;
    this._ringOn = (sel && sel.type === 'building' && sel._ring) || null;
    if (this._ringOn) this._ringOn.visible = true;
  }

  update() {
    const sel = this.game.state.selected;
    this._syncRing(sel);
    if (!sel) { if (this.curId !== null) { this.el.style.display = 'none'; this.curId = null; } return; }
    if (sel.id !== this.curId) { this._full(sel); this.curId = sel.id; this.el.style.display = 'block'; }
    this._dynamic(sel);
  }

  _full(sel) {
    let html = '';
    if (sel.type === 'building') {
      html += `<div class="sel-h">${sel.def.icon} ${sel.def.name}</div>`;
      html += hpBar(sel.hp, sel.maxHp);
      html += `<div class="sel-sub" id="sel-sub"></div>`;
      if (sel.def.trains) {
        html += '<div class="sel-train">';
        for (const uk of sel.def.trains) {
          const ud = UNITS[uk];
          html += `<button class="ubtn" data-u="${uk}">${ud.icon} ${ud.name}<span class="bc">${costStr(ud.cost)}</span></button>`;
        }
        html += '</div>';
      }
      if (sel.def.drop) html += `<div class="sel-tag">📦 точка сдачи</div>`;
      if (sel.def.produce) html += `<div class="sel-tag">${produceStr(sel.def.produce)}</div>`;
      if (sel.kind === 'market') html += `<div class="sel-tag" id="sel-road"></div>`;   // связь дорогой с ратушей (телеги)
      if (sel.kind === 'station') html += `<div class="sel-tag" id="sel-rail"></div>`;  // связь рельсами с другой станцией
    } else if (sel.type === 'unit') {
      html += `<div class="sel-h">${sel.def.icon} ${sel.def.name}</div>`;
      html += hpBar(sel.hp, sel.maxHp);
      html += `<div class="sel-sub" id="sel-sub"></div>`;
      if (sel.faction === 'ours' && !sel.def.worker) {
        html += `<div class="sel-stances">
          <button class="stbtn" data-st="aggro" title="Сами ищут и бьют врага по всей карте">⚔️ Агр</button>
          <button class="stbtn" data-st="defend" title="Бьют врага у базы, иначе держат рубеж">🛡️ Оборона</button>
          <button class="stbtn" data-st="hold" title="Стоят на месте, бьют только в упор">✋ Стоять</button></div>`;
        html += `<button class="ord-btn" title="Нажми, потом укажи цель на карте">🎯 ПРИКАЗ</button>`;
        html += `<div class="sel-tag">ПКМ (или 🎯 ПРИКАЗ) — идти куда укажешь / в атаку</div>`;
      } else if (sel.def.worker) {
        html += `<button class="ord-btn" title="Нажми, потом укажи цель на карте">🎯 ПРИКАЗ</button>`;
        html += `<div class="sel-tag">ПКМ (или 🎯 ПРИКАЗ) по ресурсу 🌳🪨🪙 — рубить · по земле — идти</div>`;
      }
    } else if (sel.type === 'node') {
      const lbl = RES_LABEL[sel.resType];
      html += `<div class="sel-h">${lbl.icon} ${lbl.ru}</div>`;
      html += hpBar(sel.amount, sel.maxAmount);
      html += `<div class="sel-sub" id="sel-sub"></div>`;
    } else if (sel.type === 'camp') {
      html += `<div class="sel-h">🏴 ВРАЖИЙ СТАН</div>`;
      html += hpBar(sel.hp, sel.maxHp);
      html += `<div class="sel-sub" id="sel-sub"></div>`;
      html += `<div class="sel-tag">ПКМ воином по стану — снести. Спавнит набеги!</div>`;
    } else if (sel.type === 'animal') {
      html += `<div class="sel-h">${sel.def.icon} ${sel.def.name}</div>`;
      html += hpBar(sel.hp, sel.maxHp);
      html += `<div class="sel-sub" id="sel-sub"></div>`;
      html += `<div class="sel-tag">ПКМ своим юнитом — охота 🏹 (+ЕДА и шкуры)</div>`;
    }
    this.el.innerHTML = html;
    this.el.querySelectorAll('.ubtn').forEach(btn => { btn.onclick = () => this.game.train(sel, btn.dataset.u); });
    const cur = sel.stance || 'aggro';
    this.el.querySelectorAll('.stbtn').forEach(btn => {
      if (btn.dataset.st === cur) btn.classList.add('on');
      btn.onclick = () => {
        this.game.setStance(sel, btn.dataset.st);
        this.el.querySelectorAll('.stbtn').forEach(b => b.classList.toggle('on', b.dataset.st === btn.dataset.st));
      };
    });
    const ord = this.el.querySelector('.ord-btn');
    if (ord) ord.onclick = () => this.game._armOrder();
  }

  _dynamic(sel) {
    const hp = document.getElementById('sel-hp');
    const sub = document.getElementById('sel-sub');
    const road = document.getElementById('sel-road');
    if (road && sel.kind === 'market') {   // BFS только по дорожным тайлам — дёшево на 10Гц UI
      const ok = roadPath(this.game.state, sel, this.game.state.townhall);
      road.textContent = ok ? '🐴 дорога к ПАЛАТАМ есть — телеги возят золото' : '🐴 нет дороги к ПАЛАТАМ — проложи 🛣️ для телег';
      road.style.color = ok ? '#9fef9f' : '#ffb35c';
    }
    const railEl = document.getElementById('sel-rail');
    if (railEl && sel.kind === 'station') {
      const s = this.game.state;
      const other = s.buildings.find(b => b.built && b.kind === 'station' && b.id !== sel.id && railPath(s, sel, b));
      railEl.textContent = other ? '🚂 линия действует — паровоз возит грузы' : '🚂 нужна ВТОРАЯ станция + рельсы 🛤️ между ними';
      railEl.style.color = other ? '#9fef9f' : '#ffb35c';
    }
    if (sel.type === 'node') {
      if (hp) { const p = Math.max(0, sel.amount / sel.maxAmount); hp.style.width = p * 100 + '%'; }
      if (sub) sub.textContent = `осталось: ${Math.ceil(sel.amount)}`;
      return;
    }
    if (hp) { const p = Math.max(0, sel.hp / sel.maxHp); hp.style.width = p * 100 + '%'; hp.style.background = p > 0.5 ? '#5eff8b' : p > 0.25 ? '#ffcc00' : '#ff5050'; }
    if (sub) {
      if (sel.type === 'building' && !sel.built) sub.textContent = `строится… ${Math.max(1, Math.ceil(sel.buildLeft))}с · 👷 ${sel._activeBuilders || 0}/3` + ((sel._activeBuilders || 0) === 0 ? ' — нужны холопы!' : '');
      else if (sel.type === 'building' && sel.trainQueue && sel.trainQueue.length) sub.textContent = `очередь: ${sel.trainQueue.length} (${Math.ceil(sel.trainLeft)}с)`;
      else if (sel.type === 'unit' && sel.faction === 'ours' && sel.def.worker) sub.textContent = sel.carry > 0 ? `несёт ${sel.carry} ${RES_LABEL[sel.carryType] ? RES_LABEL[sel.carryType].icon : ''}` : (sel.state || '');
      else sub.textContent = sel.bossName ? '☠️ ' + sel.bossName : '';
    }
  }
}

function produceStr(p) {
  const parts = [];
  if (p.food) parts.push('🍞+' + p.food);
  if (p.iron) parts.push('⛓️+' + p.iron);
  if (p.gold) parts.push('🪙+' + p.gold);
  if (p.gems) parts.push('💎+' + p.gems);
  if (p.faith) parts.push('☩+' + p.faith);
  if (p.happy) parts.push('😊+' + p.happy);
  return parts.join(' ') + '/день';
}
