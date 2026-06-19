// ===== Эпохи/ранги: авто-возвышение по населению и ВЕРЕ, набег-босс на рубеже =====
import { RANKS } from '../data/ranks.js?v=40';
import { bark } from '../data/barks.js?v=40';

export function update(state, dt, ctx) {
  if (state.gameOver) return;
  const next = RANKS[state.rankIndex + 1];
  if (!next || next.req.wonder) return;   // 'absolut' достигается достройкой чуда, не здесь
  const req = next.req;
  if (state.population >= (req.pop || 0) && state.resources.faith >= (req.faith || 0)) {
    state.rankIndex++;
    ctx.sfx && ctx.sfx('rankup');
    ctx.toast && ctx.toast(next.icon + ' ВОЗВЫШЕНИЕ: ты теперь ' + next.name + '! ' + bark('rankup'), { big: true, gold: true });
    ctx.onRankUp && ctx.onRankUp(state.rankIndex);
    // набег-босс рубежа
    if (next.boss && ctx.spawnBoss) setTimeout(() => ctx.spawnBoss(next.boss), 50);
  }
}
