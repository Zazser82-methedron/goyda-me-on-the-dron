// ===== Карты-локации: палитра террейна + множители ресурсов =====
export const MAPS = [
  { key: 'les', name: 'ЛЕС', emoji: '🌲', desc: 'Густой бор — дерева в избытке.',
    pal: { a: 0x3e5a22, b: 0x52702a, c: 0x6e9440, dirt: 0x6a5230 }, res: { tree: 1.7, stone: 0.8, ore: 0.8 } },
  { key: 'step', name: 'СТЕПЬ', emoji: '🌾', desc: 'Открытая равнина — мало леса.',
    pal: { a: 0x6a7a32, b: 0x84903a, c: 0x9aa648, dirt: 0x8a6e40 }, res: { tree: 0.6, stone: 1.0, ore: 1.1 } },
  { key: 'gory', name: 'ГОРЫ', emoji: '⛰️', desc: 'Камень и золото — горой.',
    pal: { a: 0x556048, b: 0x6a7256, c: 0x808a6a, dirt: 0x7a6a52 }, res: { tree: 0.8, stone: 1.8, ore: 1.7 } },
  { key: 'boloto', name: 'БОЛОТО', emoji: '🐸', desc: 'Топь — мрачно, но богато.',
    pal: { a: 0x3a4a2a, b: 0x49592f, c: 0x586a38, dirt: 0x4a4030 }, res: { tree: 1.2, stone: 0.7, ore: 1.0 } },
  { key: 'neon', name: 'НЕОН-ГОЙДА', emoji: '🟣', desc: 'Кислотный мир — всё ярче.',
    pal: { a: 0x2e2a5a, b: 0x42306a, c: 0x5a3a8a, dirt: 0x4a2a5a }, res: { tree: 1.0, stone: 1.0, ore: 1.3 } },
];
export function getMap(key) { return MAPS.find(m => m.key === key) || MAPS[0]; }
