/* gamification.js — Sistema de XP, niveles y logros */

const XP_RULES = {
  KM_NADADO: 100,
  ENTRENO_CALISTENIA: 150,
  DIA_SIN_FUMAR: 50,
  PROTEINA_OBJETIVO: 30,
  SUENO_7H: 20
};

const ACHIEVEMENTS_CATALOG = [
  { id: 'swim_10k', label: '10 km nadados', check: (s) => s.totalKm >= 10 },
  { id: 'swim_50k', label: '50 km nadados', check: (s) => s.totalKm >= 50 },
  { id: 'no_smoke_30', label: '30 días sin tabaco', check: (s) => s.diasSinFumar >= 30 },
  { id: 'no_smoke_90', label: '90 días sin tabaco', check: (s) => s.diasSinFumar >= 90 },
  { id: 'pushups_100', label: '100 flexiones acumuladas', check: (s) => s.totalFlexiones >= 100 },
  { id: 'weight_5', label: '5 kg perdidos', check: (s) => s.kgPerdidos >= 5 },
  { id: 'weight_9', label: 'Objetivo alcanzado (78 kg)', check: (s) => s.kgPerdidos >= 9 }
];

function xpForLevel(level) {
  // Curva simple: cada nivel requiere un poco más que el anterior
  return 500 * level;
}

const Gamification = {
  async getState() {
    const state = await DB.get('gamification', 'main');
    return state || { id: 'main', xp: 0, level: 1, achievements: [] };
  },

  async addXP(amount, reason) {
    const state = await this.getState();
    state.xp += amount;

    let leveledUp = false;
    while (state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level += 1;
      leveledUp = true;
    }

    await DB.put('gamification', state);
    document.dispatchEvent(new CustomEvent('xp:gained', { detail: { amount, reason, state, leveledUp } }));
    return state;
  },

  async checkAchievements(stats) {
    const state = await this.getState();
    const unlocked = [];
    for (const ach of ACHIEVEMENTS_CATALOG) {
      if (!state.achievements.includes(ach.id) && ach.check(stats)) {
        state.achievements.push(ach.id);
        unlocked.push(ach);
      }
    }
    if (unlocked.length) {
      await DB.put('gamification', state);
      document.dispatchEvent(new CustomEvent('achievements:unlocked', { detail: { unlocked } }));
    }
    return unlocked;
  },

  catalog: ACHIEVEMENTS_CATALOG,
  rules: XP_RULES,
  xpForLevel
};

window.Gamification = Gamification;
