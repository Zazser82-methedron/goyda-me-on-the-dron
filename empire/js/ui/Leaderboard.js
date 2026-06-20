// ===== Онлайн-таблица рекордов (общий jsonblob, без аккаунта) + локальный фолбэк =====
import { RANKS } from '../data/ranks.js?v=50';

// ЛОКАЛЬНЫЙ режим: BLOB пуст → рекорды хранятся на устройстве (localStorage).
// Чтобы таблица стала ОБЩЕЙ — впиши сюда REST-URL бэкенда с CORS (Supabase/Firebase)
// и реализацию _fetch/_save под него; вся остальная логика уже готова.
const BLOB = '';
const ONLINE = !!BLOB;
const LS_NAME = 'GOYDA_NAME';
const LS_LOCAL = 'GOYDA_SCORES_LOCAL';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export class Leaderboard {
  constructor(game) {
    this.game = game;
    this.pending = null;
    this._build();
  }

  _build() {
    const p = document.createElement('div');
    p.id = 'lboard'; p.style.display = 'none';
    p.innerHTML =
      '<div class="lb-head"><span>🏆 ТАБЛИЦА РЕКОРДОВ ГОЙДЫ</span><button class="lb-close" title="Закрыть">✕</button></div>' +
      '<div class="lb-pending"></div>' +
      '<div class="lb-status"></div>' +
      '<div class="lb-list"></div>';
    document.getElementById('app').appendChild(p);
    this.el = p;
    this.pendEl = p.querySelector('.lb-pending');
    this.statusEl = p.querySelector('.lb-status');
    this.listEl = p.querySelector('.lb-list');
    p.querySelector('.lb-close').onclick = () => this.close();
    const btn = document.getElementById('lbBtn');
    if (btn) btn.onclick = () => this.toggle();
  }

  toggle() { if (this.el.style.display === 'none') this.open(false); else this.close(); }
  close() { this.el.style.display = 'none'; }

  open(withPending) {
    this.el.style.display = 'block';
    this._renderPending(withPending ? this.pending : null);
    this.refresh();
  }

  // ---- сеть (общий blob); в локальном режиме сразу null, без запроса/ошибок в консоли ----
  async _fetch() {
    if (!BLOB) return null;
    try { const r = await fetch(BLOB, { headers: { Accept: 'application/json' }, cache: 'no-store' }); if (!r.ok) return null; const j = await r.json(); return Array.isArray(j) ? j : []; }
    catch (e) { return null; }
  }
  async _save(arr) {
    try { const r = await fetch(BLOB, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(arr) }); return r.ok; }
    catch (e) { return false; }
  }

  _localGet() { try { return JSON.parse(localStorage.getItem(LS_LOCAL) || '[]'); } catch (e) { return []; } }
  _localAdd(entry) { const a = this._localGet(); a.push(entry); a.sort((x, y) => y.score - x.score); try { localStorage.setItem(LS_LOCAL, JSON.stringify(a.slice(0, 50))); } catch (e) {} }

  // ---- итог партии ----
  onGameEnd(kind) {
    const s = this.game.state;
    const day = Math.floor(s.day || 0);
    const faith = Math.floor((s.resources && s.resources.faith) || 0);
    const score = s.rankIndex * 1000 + day * 25 + faith + (kind === 'win' ? 5000 : 0);
    const f = s.faction || {};
    this.pending = {
      name: '', score, win: kind === 'win', day, rank: s.rankIndex,
      fEmoji: f.emoji || '🗿', map: (this.game.map && this.game.map.name) || '', ts: Date.now(),
    };
    this.open(true);
  }

  _renderPending(pend) {
    if (!pend) { this.pendEl.style.display = 'none'; return; }
    this.pendEl.style.display = 'block';
    const nm = (() => { try { return localStorage.getItem(LS_NAME) || ''; } catch (e) { return ''; } })();
    this.pendEl.innerHTML =
      `<div class="lb-pres">${pend.win ? '🌟 ПОБЕДА' : '💀 ПОРАЖЕНИЕ'} · <b>${pend.score}</b> очков · ${pend.fEmoji} · ${esc(pend.map)} · день ${pend.day} · ${esc(RANKS[pend.rank] ? RANKS[pend.rank].name : '')}</div>` +
      `<div class="lb-form"><input class="lb-name" maxlength="16" placeholder="Имя для рекорда" value="${esc(nm)}"><button class="lb-send">Отправить рекорд</button></div>`;
    const input = this.pendEl.querySelector('.lb-name');
    this.pendEl.querySelector('.lb-send').onclick = () => {
      const name = (input.value || '').trim().slice(0, 16) || 'Аноним';
      try { localStorage.setItem(LS_NAME, name); } catch (e) {}
      this._submit({ ...pend, name });
    };
  }

  async _submit(entry) {
    this._localAdd(entry);
    this.pending = null; this._renderPending(null);
    if (!ONLINE) { this.statusEl.textContent = '📦 Рекорд сохранён (локально)'; this._render(this._localGet(), entry); return; }
    this.statusEl.textContent = 'Отправка рекорда…';
    let arr = await this._fetch();
    if (arr === null) { this.statusEl.textContent = '⚠ Оффлайн — сохранено локально'; this._render(this._localGet(), entry); return; }
    arr.push(entry); arr.sort((a, b) => b.score - a.score); arr = arr.slice(0, 100);
    const ok = await this._save(arr);
    this.statusEl.textContent = ok ? '✅ Рекорд в онлайн-таблице!' : '⚠ Не отправилось — сохранено локально';
    this._render(arr, entry);
  }

  async refresh() {
    const arr = ONLINE ? await this._fetch() : null;
    if (arr === null) {
      if (!this.statusEl.textContent || !/^[📦✅⚠]/.test(this.statusEl.textContent.trim()))
        this.statusEl.textContent = ONLINE ? '⚠ Онлайн недоступен — показаны локальные результаты' : '📦 Локальная таблица — твои рекорды на этом устройстве';
      this._render(this._localGet(), null);
    } else {
      this.statusEl.textContent = '🌐 Онлайн · игроков в таблице: ' + arr.length;
      this._render(arr, null);
    }
  }

  _render(arr, highlight) {
    if (!arr || !arr.length) { this.listEl.innerHTML = '<div class="lb-empty">Пока пусто — стань первым героем ГОЙДЫ!</div>'; return; }
    // ВСЕ поля приходят из публично-записываемого blob → экранируем строки и приводим числа
    const rows = arr.slice(0, 50).map((e, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      const sc = Number(e.score) || 0, day = Number(e.day) || 0;
      const hot = highlight && e.name === highlight.name && sc === highlight.score ? ' lb-me' : '';
      return `<div class="lb-row${hot}"><span class="lb-pos">${medal}</span><span class="lb-nm">${esc(e.name)}</span>` +
        `<span class="lb-sc">${sc}</span><span class="lb-meta">${esc(e.fEmoji || '')} ${esc(e.map || '')} · ${e.win ? '🌟' : 'д.' + day}</span></div>`;
    }).join('');
    this.listEl.innerHTML = rows;
  }
}
