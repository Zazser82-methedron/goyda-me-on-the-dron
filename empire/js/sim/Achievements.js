// ===== Достижения — вехи прогресса (тост при разблокировке, сохранение между играми) =====
const ACH = [
  { k: 'settle', i: '🏗️', n: 'Первое поселение', c: s => s.buildings.length >= 3 },
  { k: 'druzhina', i: '⚔️', n: 'Дружина собрана', c: s => s.units.filter(u => u.faction === 'ours' && !u.def.worker).length >= 5 },
  { k: 'kazna', i: '💰', n: 'Полная казна', c: s => (s.resources.gold || 0) >= 250 },
  { k: 'pravednik', i: '☩', n: 'Праведник', c: s => (s.resources.faith || 0) >= 200 },
  { k: 'rank2', i: '📈', n: 'Возвышение', c: s => s.rankIndex >= 2 },
  { k: 'survivor', i: '⏳', n: 'Долгожитель', c: s => Math.floor(s.day || 0) >= 25 },
  { k: 'city', i: '🏘️', n: 'Город растёт', c: s => s.buildings.length >= 12 },
  { k: 'wonder', i: '🗿', n: 'Чудо заложено', c: s => !!s.idol },
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
      ctx.toast && ctx.toast('🏅 Достижение: ' + a.i + ' ' + a.n, { gold: true, big: true });
      ctx.sfx && ctx.sfx('rankup');
    }
  }
}
