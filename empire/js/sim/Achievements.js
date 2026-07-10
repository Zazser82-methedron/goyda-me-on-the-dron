// ===== Достижения — вехи прогресса (тост + Доблесть при разблокировке, сохранение между играми) =====
import * as Meta from './Meta.js?v=89';

const ACH = [
  { k: 'settle', i: '🏗️', n: 'Первое поселение', v: 10, c: s => s.buildings.length >= 3 },
  { k: 'druzhina', i: '⚔️', n: 'Дружина собрана', v: 15, c: s => s.units.filter(u => u.faction === 'ours' && !u.def.worker).length >= 5 },
  { k: 'kazna', i: '💰', n: 'Полная казна', v: 12, c: s => (s.resources.gold || 0) >= 250 },
  { k: 'pravednik', i: '☩', n: 'Праведник', v: 15, c: s => (s.resources.faith || 0) >= 200 },
  { k: 'rank2', i: '📈', n: 'Возвышение', v: 15, c: s => s.rankIndex >= 2 },
  { k: 'survivor', i: '⏳', n: 'Долгожитель', v: 20, c: s => Math.floor(s.day || 0) >= 25 },
  { k: 'city', i: '🏘️', n: 'Город растёт', v: 25, c: s => s.buildings.length >= 12 },
  { k: 'wonder', i: '🗿', n: 'Чудо заложено', v: 40, c: s => !!s.idol },
  // новые системы (v70-v80)
  { k: 'veteran', i: '⭐', n: 'Первый ветеран', v: 12, c: s => s.units.some(u => u.faction === 'ours' && (u.vet || 0) >= 1) },
  { k: 'elite', i: '🌟', n: 'Трижды герой', v: 30, c: s => s.units.some(u => u.faction === 'ours' && (u.vet || 0) >= 3) },
  { k: 'archer', i: '🏹', n: 'Лучная стрельба', v: 12, c: s => s.units.some(u => u.faction === 'ours' && u.kind === 'luchnik') },
  { k: 'voyager', i: '🌀', n: 'Сквозь портал', v: 20, c: s => (s.portalDepth || 1) >= 2 },
  { k: 'explorer', i: '🪐', n: 'Глубокие Земли', v: 40, c: s => (s.portalDepth || 1) >= 4 },
  { k: 'trader', i: '🛒', n: 'Купеческое дело', v: 12, c: s => s.buildings.some(b => b.built && b.kind === 'market') },
  { k: 'warlord', i: '🛡️', n: 'Воевода орды', v: 30, c: s => s.units.filter(u => u.faction === 'ours' && !u.def.worker).length >= 12 },
  { k: 'gembaron', i: '💎', n: 'Самоцветный барон', v: 18, c: s => (s.resources.gems || 0) >= 50 },
];

function load() { try { return new Set(JSON.parse(localStorage.getItem('GOYDA_ACH') || '[]')); } catch (e) { return new Set(); } }
function save(set) { try { localStorage.setItem('GOYDA_ACH', JSON.stringify([...set])); } catch (e) {} }

export function update(state, dt, ctx) {
  if (state.gameOver) return;
  state._achT = (state._achT == null ? 2 : state._achT) - dt;
  if (state._achT > 0) return;
  state._achT = 3;                       // проверка раз в ~3с — дёшево
  if (!state._ach) state._ach = load();
  for (const a of ACH) {
    if (state._ach.has(a.k)) continue;
    let ok = false; try { ok = a.c(state); } catch (e) {}
    if (ok) {
      state._ach.add(a.k); save(state._ach);
      try { Meta.addValor(a.v || 0); } catch (e) {}   // достижение питает мета-Доблесть
      ctx.toast && ctx.toast('🏅 Достижение: ' + a.i + ' ' + a.n + ' (+' + (a.v || 0) + '⭐)', { gold: true, big: true });
      ctx.sfx && ctx.sfx('rankup');
    }
  }
}
