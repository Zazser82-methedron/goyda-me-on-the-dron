// ===== Набеги (Fortnite-слой): волны врагов + именованные боссы =====
import { UNITS } from '../data/units.js?v=94';
import { BOSSES } from '../data/bosses.js?v=94';
import { bark } from '../data/barks.js?v=94';
import { hostileFor } from '../data/factions.js?v=94';
import { floodReachable, nearestAdj } from '../world/Pathfinding.js?v=94';
import { damage, setPath, setPathToBuilding } from './Units.js?v=105';
import { RAID_FORMATS, composeRaid, pickRaidFormat } from './RaidFormats.js?v=96';

// мягкий потолок одновременных врагов: меньше тормозов в лейте, угроза сохраняется (спавн просто
// откладывается на 12с, а не жёстко режется — см. spawnWave). Было 56 — костыль от тормозов ДО
// spatial hash (Units.js) и time-slicing ИИ-решений вне боя (тоже Units.js); замер на 301 юните
// после spatial hash — 9.07мс/тик, запас большой, а троттлинг решений режет самую дорогую часть
// этого бюджета (широкие queryNearest у юнитов вне непосредственного боя) в разы дополнительно.
// 250 — это ~4.5× от старого потолка, в районе того же порядка юнитов, что уже прогнан в замере.
// ВРЕМЕННОЕ значение до системы эпох: PHASE2_DESIGN_SPEC.md §3 предлагает per-era потолки 12/22/34,
// но эпох в коде ещё нет — когда появятся, заменить эту константу на table по rankIndex/эпохе.
const MAX_ENEMIES = 250;

// уровни сложности набегов (выбор игрока, сохраняется) — масштаб HP и частоты волн;
// число врагов теперь задаёт только бюджет угрозы, чтобы остаток был честно переносимым.
export const DIFF = {
  easy: { count: 0.7, hp: 0.8, interval: 1.4, emoji: '😌', name: 'Легко' },
  normal: { count: 1, hp: 1, interval: 1, emoji: '⚔️', name: 'Норма' },
  hard: { count: 1.4, hp: 1.3, interval: 0.7, emoji: '💀', name: 'Тяжело' },
};
function diff(state) { return DIFF[state.difficulty] || DIFF.normal; }
// глубина портала: каждая новая Земля чуть сложнее (число/HP врагов растут)
function depthMul(state) { const d = (state.portalDepth || 1) - 1; return { count: 1 + d * 0.18, hp: 1 + d * 0.12 }; }

// связная с базой суша (кэш) — спавним только там, откуда реально можно дойти до ратуши
export function reachSet(state) {
  if (state._reach) return state._reach;
  const th = state.townhall; if (!th) return null;
  state._reach = floodReachable(state.grid, th.gx + (th.w >> 1), th.gy + (th.h >> 1));
  return state._reach;
}

export function update(state, dt, ctx) {
  if (state.gameOver || !state.townhall) return;
  syncThreatBudget(state);
  if (state._activeRaid) updateActiveRaid(state, dt, ctx);
  // Набеги начинаются ТОЛЬКО когда игроку есть чем обороняться:
  // построена казарма, ИЛИ достигнут РАТНИК, ИЛИ уже есть воины.
  const canDefend = state.hasBuilt('kazarma') || state.rankIndex >= 1 || state.soldiers().length > 0;
  if (!canDefend) { state.nextWaveIn = undefined; resetRaidWarning(state); state._pendingFormat = null; return; }

  if (state.nextWaveIn === undefined) {
    state.nextWaveIn = 28;   // мирная фора после готовности к обороне
    ctx.toast && ctx.toast('🕊️ Скоро придут набеги — ставь ЧАСТОКОЛ и куй дружину.');
  }

  state.nextWaveIn -= dt;
  updateRaidWarning(state, ctx);
  // финальный отсчёт 6с — отдельно от ступеней ниже: включает боевую тревогу (музыка/аура/текст воинов).
  if (!state._warned6 && state.nextWaveIn <= 6 && state.nextWaveIn > 0) {
    state._warned6 = true; state.threatTimer = 6;
    ctx.sfx && ctx.sfx('raid');
  }
  if (state.nextWaveIn <= 0) {
    // Не накладываем форматы друг на друга: осада/дань должны успеть закончиться.
    if (state._activeRaid || !spawnWave(state, ctx)) { state.nextWaveIn = 12; return; }
    state.waveNum = (state.waveNum || 0) + 1;
    state._warned6 = false;
    resetRaidWarning(state);
    // волны реже и плавнее — игра дольше и спокойнее
    state.nextWaveIn = Math.max(38, 85 - state.rankIndex * 3 - state.waveNum * 0.3) * diff(state).interval;
  }
}

