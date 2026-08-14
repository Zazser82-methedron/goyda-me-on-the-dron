// ===== Риск ограбления караванов (§7 PHASE3-спеки) =====
// Общий механизм для телег (Transport.js) и поезда (Railroad.js): конвой, который везёт груз
// (convoy.cargo > 0) рядом с ЖИВЫМ вражьим станом (state.camps, из Waves.js/RaidFormats.js —
// осадный формат набега), рискует быть ограбленным. Не бесплатная угроза — стан игрок может снести,
// это осознанный выбор «оставить рядом опасную дорогу» или «разобраться со станом».
// Проверка не каждый кадр — раз в CHECK_INTERVAL с на конвой, пока он в движении с грузом.

const CHECK_INTERVAL = 2;              // с — не чаще одной проверки на конвой
const DANGER_RADIUS = 9;               // тайлов вокруг стана — зона риска (TILE=1, так что тайлы=world units)
const BASE_CHANCE = 0.12;              // шанс на одну проверку вплотную к стану, линейно падает к 0 на границе радиуса
const LOSS_MIN = 0.3, LOSS_MAX = 0.6;  // доля текущего груза, которую забирают за один налёт
const GRACE_AFTER_ROB = 10;            // с — после ограбления конвой временно не проверяется снова

// convoy — телега ({cargo,...}) или поезд ({cargo,...}); x,z — его текущая мировая позиция.
// riskMul (по умолчанию 1) — множитель шанса: дорогие караваны (купеческий обоз Эпохи II) —
// приоритетная цель налёта (§7 PHASE3-спеки), поэтому их проверяют внимательнее.
export function checkAmbush(state, convoy, x, z, dt, ctx, label, riskMul = 1) {
  if (!(convoy.cargo > 0)) return;
  convoy._robCd = Math.max(0, (convoy._robCd || 0) - dt);
  convoy._robT = (convoy._robT === undefined ? CHECK_INTERVAL : convoy._robT) - dt;
  if (convoy._robCd > 0 || convoy._robT > 0) return;
  convoy._robT = CHECK_INTERVAL;
  let nearest = Infinity;
  for (const c of state.camps) {
    if (c.hp <= 0) continue;
    const d = Math.hypot(c.cx - x, c.cz - z);
    if (d < nearest) nearest = d;
  }
  if (nearest > DANGER_RADIUS) return;
  const chance = Math.min(0.9, BASE_CHANCE * (1 - nearest / DANGER_RADIUS) * riskMul);
  if (Math.random() >= chance) return;
  const lost = Math.max(1, Math.round(convoy.cargo * (LOSS_MIN + Math.random() * (LOSS_MAX - LOSS_MIN))));
  convoy.cargo = Math.max(0, convoy.cargo - lost);
  convoy._robCd = GRACE_AFTER_ROB;
  ctx.toast && ctx.toast('🏴 ' + label + ' ограблен(а) у вражьего стана! −' + lost + '🪙 груза', { bad: true });
  ctx.float && ctx.float(x, z, '🏴−' + lost, '#ff4444');
  ctx.sfx && ctx.sfx('raid');
}
