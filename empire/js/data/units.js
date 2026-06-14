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
  boss: {
    kind: 'boss', name: 'БОСС', icon: '☠️', model: 'enemy_boss', faction: 'enemy',
    hp: 600, speed: 1.6, dmg: 30, range: 1.6, atkCd: 1.0,
    desc: 'Именованный вожак набега.',
  },
};