// ===== Многоступенчатое предупреждение о наборе (было: один флаг _warned за 6с) =====
// Три отметки на долях базовой отметки: 90с, если реально есть столько времени, иначе
// пропорционально сжатые под текущий интервал (см. Math.min ниже) — не предупреждаем
// раньше, чем есть время до набега, и не спамим повторно (стадии считаются один раз каждая).
const WARN_STAGE_FRACS = [1, 2 / 3, 1 / 3]; // ~90/60/30с при полном интервале
const WARN_ICONS = ['⚠️', '🔥', '🚨'];

function raidWarnTargetName(state, format) {
  if (format !== 'sabotage') return null;
  const b = productiveBuilding(state);
  return b && b !== state.townhall ? b.def.name : null;
}

function updateRaidWarning(state, ctx) {
  const stage = state._warnStage || 0;
  if (stage >= 3) return;
  if (state._warnStart === undefined) state._warnStart = state.nextWaveIn;
  const base = Math.min(90, state._warnStart);
  if (state.nextWaveIn > base * WARN_STAGE_FRACS[stage]) return;
  // выбираем формат набега заранее (не в момент спавна), чтобы было что показать игроку —
  // дальше он же используется в spawnWave, а не перевыбирается.
  if (!state._pendingFormat) state._pendingFormat = pickRaidFormat(state);
  const format = state._pendingFormat, label = RAID_FORMATS[format];
  state._warnStage = stage + 1;
  state.raidWarning = { stage: state._warnStage, format, targetName: raidWarnTargetName(state, format) };
  ctx.sfx && ctx.sfx('raid');
  const tail = state._warnStage === 3 ? ' К стенам!' : '';
  ctx.toast && ctx.toast(WARN_ICONS[stage] + ' ' + label.icon + ' ' + label.name + ' через ' + Math.ceil(state.nextWaveIn) + 'с!' + tail, { bad: true });
}

function resetRaidWarning(state) {
  state._warnStage = 0; state._warnStart = undefined; state.raidWarning = null;
}

// Эпох в GameState ещё нет: +5 за переход оставлен для будущего хука, но не начисляется.
function syncThreatBudget(state) {
  if (state._raidBudget === undefined) { state._raidBudget = 10; state._raidBudgetDay = state.day || 0; return; }
  const days = Math.max(0, (state.day || 0) - (state._raidBudgetDay || 0));
  if (days) { state._raidBudget += days * 3; state._raidBudgetDay = state.day; }
  // TODO: при появлении state.eraIndex добавить +5 за каждый переход эпохи.
}

// первая клетка от края внутрь, которая ПРОХОДИМА и СВЯЗАНА с базой (не остров за водой)
function landFromEdge(state, edge, t, reach) {
  const g = state.grid, n = g.n;
  let gx, gy, dx = 0, dy = 0;
  if (edge === 0) { gx = t; gy = 0; dy = 1; }
  else if (edge === 1) { gx = t; gy = n - 1; dy = -1; }
  else if (edge === 2) { gx = 0; gy = t; dx = 1; }
  else { gx = n - 1; gy = t; dx = -1; }
  for (let step = 0; step < n; step++) {
    const tile = g.get(gx, gy);
    if (tile && tile.walkable && (!reach || reach.has(gy * n + gx))) { const w = g.gridToWorld(gx, gy); return { x: w.wx, z: w.wz }; }
    gx += dx; gy += dy;
    if (!g.inBounds(gx, gy)) break;
  }
  return null;
}

