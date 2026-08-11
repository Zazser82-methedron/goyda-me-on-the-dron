// ===== Форматы набегов: выбор, состав и стоимость угрозы =====

export const THREAT_COST = Object.freeze({
  raider_fast: 3, raider: 5, raider_heavy: 9, raider_shaman: 11, boss: 24,
});

export const RAID_FORMATS = Object.freeze({
  siege: { name: 'ОСАДА ЛАГЕРЕМ', icon: '🏴' },
  tribute: { name: 'ТРЕБОВАНИЕ ДАНИ', icon: '📜' },
  sabotage: { name: 'ДИВЕРСИЯ', icon: '🔥' },
  loot: { name: 'НАЛЁТ С УГОНОМ', icon: '🐎' },
});

const TEMPLATES = {
  siege: [
    ['raider', 'raider'],
    ['raider', 'raider', 'raider_heavy'],
    ['raider', 'raider', 'raider_heavy', 'raider_heavy', 'raider_shaman'],
  ],
  tribute: [
    ['raider'],
    ['raider', 'raider_heavy', 'raider_heavy'],
    ['raider_heavy', 'raider_shaman', 'boss'],
  ],
  sabotage: [
    ['raider_fast', 'raider_fast'],
    ['raider_fast', 'raider_fast', 'raider_fast', 'raider_shaman'],
    ['raider_fast', 'raider_fast', 'raider_fast', 'raider_fast', 'raider_shaman', 'raider_shaman'],
  ],
  loot: [
    ['raider_fast', 'raider_fast', 'raider_fast'],
    ['raider_fast', 'raider_fast', 'raider_fast', 'raider_fast', 'raider'],
    ['raider_fast', 'raider_fast', 'raider_fast', 'raider_fast', 'raider_fast', 'raider_fast', 'raider_heavy'],
  ],
};

function tier(rankIndex, depth) {
  const depthTier = depth >= 1.72 ? 2 : depth >= 1.36 ? 1 : 0;
  return Math.min(2, Math.max(depthTier, rankIndex >= 2 ? 2 : rankIndex >= 1 ? 1 : 0));
}

export function hasRuinedBuilding(state) {
  return state.buildings.some(b => b.built && (b.ruined || b.hp <= b.maxHp * 0.35));
}

// Два последних формата исключаются; при руинах диверсия получает 40% веса.
export function pickRaidFormat(state) {
  const weights = hasRuinedBuilding(state)
    ? { siege: 20, tribute: 20, sabotage: 40, loot: 20 }
    : { siege: 35, tribute: 30, loot: 35 };
  const recent = (state._raidHistory || []).slice(-2);
  let options = Object.entries(weights).filter(([key]) => !recent.includes(key));
  if (!options.length) options = Object.entries(weights);
  let roll = Math.random() * options.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [key, weight] of options) { roll -= weight; if (roll <= 0) return key; }
  return options[0][0];
}

// Бюджет ограничивает состав, но сохраняет характер формата и рост по рангу/глубине.
export function composeRaid(format, budget, rankIndex, depth, bossKeys = []) {
  const level = tier(rankIndex, depth || 1);
  const scaled = Math.max(0, Math.floor(budget));
  const wanted = (TEMPLATES[format] || TEMPLATES.siege)[level].slice();
  if (!bossKeys.length || level < 2) {
    const bossAt = wanted.indexOf('boss'); if (bossAt >= 0) wanted.splice(bossAt, 1);
  }
  // В Эпохе III (здесь rank/depth tier 2) босс обязан попасть в дань при бюджете от 24.
  if (format === 'tribute' && level === 2 && bossKeys.length && scaled >= THREAT_COST.boss) {
    wanted.sort((a, b) => (a === 'boss' ? -1 : 0) - (b === 'boss' ? -1 : 0));
  }
  const plan = [];
  let left = scaled;
  const add = kind => {
    const cost = THREAT_COST[kind] || Infinity;
    if (cost > left) return false;
    plan.push({ kind, bossKey: kind === 'boss' ? bossKeys[Math.floor(Math.random() * bossKeys.length)] : null });
    left -= cost;
    return true;
  };
  for (const kind of wanted) add(kind);

  // Остаток тратим на характерные для формата подкрепления, не создавая бесконечной очереди.
  const fill = format === 'sabotage' || format === 'loot'
    ? ['raider_fast', 'raider', 'raider_heavy']
    : level >= 2 ? ['raider_shaman', 'raider_heavy', 'raider', 'raider_fast']
      : level >= 1 ? ['raider_heavy', 'raider', 'raider_fast'] : ['raider', 'raider_fast'];
  while (left >= 3 && plan.length < 48) {
    const kind = fill.find(k => THREAT_COST[k] <= left);
    if (!kind) break;
    add(kind);
  }
  return { plan, spent: scaled - left, scaled };
}
