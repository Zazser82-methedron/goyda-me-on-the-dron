// ===== Лестница рангов = эпохи (как в «Гойде») =====
// req: условия перехода. unlocks: что открывается. boss: набег-босс на рубеже.
export const RANKS = [
  { key: 'kholop',    name: 'ХОЛОП',          icon: '🌾', req: {}, color: '#9c8a5a' },
  { key: 'ratnik',    name: 'РАТНИК',         icon: '🗡️', req: { pop: 5,  faith: 12 },  boss: 'holop_lezheboka', color: '#b9b9c4' },
  { key: 'oprichnik', name: 'ОПРИЧНИК',       icon: '⚔️', req: { pop: 9,  faith: 40 },  boss: 'ratnik_fedor',   color: '#e0392b' },
  { key: 'voevoda',   name: 'ВОЕВОДА',        icon: '🛡️', req: { pop: 16, faith: 90 },  boss: 'voevoda_skuf',   color: '#c8a030' },
  { key: 'knyaz',     name: 'КНЯЗЬ ГОЙДЫ',    icon: '👑', req: { pop: 22, faith: 155 }, boss: 'oprichnik_dushnila', color: '#ffcc00' },
  { key: 'absolut',   name: 'АБСОЛЮТ ГОЙДЫ',  icon: '🌟', req: { wonder: true },         boss: 'goyda_batya',    color: '#fff0a0' },
];
