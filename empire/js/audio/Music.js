// ===== Процедурная фоновая музыка + звук окружения (WebAudio) =====
// Генеративный эмбиент: бас + пэд-аккорды + редкая мелодия (минорная пентатоника «Гойды»),
// ветер (шум через лоупасс), птицы днём, дождь/гром по погоде. Делит AudioContext со Sfx, уважает mute.
import { audioCtx, isMuted } from './Sfx.js?v=66';

const SCALE = [220.00, 261.63, 293.66, 329.63, 392.00];   // ля-минор пентатоника: A C D E G
const ROOTS = [110.00, 130.81, 146.83, 164.81];           // смены аккорда (бас): A C D E

function noiseBuffer(a, sec) {
  const n = (a.sampleRate * sec) | 0, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export class AmbientAudio {
  constructor() {
    this.actx = null; this.master = null; this.started = false;
    this.night = 0; this.threat = 0; this.weather = 'clear';
    this._beat = 0; this._chord = 0; this._nextNote = 0; this._timer = null;
    this._wind = null; this._rain = null;
  }

  start() {
    if (this.started) return;
    const a = audioCtx(); if (!a) return;
    this.actx = a; this.started = true;
    this.master = a.createGain(); this.master.gain.value = 0; this.master.connect(a.destination);
    this.master.gain.setTargetAtTime(0.22, a.currentTime, 2.0);   // плавный фейд-ин
    this._buildBeds();
    this._nextNote = a.currentTime + 0.1;
    this._timer = setInterval(() => this._sched(), 60);            // lookahead-планировщик нот
  }

  _buildBeds() {
    const a = this.actx;
    // ВЕТЕР: зацикленный шум → лоупасс → медленный LFO по громкости
    const ws = a.createBufferSource(); ws.buffer = noiseBuffer(a, 3); ws.loop = true;
    const wlp = a.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 480;
    const wg = a.createGain(); wg.gain.value = 0.06;
    const lfo = a.createOscillator(); lfo.frequency.value = 0.08;
    const lfoG = a.createGain(); lfoG.gain.value = 0.04;
    lfo.connect(lfoG); lfoG.connect(wg.gain);
    ws.connect(wlp); wlp.connect(wg); wg.connect(this.master);
    ws.start(); lfo.start();
    this._wind = { g: wg, lp: wlp };
    // ДОЖДЬ: шум через хайпасс, громкость 0 → поднимается в дождь/грозу
    const rs = a.createBufferSource(); rs.buffer = noiseBuffer(a, 3); rs.loop = true;
    const rhp = a.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 1400;
    const rg = a.createGain(); rg.gain.value = 0;
    rs.connect(rhp); rhp.connect(rg); rg.connect(this.master);
    rs.start();
    this._rain = { g: rg };
  }

  // зовётся каждый кадр из render — дёшево (только целевые громкости)
  update(night, threat, weather) {
    this.night = night; this.threat = threat; this.weather = weather;
    if (!this.started || !this.actx) return;
    const a = this.actx, t = a.currentTime;
    this.master.gain.setTargetAtTime(isMuted() ? 0 : 0.22, t, 0.3);
    if (this._wind) {
      const w = weather === 'storm' ? 1 : weather === 'rain' ? 0.6 : weather === 'fog' ? 0.5 : weather === 'snow' ? 0.4 : 0.18;
      this._wind.g.gain.setTargetAtTime(0.04 + w * 0.12, t, 1.5);
      this._wind.lp.frequency.setTargetAtTime(360 + w * 700, t, 1.5);
    }
    if (this._rain) this._rain.g.gain.setTargetAtTime(weather === 'storm' ? 0.16 : weather === 'rain' ? 0.1 : 0, t, 1.2);
  }

  thunder() {
    if (!this.started || isMuted()) return;
    const a = this.actx, t = a.currentTime;
    const ns = a.createBufferSource(); ns.buffer = noiseBuffer(a, 1.4);
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    ns.connect(lp); lp.connect(g); g.connect(this.master); ns.start(t); ns.stop(t + 1.7);
    const o = a.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(34, t + 1.2);
    const og = a.createGain();
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.35, t + 0.05); og.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 1.35);
  }

  victory() {   // триумфальный восходящий мотив + аккорд
    if (!this.started || isMuted()) return;
    const t = this.actx.currentTime;
    [261.63, 329.63, 392.00, 523.25, 659.25].forEach((f, i) => this._note(f, t + i * 0.17, 0.9, 'triangle', 0.16));
    [392.00, 523.25, 659.25, 783.99].forEach(f => this._note(f, t + 0.85, 2.6, 'triangle', 0.07));
  }
  defeat() {   // нисходящий минорный мотив
    if (!this.started || isMuted()) return;
    const t = this.actx.currentTime;
    [329.63, 277.18, 220.00, 164.81].forEach((f, i) => this._note(f, t + i * 0.32, 1.2, 'sine', 0.16));
    this._note(110, t, 3.0, 'sine', 0.1);
  }

  _sched() {
    if (!this.actx) return;
    const a = this.actx, spb = 60 / (64 + this.threat * 30);
    while (this._nextNote < a.currentTime + 0.15) {
      this._playBeat(this._nextNote);
      this._nextNote += spb; this._beat++;
      if (this._beat % 16 === 0) this._chord = (this._chord + 1) % ROOTS.length;
    }
  }

  _playBeat(when) {
    if (isMuted()) return;
    const root = ROOTS[this._chord];
    if (this._beat % 4 === 0) this._note(root, when, 1.8, 'sine', 0.15 + this.threat * 0.08);   // бас
    if (this._beat % 16 === 0) {                                                                 // пэд-аккорд
      this._note(root * 2, when, 4.5, 'triangle', 0.05);
      this._note(SCALE[2], when, 4.5, 'sine', 0.04);
      this._note(SCALE[4], when, 4.5, 'sine', 0.035);
    }
    const density = (1 - this.night) * 0.26 + this.threat * 0.25 + 0.06;                         // мелодия: днём гуще
    if (this._beat % 2 === 0 && Math.random() < density) {
      this._note(SCALE[(Math.random() * SCALE.length) | 0] * (Math.random() < 0.4 ? 2 : 1), when, 0.5, 'triangle', 0.07);
    }
    if (this.night < 0.35 && this.weather !== 'rain' && this.weather !== 'storm' && Math.random() < 0.05) this._chirp(when);
  }

  _note(freq, when, dur, type, vol) {
    const a = this.actx, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(this.master); o.start(when); o.stop(when + dur + 0.05);
  }

  _chirp(when) {
    const a = this.actx, o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; const b = 2200 + Math.random() * 1400;
    o.frequency.setValueAtTime(b, when); o.frequency.exponentialRampToValueAtTime(b * 1.5, when + 0.06); o.frequency.exponentialRampToValueAtTime(b * 0.8, when + 0.13);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.04, when + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
    o.connect(g); g.connect(this.master); o.start(when); o.stop(when + 0.2);
  }
}