function edgePoints(state, count) {
  const res = [];
  const reach = reachSet(state);
  let guard = 0;
  while (res.length < count && guard < count * 14) {
    guard++;
    const p = landFromEdge(state, Math.floor(Math.random() * 4), Math.floor(Math.random() * state.grid.n), reach);
    if (p) res.push({ x: p.x + (Math.random() - 0.5) * 0.4, z: p.z + (Math.random() - 0.5) * 0.4 });
  }
  if (!res.length) {   // запас: тайл рядом с ратушей (точно достижим)
    const th = state.townhall, c = th ? state.grid.gridToWorld(th.gx, th.gy - 2) : state.grid.gridToWorld(3, 3);
    res.push({ x: c.wx, z: c.wz });
  }
  return res;
}

function spawnWave(state, ctx) {
  if (state.enemies().length >= MAX_ENEMIES) return false;
  // формат уже мог быть выбран заранее на предупреждении (см. updateRaidWarning) — используем
  // его же, чтобы не разойтись с тем, что показали игроку в HUD/тостах.
  const format = state._pendingFormat || pickRaidFormat(state);
  const budget = Math.max(0, state._raidBudget || 0);
  const made = composeRaid(format, budget, state.rankIndex, depthMul(state).count, Object.keys(BOSSES));
  if (!made.plan.length) return false;
  state._pendingFormat = null; // потрачен успешным спавном
  state._raidBudget = Math.max(0, budget - made.spent);
  const hf = hostileFor(state);
  const raid = { format, plan: made.plan, hf, ids: [], t: 0, phase: 'approach', entry: edgePoints(state, 1)[0] };
  state._activeRaid = raid;
  state._raidHistory = [...(state._raidHistory || []), format].slice(-2);
  if (format === 'siege') startSiege(state, raid);
  else if (format === 'tribute') startTribute(state, raid, ctx);
  else if (format === 'sabotage') startSabotage(state, raid);
  else startLoot(state, raid);
  if (hf.raid.krio) state.krioTimer = Math.max(state.krioTimer, 8);
  state.threatTimer = 8;
  ctx.sfx && ctx.sfx('raid');
  const label = RAID_FORMATS[format];
  ctx.toast && ctx.toast(label.icon + ' ' + label.name + ' ' + hf.emoji + ' #' + ((state.waveNum || 0) + 1) + ': ' + bark('raid'), { bad: true });
  if (raid.telegraph) ctx.toast && ctx.toast(raid.telegraph, { bad: true });
  return true;
}

function spawnRaidUnit(state, raid, spec, point) {
  const def = UNITS[spec.kind]; if (!def) return null;
  const d = depthMul(state), h = raid.hf.raid;
  let hp = Math.max(1, Math.round(def.hp * h.hpMul * diff(state).hp * d.hp * (state.mutHp || 1)));
  const opt = { tint: def.tint || h.tint, hp, maxHp: hp, scale: def.scale || 1 };
  if (spec.kind === 'boss') opt.bossKey = spec.bossKey;
  const u = state.addUnit(spec.kind, point.x, point.z, opt);
  u.speed = def.speed * h.speedMul;
  if (spec.kind === 'boss') {
    const boss = BOSSES[spec.bossKey];
    if (boss) { u.hp = u.maxHp = Math.max(1, Math.round(hp * boss.hpMul)); u.dmg = Math.round(def.dmg * boss.dmgMul); u.bossName = boss.name; u.emoji = boss.emoji; }
  }
  raid.ids.push(u.id);
  return u;
}

function spawnPlan(state, raid, plan, point) {
  for (const spec of plan) {
    if (state.enemies().length >= MAX_ENEMIES) break;
    const p = { x: point.x + (Math.random() - .5) * .8, z: point.z + (Math.random() - .5) * .8 };
    spawnRaidUnit(state, raid, spec, p);
  }
}

function liveRaidUnits(state, raid) { return raid.ids.map(id => state.byId(id)).filter(Boolean); }
function buildingById(state, id) { return state.buildings.find(b => b.id === id); }
function dist2(a, b) { return (a.x - b.x) ** 2 + (a.z - b.z) ** 2; }
function clampHappy(state, delta) { state.happiness = Math.max(0, Math.min(100, state.happiness + delta)); }

