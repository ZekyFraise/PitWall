import { recordTransaction } from "./finance.js";
import { bestSkill, bestCommunication, averageExperience, averageScoutSkill, averagePrecisionSkill } from "./staff.js";
import { applyReputationGain } from "./data.js";

// reputationRequired gates each upgrade in addition to its cost — level 1 (index 0, already
// owned from the start) has no requirement, since it's never "purchased".
export const FACILITIES = {
  offices: {
    name: "Bureaux",
    description: "Capacité d'effectif, commission sur les gains et transferts des pilotes pro, et gain de relation agence.",
    // commissionRate remplace l'ancienne constante PRO_COMMISSION_RATE (fixe à 0.25) — le palier
    // 1 est centré autour de cette valeur pour ne pas braquer une agence qui débute. Les 3
    // derniers paliers accentuent nettement l'écart de coût/réputation par rapport aux 5
    // premiers (progression historique) — investir plus loin doit se mériter, pas juste
    // continuer la même pente linéaire indéfiniment.
    levels: [
      { capacity: 3, commissionRate: 0.20, transferFeeRate: 0.10, patienceBonus: 0, upkeep: 0, upgradeCost: 0, reputationRequired: 0 },
      { capacity: 4, commissionRate: 0.22, transferFeeRate: 0.13, patienceBonus: 1, upkeep: 250, upgradeCost: 15000, reputationRequired: 10 },
      { capacity: 5, commissionRate: 0.24, transferFeeRate: 0.16, patienceBonus: 2, upkeep: 600, upgradeCost: 40000, reputationRequired: 25 },
      { capacity: 6, commissionRate: 0.26, transferFeeRate: 0.19, patienceBonus: 3, upkeep: 1200, upgradeCost: 90000, reputationRequired: 45 },
      { capacity: 7, commissionRate: 0.28, transferFeeRate: 0.22, patienceBonus: 4, upkeep: 2200, upgradeCost: 180000, reputationRequired: 70 },
      { capacity: 8, commissionRate: 0.30, transferFeeRate: 0.25, patienceBonus: 5, upkeep: 3800, upgradeCost: 350000, reputationRequired: 100 },
      { capacity: 9, commissionRate: 0.32, transferFeeRate: 0.28, patienceBonus: 6, upkeep: 6000, upgradeCost: 650000, reputationRequired: 140 },
      { capacity: 10, commissionRate: 0.34, transferFeeRate: 0.30, patienceBonus: 7, upkeep: 9500, upgradeCost: 1200000, reputationRequired: 190 },
    ],
  },
  training: {
    name: "Centre d'entraînement",
    description: "Accélère la progression de tes pilotes signés.",
    // Ceiling lowered from 1.6 — combined with the experience/coach bonuses on top (simulate.js/
    // trainingGrowthMultiplier below), a fully-upgraded agency's drivers were progressing up to
    // ~2.4x faster than AI drivers, which read as the two not playing by the same rules rather
    // than a fair reward for investment. Same cost/reputation curve, just a gentler payoff.
    levels: [
      { growthMultiplier: 1, upkeep: 0, upgradeCost: 0, reputationRequired: 0 },
      { growthMultiplier: 1.08, upkeep: 300, upgradeCost: 18000, reputationRequired: 10 },
      { growthMultiplier: 1.16, upkeep: 700, upgradeCost: 45000, reputationRequired: 25 },
      { growthMultiplier: 1.24, upkeep: 1400, upgradeCost: 95000, reputationRequired: 45 },
      { growthMultiplier: 1.32, upkeep: 2500, upgradeCost: 190000, reputationRequired: 70 },
    ],
  },
  prestige: {
    name: "Bureau de standing",
    description: "Renforce l'attrait de l'agence auprès des pilotes établis et limite le débauchage de tes pilotes libres.",
    levels: [
      { appealBonus: 0, poachFactor: 1, upkeep: 0, upgradeCost: 0, reputationRequired: 0 },
      { appealBonus: 15, poachFactor: 0.9, upkeep: 300, upgradeCost: 18000, reputationRequired: 10 },
      { appealBonus: 30, poachFactor: 0.8, upkeep: 700, upgradeCost: 45000, reputationRequired: 25 },
      { appealBonus: 50, poachFactor: 0.65, upkeep: 1400, upgradeCost: 95000, reputationRequired: 45 },
      { appealBonus: 75, poachFactor: 0.5, upkeep: 2500, upgradeCost: 190000, reputationRequired: 70 },
    ],
  },
  recruiterQuality: {
    name: "Qualité des recruteurs",
    description: "Nombre de pilotes trouvés à chaque mercato, précision de découverte, et niveau de base des profils repérés.",
    // Même esprit de progression que les infra ci-dessus pour les 5 premiers paliers, puis 3
    // paliers avancés nettement plus durs — voir le commentaire sur offices ci-dessus.
    levels: [
      { poolSize: 4, discoveryBonus: 0, precisionBonus: 0, qualityFloorBonus: 0, upkeep: 0, upgradeCost: 0, reputationRequired: 0 },
      { poolSize: 5, discoveryBonus: 10, precisionBonus: 10, qualityFloorBonus: 3, upkeep: 300, upgradeCost: 18000, reputationRequired: 10 },
      { poolSize: 6, discoveryBonus: 20, precisionBonus: 20, qualityFloorBonus: 6, upkeep: 700, upgradeCost: 45000, reputationRequired: 25 },
      { poolSize: 7, discoveryBonus: 30, precisionBonus: 30, qualityFloorBonus: 9, upkeep: 1400, upgradeCost: 95000, reputationRequired: 45 },
      { poolSize: 8, discoveryBonus: 40, precisionBonus: 40, qualityFloorBonus: 12, upkeep: 2500, upgradeCost: 190000, reputationRequired: 70 },
      { poolSize: 9, discoveryBonus: 50, precisionBonus: 50, qualityFloorBonus: 15, upkeep: 4200, upgradeCost: 350000, reputationRequired: 100 },
      { poolSize: 10, discoveryBonus: 60, precisionBonus: 60, qualityFloorBonus: 18, upkeep: 6500, upgradeCost: 650000, reputationRequired: 140 },
      { poolSize: 12, discoveryBonus: 70, precisionBonus: 70, qualityFloorBonus: 21, upkeep: 9500, upgradeCost: 1200000, reputationRequired: 190 },
    ],
  },
  contactNetwork: {
    name: "Réseau de contacts",
    description: "Chance de tomber sur un profil de staff élite dans le vivier de recrutement.",
    // Same reputationRequired curve as offices/recruiterQuality — single-effect facility, so
    // upkeep/upgradeCost sit at roughly 60% of recruiterQuality's since it isn't bundling a
    // pool-size + discovery + precision triple effect.
    levels: [
      { eliteChance: 0, upkeep: 0, upgradeCost: 0, reputationRequired: 0 },
      { eliteChance: 0.04, upkeep: 200, upgradeCost: 12000, reputationRequired: 10 },
      { eliteChance: 0.08, upkeep: 450, upgradeCost: 30000, reputationRequired: 25 },
      { eliteChance: 0.13, upkeep: 900, upgradeCost: 65000, reputationRequired: 45 },
      { eliteChance: 0.19, upkeep: 1700, upgradeCost: 130000, reputationRequired: 70 },
      { eliteChance: 0.26, upkeep: 2900, upgradeCost: 240000, reputationRequired: 100 },
      { eliteChance: 0.34, upkeep: 4500, upgradeCost: 450000, reputationRequired: 140 },
      { eliteChance: 0.42, upkeep: 6800, upgradeCost: 800000, reputationRequired: 190 },
    ],
  },
};

