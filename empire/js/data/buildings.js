// ===== Каталог зданий =====
// cost: ресурсы; build: секунды стройки; rank: с какого ранга открыто.
// produce: пассив в день; pop: прирост лимита населения; drop: точка сдачи ресурсов.
// trains: каких юнитов можно тренировать. cat: категория для меню.
// era: с какой эпохи доступно (0/1/2 — Eras.js, ключ ТОГО ЖЕ стиля что rank; отсутствие поля = 0,
//   гейт в Buildings.placeBuilding «(def.era||0) > state.era»; BuildMenu.js фильтрацию по era ещё не
//   читает — см. STATE.md/отчёт задачи, нужна 1 строка там).
// upgrades: { a:{...}, b:{...} } — 2 ветки модернизации (Upgrades.js), выбор навсегда (с одним дешёвым
//   откатом за эпоху). Каждая ветка: name/icon/desc/cost/workers/time/effects — см. sim/Upgrades.js.

export const BUILDINGS = {
  townhall: {
    kind: 'townhall', name: 'ПАЛАТЫ ГОЙДЫ', icon: '🏰', model: 'bld_townhall',
    w: 3, h: 3, hp: 800, cat: 'core', rank: 0, unique: true, drop: true,
    roadPort: { dx: 1, dy: 3 },
    cost: {}, build: 0, pop: 5, produce: { faith: 2 }, wearRate: 0.15,
    trains: ['kholop'],
    desc: 'Сердце державы. Сюда несут добычу, здесь куют ХОЛОПов. Падёт — конец.',
  },
  izba: {
    kind: 'izba', name: 'ИЗБА', icon: '🛖', model: 'bld_izba',
    w: 1, h: 1, hp: 90, cat: 'econ', rank: 0,
    cost: { wood: 20 }, build: 3, pop: 4, produce: { happy: 1 }, wearRate: 0.45,
    desc: 'Жильё. +4 к лимиту населения. Без изб народ не плодится.',
    upgrades: {
      a: { key: 'a', name: 'Общинная', icon: '🏘️', desc: '+3 к лимиту населения', cost: { wood: 20, stone: 10 }, workers: 1, time: 5, effects: { pop: 3 } },
      b: { key: 'b', name: 'Доходная', icon: '🪙', desc: '+1 золота/день, −1 счастья/день', cost: { wood: 15, gold: 10 }, workers: 1, time: 5, effects: { produce: { gold: 1, happy: -1 } } },
    },
  },
  izba_plotnika: {
    kind: 'izba_plotnika', name: 'ИЗБА ПЛОТНИКА', icon: '🪚', model: 'bld_izba_plotnika',
    w: 1, h: 1, hp: 90, cat: 'econ', rank: 0, workers: 1,
    roadPort: { dx: 0, dy: 1 },
    cost: { wood: 30, stone: 10 }, build: 5,
    carpenter: { radius: 8, targets: 6, upkeep: { wood: 3, stone: 1 }, repair: 4 },
    desc: 'Содержит шесть ближайших построек в радиусе 8 клеток: +4 износа самой изношенной в день.',
  },
  ambar: {
    kind: 'ambar', name: 'АМБАР', icon: '🌾', model: 'bld_ambar',
    w: 2, h: 2, hp: 160, cat: 'econ', rank: 0, drop: true,
    cost: { wood: 30, stone: 10 }, build: 5, produce: { food: 7 }, wearRate: 0.35,
    desc: 'Делянка и закрома. +7 ЕДЫ в день. Голод роняет счастье.',
    upgrades: {
      a: { key: 'a', name: 'Резерв', icon: '🗄️', desc: '+80 к лимиту склада еды', cost: { wood: 25, stone: 15 }, workers: 1, time: 6, effects: { cap: { food: 80 } } },
      b: { key: 'b', name: 'Сухпай', icon: '🥖', desc: '+4 еды/день', cost: { wood: 30 }, workers: 1, time: 6, effects: { produce: { food: 4 } } },
    },
  },
  roshcha: {
    kind: 'roshcha', name: 'ЛЕСОПОСАДКА', icon: '🌱', model: 'bld_roshcha',
    w: 2, h: 2, hp: 140, cat: 'econ', rank: 0,
    cost: { wood: 25, stone: 10 }, build: 5, wearRate: 0.20,
    desc: 'Сажает деревья вокруг — лес восстанавливается, ДЕРЕВО не кончится.',
  },
  kuznica: {
    kind: 'kuznica', name: 'КУЗНИЦА', icon: '⚒️', model: 'bld_kuznica',
    w: 1, h: 1, hp: 140, cat: 'mil', rank: 1,
    cost: { wood: 25, stone: 25 }, build: 5, produce: { gold: 2 }, wearRate: 0.60,
    desc: 'Куёт оружие. Нужна для ОПРИЧНИКОВ. +2 золота в день.',
  },
  kazarma: {
    kind: 'kazarma', name: 'КАЗАРМА', icon: '⚔️', model: 'bld_kazarma',
    w: 2, h: 2, hp: 260, cat: 'mil', rank: 1,
    cost: { wood: 40, stone: 30 }, build: 7, trains: ['ratnik', 'luchnik', 'oprichnik', 'bogatyr', 'voevoda'], wearRate: 0.45,
    desc: 'Куёт воинов: РАТНИКИ, ОПРИЧНИКИ (с кузницей) и БОГАТЫРИ (на железе).',
    upgrades: {
      a: { key: 'a', name: 'Дриль', icon: '🥁', desc: '−25% времени обучения воинов', cost: { wood: 30, stone: 20, gold: 20 }, workers: 2, time: 8, effects: { trainTimeMul: 0.75 } },
      b: { key: 'b', name: 'Кладовая', icon: '💰', desc: '−15% цены воинов', cost: { wood: 35, stone: 15, gold: 20 }, workers: 2, time: 8, effects: { trainCostMul: 0.85 } },
    },
  },
  chastokol: {
    kind: 'chastokol', name: 'ЧАСТОКОЛ', icon: '🪵', model: 'bld_chastokol',
    w: 1, h: 1, hp: 220, cat: 'def', rank: 1, wall: true,
    cost: { wood: 6 }, build: 1, wearRate: 0.70,
    desc: 'Стена. Блокирует набег. Ставь линией ПКМ-таскать перед волной.',
    upgrades: {
      a: { key: 'a', name: 'Острог', icon: '🧱', desc: '+100 HP', cost: { wood: 8, stone: 4 }, workers: 1, time: 3, effects: { hp: 100 } },
      b: {
        key: 'b', name: 'Шипы', icon: '🌵', desc: '4 урона/с врагам вплотную (не только ближний бой — упрощение)',
        cost: { wood: 10, stone: 2 }, workers: 1, time: 3,
        effects: { auraAdd: { radius: 1.5, tick: 1.0, effect: 'aoe', power: 4 } },
      },
    },
  },
  gate: {
    kind: 'gate', name: 'ВОРОТА', icon: '🚪', model: 'bld_chastokol_gate',
    w: 1, h: 1, hp: 180, cat: 'def', rank: 1, wall: true, walkable: true,
    cost: { wood: 10 }, build: 1, wearRate: 0.80,
    desc: 'Проходимый участок стены для своих.',
  },
  road: {
    kind: 'road', name: 'ДОРОГА', icon: '🛣️', model: 'bld_road',
    w: 1, h: 1, hp: 50, cat: 'econ', rank: 0, wall: true, walkable: true, road: true,
    cost: { stone: 3 }, build: 0,
    desc: 'Мощёная дорога — юниты идут по ней быстрее. Тяни линией (ПКМ-таскать).',
  },
  bridge: {
    kind: 'bridge', name: 'МОСТ', icon: '🌉', model: 'bld_bridge',
    w: 1, h: 1, hp: 140, cat: 'econ', rank: 0, wall: true, walkable: true, bridge: true, onWater: true, road: true,
    cost: { wood: 8 }, build: 0,
    desc: 'Мост через воду — по нему можно ходить и возить. Тяни линией через реку.',
  },
  rail: {
    kind: 'rail', name: 'РЕЛЬСЫ', icon: '🛤️', model: 'bld_rail',
    w: 1, h: 1, hp: 80, cat: 'econ', rank: 2, wall: true, walkable: true, rail: true, requiresTech: 'zhelezny_put',
    cost: { iron: 2, stone: 2 }, build: 0,
    desc: 'Железный путь. Соедини рельсами ДВЕ станции — поезд повезёт грузы. Тяни линией.',
  },
  station: {
    kind: 'station', name: 'СТАНЦИЯ', icon: '🚂', model: 'bld_station',
    w: 2, h: 2, hp: 260, cat: 'econ', rank: 2, requiresTech: 'zhelezny_put',
    railPort: { dx: 1, dy: 2 },
    cost: { wood: 60, stone: 40, iron: 30, gold: 30 }, build: 8, produce: { gold: 2 },
    desc: 'Вокзал державы. Две станции + рельсы = паровоз возит грузы и золото.',
  },
  church: {
    kind: 'church', name: 'КУМИРНЯ ДРОНА', icon: '☩', model: 'bld_church',
    w: 2, h: 2, hp: 200, cat: 'faith', rank: 2,
    cost: { wood: 30, stone: 20 }, build: 6, produce: { faith: 5, happy: 2 }, wearRate: 0.25,
    desc: 'Капище идола. +5 ВЕРЫ и +счастье в день. ВЕРА открывает ранги.',
  },
  market: {
    kind: 'market', name: 'ТОРГ', icon: '🪙', model: 'bld_market',
    w: 2, h: 2, hp: 200, cat: 'econ', rank: 2, drop: true,
    roadPort: { dx: 1, dy: 2 },
    cost: { wood: 40, stone: 20, gold: 10 }, build: 6, produce: { gold: 5, happy: 1 }, wearRate: 0.40,
    desc: 'Торговые ряды. +5 золота в день и точка сдачи.',
  },
  traktir: {
    kind: 'traktir', name: 'ТРАКТИР', icon: '🍺', model: 'bld_market',
    w: 2, h: 2, hp: 170, cat: 'econ', rank: 1,
    roadPort: { dx: 1, dy: 2 },
    cost: { wood: 35, gold: 15 }, build: 5, produce: { happy: 5 },
    desc: 'Хмель, пляски, байки — народ гуляет. +5 счастья в день.',
  },
  banya: {
    kind: 'banya', name: 'БАНЯ', icon: '🛁', model: 'bld_banya',
    w: 1, h: 1, hp: 100, cat: 'econ', rank: 0,
    cost: { wood: 25, stone: 10 }, build: 3, produce: { happy: 3 },
    desc: 'Пар да веник — здоровье и довольство. +3 счастья в день.',
  },
  veche: {
    kind: 'veche', name: 'ВЕЧЕ', icon: '🏛️', model: 'bld_observatory',
    w: 2, h: 2, hp: 230, cat: 'faith', rank: 2,
    cost: { wood: 40, stone: 35, gold: 20 }, build: 6, produce: { happy: 3, faith: 4 },
    desc: 'Народное собрание: голос державы. +счастье и +4 ВЕРЫ в день.',
  },
  observatory: {
    kind: 'observatory', name: 'ОБСЕРВАТОРИЯ', icon: '🔭', model: 'bld_observatory',
    w: 2, h: 2, hp: 240, cat: 'faith', rank: 2,
    cost: { wood: 50, stone: 60, gold: 40, gems: 5 }, build: 8, produce: { faith: 5, happy: 1 }, wearRate: 0.30,
    desc: 'Открывает ВЫСШИЕ исследования 🔬 (СЕЧА/ЗАКАЛ/ФОРТИФИКАЦИЯ) и +5 ВЕРЫ в день.',
  },
  tower: {
    kind: 'tower', name: 'СТОРОЖЕВАЯ БАШНЯ', icon: '🗼', model: 'bld_tower',
    w: 1, h: 1, hp: 340, cat: 'def', rank: 2, requiresTech: 'fortifikaciya',
    cost: { wood: 40, stone: 60, iron: 10 }, build: 6,
    aura: { radius: 7, tick: 1.0, effect: 'aoe', power: 14 }, wearRate: 0.55,
    desc: 'Бьёт врагов в радиусе. Нужна технология ФОРТИФИКАЦИЯ (через обсерваторию).',
    upgrades: {
      a: {
        key: 'a', name: 'Сигнальная', icon: '🔥', desc: 'Аура шире: радиус +2 (спека просит +12с раннего предупреждения — требует Waves.js, вне зоны)',
        cost: { wood: 25, stone: 30, iron: 10 }, workers: 2, time: 8, effects: { auraRadiusDelta: 2 },
      },
      b: { key: 'b', name: 'Стрелецкая', icon: '🏹', desc: '+50% урон ауры', cost: { wood: 30, stone: 35, iron: 15 }, workers: 2, time: 10, effects: { auraPowerMul: 1.5 } },
    },
  },
  ferma: {
    kind: 'ferma', name: 'ФЕРМА', icon: '🌻', model: 'bld_ferma',
    w: 2, h: 2, hp: 150, cat: 'econ', rank: 0,
    cost: { wood: 25 }, build: 4, produce: { food: 10, happy: 1 }, workSlots: 2, wearRate: 0.50,
    desc: 'Поля и грядки. +10 ЕДЫ в день — кормит растущий народ.',
  },
  rudnik: {
    kind: 'rudnik', name: 'РУДНИК', icon: '⛏️', model: 'bld_rudnik',
    w: 2, h: 2, hp: 220, cat: 'econ', rank: 1,
    cost: { wood: 30, stone: 25 }, build: 6, produce: { iron: 4 }, workSlots: 2, wearRate: 0.75,
    desc: 'Добывает ЖЕЛЕЗО ⛓️ — нужно для БОГАТЫРЕЙ и тяжёлой брони.',
    upgrades: {
      a: { key: 'a', name: 'Глубокий', icon: '⛏️', desc: '+3 железа/день, но износ +0.8/день', cost: { wood: 35, stone: 25 }, workers: 2, time: 9, effects: { produce: { iron: 3 }, wearRateDelta: 0.8 } },
      b: { key: 'b', name: 'Артель', icon: '👥', desc: '+2 железа/день, +2 счастья/день', cost: { wood: 30, stone: 20, gold: 10 }, workers: 2, time: 9, effects: { produce: { iron: 2, happy: 2 } } },
    },
  },
  zhila: {
    kind: 'zhila', name: 'САМОЦВЕТНАЯ ЖИЛА', icon: '💎', model: 'bld_zhila',
    w: 2, h: 2, hp: 240, cat: 'econ', rank: 2,
    cost: { wood: 30, stone: 40, gold: 20 }, build: 7, produce: { gems: 2 }, workSlots: 2, wearRate: 0.65,
    desc: 'Гранит самоцветы 💎 — топливо для мощных идолов и чуда.',
  },
  // ===== ЭПОХА II «Уездная держава» (era:1) — додумано по мотивам PHASE2_DESIGN_SPEC.md §1 =====
  prikaz_sbora: {
    kind: 'prikaz_sbora', name: 'ПРИКАЗ СБОРА', icon: '📋', model: 'bld_market',
    w: 2, h: 2, hp: 190, cat: 'econ', era: 1,
    roadPort: { dx: 1, dy: 2 },
    cost: { wood: 45, stone: 25, gold: 15 }, build: 6, produce: {}, wearRate: 0.40,
    desc: 'Приказная изба уездной державы — собирает подати с населения.',
  },
  zastava_ostrog: {
    kind: 'zastava_ostrog', name: 'ОСТРОЖНАЯ ЗАСТАВА', icon: '🏯', model: 'bld_tower',
    w: 1, h: 1, hp: 300, cat: 'def', era: 1,
    cost: { wood: 55, stone: 45 }, build: 8,
    aura: { radius: 6, tick: 1.2, effect: 'aoe', power: 10 }, wearRate: 0.50,
    desc: 'Порубежный острог с дозором — бьёт налётчиков в радиусе, дешевле башни (без железа).',
  },
  tamozhnya: {
    kind: 'tamozhnya', name: 'ТАМОЖЕННЫЕ ВОРОТА', icon: '🛃', model: 'bld_chastokol_gate',
    w: 1, h: 1, hp: 200, cat: 'def', era: 1, wall: true, walkable: true,
    roadPort: { dx: 0, dy: 1 },
    cost: { wood: 25, stone: 15 }, build: 4, produce: { gold: 3 }, wearRate: 0.50,
    desc: 'Мытный двор на въезде — пошлина с обозов. +3 золота в день, проходимо для своих.',
  },

  // ===== ЭПОХА III «Гойда-индустрия» (era:2) — додумано по мотивам PHASE2_DESIGN_SPEC.md §1 =====
  remontny_dvor: {
    kind: 'remontny_dvor', name: 'РЕМОНТНЫЙ ДВОР', icon: '🔧', model: 'bld_remdvor',
    w: 1, h: 1, hp: 160, cat: 'econ', era: 2, workers: 1,
    roadPort: { dx: 0, dy: 1 },
    cost: { wood: 50, stone: 35, iron: 15 }, build: 7,
    carpenter: { radius: 10, targets: 10, upkeep: { wood: 4, stone: 2, iron: 1 }, repair: 7 },
    desc: 'Артельная мастерская — держит в исправности 10 построек в радиусе 10 клеток, сильнее Избы Плотника.',
  },
  agitpunkt: {
    kind: 'agitpunkt', name: 'АГИТПУНКТ', icon: '📯', model: 'bld_observatory',
    w: 2, h: 2, hp: 220, cat: 'faith', era: 2,
    cost: { wood: 45, stone: 50, gold: 25 }, build: 7, produce: { faith: 6, happy: 2 }, wearRate: 0.35,
    desc: 'Агитация Абсолюта Дрона на площадях — поднимает дух и веру. +6 ВЕРЫ и +2 счастья в день.',
  },
  sklad_putevoy: {
    kind: 'sklad_putevoy', name: 'ПУТЕВОЙ ПАКГАУЗ', icon: '📦', model: 'bld_sklad',
    w: 2, h: 2, hp: 200, cat: 'econ', era: 2,
    roadPort: { dx: 1, dy: 2 },
    cost: { wood: 55, stone: 35, iron: 15 }, build: 7, produce: {}, wearRate: 0.35,
    desc: 'Складской двор у путей — копит выручку от излишков для паровозов.',
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
export const BUILD_ORDER = ['izba', 'izba_plotnika', 'banya', 'ambar', 'ferma', 'roshcha', 'rudnik', 'zhila', 'kuznica', 'kazarma', 'chastokol', 'gate', 'road', 'bridge', 'rail', 'station', 'tower', 'church', 'observatory', 'veche', 'market', 'traktir',
  'prikaz_sbora', 'zastava_ostrog', 'tamozhnya', 'remontny_dvor', 'agitpunkt', 'sklad_putevoy',
  'rel_shipo', 'rel_krio', 'rel_obereg', 'rel_giper', 'rel_goydushka', 'rel_zlato', 'rel_fonk', 'rel_vera', 'rel_samotsvet', 'idol'];

export const CATS = {
  econ: { name: 'ХОЗЯЙСТВО', color: '#b8763a' },
  mil: { name: 'ВОЙСКО', color: '#e0392b' },
  def: { name: 'ОБОРОНА', color: '#9aa0aa' },
  faith: { name: 'ВЕРА', color: '#00eeff' },
  relic: { name: 'ИДОЛЫ', color: '#cc44ff' },
  wonder: { name: 'ЧУДО', color: '#ffcc00' },
};
