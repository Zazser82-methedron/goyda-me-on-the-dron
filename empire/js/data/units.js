// ===== Каталог юнитов =====
// speed: тайлы/сек; carry: вместимость добытчика; dmg/range/atkCd: бой.
export const UNITS = {
  kholop: {
    kind: 'kholop', name: 'ХОЛОП', icon: '🧑‍🌾', model: 'unit_kholop', faction: 'ours',
    hp: 35, speed: 2.4, dmg: 3, range: 1.0, atkCd: 1.2,
    carry: 8, gatherRate: 4, trainAt: 'townhall', trainTime: 4, cost: { food: 10 },
    worker: true, desc: 'Добытчик. Рубит лес, ломает камень, моет золото.',
  },
  ratnik: {
    kind: 'ratnik', name: 'РАТНИК', icon: '🗡️', model: 'unit_ratnik', faction: 'ours',
    hp: 80, speed: 2.1, dmg: 9, range: 1.2, atkCd: 1.0,
    trainAt: 'kazarma', trainTime: 6, cost: { food: 10, gold: 15 },
    desc: 'Копейщик. Костяк дружины.',
  },
  oprichnik: {
    kind: 'oprichnik', name: 'ОПРИЧНИК', icon: '🛡️', model: 'unit_oprichnik', faction: 'ours',
    hp: 150, speed: 2.3, dmg: 18, range: 1.3, atkCd: 0.9,
    trainAt: 'kazarma', trainTime: 9, cost: { food: 15, gold: 35 }, needs: 'kuznica', rank: 2,
    desc: 'Элита. Чёрно-багряная гроза набегов.',
  },
  raider: {
    kind: 'raider', name: 'НАБЕЖЧИК', icon: '👹', model: 'enemy_raider', faction: 'enemy',
    hp: 55, speed: 2.0, dmg: 7, range: 1.2, atkCd: 1.1,
    desc: 'Вражий набег. Идёт на ратушу и идола.',
  },
  raider_fast: {
    kind: 'raider_fast', name: 'ЛОВКАЧ', icon: '🏃', model: 'enemy_raider', faction: 'enemy',
    hp: 38, speed: 2.9, dmg: 6, range: 1.1, atkCd: 0.85, tint: 0x6a3a1a, scale: 0.9, raidStyle: 'flank',
    desc: 'Быстрый — метит в добытчиков.',
  },
  raider_heavy: {
    kind: 'raider_heavy', name: 'ВЕРЗИЛА', icon: '🛡️', model: 'enemy_raider', faction: 'enemy',
    hp: 130, speed: 1.5, dmg: 15, range: 1.3, atkCd: 1.3, tint: 0x3a2a3a, scale: 1.35, raidStyle: 'siege',
    desc: 'Тяжёлый — прёт на ратушу/идол.',
  },
  raider_shaman: {
    kind: 'raider_shaman', name: 'ШАМАН-ГОЙДЫ', icon: '🔮', model: 'enemy_raider', faction: 'enemy',
    hp: 48, speed: 1.9, dmg: 11, range: 7.0, atkCd: 1.6, ranged: true, tint: 0x2a1a4a, scale: 1.0, raidStyle: 'kite',
    desc: 'Дальнобойный — бьёт издали, держит дистанцию.',
  },
  boss: {
    kind: 'boss', name: 'БОСС', icon: '☠️', model: 'enemy_boss', faction: 'enemy',
    hp: 600, speed: 1.6, dmg: 30, range: 1.6, atkCd: 1.0,
    desc: 'Именованный вожак набега.',
  },
};
