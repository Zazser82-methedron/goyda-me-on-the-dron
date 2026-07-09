// ===== Всплывающие сообщения (ранг-ап / набег / указ / барки) =====
import { sfx } from '../audio/Sfx.js?v=87';

export class Toasts {
  constructor(el) { this.el = el; }
  show(text, opts = {}) {
    if (opts.bad) sfx('deny');   // звук отказа/тревоги на «плохих» тостах
    const d = document.createElement('div');
    d.className = 'toast' + (opts.bad ? ' bad' : '') + (opts.gold ? ' gold' : '') + (opts.big ? ' big' : '');
    d.textContent = text;
    this.el.appendChild(d);
    requestAnimationFrame(() => d.classList.add('in'));
    const life = opts.big ? 3800 : 2300;
    setTimeout(() => { d.classList.remove('in'); setTimeout(() => d.remove(), 420); }, life);
    while (this.el.children.length > 6) this.el.firstChild.remove();
  }
}