function finishRaid(state, raid, ctx, success, text, reward = null) {
  if (state._activeRaid !== raid) return;
  state._activeRaid = null;
  if (success) state._raidBudget = Math.max(0, (state._raidBudget || 0) + 8);
  if (reward) state.gain(reward);
  ctx.toast && ctx.toast(text, { bad: !success, gold: success, big: success });
}

function findCampSpot(state) {
  const g = state.grid, reach = reachSet(state);
  for (let i = 0; i < 36; i++) {
    const p = edgePoints(state, 1)[0], c = g.worldToGrid(p.x, p.z);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      const x = c.x + dx, y = c.y + dy;
      if (g.inBounds(x, y) && g.canPlace(x, y, 2, 2) && (!reach || reach.has(y * g.n + x))) return { x, y };
    }
  }
  return null;
}

function startSiege(state, raid) {
  const spot = findCampSpot(state);
  if (!spot) { // TODO: на картах без места под enemy_camp осада деградирует в обычный штурм.
    spawnPlan(state, raid, raid.plan, raid.entry); raid.phase = 'assault'; return;
  }
  const camp = state.addCamp(spot.x, spot.y);
  camp.spawnT = -999; // Camps.js не должен добавлять свою независимую очередь этой осаде.
  raid.campId = camp.id; raid.queue = raid.plan.slice(); raid.phase = 'camp'; raid.t = -16; // лагерь виден 24с до первого отряда
  raid.telegraph = '🏴 Вражий лагерь замечен у края: 24с до первого отряда.';
}

function startTribute(state, raid, ctx) {
  const messenger = raid.plan.shift();
  const u = messenger && spawnRaidUnit(state, raid, messenger, raid.entry);
  if (!u) { finishRaid(state, raid, ctx, true, '📜 Посол не добрался. Набег сорван.'); return; }
  u.speed = 0; raid.messengerId = u.id; raid.phase = 'demand'; raid.t = 18;
  const gold = Math.min(70, 15 + state.rankIndex * 18), food = Math.min(100, 30 + state.rankIndex * 24);
  if (ctx.choiceEvent) ctx.choiceEvent({
    t: '📜 ТРЕБОВАНИЕ ДАНИ', m: 'Посол ждёт у края. Откупиться или готовить штурм.', choices: [
      { lbl: 'Отдать ' + gold + ' 🪙', msg: 'Дань уплачена', f: s => { if (s.spend({ gold })) raid.paid = 'gold'; else raid.refused = true; } },
      { lbl: 'Отдать ' + food + ' 🍞', msg: 'Дань уплачена', f: s => { if (s.spend({ food })) raid.paid = 'food'; else raid.refused = true; } },
      { lbl: 'Отказать — к оружию!', msg: 'Посол зовёт штурм', f: () => { raid.refused = true; } },
    ],
  });
}

function productiveBuilding(state) {
  const candidates = state.buildings.filter(b => b.built && b !== state.townhall && b.def.produce);
  return candidates.reduce((best, b) => {
    const score = Object.values(b.def.produce || {}).reduce((sum, n) => sum + Math.max(0, n), 0);
    const bestScore = best ? Object.values(best.def.produce || {}).reduce((sum, n) => sum + Math.max(0, n), 0) : -1;
    return score > bestScore ? b : best;
  }, null) || state.townhall;
}

function startSabotage(state, raid) {
  const target = productiveBuilding(state);
  if (!target) { raid.phase = 'assault'; spawnPlan(state, raid, raid.plan, raid.entry); return; }
  raid.targetId = target.id; raid.exit = edgePoints(state, 1)[0]; raid.phase = 'telegraph'; raid.t = 16;
  raid.telegraph = '🔥 Метка диверсии: ' + target.def.name + '. Враги выйдут через 16с.';
}

function startLoot(state, raid) {
  const drops = state.buildings.filter(b => b.built && (b.kind === 'ambar' || b.kind === 'market'));
  const target = drops.reduce((best, b) => !best || dist2(b, raid.entry) < dist2(best, raid.entry) ? b : best, null) || state.nearestDrop(raid.entry.x, raid.entry.z);
  if (!target) { raid.phase = 'assault'; spawnPlan(state, raid, raid.plan, raid.entry); return; }
  raid.targetId = target.id; raid.exit = { x: -raid.entry.x, z: -raid.entry.z }; raid.phase = 'telegraph'; raid.t = 14;
  raid.telegraph = '💨 Дым указывает на ' + target.def.name + ': налёт через 14с.';
}

