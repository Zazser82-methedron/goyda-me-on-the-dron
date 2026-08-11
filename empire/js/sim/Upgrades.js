// ===== Модернизация построек: 2 ветки специализации (выбор навсегда) вместо линейных уровней =====
// b.upgrade: null | 'a' | 'b'. b._upgradeWork — активная модернизация (простой: производство на паузе).
// Цена: ресурсы + рабочие (резерв на время работ, как startRepair) + время. «Дешёвый откат» — 1 раз за
// эпоху (state.upgradeResets, обнуляется в Eras.js при смене эпохи), возвращает бонусы старой ветки.
// Модель отката: applyEffects(...,-1) отменяет РОВНО те дельты, что применил apply(...,+1) — без пересчёта
// с нуля. Считаем это «повторным выбором ветки», а не отдельной механикой — см. отчёт задачи.
import { apply as applyWear } from './Wear.js?v=1';

const RESET_COST = { gold: 20 };   // спека не даёт числа для отката — придумано в стиле цен эдиктов
const RESETS_PER_ERA = 1;

function idleWorkers(state, n) {
  const list = state.workers().filter(u => !u.buildSite && !u.repairSite && !u.upgradeSite);
  return list.length >= n ? list.slice(0, n) : null;
}

// применяет (sign=+1) или отменяет (sign=-1) дельты одной ветки апгрейда на конкретном здании b.
// поддерживаемые ключи eff: pop, produce{}, cap{}, hp, wearRateDelta, auraAdd{radius,tick,effect,power},
// auraPowerMul, auraRadiusDelta, trainTimeMul, trainCostMul (последние два читает Buildings.js напрямую).
function applyEffects(state, b, eff, sign) {
  if (eff.pop) b.def.pop = (b.def.pop || 0) + sign * eff.pop;
  if (eff.produce) {
    b.def.produce = { ...(b.def.produce || {}) };   // НЕ мутировать в общий каталог — только свежий per-building объект
    for (const k in eff.produce) b.def.produce[k] = (b.def.produce[k] || 0) + sign * eff.produce[k];
  }
  if (eff.cap) { for (const k in eff.cap) state.cap[k] = Math.max(0, (state.cap[k] || 0) + sign * eff.cap[k]); }
  if (eff.hp) b._wearBaseMaxHp = Math.max(1, (b._wearBaseMaxHp || b.def.hp) + sign * eff.hp);
  if (eff.wearRateDelta) {
    // клонируем _wearBaseDef ПЕРЕД правкой — это общий каталожный объект (BUILDINGS[kind]) до первого клона;
    // Wear.js читает только b._wearBaseDef.* (никогда не сравнивает по ссылке с каталогом), клон безопасен.
    b._wearBaseDef = { ...b._wearBaseDef, wearRate: Math.max(0, (b._wearBaseDef.wearRate || 0) + sign * eff.wearRateDelta) };
  }
  if (eff.auraAdd) {
    if (sign > 0) { b.def.aura = { ...eff.auraAdd }; b._wearBaseAuraPower = eff.auraAdd.power; }
    else { b.def.aura = null; b._wearBaseAuraPower = undefined; }
  }
  if (eff.auraPowerMul && b._wearBaseAuraPower != null) b._wearBaseAuraPower *= sign > 0 ? eff.auraPowerMul : 1 / eff.auraPowerMul;
  if (eff.auraRadiusDelta && b.def.aura) b.def.aura.radius = Math.max(1, b.def.aura.radius + sign * eff.auraRadiusDelta);
  if (eff.trainTimeMul || eff.trainCostMul) {
    b._upgradeEffects = b._upgradeEffects || {};
    if (eff.trainTimeMul) b._upgradeEffects.trainTimeMul = sign > 0 ? eff.trainTimeMul : 1;
    if (eff.trainCostMul) b._upgradeEffects.trainCostMul = sign > 0 ? eff.trainCostMul : 1;
  }
}

function afterEffectChange(state, b) {
  applyWear(state, b);
  b.hp = Math.min(b.hp, b.maxHp);
  state.recomputePop();
}

export function branches(b) { return (b.def && b.def.upgrades) || null; }

export function startUpgrade(state, b, branchKey, ctx) {
  if (!b || !b.built) return { ok: false, reason: 'здание ещё не построено' };
  if (b.ruined) return { ok: false, reason: 'сперва восстановите из руин' };
  if (b.repairLeft || b._upgradeWork) return { ok: false, reason: 'постройка занята (ремонт/модернизация)' };
  const br = b.def.upgrades && b.def.upgrades[branchKey];
  if (!br) return { ok: false, reason: 'нет такой ветки модернизации' };
  if (b.upgrade) return { ok: false, reason: 'ветка уже выбрана (' + b.def.upgrades[b.upgrade].name + ') — нужен откат' };
  const need = br.workers || 1;
  const crew = idleWorkers(state, need);
  if (!crew) return { ok: false, reason: 'нужно свободных рабочих: ' + need };
  if (!state.canAfford(br.cost)) return { ok: false, reason: 'мало ресурсов' };
  state.spend(br.cost);
  for (const w of crew) w.upgradeSite = b.id;
  b._stashedProduce = b.def.produce ? { ...b.def.produce } : null;   // «здание не производит во время апгрейда»
  b.def.produce = {};
  b._upgradeWork = { branch: branchKey, left: br.time || 1, workerIds: crew.map(w => w.id) };
  ctx.toast && ctx.toast('🛠️ ' + b.def.name + ': модернизация «' + br.name + '» начата (' + (br.time || 1) + 'с простоя)');
  return { ok: true };
}

function finishUpgrade(state, b, ctx) {
  const w = b._upgradeWork;
  const br = b.def.upgrades[w.branch];
  for (const id of w.workerIds) { const u = state.byId(id); if (u) u.upgradeSite = null; }
  b.def.produce = b._stashedProduce || {};
  b._stashedProduce = null;
  b._upgradeWork = null;
  b.upgrade = w.branch;
  applyEffects(state, b, br.effects || {}, +1);
  afterEffectChange(state, b);
  ctx.toast && ctx.toast('✅ ' + b.def.name + ': «' + br.name + '» готово — ' + (br.desc || ''), { gold: true });
  ctx.sfx && ctx.sfx('build');
}

export function resetUpgrade(state, b, ctx) {
  if (!b || !b.upgrade) return { ok: false, reason: 'ветка не выбрана' };
  if ((state.upgradeResets || 0) >= RESETS_PER_ERA) return { ok: false, reason: 'откат уже использован в этой эпохе' };
  if (!state.canAfford(RESET_COST)) return { ok: false, reason: 'мало ресурсов на откат' };
  const br = b.def.upgrades[b.upgrade];
  state.spend(RESET_COST);
  applyEffects(state, b, br.effects || {}, -1);
  afterEffectChange(state, b);
  b.upgrade = null;
  state.upgradeResets = (state.upgradeResets || 0) + 1;
  ctx.toast && ctx.toast('↩️ ' + b.def.name + ': ветка «' + br.name + '» отменена — можно выбрать заново', { bad: true });
  return { ok: true };
}

export function update(state, dt, ctx) {
  for (const b of state.buildings) {
    if (!b._upgradeWork) continue;
    const w = b._upgradeWork;
    // рабочий(и) пропал(и) (погиб под набегом) — работа стоит, как ремонт при потере rабочего (тот же паттерн).
    if (w.workerIds.some(id => !state.byId(id))) continue;
    w.left -= dt;
    if (w.left > 0) continue;
    finishUpgrade(state, b, ctx);
  }
}
