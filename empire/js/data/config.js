// ===== ГОЙДА-ИМПЕРИЯ — глобальные константы =====
// 1 единица мира = 1 тайл = 1 единица Blender (конвенция экспорта GLB).

export const TILE = 1;
export const GRID_N = 40;            // сетка 40×40
export const GROUND_Y = 0;           // верх тайла на y=0, здания стоят на y=0

// Палитра «Гойды» (hex как в index.html идол-слоя)
export const PAL = {
  gold:       0xffcc00,
  goldBright: 0xffe680,
  bg:         0x060100,
  crimson:    0xe0392b,
  crimsonDk:  0x7a1a12,
  stone:      0x4a4038,
  stoneLt:    0x6a5e50,
  wood:       0x5a3a18,
  woodDk:     0x3a2410,
  roof:       0x7a2a1a,
  thatch:     0x8a6a2a,
  grass1:     0x2e3a14,
  grass2:     0x39481c,
  grass3:     0x445420,
  dirt:       0x5a4326,
  rock:       0x6b6b73,
  rockDk:     0x4a4a52,
  oreGold:    0xd4a017,
  faithCyan:  0x00eeff,
  faithPink:  0xff00bb,
  faithGreen: 0x44ff00,
  skin:       0xc89a6a,
  cloth:      0x8a6a3a,
  enemy:      0x401018,
  enemyTrim:  0xff2030,
};

// Сим-цикл
export const SIM_HZ = 10;
export const SIM_DT = 1 / SIM_HZ;    // 0.1 c
export const DAY_TICKS = 80;         // 1 «день» = 80 тиков = 8 секунд

// Ресурсы (ключи + подписи)
export const RES = ['food', 'wood', 'stone', 'gold', 'faith'];
export const RES_LABEL = {
  food:  { ru: 'ЕДА',     icon: '🍞', color: '#e8c060' },
  wood:  { ru: 'ДЕРЕВО',  icon: '🪵', color: '#b8763a' },
  stone: { ru: 'КАМЕНЬ',  icon: '🪨', color: '#b9b9c4' },
  gold:  { ru: 'ЗОЛОТО',  icon: '🪙', color: '#ffcc00' },
  faith: { ru: 'ВЕРА',    icon: '☩',  color: '#00eeff' },
};

export const STORAGE_KEY = 'GOYDA_EMPIRE_SAVE_v1';
