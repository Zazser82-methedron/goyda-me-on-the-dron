// ===== Набеги (Fortnite-слой): волны врагов + именованные боссы =====
import { UNITS } from '../data/units.js';
import { BOSSES } from '../data/bosses.js';
import { bark } from '../data/barks.js';

const MAX_ENEMIES = 70;

export function update(state, dt, ctx) {
  if (state.gameOver || !state.townhall) return;
  if (state.nextWaveIn === undefined) state.nextWaveIn = 40;   // льготная фора в начале
  state.nextWaveIn -= dt;
  if (state.nextWaveIn <= 0) {
    spawnWave(state, ctx);
    state.waveNum = (state.waveNum || 0) + 1;
    state.nextWaveIn = Math.max(16, 42 - state.rankIndex * 3 - state.waveNum * 0.4);
  }
}

function edgePoints(state, count) {
  const n = state.grid.n, res = [];
  const edge = Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const t = Math.floor(Math.random() * n);
    let gx, gy;
    if (edge === 0) { gx = t; gy = 0; }
    else if (edge === 1) { gx = t; gy = n - 1; }
    else if (edge === 2) { gx = 0; gy = t; }
    else { gx = n - 1; gy = t; }
    const w = state.grid.gridToWorld(gx, gy);
    res.push({ x: w.wx + (Math.random() - 0.5) * 0.5, z: w.wz + (Math.random() - 0.5) * 0.5 });
  }
  return res;
}

function spawnWave(state, ctx) {
  if (state.enemies().length > MAX_ENEMIES) { state.nextWaveIn = 12; return; }
  const count = 2 + state.rankIndex * 2 + Math.floor((state.waveNum || 0) / 2);
  for (const p of edgePoints(state, count)) state.addUnit('raider', p.x, p.z, {});
  state.threatTimer = 8;
  ctx.sfx && ctx.sfx('raid');
  ctx.toast && ctx.toast('🚨 НАБЕГ #' + ((state.waveNum || 0) + 1) + '! ' + bark('raid'), { bad: true });
}

export function spawnBoss(state, key, ctx) {
  const b = BOSSES[key]; if (!b || state.gameOver) return;
  const pts = edgePoints(state, 1 + (b.escort || 0));
  const hp = Math.round(UNITS.boss.hp * b.hpMul);
  const boss = state.addUnit('boss', pts[0].x, pts[0].z, { tint: b.tint, hp, maxHp: hp, bossKey: key });
  boss.dmg = Math.round(UNITS.boss.dmg * b.dmgMul);
  boss.bossName = b.name; boss.emoji = b.emoji;
  for (let i = 1; i < pts.length; i++) state.addUnit('raider', pts[i].x, pts[i].z, {});
  if (b.mech === 'krio') { state.krioTimer = 22; ctx.toast && ctx.toast('❄️ ХЛАД ГОЙДЫ: добыча замедлена!', { bad: true }); }
  state.threatTimer = 14;
  ctx.sfx && ctx.sfx('boss');
  ctx.toast && ctx.toast(b.emoji + ' ' + b.name + ': «' + b.taunt + '»', { bad: true, big: true });
}
