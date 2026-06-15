// ===== Карты-локации: палитра террейна + множители ресурсов =====
export const MAPS = [
  { key: 'les', name: 'ЛЕС', emoji: '🌲', desc: 'Густой бор — дерева в избытке.',
    pal: { a: 0x3e5a22, b: 0x52702a, c: 0x6e9440, dirt: 0x6a5230 }, res: { tree: 1.7, stone: 0.8, ore: 0.8 },
    terr: { amp: 1.9, water: -0.7, river: 0.045, sand: -0.3, rock: 2.1, snow: 3.2, slopeMax: 1.05 } },
  { key: 'step', name: 'СТЕПЬ', emoji: '🌾', desc: 'Открытая равнина — мало леса, мало воды.',
    pal: { a: 0x6a7a32, b: 0x84903a, c: 0x9aa648, dirt: 0x8a6e40 }, res: { tree: 0.5, stone: 1.0, ore: 1.1 },
    terr: { amp: 0.55, water: -1.4, river: 0.015, sand: -0.9, rock: 2.6, snow: 3.8, slopeMax: 0.7 } },
  { key: 'gory', name: 'ГОРЫ', emoji: '⛰️', desc: 'Высокие горы — камень и золото.',
    pal: { a: 0x556048, b: 0x6a7256, c: 0x808a6a, dirt: 0x7a6a52 }, res: { tree: 0.7, stone: 1.9, ore: 1.8 },
    terr: { amp: 6.0, water: -1.2, river: 0.04, sand: -0.4, rock: 1.0, snow: 3.0, slopeMax: 1.6 } },
  { key: 'boloto', name: 'БОЛОТО', emoji: '🐸', desc: 'Топь — много воды, но богато.',
    pal: { a: 0x3a4a2a, b: 0x49592f, c: 0x586a38, dirt: 0x4a4030 }, res: { tree: 1.3, stone: 0.7, ore: 1.0 },
    terr: { amp: 0.9, water: 0.12, river: 0.16, sand: 0.18, rock: 2.2, snow: 3.4, slopeMax: 0.9 } },
  { key: 'neon', name: 'НЕОН-ГОЙДА', emoji: '🟣', desc: 'Кислотный мир — всё ярче.',
    pal: { a: 0x2e2a5a, b: 0x42306a, c: 0x5a3a8a, dirt: 0x4a2a5a }, res: { tree: 1.0, stone: 1.0, ore: 1.3 },
    terr: { amp: 2.6, water: -0.6, river: 0.05, sand: -0.3, rock: 1.9, snow: 3.0, slopeMax: 1.2 } },
];
export function getMap(key) { return MAPS.find(m => m.key === key) || MAPS[0]; }
