// ===== ГОЙДА-ИМПЕРИЯ — глобальные константы =====
// 1 единица мира = 1 тайл = 1 единица Blender (конвенция экспорта GLB).

export const TILE = 1;
export const GRID_N = 96;            // сетка 96×96 (огромная карта)
export const GROUND_Y = 0;           // верх тайла на y=0, здания стоят на y=0

// Палитра «Гойды» — заметно осветлена ради читаемости сцены
export const PAL = {
  gold:       0xffcc00,
  goldBright: 0xffe680,
  bg:         0x0c0804,
  sky:        0x8fa8c8,   // верх неба (CSS-градиент/фон)
  skyLow:     0xd8b888,   // низ неба у горизонта (тёплый закат)
  fog:        0x7d7390,   // туман уходит в светлый сумрак, не в черноту
  crimson:    0xe0392b,
  crimsonDk:  0x7a1a12,
  stone:      0x6a6052,
  stoneLt:    0x8a7e6a,
  wood:       0x7a5226,
  woodDk:     0x4e3418,
  roof:       0x9a3a22,
  thatch:     0xb88e3a,
  grass1:     0x44602a,
  grass2:     0x577a32,
  grass3:     0x6e9440,
  dirt:       0x7a5e38,
  rock:       0x8a8a94,
  rockDk:     0x64646e,
  oreGold:    0xe6b020,
  faithCyan:  0x00eeff,
  faithPink:  0xff00bb,
  faithGreen: 0x44ff00,
  skin:       0xd6a878,
  cloth:      0xa07e44,
  enemy:      0x5a1822,
  enemyTrim:  0xff2030,
};

// Сим-цикл
export const SIM_HZ = 10;
export const SIM_DT = 1 / SIM_HZ;    // 0.1 c
export const DAY_TICKS = 80;         // 1 «день» = 80 тиков = 8 секунд

// Ресурсы (ключи + подписи)
export const RES = ['food', 'wood', 'stone', 'iron', 'gold', 'gems', 'faith'];
export const RES_LABEL = {
  food:  { ru: 'ЕДА',       icon: '🍞', color: '#e8c060' },
  wood:  { ru: 'ДЕРЕВО',    icon: '🪵', color: '#b8763a' },
  stone: { ru: 'КАМЕНЬ',    icon: '🪨', color: '#b9b9c4' },
  iron:  { ru: 'ЖЕЛЕЗО',    icon: '⛓️', color: '#c8cdd6' },
  gold:  { ru: 'ЗОЛОТО',    icon: '🪙', color: '#ffcc00' },
  gems:  { ru: 'САМОЦВЕТЫ', icon: '💎', color: '#ff7ce6' },
  faith: { ru: 'ВЕРА',      icon: '☩',  color: '#00eeff' },
};

export const STORAGE_KEY = 'GOYDA_EMPIRE_SAVE_v1';
