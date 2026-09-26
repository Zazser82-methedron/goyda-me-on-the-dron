// ===== Производственные цепочки и нужды дворов =====
// Здесь только данные игры: модуль можно проверять Node без Three.js.

const NEEDS = [
  { key: 'food', name: 'Еда', kinds: ['ambar'], radius: 10 },
  { key: 'faith', name: 'Вера', kinds: ['church', 'agitpunkt'], radius: 9 },
  { key: 'fun', name: 'Веселье', kinds: ['traktir'], radius: 8 },
  { key: 'health', name: 'Здоровье', kinds: ['banya'], radius: 8 },
  { key: 'order', name: 'Порядок', kinds: ['zastava_ostrog', 'prikaz_sbora'], radius: 10 },
];

function center(b) { return { x: b.gx + b.w * 0.5, y: b.gy + b.h * 0.5 }; }

export function isNearKind(building, buildings, kind, radius) {
  const a = center(building);
  return buildings.some(other => {
    if (other === building || other.kind !== kind || !other.built || other.ruined) return false;
    const b = center(other);
    return Math.hypot(a.x - b.x, a.y - b.y) <= radius;
  });
}

export function canConvert(resources, convert) {
  return Object.entries(convert.in || {}).every(([key, amount]) => (resources[key] || 0) >= amount);
}

// Возвращает true, когда преобразование действительно прошло.
export function convert(resources, cap, recipe) {
  if (!canConvert(resources, recipe)) return false;
  for (const [key, amount] of Object.entries(recipe.in || {})) resources[key] -= amount;
  for (const [key, amount] of Object.entries(recipe.out || {})) {
    resources[key] = Math.min(cap[key] ?? Infinity, (resources[key] || 0) + amount);
  }
  return true;
}

export function runConversions(state, built) {
  const consumed = {};
  for (const b of built) {
    const recipe = b.def && b.def.convert;
    if (!recipe) continue;
    const near = b.def.convertNearby;
    // Трактир без пасеки не простаивает: он всё ещё даёт своё обычное веселье.
    if (near && !isNearKind(b, built, near.kind, near.radius)) { b.idle = false; continue; }
    b.idle = !convert(state.resources, state.cap, recipe);
    if (!b.idle) for (const [key, amount] of Object.entries(recipe.in || {})) consumed[key] = (consumed[key] || 0) + amount;
  }
  return consumed;
}

export function homesteadNeeds(homestead, built) {
  const a = center(homestead);
  const covered = {};
  for (const need of NEEDS) {
    covered[need.key] = built.some(b => {
      if (!b.built || b.ruined || !need.kinds.includes(b.kind)) return false;
      const c = center(b);
      return Math.hypot(a.x - c.x, a.y - c.y) <= need.radius;
    });
  }
  return covered;
}

export function needsCoverage(built) {
  const homes = built.filter(b => b.kind === 'izba');
  if (!homes.length) return { homes: 0, average: 0.5, byNeed: {}, byHome: new Map() };
  const byNeed = Object.fromEntries(NEEDS.map(n => [n.key, 0]));
  const byHome = new Map();
  for (const home of homes) {
    const covered = homesteadNeeds(home, built);
    byHome.set(home.id, covered);
    for (const key in covered) if (covered[key]) byNeed[key]++;
  }
  const total = NEEDS.length * homes.length;
  const met = Object.values(byNeed).reduce((sum, count) => sum + count, 0);
  for (const key in byNeed) byNeed[key] /= homes.length;
  return { homes: homes.length, average: met / total, byNeed, byHome };
}

export const NEED_LABELS = Object.fromEntries(NEEDS.map(n => [n.key, n.name]));
