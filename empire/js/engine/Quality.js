// ===== Уровень качества: авто-детект (мобила/слабое железо → low) + ручной override (localStorage) =====
const KEY = 'GOYDA_QUALITY';

function autoTier() {
  try {
    const ua = navigator.userAgent || '';
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const mobileUA = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|Silk/i.test(ua);
    const fewCores = (navigator.hardwareConcurrency || 8) <= 4;
    const smallScreen = Math.min(window.innerWidth || 9999, window.innerHeight || 9999) <= 820;
    if (mobileUA || (coarse && (smallScreen || fewCores))) return 'low';
  } catch (e) {}
  return 'high';
}

// текущий тир: ручной override из localStorage, иначе авто
export function getTier() {
  try { const t = localStorage.getItem(KEY); if (t === 'low' || t === 'high') return t; } catch (e) {}
  return autoTier();
}
export function setTier(t) { try { localStorage.setItem(KEY, t); } catch (e) {} }
export function toggleTier() { const t = getTier() === 'low' ? 'high' : 'low'; setTier(t); return t; }
export function isLow() { return getTier() === 'low'; }