function routeUnitsToBuilding(state, units, target) {
  for (const u of units) { u.repathT = 0; setPathToBuilding(state, u, target); }
}
function routeUnitsToExit(state, units, exit) {
  const g = state.grid.worldToGrid(exit.x, exit.z);
  for (const u of units) { u.repathT = 0; setPath(state, u, g.x, g.y); }
}

function updateActiveRaid(state, dt, ctx) {
  const raid = state._activeRaid;
  if (raid.format === 'siege') return updateSiege(state, raid, dt, ctx);
  if (raid.format === 'tribute') return updateTribute(state, raid, dt, ctx);
  if (raid.format === 'sabotage') return updateSabotage(state, raid, dt, ctx);
  updateLoot(state, raid, dt, ctx);
}

function updateSiege(state, raid, dt, ctx) {
  if (raid.phase === 'assault') {
    if (!liveRaidUnits(state, raid).length) finishRaid(state, raid, ctx, true, '🏴 Осада отбита! +8 угрозы следующей волне.');
    return;
  }
  const camp = state.campById(raid.campId);
  if (!camp) { state._raidBudget = Math.max(0, (state._raidBudget || 0) - 6); finishRaid(state, raid, ctx, true, '🏴 Вражий лагерь снесён! +20🪙, угроза −6.', { gold: 20 + Math.min(35, state.rankIndex * 12) }); return; }
  raid.t += dt;
  if (raid.t < 8 || !raid.queue.length || state.enemies().length >= MAX_ENEMIES) return;
  raid.t = 0;
  const adj = nearestAdj(state.grid, camp.gx, camp.gy, camp.w, camp.h, camp.gx, camp.gy) || { x: camp.gx, y: camp.gy };
  const p = state.grid.gridToWorld(adj.x, adj.y);
  spawnPlan(state, raid, raid.queue.splice(0, 2), { x: p.wx, z: p.wz });
}

function beginTributeAssault(state, raid) {
  const messenger = state.byId(raid.messengerId);
  if (messenger) messenger.speed = messenger.def.speed * raid.hf.raid.speedMul;
  spawnPlan(state, raid, raid.plan, raid.entry); raid.phase = 'assault';
}

function updateTribute(state, raid, dt, ctx) {
  const live = liveRaidUnits(state, raid);
  if (raid.phase === 'demand') {
    if (raid.paid) { const m = state.byId(raid.messengerId); if (m) state.removeUnit(m); clampHappy(state, -5); finishRaid(state, raid, ctx, true, '📜 Дань уплачена. Народ недоволен: −5 счастья.'); return; }
    if (!live.length) { finishRaid(state, raid, ctx, true, '📜 Посол и отряд сражены! +10☩.', { faith: 10 }); return; }
    raid.t -= dt;
    if (raid.refused || raid.t <= 0) beginTributeAssault(state, raid);
    return;
  }
  if (!live.length) finishRaid(state, raid, ctx, true, '⚔️ Отряд, требовавший дань, разбит! +10☩.', { faith: 10 });
}

