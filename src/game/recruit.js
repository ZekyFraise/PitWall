import { CATEGORY_BY_ID, PRO_TIER_THRESHOLD } from "./data.js";
import { overallRating } from "./driver.js";
import { releaseSeatAndBackfill } from "./team.js";
import { rosterCapacity, agencyAppeal } from "./infrastructure.js";
import { bumpRivalReputation } from "./rivals.js";
import { recordTransaction } from "./finance.js";
import { racesUntilSeasonEnd } from "./standings.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function approachTerms(state, driver) {
  const category = CATEGORY_BY_ID[driver.categoryId];
  const isRivalManaged = Boolean(driver.agencyId);
  const threshold = Math.round(category.repRequired * (isRivalManaged ? 1.6 : 1));
  const appeal = agencyAppeal(state);
  const baseCost = 5000 + overallRating(driver) * 600 + category.tier * 15000;
  const cost = Math.round(isRivalManaged ? baseCost * 1.8 : baseCost);
  const successChance = isRivalManaged ? clamp(0.4 + (appeal - threshold) / 100, 0.15, 0.9) : 1;
  return { category, isRivalManaged, threshold, appeal, cost, successChance };
}

export function approachDriver(state, driverId, rng) {
  if (state.drivers.some((d) => d.id === driverId)) {
    return { ok: false, error: "Ce pilote fait déjà partie de ton agence." };
  }
  const driver = state.aiDrivers[driverId];
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  if (state.drivers.length >= rosterCapacity(state)) {
    return { ok: false, error: "Effectif complet — améliore tes bureaux pour recruter davantage." };
  }

  const { category, isRivalManaged, threshold, appeal, cost, successChance } = approachTerms(state, driver);
  if (appeal < threshold) {
    return { ok: false, error: "Réputation insuffisante pour approcher ce pilote." };
  }
  if (state.agency.money < cost) {
    return { ok: false, error: "Budget insuffisant." };
  }
  if (isRivalManaged && rng() >= successChance) {
    return { ok: false, error: "Négociation échouée — le pilote reste chez son agence actuelle." };
  }

  state.agency.money -= cost;
  recordTransaction(state, "approach-driver", `Recrutement — ${driver.name}`, -cost);

  const previousAgencyId = driver.agencyId;
  const previousAgencyName = isRivalManaged
    ? state.rivalAgencies.find((a) => a.id === previousAgencyId)?.name ?? "une agence rivale"
    : null;
  if (isRivalManaged) {
    bumpRivalReputation(state, previousAgencyId, -3);
  }

  releaseSeatAndBackfill(state, driver.id, rng);
  delete state.aiDrivers[driver.id];

  driver.contract = { racesRemaining: racesUntilSeasonEnd(state, category.id), weeklyWage: Math.round(cost / 20) };
  driver.weeksWithoutContract = 0;
  driver.isPro = category.tier >= PRO_TIER_THRESHOLD;
  driver.highestTierReached = Math.max(driver.highestTierReached ?? 0, category.tier);
  driver.isAI = false;
  driver.agencyId = null;
  driver.scouted = true;
  driver.teamId = null;
  state.drivers.push(driver);

  return { ok: true, driver, category, cost, wasRivalManaged: isRivalManaged, previousAgencyId, previousAgencyName };
}
