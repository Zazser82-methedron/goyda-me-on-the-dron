// ===== Фракции: играбельные (мод-бонусы) + враждебные (тинт/тактика набегов) =====
// Игрок выбирает одну; набеги приходят из остальных.
export const FACTIONS = [
  {
    key: 'goyda', name: 'ГОЙДА', emoji: '🗿', color: '#ffcc00',
    desc: 'Путь ДРОНА. Вера крепка: +25% ВЕРЫ.',
    mods: { faithMul: 1.25, trainCostMul: 1, gatherMul: 1, startGold: 0, happy: 4 },
    raid: { hpMul: 1.0, speedMul: 1.0, tint: 0x5a1822 },
  },
  {
    key: 'oprichnina', name: 'ОПРИЧНИНА', emoji: '🐕', color: '#e0392b',
    desc: 'Чёрное войско. Воины −25% цены, но народ ропщет.',
    mods: { faithMul: 1, trainCostMul: 0.75, gatherMul: 1, startGold: 20, happy: -6 },
    raid: { hpMul: 1.15, speedMul: 1.05, tint: 0x201018 },
  },
  {
    key: 'kochevniki', name: 'КОЧЕВНИКИ', emoji: '🐎', color: '#d4a017',
    desc: 'Степь кормит. Добыча +25%, юниты прытки.',
    mods: { faithMul: 1, trainCostMul: 1, gatherMul: 1.25, startGold: 0, happy: 2 },
    raid: { hpMul: 0.9, speedMul: 1.3, tint: 0x4a3a1a },
  },
  {
    key: 'hlad', name: 'КУЛЬТ ХЛАДА', emoji: '❄️', color: '#00eeff',
    desc: 'Криомаги. ВЕРА +35%, но добыча мёрзнет (−10%).',
    mods: { faithMul: 1.35, trainCostMul: 1, gatherMul: 0.9, startGold: 0, happy: 0 },
    raid: { hpMul: 1.2, speedMul: 0.9, tint: 0x1a5a7a, krio: true },
  },
];

export function getFaction(key) { return FACTIONS.find(f => f.key === key) || FACTIONS[0]; }
export function hostileFor(state) {
  const hs = FACTIONS.filter(f => !state.faction || f.key !== state.faction.key);
  return hs[Math.floor(Math.random() * hs.length)] || FACTIONS[0];
}
