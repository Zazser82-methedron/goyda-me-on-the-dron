// ===== Процедурный звук (WebAudio) — в духе tone()/sfx() из «Гойды» =====
let actx = null;
let muted = false;
try { muted = localStorage.getItem('GOYDA_EMPIRE_MUTE') === '1'; } catch (e) {}

function ac() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(freq, dur, { type = 'sine', vol = 0.18, when = 0, slide = 0 } = {}) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

const PRESETS = {
  click: () => tone(420, 0.05, { type: 'square', vol: 0.08 }),
  place: () => { tone(180, 0.12, { type: 'triangle', vol: 0.2 }); tone(90, 0.18, { type: 'sine', vol: 0.18, when: 0.02 }); },
  build: () => { [330, 440, 550].forEach((f, i) => tone(f, 0.14, { type: 'triangle', vol: 0.15, when: i * 0.08 })); },
  train: () => { tone(520, 0.08, { type: 'square', vol: 0.12 }); tone(660, 0.1, { type: 'square', vol: 0.1, when: 0.07 }); },
  gather: () => tone(300 + Math.random() * 60, 0.05, { type: 'triangle', vol: 0.06 }),
  deposit: () => { tone(660, 0.07, { vol: 0.12, type: 'sine' }); tone(880, 0.09, { vol: 0.1, when: 0.05 }); },
  hit: () => tone(220, 0.06, { type: 'sawtooth', vol: 0.1, slide: -120 }),
  hitEnemy: () => tone(160, 0.07, { type: 'sawtooth', vol: 0.1, slide: -80 }),
  raid: () => { tone(160, 0.4, { type: 'sawtooth', vol: 0.16, slide: 40 }); tone(120, 0.5, { type: 'square', vol: 0.12, when: 0.12 }); },
  boss: () => { [110, 90, 70].forEach((f, i) => tone(f, 0.6, { type: 'sawtooth', vol: 0.2, when: i * 0.18, slide: 20 })); },
  rankup: () => { [440, 554, 660, 880].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.16, when: i * 0.1 })); },
  super: () => { [330, 440, 550, 660, 880].forEach((f, i) => tone(f, 0.3, { type: 'sawtooth', vol: 0.16, when: i * 0.06 })); },
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.2, when: i * 0.16 })); },
  lose: () => { [330, 277, 220, 165].forEach((f, i) => tone(f, 0.4, { type: 'sine', vol: 0.18, when: i * 0.18 })); },
  edict: () => { tone(392, 0.12, { type: 'square', vol: 0.12 }); tone(523, 0.14, { type: 'square', vol: 0.1, when: 0.08 }); },
  deny: () => { tone(200, 0.09, { type: 'square', vol: 0.09, slide: -70 }); tone(150, 0.11, { type: 'square', vol: 0.07, when: 0.06, slide: -40 }); },   // отказ/ошибка
  bow: () => { tone(880, 0.07, { type: 'sawtooth', vol: 0.06, slide: -480 }); tone(1500, 0.04, { type: 'sine', vol: 0.04, when: 0.01, slide: -700 }); },   // тетива/свист стрелы
  hammer: () => { tone(1100 + Math.random() * 400, 0.03, { type: 'square', vol: 0.045, slide: -500 }); tone(170 + Math.random() * 30, 0.07, { type: 'triangle', vol: 0.08, when: 0.004 }); },   // тук молотка по дереву
  whistle: () => { tone(620, 0.55, { type: 'triangle', vol: 0.12, slide: 30 }); tone(932, 0.55, { type: 'triangle', vol: 0.09, when: 0.03, slide: 30 }); },   // паровозный гудок (двухголосый)
  chuff: () => { tone(110 + Math.random() * 25, 0.05, { type: 'square', vol: 0.028, slide: -50 }); },   // тихое чух-чух
};

export function sfx(name) { if (muted) return; const p = PRESETS[name]; if (p) try { p(); } catch (e) {} }
export function isMuted() { return muted; }
export function toggleMute() { muted = !muted; try { localStorage.setItem('GOYDA_EMPIRE_MUTE', muted ? '1' : '0'); } catch (e) {} return muted; }
export function resumeAudio() { ac(); }
export function audioCtx() { return ac(); }   // общий AudioContext для фоновой музыки/окружения (Music.js)
