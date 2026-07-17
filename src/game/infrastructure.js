import { recordTransaction } from "./finance.js";
import { bestSkill, bestCommunication, averageExperience } from "./staff.js";

export const FACILITIES = {
  offices: {
    name: "Bureaux",
    description: "Capacité d'effectif : nombre de pilotes que l'agence peut représenter.",
    levels: [
      { capacity: 3, upkeep: 0, upgradeCost: 0 },
      { capacity: 4, upkeep: 250, upgradeCost: 15000 },
      { capacity: 5, upkeep: 600, upgradeCost: 40000 },
      { capacity: 6, upkeep: 1200, upgradeCost: 90000 },
      { capacity: 8, upkeep: 2200, upgradeCost: 180000 },
    ],
  },
  training: {
    name: "Centre d'entraînement",
    description: "Accélère la progression de tes pilotes signés.",
    levels: [
      { growthMultiplier: 1, upkeep: 0, upgradeCost: 0 },
      { growthMultiplier: 1.15, upkeep: 300, upgradeCost: 18000 },
      { growthMultiplier: 1.3, upkeep: 700, upgradeCost: 45000 },
      { growthMultiplier: 1.45, upkeep: 1400, upgradeCost: 95000 },
      { growthMultiplier: 1.6, upkeep: 2500, upgradeCost: 190000 },
    ],
  },
  prestige: {
    name: "Bureau de standing",
    description: "Renforce l'attrait de l'agence auprès des pilotes établis et limite le débauchage de tes pilotes libres.",
    levels: [
      { appealBonus: 0, poachFactor: 1, upkeep: 0, upgradeCost: 0 },
      { appealBonus: 15, poachFactor: 0.9, upkeep: 300, upgradeCost: 18000 },
      { appealBonus: 30, poachFactor: 0.8, upkeep: 700, upgradeCost: 45000 },
      { appealBonus: 50, poachFactor: 0.65, upkeep: 1400, upgradeCost: 95000 },
      { appealBonus: 75, poachFactor: 0.5, upkeep: 2500, upgradeCost: 190000 },
    ],
  },
};

export const MAX_FACILITY_LEVEL = 5;

export const SHOP_ITEMS = [
  {
    id: "pr-campaign",
    name: "Campagne PR",
    description: "Coup de projecteur immédiat pour l'agence.",
    cost: 5000,
    type: "flat",
    reputationBonus: 5,
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

export function purchaseShopItem(state, itemId) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: "Objet introuvable." };
  if (item.type === "multiplier" && state.purchasedUpgrades.includes(itemId)) {
    return { ok: false, error: "Déjà acheté." };
  }
  if (state.agency.money < item.cost) return { ok: false, error: "Budget insuffisant." };

  state.agency.money -= item.cost;
  recordTransaction(state, "shop-purchase", `Achat — ${item.name}`, -item.cost);
  if (item.type === "flat") {
    state.agency.reputation += item.reputationBonus;
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

export function upgradeFacility(state, facilityId) {
  const next = nextFacilityLevelData(state, facilityId);
  if (!next) return false;
  if (state.agency.money < next.upgradeCost) return false;
  state.agency.money -= next.upgradeCost;
  recordTransaction(state, "facility-upgrade", `${FACILITIES[facilityId].name} niveau ${state.infrastructure[facilityId] + 1}`, -next.upgradeCost);
  state.infrastructure[facilityId] += 1;
  return true;
}

export function rosterCapacity(state) {
  return getFacilityLevelData(state, "offices").capacity;
}

export function trainingGrowthMultiplier(state) {
  const experienceBonus = (averageExperience(state) / 95) * 0.15;
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
