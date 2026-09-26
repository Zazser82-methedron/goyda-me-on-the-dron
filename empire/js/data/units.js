// ===== Каталог юнитов =====
// speed: тайлы/сек; carry: вместимость добытчика; dmg/range/atkCd: бой.
export const UNITS = {
  kholop: {
    kind: 'kholop', name: 'ХОЛОП', icon: '🧑‍🌾', model: 'unit_kholop', faction: 'ours',
    hp: 35, speed: 2.4, dmg: 3, range: 1.0, atkCd: 1.2,
    carry: 8, gatherRate: 4, trainAt: 'townhall', trainTime: 4, cost: { food: 10 },
    worker: true, cls: 'worker', era: 0, desc: 'Добытчик. Рубит лес, ломает камень, моет золото.',
  },
  ratnik: {
    kind: 'ratnik', name: 'РАТНИК', icon: '🗡️', model: 'unit_ratnik', faction: 'ours',
    hp: 80, speed: 2.1, dmg: 9, range: 1.2, atkCd: 1.0,
    trainAt: 'kazarma', trainTime: 6, cost: { food: 10, gold: 15 }, cls: 'spear', era: 0,
    desc: 'Копейщик. Костяк дружины.',
  },
  oprichnik: {
    kind: 'oprichnik', name: 'ОПРИЧНИК', icon: '🐎', model: 'unit_oprichnik_kon', faction: 'ours',
    hp: 150, speed: 3.1, dmg: 18, range: 1.3, atkCd: 0.9,
    trainAt: 'kazarma', trainTime: 9, cost: { food: 15, gold: 35 }, needs: 'kuznica', rank: 2, cls: 'cavalry', era: 1,
    desc: 'Конница. Чёрно-багряная гроза стрелков.',
  },
  bogatyr: {
    kind: 'bogatyr', name: 'БОГАТЫРЬ', icon: '🛡️', model: 'unit_bogatyr', faction: 'ours',
    hp: 240, speed: 2.0, dmg: 26, range: 1.45, atkCd: 1.0,
    trainAt: 'townhall', trainTime: 12, cost: { food: 20, iron: 12 }, needs: 'rudnik', rank: 2, cls: 'hero', era: 1, unique: true,
    aura: { radius: 5, dmgMul: 1.15 },
    desc: 'Герой: только один. Воодушевляет своих в радиусе 5 на +15% урона.',
  },
  luchnik: {
    kind: 'luchnik', name: 'ЛУЧНИК', icon: '🏹', model: 'unit_ratnik', faction: 'ours',
    hp: 55, speed: 2.2, dmg: 12, range: 5.5, atkCd: 1.3, ranged: true,
    trainAt: 'kazarma', trainTime: 7, cost: { food: 12, wood: 10, gold: 10 }, rank: 1, cls: 'ranged', era: 0,
    desc: 'Бьёт издали. Стеклянная пушка — держи за спинами копейщиков.',
  },
  strelec: {
    kind: 'strelec', name: 'СТРЕЛЕЦ', icon: '🏹', model: 'unit_strelec', faction: 'ours',
    hp: 70, speed: 2.0, dmg: 17, range: 6.5, atkCd: 1.25, ranged: true,
    trainAt: 'kazarma', trainTime: 8, cost: { food: 14, wood: 12, gold: 18 }, rank: 2, cls: 'ranged', era: 1,
    desc: 'Стрелок с пищалью. Дальше и больнее лучника.',
  },
  voevoda: {
    kind: 'voevoda', name: 'ВОЕВОДА', icon: '⭐', model: 'unit_voevoda', faction: 'ours',
    hp: 190, speed: 2.0, dmg: 21, range: 1.4, atkCd: 1.0,
    trainAt: 'kazarma', trainTime: 12, cost: { food: 22, gold: 42, iron: 6 }, needs: 'kuznica', rank: 2, cls: 'infantry', era: 1,
    aura: { radius: 4, dmgMul: 1.10 },
    desc: 'Командир дружины: своим рядом даёт +10% урона.',
  },
  pushka: {
    kind: 'pushka', name: 'ПУШКА', icon: '💣', model: 'unit_pushka', faction: 'ours',
    hp: 130, speed: 1.1, dmg: 32, range: 7.0, atkCd: 2.4, ranged: true,
    trainAt: 'kuznica', trainTime: 16, cost: { wood: 25, iron: 25, gold: 35 }, needs: 'kuznica', rank: 3, cls: 'siege', era: 2,
    desc: 'Осадное орудие. Особенно эффективно против стен и вражьих станов.',
  },
  zhrec: {
    kind: 'zhrec', name: 'ЖРЕЦ ДРОНА', icon: '☩', model: 'unit_zhrec', faction: 'ours', factionKey: 'goyda',
    hp: 60, speed: 2.1, dmg: 5, range: 1.1, atkCd: 1.2,
    trainAt: 'kazarma', trainTime: 9, cost: { food: 12, faith: 18 }, rank: 2, cls: 'infantry', era: 1,
    heal: { radius: 4, amount: 12, cd: 2 },
    desc: 'Служитель ДРОНА. Раз в 2 с лечит ближайшего раненого союзника на 12 HP.',
  },
  kromeshnik: {
    kind: 'kromeshnik', name: 'КРОМЕШНИК', icon: '🐎', model: 'unit_kromeshnik', faction: 'ours', factionKey: 'oprichnina',
    hp: 210, speed: 3.15, dmg: 25, range: 1.35, atkCd: 0.85,
    trainAt: 'kazarma', trainTime: 12, cost: { food: 20, gold: 55, iron: 8 }, needs: 'kuznica', rank: 2, cls: 'cavalry', era: 1,
    desc: 'Элитная опричная конница: больше живучести и урона.',
  },
  konny_luchnik: {
    kind: 'konny_luchnik', name: 'КОННЫЙ ЛУЧНИК', icon: '🏹', model: 'unit_konny_luchnik', faction: 'ours', factionKey: 'kochevniki',
    hp: 75, speed: 3.2, dmg: 14, range: 5.8, atkCd: 1.15, ranged: true,
    trainAt: 'kazarma', trainTime: 10, cost: { food: 18, wood: 12, gold: 22 }, rank: 2, cls: 'ranged', era: 1,
    desc: 'Быстрый стрелок степи: заходит с фланга и не даёт себя догнать.',
  },
  kriomag: {
    kind: 'kriomag', name: 'КРИОМАГ', icon: '❄️', model: 'unit_kriomag', faction: 'ours', factionKey: 'hlad',
    hp: 65, speed: 2.0, dmg: 15, range: 6.0, atkCd: 1.35, ranged: true,
    trainAt: 'kazarma', trainTime: 11, cost: { food: 14, faith: 22, gold: 18 }, rank: 2, cls: 'ranged', era: 1,
    slow: { mul: 0.6, duration: 3 },
    desc: 'Крио-стрелок: попадание замедляет цель на 40% на 3 с.',
  },
  raider: {
    kind: 'raider', name: 'НАБЕЖЧИК', icon: '👹', model: 'enemy_raider', faction: 'enemy',
    hp: 55, speed: 2.0, dmg: 7, range: 1.2, atkCd: 1.1,
    cls: 'infantry', desc: 'Вражий набег. Идёт на ратушу и идола.',
  },
  raider_fast: {
    kind: 'raider_fast', name: 'ЛОВКАЧ', icon: '🏃', model: 'enemy_raider', faction: 'enemy',
    hp: 38, speed: 2.9, dmg: 6, range: 1.1, atkCd: 0.85, tint: 0x6a3a1a, scale: 0.9, raidStyle: 'flank', cls: 'cavalry',
    desc: 'Быстрый — метит в добытчиков.',
  },
  raider_heavy: {
    kind: 'raider_heavy', name: 'ВЕРЗИЛА', icon: '🛡️', model: 'enemy_raider', faction: 'enemy',
    hp: 130, speed: 1.5, dmg: 15, range: 1.3, atkCd: 1.3, tint: 0x3a2a3a, scale: 1.35, raidStyle: 'siege', cls: 'spear',
    desc: 'Тяжёлый — прёт на ратушу/идол.',
  },
  raider_shaman: {
    kind: 'raider_shaman', name: 'ШАМАН-ГОЙДЫ', icon: '🔮', model: 'enemy_raider', faction: 'enemy',
    hp: 48, speed: 1.9, dmg: 11, range: 7.0, atkCd: 1.6, ranged: true, tint: 0x2a1a4a, scale: 1.0, raidStyle: 'kite', cls: 'ranged',
    desc: 'Дальнобойный — бьёт издали, держит дистанцию.',
  },
  boss: {
    kind: 'boss', name: 'БОСС', icon: '☠️', model: 'enemy_boss', faction: 'enemy',
    hp: 600, speed: 1.6, dmg: 30, range: 1.6, atkCd: 1.0, cls: 'hero',
    desc: 'Именованный вожак набега.',
  },
};
