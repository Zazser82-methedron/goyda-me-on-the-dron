// ===== Панель выбранной сущности: HP, тренировка, инфо =====
import { UNITS } from '../data/units.js?v=52';
import { RES_LABEL } from '../data/config.js?v=52';
import { costStr } from './BuildMenu.js?v=52';

function hpBar(hp, max) {
  const p = Math.max(0, Math.min(1, hp / max));
  const col = p > 0.5 ? '#5eff8b' : p > 0.25 ? '#ffcc00' : '#ff5050';
  return `<div class="hpbar"><div class="hpfill" id="sel-hp" style="width:${p * 100}%;background:${col}"></div></div>`;
}

export class Selection {
  constructor(game) { this.game = game; this.el = document.getElementById('selection'); this.curId = null; }

  update() {
    const sel = this.game.state.selected;
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
    } else if (sel.type === 'unit') {
      html += `<div class="sel-h">${sel.def.icon} ${sel.def.name}</div>`;
      html += hpBar(sel.hp, sel.maxHp);
      html += `<div class="sel-sub" id="sel-sub"></div>`;
      if (sel.faction === 'ours' && !sel.def.worker) {
        html += `<div class="sel-stances">
          <button class="stbtn" data-st="aggro" title="Сами ищут и бьют врага по всей карте">⚔️ Агр</button>
          <button class="stbtn" data-st="defend" title="Бьют врага у базы, иначе держат рубеж">🛡️ Оборона</button>
          <button class="stbtn" data-st="hold" title="Стоят на месте, бьют только в упор">✋ Стоять</button></div>`;
        html += `<div class="sel-tag">ПКМ — идти куда укажешь / в атаку</div>`;
      } else if (sel.def.worker) {
        html += `<div class="sel-tag">ПКМ по ресурсу 🌳🪨🪙 — рубить · ПКМ по земле — идти</div>`;
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
  }

  _dynamic(sel) {
    const hp = document.getElementById('sel-hp');
    const sub = document.getElementById('sel-sub');
    if (sel.type === 'node') {
      if (hp) { const p = Math.max(0, sel.amount / sel.maxAmount); hp.style.width = p * 100 + '%'; }
      if (sub) sub.textContent = `осталось: ${Math.ceil(sel.amount)}`;
      return;
    }
    if (hp) { const p = Math.max(0, sel.hp / sel.maxHp); hp.style.width = p * 100 + '%'; hp.style.background = p > 0.5 ? '#5eff8b' : p > 0.25 ? '#ffcc00' : '#ff5050'; }
    if (sub) {
      if (sel.type === 'building' && !sel.built) sub.textContent = `строится… ${Math.ceil(sel.buildLeft)}с`;
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
