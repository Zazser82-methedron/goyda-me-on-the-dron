// ===== Природа: отрастание деревьев + лесопосадки сажают новый лес =====
const STEP = 2.0;   // шаг природы, сек
const MAX_TREES = 420;

export function update(state, dt, ctx) {
  if (state.gameOver) return;
  state._natT = (state._natT || 0) + dt;
  if (state._natT < STEP) return;
  const d = state._natT; state._natT = 0;

  let trees = 0;
  for (const n of state.nodes) {
    if (n.resType !== 'wood') continue;
    trees++;
    if (n.depleted) {
      n.amount += 2;                                  // пень отрастает
      const s = Math.min(1, n.amount / (n.maxAmount * 0.6));
      n.view.scale.setScalar(0.22 + 0.78 * s);
      if (n.amount >= n.maxAmount * 0.6) { n.depleted = false; n.amount = Math.min(n.amount, n.maxAmount); }
    } else if (n.amount < n.maxAmount) {
      n.amount = Math.min(n.maxAmount, n.amount + 1);  // живое дерево подрастает
      n.view.scale.setScalar(0.45 + 0.55 * (n.amount / n.maxAmount));
    }
  }

  // лесопосадки сажают саженцы вокруг
  if (trees < MAX_TREES) {
    for (const b of state.buildings) {
      if (!b.built || b.kind !== 'roshcha') continue;
      b._plantT = (b._plantT || 0) + d;
      if (b._plantT >= 6) { b._plantT = 0; plantNear(state, b); }
    }
  }
}

function plantNear(state, b) {
  const R = 7;
  for (let t = 0; t < 16; t++) {
    const gx = b.gx + (Math.floor(Math.random() * (2 * R + 1)) - R);
    const gy = b.gy + (Math.floor(Math.random() * (2 * R + 1)) - R);
    if (state.grid.canPlace(gx, gy, 1, 1)) {
      const n = state.addNode('res_tree', gx, gy, 50);
      n.amount = 6; n.depleted = false; n.view.scale.setScalar(0.3);   // саженец
      return;
    }
  }
}
