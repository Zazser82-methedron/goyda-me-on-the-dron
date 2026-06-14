// ===== Именованные боссы-набеги (персонажи кампании «Гойды») =====
// hpMul/dmgMul масштабируют базового boss; tint — цвет перекраски модели;
// escort — сколько набежчиков ведёт; mech — спец-механика (обрабатывается в Waves).
export const BOSSES = {
  holop_lezheboka: {
    name: 'ХОЛОП-ЛЕЖЕБОКА', emoji: '😴', hpMul: 0.6, dmgMul: 0.6, tint: 0x6a5a3a, escort: 3,
    taunt: 'Ну чё вы… дайте поспать, а потом гойданёмся…',
  },
  ratnik_fedor: {
    name: 'РАТНИК ФЁДОР', emoji: '⚔️', hpMul: 1.0, dmgMul: 1.0, tint: 0x8a3a2a, escort: 5,
    taunt: 'За ДРОНА бились — и ты ляжешь!',
  },
  voevoda_skuf: {
    name: 'ВОЕВОДА СКУФ', emoji: '🛡️', hpMul: 1.8, dmgMul: 0.9, tint: 0x4a4a52, escort: 6,
    taunt: 'Стены твои — труха. Сидел я в окопе подольше тебя.',
  },
  oprichnik_dushnila: {
    name: 'ОПРИЧНИК-ДУШНИЛА', emoji: '👹', hpMul: 1.3, dmgMul: 1.4, tint: 0x201018, escort: 7,
    taunt: 'Технически ты уже проиграл. Объясняю по пунктам…',
  },
  volhv_krioved: {
    name: 'ВОЛХВ КРИОВЕД', emoji: '❄️', hpMul: 1.5, dmgMul: 1.1, tint: 0x1a5a7a, escort: 6,
    mech: 'krio', taunt: 'ХЛАД ГОЙДЫ скуёт твои закрома!',
  },
  goyda_batya: {
    name: 'САМ ГОЙДА-БАТЯ', emoji: '👑', hpMul: 3.0, dmgMul: 1.8, tint: 0xffcc00, escort: 10,
    taunt: 'ГО-О-О-ОЙДА! Ты лишь тень моя, сынок.',
  },
};
