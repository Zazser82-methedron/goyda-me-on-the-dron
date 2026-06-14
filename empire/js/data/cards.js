// ===== Карты-архетипы «Гойды» как разыгрываемые способности =====
// cost — ВЕРА. effect(state, ctx) — мгновенный эффект.
import { nearestAdj } from '../world/Pathfinding.js?v=6';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hurtAll(state, amt) {
  for (const e of state.enemies()) { e.hp -= amt; if (e.hp <= 0) state.killUnit(e); }
}
function stunAll(state, sec) { for (const e of state.enemies()) e.stunT = Math.max(e.stunT || 0, sec); }
function poisonAll(state, dmg, sec) { for (const e of state.enemies()) { e.poisonT = sec; e.poisonDmg = dmg; } }
function summon(state, kind, n) {
  const b = state.townhall; if (!b) return;
  for (let i = 0; i < n; i++) {
    const adj = nearestAdj(state.grid, b.gx, b.gy, b.w, b.h, b.gx, b.gy) || { x: b.gx, y: b.gy };
    const w = state.grid.gridToWorld(adj.x, adj.y);
    state.addUnit(kind, w.wx + (Math.random() - 0.5), w.wz + (Math.random() - 0.5), {});
  }
}
function healBuildings(state) { for (const b of state.buildings) b.hp = b.maxHp; }
function happy(state, d) { state.happiness = clamp(state.happiness + d, 0, 100); }

export const CARDS = [
  { key: 'giper_goyd', name: 'ГИПЕР-ГОЙД', emoji: '💥', cost: 30, rarity: 'leg',
    desc: 'Удар по ВСЕМ врагам на карте (40).', effect: (s) => hurtAll(s, 40) },
  { key: 'absolut_goyda', name: 'АБСОЛЮТ-ГОЙДА', emoji: '🌟', cost: 60, rarity: 'leg',
    desc: 'Кара по всем врагам (80) + чинит все постройки.', effect: (s) => { hurtAll(s, 80); healBuildings(s); } },
  { key: 'krio_goyda', name: 'КРИО-ГОЙДА', emoji: '❄️', cost: 25, rarity: 'epic',
    desc: 'Замораживает весь набег на 5с.', effect: (s) => stunAll(s, 5) },
  { key: 'oprich_goyda', name: 'ОПРИЧ-ГОЙДА', emoji: '🛡️', cost: 35, rarity: 'epic',
    desc: 'Призывает 3 ОПРИЧНИКОВ у ратуши.', effect: (s) => summon(s, 'oprichnik', 3) },
  { key: 'nagoydatel', name: 'НАГОЙДАТЕЛЬ', emoji: '⚔️', cost: 20, rarity: 'rare',
    desc: 'Призывает 4 РАТНИКОВ у ратуши.', effect: (s) => summon(s, 'ratnik', 4) },
  { key: 'goydo_obereg', name: 'ГОЙДО-ОБЕРЕГ', emoji: '🔰', cost: 20, rarity: 'epic',
    desc: 'Чинит все постройки до полного.', effect: (s) => healBuildings(s) },
  { key: 'goydo_yad', name: 'ГОЙДО-ЯД', emoji: '☠️', cost: 18, rarity: 'epic',
    desc: 'Травит весь набег (6 урона/с, 6с).', effect: (s) => poisonAll(s, 6, 6) },
  { key: 'shipogoyda', name: 'ШИПОГОЙДА', emoji: '🌵', cost: 16, rarity: 'rare',
    desc: 'Шипы рвут набег (25 всем).', effect: (s) => hurtAll(s, 25) },
  { key: 'cringe_goyda', name: 'КРИНЖ-ГОЙДА', emoji: '😬', cost: 20, rarity: 'rare',
    desc: 'Враги цепенеют (3с) + урон 15.', effect: (s) => { stunAll(s, 3); hurtAll(s, 15); } },
  { key: 'goydushka', name: 'GOYDUSHKA', emoji: '🍲', cost: 12, rarity: 'rare',
    desc: '+60 ЕДЫ и +15 счастья.', effect: (s) => { s.gain({ food: 60 }); happy(s, 15); } },
  { key: 'goydo_diler', name: 'GOYDO-ДИЛЕР', emoji: '🪙', cost: 10, rarity: 'common',
    desc: '+80 золота в казну.', effect: (s) => s.gain({ gold: 80 }) },
  { key: 'goydo_hamster', name: 'GOYDO-ХОМЯК', emoji: '🐹', cost: 14, rarity: 'common',
    desc: 'Запасы: +дерево/камень/золото/еда.', effect: (s) => s.gain({ wood: 60, stone: 50, gold: 40, food: 40 }) },
  { key: 'peregoyda', name: 'ПЕРЕГОЙДА', emoji: '🔥', cost: 24, rarity: 'epic',
    desc: 'СВЕРХ-ГОЙДА: дружина бьёт сильнее 12с.', effect: (s) => { s.superTimer = Math.max(s.superTimer, 12); } },
  { key: 'goydo_fonk', name: 'ГОЙДО-ФОНК', emoji: '🎶', cost: 8, rarity: 'common',
    desc: 'Народ ликует: +18 счастья.', effect: (s) => happy(s, 18) },
];

export const RARITY_COLOR = { leg: '#ffcc00', epic: '#cc44ff', rare: '#00eeff', common: '#b8b8c0' };