// Bureau et Qualité des recruteurs ont plus de paliers que Centre d'entraînement/Bureau de
// standing (8 contre 5) — le plafond d'affichage doit donc être lu par facility plutôt que
// supposé identique partout.
export function facilityMaxLevel(facilityId) {
  return FACILITIES[facilityId].levels.length;
}

export const SHOP_ITEMS = [
  {
    id: "pr-campaign",
    name: "Campagne PR",
    description: "Coup de projecteur immédiat pour l'agence.",
    cost: 5000,
    type: "flat",
    reputationBonus: 5,
    // Unlike the multiplier items (one-time by nature), a "flat" purchase had no repeat guard
    // at all — money could be converted into unlimited reputation, which was the actual reason
    // reputation kept feeling too easy even after the season-end-only rework. A cooldown keeps
    // the flavor (a repeatable PR push) without making it a bypass for the whole economy.
    cooldownWeeks: 8,
  },
  {
    id: "media-training",
    name: "Média training",
    description: "Améliore durablement l'image de l'agence.",
    cost: 15000,
    type: "multiplier",
    reputationMultiplier: 1.05,
  },
  {
    id: "vip-lounge",
    name: "Espace VIP paddock",
    description: "Renforce durablement la réputation gagnée en course.",
    cost: 25000,
    type: "multiplier",
    reputationMultiplier: 1.1,
  },
];

export function shopCooldownRemaining(state, itemId) {
  return state.shopCooldowns?.[itemId] ?? 0;
}

