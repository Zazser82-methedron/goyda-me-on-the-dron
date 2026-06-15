// ===== Древо технологий (исследования): разовые улучшения за ресурсы =====
// apply — что прибавляется к множителям/бонусам state.research.
export const TECHS = {
  strada:   { name: 'СТРАДА',        icon: '🌾', rank: 0, cost: { food: 40, wood: 30 },        apply: { gatherMul: 0.25 }, desc: '+25% к добыче ХОЛОПов' },
  zhnivo:   { name: 'ЖНИВО',         icon: '🍞', rank: 0, cost: { wood: 40, food: 20 },        apply: { foodDay: 4 },      desc: '+4 ЕДЫ в день' },
  lihva:    { name: 'ЛИХВА',         icon: '🪙', rank: 1, cost: { gold: 45, stone: 20 },       apply: { goldDay: 3 },      desc: '+3 золота в день' },
  plodovitost: { name: 'ПЛОДОВИТОСТЬ', icon: '👥', rank: 1, cost: { food: 60, faith: 20 },    apply: { popBonus: 4 },     desc: '+4 к лимиту народа' },
  bronya:   { name: 'БРОНЯ',         icon: '🛡️', rank: 1, cost: { iron: 20, stone: 40 },       apply: { hpMul: 0.25 },     desc: '+25% HP новым воинам' },
  dogmat:   { name: 'ДОГМАТ',        icon: '☩',  rank: 2, cost: { faith: 30, gold: 20 },       apply: { faithDay: 3 },     desc: '+3 ВЕРЫ в день' },
  secha:    { name: 'СЕЧА',          icon: '⚔️', rank: 2, cost: { iron: 25, gold: 30 },         apply: { dmgMul: 0.20 },    desc: '+20% урона воинов' },
  zakal:    { name: 'ЗАКАЛ',         icon: '🏃', rank: 2, cost: { iron: 15, food: 30 },         apply: { spdMul: 0.12 },    desc: '+12% скорости новым воинам' },
};

export const TECH_ORDER = ['strada', 'zhnivo', 'lihva', 'plodovitost', 'bronya', 'dogmat', 'secha', 'zakal'];