function updateSabotage(state, raid, dt, ctx) {
  const units = liveRaidUnits(state, raid), target = buildingById(state, raid.targetId);
  if (raid.phase === 'telegraph') {
    raid.t -= dt;
    if (raid.t <= 0) { raid.phase = 'approach'; spawnPlan(state, raid, raid.plan, raid.entry); }
    return;
  }
  if (!units.length && raid.phase !== 'retreat') { finishRaid(state, raid, ctx, true, '🔥 Диверсия сорвана! +15☩.', { faith: 15 }); return; }
  if (raid.phase === 'approach') {
    if (!target) { finishRaid(state, raid, ctx, true, '🔥 Цель диверсии исчезла — набег сорван.'); return; }
    routeUnitsToBuilding(state, units, target);
    if (units.some(u => dist2(u, target) < 8)) { raid.phase = 'burn'; raid.t = 12; for (const u of units) { u.speed = 0; u.dmg = 0; } ctx.toast && ctx.toast('🔥 Диверсанты поджигают ' + target.def.name + '! 12с до ущерба.', { bad: true }); }
    return;
  }
  if (raid.phase === 'burn') {
    if (!target) { finishRaid(state, raid, ctx, true, '🔥 Поджог сорван. +15☩.', { faith: 15 }); return; }
    raid.t -= dt;
    if (!units.length) { finishRaid(state, raid, ctx, true, '🔥 Огонь потушен дружиной! +15☩.', { faith: 15 }); return; }
    if (raid.t <= 0) {
      damage(state, target, Math.max(1, Math.round(target.maxHp * .35)), ctx);
      // TODO: Economy.js пока не читает простой; поле подготовлено для системы износа/ремонта.
      target._raidDowntimeDays = Math.max(target._raidDowntimeDays || 0, 3);
      raid.phase = 'retreat'; for (const u of units) { u.speed = u.def.speed * raid.hf.raid.speedMul; u.dmg = u.def.dmg; }
    }
    return;
  }
  routeUnitsToExit(state, units, raid.exit);
  for (const u of units) if (dist2(u, raid.exit) < 2.5) state.removeUnit(u);
  if (!liveRaidUnits(state, raid).length) finishRaid(state, raid, ctx, false, '🔥 Диверсанты скрылись: постройка получила 35% урона.');
}

function steal(state) {
  const result = {};
  for (const key of ['food', 'gold']) {
    const amount = Math.min(80, Math.floor((state.resources[key] || 0) * (.2 + Math.random() * .3)));
    state.resources[key] = Math.max(0, (state.resources[key] || 0) - amount); result[key] = amount;
  }
  return result;
}

function updateLoot(state, raid, dt, ctx) {
  const units = liveRaidUnits(state, raid), target = buildingById(state, raid.targetId);
  if (raid.phase === 'telegraph') {
    raid.t -= dt;
    if (raid.t <= 0) { raid.phase = 'approach'; spawnPlan(state, raid, raid.plan, raid.entry); }
    return;
  }
  if (!units.length) {
    const trophy = raid.stolen ? { food: Math.floor((raid.stolen.food || 0) * .1), gold: Math.floor((raid.stolen.gold || 0) * .1) } : null;
    const escaped = raid.escaped || 0;
    finishRaid(state, raid, ctx, !escaped, escaped ? '🐎 Налётчики скрылись с добычей.' : (raid.stolen ? '🐎 Налётчики перехвачены! Возвращена часть добычи.' : '🐎 Налёт сорван до погрузки.'), trophy); return;
  }
  if (raid.phase === 'approach') {
    if (!target) { finishRaid(state, raid, ctx, true, '🐎 Закрома не найдены — налёт сорван.'); return; }
    routeUnitsToBuilding(state, units, target);
    if (units.some(u => dist2(u, target) < 8)) { raid.phase = 'load'; raid.t = 10; for (const u of units) { u.speed = 0; u.dmg = 0; } ctx.toast && ctx.toast('🐎 Налётчики грузят добычу! 10с до отхода.', { bad: true }); }
    return;
  }
  if (raid.phase === 'load') {
    raid.t -= dt;
    if (raid.t > 0) return;
    raid.stolen = steal(state); raid.phase = 'retreat';
    for (const u of units) { u.speed = u.def.speed * raid.hf.raid.speedMul; u.dmg = u.def.dmg; }
    ctx.toast && ctx.toast('🐎 Уводят добычу: −' + raid.stolen.food + '🍞 −' + raid.stolen.gold + '🪙!', { bad: true });
    return;
  }
  routeUnitsToExit(state, units, raid.exit);
  let escaped = 0;
  for (const u of units) if (dist2(u, raid.exit) < 2.5) { state.removeUnit(u); escaped++; }
  raid.escaped = (raid.escaped || 0) + escaped;
  if (escaped && !liveRaidUnits(state, raid).length) finishRaid(state, raid, ctx, false, '🐎 Налётчики скрылись с добычей.');
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
