/*
 * ГОЙДА — общий контракт «Империя ↔ Арена».
 * Без зависимостей: этот файл загружается обеими HTML-страницами и держит
 * небольшой, проверяемый обменный пакет в localStorage.
 */
(function (root) {
  'use strict';

  var ACTIVE_KEY = 'GOYDA_EXPEDITION_V1';
  var RETURN_KEY = 'GOYDA_EXPEDITION_RETURN_V1';
  var HISTORY_KEY = 'GOYDA_EXPEDITION_HISTORY_V1';

  function read(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return value || fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function take(key) {
    var value = read(key, null);
    try { localStorage.removeItem(key); } catch (e) {}
    return value;
  }
  function int(value, min, max) {
    var n = Math.round(Number(value) || 0);
    return Math.max(min, Math.min(max, n));
  }
  function uid() {
    return 'exp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }
  function difficulty(depth, rank, army) {
    var power = depth * 1.1 + rank * 0.85 + Math.max(0, army - 3) * 0.18;
    if (power >= 5.3) return { id: 'oprichnik', name: 'ОПРИЧНИЧИЙ', icon: '💀', tier: 3 };
    if (power >= 2.6) return { id: 'warrior', name: 'ВОИНСКИЙ', icon: '⚔️', tier: 2 };
    return { id: 'easy', name: 'ДОЗОРНЫЙ', icon: '🛡️', tier: 1 };
  }
  function titleFor(tier) {
    return ['Дозор у разлома', 'Рейд на вражий лагерь', 'Осада Чертога Дрона'][tier - 1] || 'Экспедиция Дрона';
  }
  function rosterOf(value) {
    var out = {};
    if (!value || typeof value !== 'object') return out;
    Object.keys(value).forEach(function (key) { out[key] = int(value[key], 0, 99); });
    return out;
  }
  function squadFor(roster) {
    if ((roster.oprichnik || 0) + (roster.bogatyr || 0) > 0) return { id: 'elite', icon: '👑', name: 'Ударная дружина', desc: '+10% Базометра' };
    if ((roster.ratnik || 0) > 0) return { id: 'guard', icon: '🛡️', name: 'Ратная стража', desc: '+1 броня' };
    if ((roster.kholop || 0) >= 2) return { id: 'workers', icon: '📦', name: 'Обоз холопов', desc: '+1 вечевой' };
    return { id: 'scouts', icon: '👣', name: 'Дозорные', desc: '+1 карта в начале' };
  }
  var MISSIONS = {
    assault: { id: 'assault', icon: '⚔️', name: 'Штурм разлома', desc: 'Рискованный бой за военную добычу', encounter: 'frenzy', bonus: { gold: 18, valor: 4 } },
    treasury: { id: 'treasury', icon: '💰', name: 'Казна налётчика', desc: 'Отними дань, пока враг не успел её потратить', encounter: 'tithe', bonus: { gold: 28, food: 8 } },
    relic: { id: 'relic', icon: '🗿', name: 'Святилище Дрона', desc: 'Пробей стражу и забери святыню', encounter: 'wall', bonus: { faith: 18, gems: 1 } }
  };
  function missionFor(id) { return MISSIONS[id] || MISSIONS.assault; }
  function encounterFor(depth, rank, army, threat, mission) {
    if (mission && mission.encounter) {
      var forced = {
        frenzy: { id: 'frenzy', icon: '🔥', name: 'Яростный налёт', desc: 'враг начинает ближе к Этапу II', effect: 'base', bonus: { food: 14 } },
        tithe: { id: 'tithe', icon: '💰', name: 'Сборщик дани', desc: 'враг начинает с вечевыми', effect: 'coins', bonus: { gold: 12 } },
        wall: { id: 'wall', icon: '🛡️', name: 'Щитоносцы разлома', desc: 'враг начинает с бронёй', effect: 'shield', bonus: { faith: 8 } }
      }[mission.encounter];
      if (forced && threat.tier >= 3 && forced.id === 'wall') return { id: 'wall_elite', icon: '🛡️', name: 'Стена воеводы', desc: 'враг начинает с двумя бронями', effect: 'doubleShield', bonus: { gems: 1, faith: 8 } };
      if (forced) return forced;
    }
    var roll = (depth * 5 + rank * 3 + army) % 3;
    var list = [
      { id: 'wall', icon: '🛡️', name: 'Щитоносцы разлома', desc: 'враг начинает с бронёй', effect: 'shield', bonus: { faith: 8 } },
      { id: 'tithe', icon: '💰', name: 'Сборщик дани', desc: 'враг начинает с вечевыми', effect: 'coins', bonus: { gold: 12 } },
      { id: 'frenzy', icon: '🔥', name: 'Яростный налёт', desc: 'враг начинает ближе к Этапу II', effect: 'base', bonus: { food: 14 } }
    ];
    var result = list[roll];
    if (threat.tier >= 3 && result.id === 'wall') {
      result = { id: 'wall_elite', icon: '🛡️', name: 'Стена воеводы', desc: 'враг начинает с двумя бронями', effect: 'doubleShield', bonus: { gems: 1, faith: 8 } };
    }
    return result;
  }
  function describe(contract) {
    return contract.threat.icon + ' ' + contract.title + ' · угроза «' + contract.threat.name + '»';
  }
  var DOCTRINES = {
    vanguard: { id: 'vanguard', icon: '⚔️', name: 'Натиск', desc: '+20% Базометра в начале; больше золота за победу' },
    ward: { id: 'ward', icon: '🛡️', name: 'Оберег', desc: '+1 броня; больше Веры за победу' },
    supply: { id: 'supply', icon: '📦', name: 'Снабжение', desc: '+2 вечевых и карта; больше припасов' }
  };

  function prepare(input) {
    input = input || {};
    var depth = int(input.depth, 1, 99);
    var rank = int(input.rankIndex, 0, 20);
    var army = int(input.army, 0, 99);
    var threat = difficulty(depth, rank, army);
    var roster = rosterOf(input.roster);
    var mission = missionFor(input.mission);
    var contract = {
      v: 1, id: uid(), state: 'ready', createdAt: Date.now(), source: 'empire',
      day: int(input.day, 0, 9999), depth: depth, rankIndex: rank, army: army,
      goldAtStart: int(input.gold, 0, 999999), roster: roster, squad: squadFor(roster), threat: threat,
      mission: mission, encounter: encounterFor(depth, rank, army, threat, mission),
      title: mission.name || titleFor(threat.tier), retries: 0
    };
    write(ACTIVE_KEY, contract);
    return contract;
  }
  function active() {
    var contract = read(ACTIVE_KEY, null);
    if (!contract || contract.v !== 1 || contract.state === 'resolved') return null;
    return contract;
  }
  function begin() {
    var contract = active();
    if (!contract) return null;
    contract.state = 'in_battle'; contract.startedAt = Date.now();
    write(ACTIVE_KEY, contract);
    return contract;
  }
  function chooseDoctrine(id) {
    var contract = active();
    if (!contract || contract.state === 'in_battle' || !DOCTRINES[id]) return null;
    contract.doctrine = DOCTRINES[id];
    write(ACTIVE_KEY, contract);
    return contract;
  }
  function resolve(outcome, details) {
    var contract = active();
    if (!contract) return null;
    details = details || {};
    var win = outcome === 'win', draw = outcome === 'draw';
    var tier = int(contract.threat && contract.threat.tier, 1, 3);
    var reward = win ? {
      gold: 20 + tier * 16 + contract.depth * 4,
      faith: 10 + tier * 9 + contract.rankIndex * 3,
      food: 14 + tier * 10,
      gems: tier >= 3 ? 2 : tier === 2 ? 1 : 0,
      valor: 8 + tier * 7,
      morale: 4 + tier * 2,
      veterancy: tier
    } : {
      gold: draw ? 8 + tier * 4 : 0,
      faith: draw ? 4 + tier * 2 : 2,
      food: draw ? 8 : 0, gems: 0, valor: draw ? 3 : 1,
      morale: draw ? 0 : -3, veterancy: 0
    };
    if (win && contract.doctrine) {
      if (contract.doctrine.id === 'vanguard') reward.gold += 14 + tier * 4;
      if (contract.doctrine.id === 'ward') reward.faith += 10 + tier * 3;
      if (contract.doctrine.id === 'supply') reward.food += 18 + tier * 6;
    }
    if (win && contract.encounter && contract.encounter.bonus) {
      Object.keys(contract.encounter.bonus).forEach(function (key) {
        reward[key] = (reward[key] || 0) + contract.encounter.bonus[key];
      });
    }
    if (win && contract.mission && contract.mission.bonus) {
      Object.keys(contract.mission.bonus).forEach(function (key) {
        reward[key] = (reward[key] || 0) + contract.mission.bonus[key];
      });
    }
    var returnPacket = {
      v: 1, id: contract.id, from: 'arena', outcome: outcome,
      contract: { title: contract.title, threat: contract.threat, depth: contract.depth, doctrine: contract.doctrine || null, encounter: contract.encounter || null, mission: contract.mission || null },
      reward: reward, hp: int(details.hp, 0, 100), resolvedAt: Date.now()
    };
    contract.state = 'resolved'; contract.result = returnPacket;
    write(ACTIVE_KEY, contract); write(RETURN_KEY, returnPacket);
    var history = read(HISTORY_KEY, []);
    if (!Array.isArray(history)) history = [];
    history.unshift(returnPacket); write(HISTORY_KEY, history.slice(0, 12));
    return returnPacket;
  }
  function consumeReturn() { return take(RETURN_KEY); }
  function clear() { try { localStorage.removeItem(ACTIVE_KEY); } catch (e) {} }
  function formatReward(reward) {
    if (!reward) return '';
    var bits = [];
    if (reward.gold) bits.push('+' + reward.gold + '🪙');
    if (reward.food) bits.push('+' + reward.food + '🍖');
    if (reward.faith) bits.push('+' + reward.faith + '☩');
    if (reward.gems) bits.push('+' + reward.gems + '💎');
    if (reward.valor) bits.push('+' + reward.valor + '⭐');
    if (reward.veterancy) bits.push('+' + reward.veterancy + '⚔ опыт');
    if (reward.morale) bits.push((reward.morale > 0 ? '+' : '') + reward.morale + '😊');
    return bits.join(' · ');
  }

  root.GoydaExpedition = {
    prepare: prepare, active: active, chooseDoctrine: chooseDoctrine, begin: begin, resolve: resolve,
    consumeReturn: consumeReturn, clear: clear, describe: describe, formatReward: formatReward,
    history: function () { var items = read(HISTORY_KEY, []); return Array.isArray(items) ? items.slice() : []; }
  };
})(window);