export function purchaseShopItem(state, itemId, { force = false } = {}) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: "Objet introuvable." };
  if (item.type === "multiplier" && state.purchasedUpgrades.includes(itemId)) {
    return { ok: false, error: "Déjà acheté." };
  }
  if (!force && item.cooldownWeeks && shopCooldownRemaining(state, itemId) > 0) {
    return { ok: false, error: `Disponible à nouveau dans ${shopCooldownRemaining(state, itemId)} semaine(s).` };
  }
  const cost = force ? 0 : item.cost;
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };

  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "shop-purchase", `Achat — ${item.name}`, -cost);
  }
  if (item.type === "flat") {
    applyReputationGain(state, item.reputationBonus);
    if (item.cooldownWeeks) {
      state.shopCooldowns = state.shopCooldowns ?? {};
      state.shopCooldowns[itemId] = item.cooldownWeeks;
    }
  } else {
    state.purchasedUpgrades.push(itemId);
  }
  return { ok: true };
}

export function reputationMultiplier(state) {
  return state.purchasedUpgrades.reduce((acc, id) => {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    return item?.type === "multiplier" ? acc * item.reputationMultiplier : acc;
  }, 1);
}

export function getFacilityLevelData(state, facilityId) {
  const level = state.infrastructure[facilityId];
  return FACILITIES[facilityId].levels[level - 1];
}

export function nextFacilityLevelData(state, facilityId) {
  const level = state.infrastructure[facilityId];
  return FACILITIES[facilityId].levels[level] ?? null;
}

export function upgradeFacility(state, facilityId, { force = false } = {}) {
  const next = nextFacilityLevelData(state, facilityId);
  if (!next) return { ok: false, error: "Niveau maximum atteint." };
  if (!force && state.agency.reputation < next.reputationRequired) {
    return { ok: false, error: `Réputation insuffisante (${next.reputationRequired} requise).` };
  }
  const cost = force ? 0 : next.upgradeCost;
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };
  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "facility-upgrade", `${FACILITIES[facilityId].name} niveau ${state.infrastructure[facilityId] + 1}`, -cost);
  }
  state.infrastructure[facilityId] += 1;
  return { ok: true };
}

export function rosterCapacity(state) {
  return getFacilityLevelData(state, "offices").capacity;
}

export function officeCommissionRate(state) {
  return getFacilityLevelData(state, "offices").commissionRate;
}

export function officeTransferFeeRate(state) {
  return getFacilityLevelData(state, "offices").transferFeeRate;
}

export function officePatienceBonus(state) {
  return getFacilityLevelData(state, "offices").patienceBonus;
}

// "Qualité des recruteurs" est désormais le moteur principal du vivier (taille) — le staff
// recruteur embauché (compétences primaire/secondaire) devient un modificateur secondaire sur
// la qualité de découverte, pas sur le nombre de profils trouvés. Défini ici (et pas staff.js)
// pour éviter un cycle d'import : infrastructure.js dépend déjà de staff.js, l'inverse créerait
// une dépendance circulaire.
export function scoutPoolCapacity(state) {
  return getFacilityLevelData(state, "recruiterQuality").poolSize;
}

export function eliteStaffChance(state) {
  return getFacilityLevelData(state, "contactNetwork").eliteChance;
}

export function effectiveScoutSkills(state) {
  const level = getFacilityLevelData(state, "recruiterQuality");
  return {
    discovery: level.discoveryBonus + averageScoutSkill(state) * 0.5,
    precision: level.precisionBonus + averagePrecisionSkill(state) * 0.5,
  };
}

export function trainingGrowthMultiplier(state) {
  // Halved from 0.15 alongside the facility ceiling above — same reasoning, narrows the gap
  // to AI drivers instead of removing the staff-experience incentive entirely.
  const experienceBonus = (averageExperience(state) / 95) * 0.08;
  return getFacilityLevelData(state, "training").growthMultiplier * (1 + experienceBonus);
}

export function agencyAppeal(state) {
  const communicationBonus = (bestCommunication(state) / 95) * 15;
  return state.agency.reputation + getFacilityLevelData(state, "prestige").appealBonus + communicationBonus;
}

export function poachFactor(state) {
  return getFacilityLevelData(state, "prestige").poachFactor;
}

export function totalUpkeep(state) {
  const rawUpkeep = Object.keys(FACILITIES).reduce((sum, id) => sum + getFacilityLevelData(state, id).upkeep, 0);
  const cfoDiscount = (bestSkill(state, "cfo") / 95) * 0.25;
  return Math.round(rawUpkeep * (1 - cfoDiscount));
}
