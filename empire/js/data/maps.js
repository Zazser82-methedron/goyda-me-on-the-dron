// ===== Карты-локации: палитра террейна + множители ресурсов =====
export const MAPS = [
  { key: 'les', name: 'ЛЕС', emoji: '🌲', desc: 'Густой бор — дерева в избытке.',
    pal: { a: 0x5f8f31, b: 0x7db03c, c: 0x9fd056, dirt: 0x97723f }, res: { tree: 1.7, stone: 0.8, ore: 0.8 },
    terr: { amp: 1.05, water: -0.7, river: 0.045, sand: -0.35, rock: 2.4, snow: 3.6, slopeMax: 1.1 } },
  { key: 'step', name: 'СТЕПЬ', emoji: '🌾', desc: 'Открытая равнина — мало леса, мало воды.',
    pal: { a: 0x9aa840, b: 0xb4bf4c, c: 0xd0d466, dirt: 0xa88450 }, res: { tree: 0.5, stone: 1.0, ore: 1.1 },
    terr: { amp: 0.38, water: -1.4, river: 0.015, sand: -0.95, rock: 2.8, snow: 4.0, slopeMax: 0.75 } },
  { key: 'gory', name: 'ГОРЫ', emoji: '⛰️', desc: 'Высокие горы — камень и золото.',
    pal: { a: 0x6f8a52, b: 0x88a266, c: 0xa4bc80, dirt: 0x8f7c5e }, res: { tree: 0.7, stone: 1.9, ore: 1.8 },
    terr: { amp: 3.4, water: -1.2, river: 0.04, sand: -0.5, rock: 1.2, snow: 2.6, slopeMax: 1.7 } },
  { key: 'boloto', name: 'БОЛОТО', emoji: '🐸', desc: 'Топь — много воды, но богато.',
    pal: { a: 0x527238, b: 0x658a40, c: 0x7ea450, dirt: 0x6a5a3a }, res: { tree: 1.3, stone: 0.7, ore: 1.0 },
    terr: { amp: 0.6, water: 0.1, river: 0.16, sand: 0.16, rock: 2.4, snow: 3.6, slopeMax: 0.95 } },
  { key: 'neon', name: 'НЕОН-ГОЙДА', emoji: '🟣', desc: 'Кислотный мир — всё ярче.',
    pal: { a: 0x2e2a5a, b: 0x42306a, c: 0x5a3a8a, dirt: 0x4a2a5a }, res: { tree: 1.0, stone: 1.0, ore: 1.3 },
    terr: { amp: 1.5, water: -0.6, river: 0.05, sand: -0.35, rock: 2.2, snow: 3.4, slopeMax: 1.25 } },
];
export function getMap(key) { return MAPS.find(m => m.key === key) || MAPS[0]; }
