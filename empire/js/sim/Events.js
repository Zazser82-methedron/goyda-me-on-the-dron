// ===== Случайные события мира — оживляют партию (урожай/купец/засуха/мор/доброволец и т.п.) =====
// Периодически срабатывает событие: тост + эффект на ресурсы/счастье/войско. Без новых UI — самодостаточно.

const EVENTS = [
  { w: 3, good: true,  t: '🌾 Богатый урожай!',  m: 'Закрома ломятся (+60 ЕДА)',     f: s => s.gain({ food: 60 }) },
  { w: 2, good: true,  t: '🐫 Заезжий купец',    m: 'Выгодный обмен (+40 🪙 +3 💎)', f: s => s.gain({ gold: 40, gems: 3 }) },
  { w: 1, good: true,  t: '⛏️ Найдена реликвия', m: 'Святыня в земле (+30 ВЕРА)',     f: s => s.gain({ faith: 30 }) },
  { w: 2, good: true,  t: '🎉 Народное гуляние', m: 'Душа поёт (+счастье, +вера)',    f: s => { s.happiness = Math.min(100, s.happiness + 8); s.gain({ faith: 12 }); } },
  { w: 2, good: true,  t: '⚔️ Доброволец ГОЙДЫ', m: 'В строй встал ратник!',          f: s => { if (s.townhall) { const w = s.grid.gridToWorld(s.townhall.gx, s.townhall.gy); s.addUnit('ratnik', w.wx, w.wz, {}); } } },
  { w: 2, good: false, t: '☀️ Засуха',           m: 'Поля сохнут (−40 ЕДА)',          f: s => { s.resources.food = Math.max(0, s.resources.food - 40); } },
  { w: 2, good: false, t: '🦝 Воришки в ночи',   m: 'Увели золото (−30 🪙)',          f: s => { s.resources.gold = Math.max(0, s.resources.gold - 30); } },
  { w: 1, good: false, t: '🤒 Поветрие',         m: 'Хворь по избам (−счастье)',      f: s => { s.happiness = Math.max(0, s.happiness - 14); } },

  // --- события с ВЫБОРОМ (модалка + таймер; авто-решение = последний/отказ) ---
  { w: 2, choice: true, t: '🐫 Караван купца', m: 'Меняет лес на золото.', choices: [
    { lbl: 'Сменять (−60 🌲 → +50 🪙)', msg: 'Сделка по рукам! +50 🪙', f: s => { s.resources.wood = Math.max(0, s.resources.wood - 60); s.gain({ gold: 50 }); } },
    { lbl: 'Отказать', msg: 'Купец уехал ни с чем', f: () => {} },
  ] },
  { w: 2, choice: true, t: '🧳 Беженцы у ворот', m: 'Просятся в избы ГОЙДЫ.', choices: [
    { lbl: 'Впустить (+холоп, −20 🍞)', msg: 'Народ прибыл! +работник', f: s => { if (s.townhall) { const w = s.grid.gridToWorld(s.townhall.gx, s.townhall.gy); s.addUnit('kholop', w.wx, w.wz, {}); } s.resources.food = Math.max(0, s.resources.food - 20); s.happiness = Math.min(100, s.happiness + 6); } },
    { lbl: 'Прогнать (−счастье)', msg: 'Холодный приём (−счастье)', f: s => { s.happiness = Math.max(0, s.happiness - 5); } },
  ] },
  { w: 2, choice: true, t: '⚔️ Странник-наёмник', m: 'Продаст меч за золото.', choices: [
    { lbl: 'Нанять (−50 🪙 → ратник)', msg: 'В строю новый ратник!', f: s => { if ((s.resources.gold || 0) >= 50) { s.resources.gold -= 50; if (s.townhall) { const w = s.grid.gridToWorld(s.townhall.gx, s.townhall.gy); s.addUnit('ratnik', w.wx, w.wz, {}); } } } },
    { lbl: 'Отказать', msg: 'Наёмник ушёл к соседям', f: () => {} },
  ] },
];

function pick() {
  let tot = 0; for (const e of EVENTS) tot += e.w;
  let r = Math.random() * tot;
  for (const e of EVENTS) { r -= e.w; if (r <= 0) return e; }
  return EVENTS[0];
}

export function update(state, dt, ctx) {
  if (state.gameOver) return;
  if (state._eventT == null) { state._eventT = 70 + Math.random() * 30; return; }   // первое событие не сразу после старта
  state._eventT -= dt;
  if (state._eventT > 0) return;
  state._eventT = 60 + Math.random() * 55;                                          // интервал до следующего
  const e = pick();
  if (e.choice) {                                                                   // событие с выбором → модалка
    if (ctx.choiceEvent) ctx.choiceEvent(e);
    else if (e.choices[0]) try { e.choices[0].f(state); } catch (err) {}            // фолбэк без UI
    return;
  }
  try { e.f(state); } catch (err) {}
  if (ctx.toast) ctx.toast(e.t + ' — ' + e.m, { big: true, gold: e.good, bad: !e.good });
  if (ctx.sfx) ctx.sfx(e.good ? 'rankup' : 'raid');
  if (!e.good && ctx.shake) ctx.shake(0.25);
}
