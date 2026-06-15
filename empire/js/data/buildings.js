// ===== Каталог зданий =====
// cost: ресурсы; build: секунды стройки; rank: с какого ранга открыто.
// produce: пассив в день; pop: прирост лимита населения; drop: точка сдачи ресурсов.
// trains: каких юнитов можно тренировать. cat: категория для меню.

export const BUILDINGS = {
  townhall: {
    kind: 'townhall', name: 'ПАЛАТЫ ГОЙДЫ', icon: '🏰', model: 'bld_townhall',
    w: 3, h: 3, hp: 800, cat: 'core', rank: 0, unique: true, drop: true,
    cost: {}, build: 0, pop: 5, produce: { faith: 2 },
    trains: ['kholop'],
    desc: 'Сердце державы. Сюда несут добычу, здесь куют ХОЛОПов. Падёт — конец.',
  },
  izba: {
    kind: 'izba', name: 'ИЗБА', icon: '🛖', model: 'bld_izba',
    w: 1, h: 1, hp: 90, cat: 'econ', rank: 0,
    cost: { wood: 20 }, build: 3, pop: 4, produce: { happy: 1 },
    desc: 'Жильё. +4 к лимиту населения. Без изб народ не плодится.',
  },
  ambar: {
    kind: 'ambar', name: 'АМБАР', icon: '🌾', model: 'bld_ambar',
    w: 2, h: 2, hp: 160, cat: 'econ', rank: 0, drop: true,
    cost: { wood: 30, stone: 10 }, build: 5, produce: { food: 7 },
    desc: 'Делянка и закрома. +7 ЕДЫ в день. Голод роняет счастье.',
  },
  roshcha: {
    kind: 'roshcha', name: 'ЛЕСОПОСАДКА', icon: '🌱', model: 'bld_roshcha',
    w: 2, h: 2, hp: 140, cat: 'econ', rank: 0,
    cost: { wood: 25, stone: 10 }, build: 5,
    desc: 'Сажает деревья вокруг — лес восстанавливается, ДЕРЕВО не кончится.',
  },
  kuznica: {
    kind: 'kuznica', name: 'КУЗНИЦА', icon: '⚒️', model: 'bld_kuznica',
    w: 1, h: 1, hp: 140, cat: 'mil', rank: 1,
    cost: { wood: 25, stone: 25 }, build: 5, produce: { gold: 2 },
    desc: 'Куёт оружие. Нужна для ОПРИЧНИКОВ. +2 золота в день.',
  },
  kazarma: {
    kind: 'kazarma', name: 'КАЗАРМА', icon: '⚔️', model: 'bld_kazarma',
    w: 2, h: 2, hp: 260, cat: 'mil', rank: 1,
    cost: { wood: 40, stone: 30 }, build: 7, trains: ['ratnik', 'oprichnik', 'bogatyr'],
    desc: 'Куёт воинов: РАТНИКИ, ОПРИЧНИКИ (с кузницей) и БОГАТЫРИ (на железе).',
  },
  chastokol: {
    kind: 'chastokol', name: 'ЧАСТОКОЛ', icon: '🪵', model: 'bld_chastokol',
    w: 1, h: 1, hp: 220, cat: 'def', rank: 1, wall: true,
    cost: { wood: 6 }, build: 1,
    desc: 'Стена. Блокирует набег. Ставь линией ПКМ-таскать перед волной.',
  },
  gate: {
    kind: 'gate', name: 'ВОРОТА', icon: '🚪', model: 'bld_chastokol_gate',
    w: 1, h: 1, hp: 180, cat: 'def', rank: 1, wall: true, walkable: true,
    cost: { wood: 10 }, build: 1,
    desc: 'Проходимый участок стены для своих.',
  },
  church: {
    kind: 'church', name: 'КУМИРНЯ ДРОНА', icon: '☩', model: 'bld_church',
    w: 2, h: 2, hp: 200, cat: 'faith', rank: 2,
    cost: { wood: 30, stone: 20 }, build: 6, produce: { faith: 5, happy: 2 },
    desc: 'Капище идола. +5 ВЕРЫ и +счастье в день. ВЕРА открывает ранги.',
  },
  market: {
    kind: 'market', name: 'ТОРГ', icon: '🪙', model: 'bld_market',
    w: 2, h: 2, hp: 200, cat: 'econ', rank: 2, drop: true,
    cost: { wood: 40, stone: 20, gold: 10 }, build: 6, produce: { gold: 5, happy: 1 },
    desc: 'Торговые ряды. +5 золота в день и точка сдачи.',
  },
  observatory: {
    kind: 'observatory', name: 'ОБСЕРВАТОРИЯ', icon: '🔭', model: 'bld_observatory',
    w: 2, h: 2, hp: 240, cat: 'faith', rank: 2,
    cost: { wood: 50, stone: 60, gold: 40, gems: 5 }, build: 8, produce: { faith: 5, happy: 1 },
    desc: 'Открывает ВЫСШИЕ исследования 🔬 (СЕЧА/ЗАКАЛ/ФОРТИФИКАЦИЯ) и +5 ВЕРЫ в день.',
  },
  tower: {
    kind: 'tower', name: 'СТОРОЖЕВАЯ БАШНЯ', icon: '🗼', model: 'bld_tower',
    w: 1, h: 1, hp: 340, cat: 'def', rank: 2, requiresTech: 'fortifikaciya',
    cost: { wood: 40, stone: 60, iron: 10 }, build: 6,
    aura: { radius: 7, tick: 1.0, effect: 'aoe', power: 14 },
    desc: 'Бьёт врагов в радиусе. Нужна технология ФОРТИФИКАЦИЯ (через обсерваторию).',
  },
  ferma: {
    kind: 'ferma', name: 'ФЕРМА', icon: '🌻', model: 'bld_ferma',
    w: 2, h: 2, hp: 150, cat: 'econ', rank: 0,
    cost: { wood: 25 }, build: 4, produce: { food: 10, happy: 1 },
    desc: 'Поля и грядки. +10 ЕДЫ в день — кормит растущий народ.',
  },
  rudnik: {
    kind: 'rudnik', name: 'РУДНИК', icon: '⛏️', model: 'bld_rudnik',
    w: 2, h: 2, hp: 220, cat: 'econ', rank: 1,
    cost: { wood: 30, stone: 25 }, build: 6, produce: { iron: 4 },
    desc: 'Добывает ЖЕЛЕЗО ⛓️ — нужно для БОГАТЫРЕЙ и тяжёлой брони.',
  },
  zhila: {
    kind: 'zhila', name: 'САМОЦВЕТНАЯ ЖИЛА', icon: '💎', model: 'bld_zhila',
    w: 2, h: 2, hp: 240, cat: 'econ', rank: 2,
    cost: { wood: 30, stone: 40, gold: 20 }, build: 7, produce: { gems: 2 },
    desc: 'Гранит самоцветы 💎 — топливо для мощных идолов и чуда.',
  },
  idol: {
    kind: 'idol', name: 'ИДОЛ ДРОН (ЧУДО)', icon: '🗿', model: 'idol_dron',
    w: 3, h: 3, hp: 1500, cat: 'wonder', rank: 4, unique: true, wonder: true,
    cost: { wood: 260, stone: 400, gold: 320, gems: 30, faith: 200 }, build: 55,
    produce: { faith: 8 },
    desc: 'ЧУДО. Достроишь — пробудишь ДРОНА и станешь АБСОЛЮТОМ ГОЙДЫ. Победа.',
  },

  // ===== ИДОЛЫ-РЕЛИКВИИ (архетипы «Гойды» как 3D-постройки с аурой) =====
  rel_krio: {
    kind: 'rel_krio', name: 'КРИО-ИДОЛ', icon: '❄️', model: 'idol_krio',
    w: 1, h: 1, hp: 160, cat: 'relic', rank: 2, build: 5,
    cost: { stone: 60, faith: 25 }, aura: { radius: 8, tick: 1.0, effect: 'slow', power: 0.5 },
    desc: 'Замораживает врагов рядом — идут вдвое медленнее.',
  },
  rel_giper: {
    kind: 'rel_giper', name: 'ГИПЕР-ИДОЛ', icon: '💥', model: 'idol_giper',
    w: 1, h: 1, hp: 180, cat: 'relic', rank: 3, build: 6,
    cost: { stone: 80, gold: 40, faith: 40 }, aura: { radius: 7, tick: 1.1, effect: 'aoe', power: 16 },
    desc: 'Бьёт молнией по врагам в радиусе.',
  },
  rel_shipo: {
    kind: 'rel_shipo', name: 'ШИПО-ИДОЛ', icon: '🌵', model: 'idol_shipo',
    w: 1, h: 1, hp: 150, cat: 'relic', rank: 1, build: 4,
    cost: { stone: 45, faith: 18 }, aura: { radius: 5, tick: 0.9, effect: 'aoe', power: 8 },
    desc: 'Шипы рвут набег рядом — дешёвая оборона.',
  },
  rel_obereg: {
    kind: 'rel_obereg', name: 'ИДОЛ-ОБЕРЕГ', icon: '🔰', model: 'idol_obereg',
    w: 1, h: 1, hp: 200, cat: 'relic', rank: 2, build: 5,
    cost: { stone: 55, gold: 20, faith: 22 }, aura: { radius: 9, tick: 1.0, effect: 'heal', power: 7 },
    desc: 'Чинит постройки в радиусе.',
  },
  rel_goydushka: {
    kind: 'rel_goydushka', name: 'ИДОЛ-GOYDUSHKA', icon: '🍲', model: 'idol_food',
    w: 1, h: 1, hp: 140, cat: 'relic', rank: 1, build: 4,
    cost: { wood: 30, faith: 14 }, produce: { food: 6, happy: 2 },
    desc: 'Кормит округу: +6 ЕДЫ и +счастье в день.',
  },
  rel_zlato: {
    kind: 'rel_zlato', name: 'ЗЛАТО-ИДОЛ', icon: '🪙', model: 'idol_gold',
    w: 1, h: 1, hp: 160, cat: 'relic', rank: 2, build: 5,
    cost: { stone: 40, gold: 20, faith: 16 }, produce: { gold: 6 },
    desc: 'Источает золото: +6 золота в день.',
  },
  rel_fonk: {
    kind: 'rel_fonk', name: 'ФОНК-ИДОЛ', icon: '🎶', model: 'idol_fonk',
    w: 1, h: 1, hp: 140, cat: 'relic', rank: 1, build: 4,
    cost: { wood: 25, faith: 12 }, produce: { happy: 6, faith: 1 },
    desc: 'Народ ликует: +счастье и немного ВЕРЫ.',
  },
  rel_vera: {
    kind: 'rel_vera', name: 'ИДОЛ ВЕРЫ', icon: '☩', model: 'idol_vera',
    w: 1, h: 1, hp: 180, cat: 'relic', rank: 2, build: 5,
    cost: { stone: 50, gold: 25, faith: 20 }, produce: { faith: 7 },
    desc: 'Столп веры: +7 ВЕРЫ в день — быстрее эпохи.',
  },
  rel_samotsvet: {
    kind: 'rel_samotsvet', name: 'САМОЦВЕТНЫЙ ИДОЛ', icon: '💠', model: 'idol_samotsvet',
    w: 1, h: 1, hp: 210, cat: 'relic', rank: 3, build: 7,
    cost: { stone: 60, gems: 8, faith: 30 }, aura: { radius: 9, tick: 0.95, effect: 'aoe', power: 22 },
    desc: 'Гранёный идол на самоцветах 💎 — бьёт самой мощной аурой по набегу.',
  },
};

// порядок в меню постройки
export const BUILD_ORDER = ['izba', 'ambar', 'ferma', 'roshcha', 'rudnik', 'zhila', 'kuznica', 'kazarma', 'chastokol', 'gate', 'tower', 'church', 'observatory', 'market',
  'rel_shipo', 'rel_krio', 'rel_obereg', 'rel_giper', 'rel_goydushka', 'rel_zlato', 'rel_fonk', 'rel_vera', 'rel_samotsvet', 'idol'];

export const CATS = {
  econ: { name: 'ХОЗЯЙСТВО', color: '#b8763a' },
  mil: { name: 'ВОЙСКО', color: '#e0392b' },
  def: { name: 'ОБОРОНА', color: '#9aa0aa' },
  faith: { name: 'ВЕРА', color: '#00eeff' },
  relic: { name: 'ИДОЛЫ', color: '#cc44ff' },
  wonder: { name: 'ЧУДО', color: '#ffcc00' },
};
