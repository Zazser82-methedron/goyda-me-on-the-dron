// ===== Дичь и охота: звери бродят/убегают, наши юниты их добывают (еда + шкуры) =====
import { ANIMALS } from '../data/animals.js?v=65';

const COUNT = 14;        // желаемое поголовье на карте
const RESPAWN = 26;      // сек между респаунами (до COUNT)

export function spawn(state, count = COUNT) {
  if (!state.animals) state.animals = [];
  for (let i = 0; i < count; i++) spawnOne(state);
}

function randWalkable(state) {
  const g = state.grid, n = g.n;
  for (let t = 0; t < 40; t++) {
    const x = 4 + Math.floor(Math.random() * (n - 8));
    const y = 4 + Math.floor(Math.random() * (n - 8));
    const tile = g.get(x, y);
    if (tile && tile.walkable) return { x, y };
  }
  return null;
}

function spawnOne(state) {
  const p = randWalkable(state); if (!p) return null;
  const kind = Math.random() < 0.62 ? 'deer' : 'boar';
  const w = state.grid.gridToWorld(p.x, p.y);
  return state.addAnimal(kind, ANIMALS[kind], w.wx, w.wz);
}

export function update(state, dt, ctx) {
  if (state.gameOver || !state.animals) return;
  const g = state.grid;

  // респаун до нормы
  if (state.animals.length < COUNT) {
    state._wResp = (state._wResp || 0) + dt;
    if (state._wResp > RESPAWN) { state._wResp = 0; spawnOne(state); }
  }

  // движение зверья (блуждание / бегство от охотника)
  for (const a of state.animals) {
    a.px = a.x; a.pz = a.z;
    const hunter = a.hunterId ? state.byId(a.hunterId) : null;
    if (hunter && hunter.hp > 0) {
      const dx = a.x - hunter.x, dz = a.z - hunter.z, d = Math.hypot(dx, dz) || 1;
      if (d < 9) { a.tx = a.x + dx / d * 4; a.tz = a.z + dz / d * 4; a.fleeing = true; }
      else { a.fleeing = false; a.hunterId = null; }
    } else { a.fleeing = false; a.hunterId = null; }

    a.wanderT -= dt;
    if (!a.fleeing && a.wanderT <= 0) {
      a.wanderT = 2 + Math.random() * 3;
      const ang = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4;
      a.tx = a.x + Math.cos(ang) * r; a.tz = a.z + Math.sin(ang) * r;
    }
    moveToward(state, a, dt);
  }

  // ОХОТА: наши юниты с huntId догоняют зверя и бьют (вся логика тут, не в Units)
  for (const u of state.ours()) {
    if (!u.huntId) continue;
    const a = state.animals.find(an => an.id === u.huntId);
    if (!a) { u.huntId = null; u._huntTx = null; continue; }
    a.hunterId = u.id;
    const dx = a.x - u.x, dz = a.z - u.z, d = Math.hypot(dx, dz);
    const reach = (u.def.range || 1.2) + 0.5;
    if (d > reach) {
      const gp = g.worldToGrid(a.x, a.z);   // обновляем приказ только при смене тайла зверя
      if (u._huntTx !== gp.x || u._huntTy !== gp.y) { u._huntTx = gp.x; u._huntTy = gp.y; u.moveOrder = { x: gp.x, y: gp.y }; u.path = null; }
    } else {
      u.moveOrder = null; u.path = null; u._huntTx = null;
      u.dir = Math.atan2(dx, dz);
      u.huntCd = (u.huntCd || 0) - dt;
      if (u.huntCd <= 0) {
        u.huntCd = u.def.atkCd || 1.1; u.atkAnim = 0.2;
        a.hp -= (u.def.dmg || 5) * 1.5;          // охота результативнее обычного боя
        ctx.sfx && ctx.sfx('hit');
        if (a.hp <= 0) { killAnimal(state, a, ctx); }
      }
    }
  }
}

function moveToward(state, a, dt) {
  if (a.tx === undefined) return;
  const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
  if (d < 0.1) return;
  const sp = a.def.speed * (a.fleeing ? 1.15 : 0.7) * dt;
  const nx = a.x + dx / d * sp, nz = a.z + dz / d * sp;
  const g = state.grid, gp = g.worldToGrid(nx, nz), t = g.get(gp.x, gp.y);
  if (t && t.walkable) { a.x = nx; a.z = nz; a.dir = Math.atan2(dx, dz); }
  else { a.wanderT = 0; a.fleeing = false; }   // упёрлись — новая цель
}

function killAnimal(state, a, ctx) {
  state.gain(a.def.reward);
  ctx.toast && ctx.toast(`${a.def.icon} ${a.def.name} добыт! +${a.def.reward.food}🍞 +${a.def.reward.gold}🪙 (шкуры)`, { gold: true });
  ctx.float && ctx.float(a.x, a.z, '+' + a.def.reward.food + '🍞', '#9effd0');
  ctx.sfx && ctx.sfx('deposit');
  for (const o of state.ours()) if (o.huntId === a.id) { o.huntId = null; o._huntTx = null; }
  state.removeAnimal(a, true);
}
