// ===== Каталог зданий =====
// cost: ресурсы; build: секунды стройки; rank: с какого ранга открыто.
// produce: пассив в день; pop: прирост лимита населения; drop: точка сдачи ресурсов.
// trains: каких юнитов можно тренировать. cat: категория для меню.

export const BUILDINGS = {
  townhall: {
    kind: 'townhall', name: 'ПАЛАТЫ ГОЙДЫ', icon: '🏰', model: 'bld_townhall',
    w: 3, h: 3, hp: 800, cat: 'core', rank: 0, unique: true, drop: true,
    cost: {}, build: 0, pop: 5, produce: { faith: 1 },
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
    cost: { wood: 40, stone: 30 }, build: 7, trains: ['ratnik', 'oprichnik'],
    desc: 'Куёт воинов: РАТНИКИ и (с кузницей) ОПРИЧНИКИ.',
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
  idol: {
    kind: 'idol', name: 'ИДОЛ ДРОН (ЧУДО)', icon: '🗿', model: 'idol_dron',
    w: 3, h: 3, hp: 1500, cat: 'wonder', rank: 4, unique: true, wonder: true,
    cost: { wood: 200, stone: 300, gold: 250, faith: 150 }, build: 40,
    produce: { faith: 8 },
    desc: 'ЧУДО. Достроишь — пробудишь ДРОНА и станешь АБСОЛЮТОМ ГОЙДЫ. Победа.',
  },
};

// порядок в меню постройки
export const BUILD_ORDER = ['izba', 'ambar', 'roshcha', 'kuznica', 'kazarma', 'chastokol', 'gate', 'church', 'market', 'idol'];

export const CATS = {
  econ: { name: 'ХОЗЯЙСТВО', color: '#b8763a' },
  mil: { name: 'ВОЙСКО', color: '#e0392b' },
  def: { name: 'ОБОРОНА', color: '#9aa0aa' },
  faith: { name: 'ВЕРА', color: '#00eeff' },
  wonder: { name: 'ЧУДО', color: '#ffcc00' },
};
