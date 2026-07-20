import { CATEGORY_BY_ID, PRO_TIER_THRESHOLD, SEASON_WEEKS, PRO_COMMISSION_RATE } from "./data.js";
import { overallRating } from "./driver.js";
import { releaseSeatAndBackfill } from "./team.js";
import { rosterCapacity, agencyAppeal } from "./infrastructure.js";
import { bumpRivalReputation } from "./rivals.js";
import { recordTransaction } from "./finance.js";

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

export function approachDriver(state, driverId, rng, { force = false } = {}) {
  if (state.drivers.some((d) => d.id === driverId)) {
    return { ok: false, error: "Ce pilote fait déjà partie de ton agence." };
  }
  const driver = state.aiDrivers[driverId];
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  if (!force && state.drivers.length >= rosterCapacity(state)) {
    return { ok: false, error: "Effectif complet — améliore tes bureaux pour recruter davantage." };
  }

  const { category, isRivalManaged, threshold, appeal, cost: rawCost, successChance } = approachTerms(state, driver);
  const cost = force ? 0 : rawCost;
  if (!force && appeal < threshold) {
    return { ok: false, error: "Réputation insuffisante pour approcher ce pilote." };
  }
  if (!force && state.agency.money < cost) {
    return { ok: false, error: "Budget insuffisant." };
  }
  if (!force && isRivalManaged && rng() >= successChance) {
    return { ok: false, error: "Négociation échouée — le pilote reste chez son agence actuelle." };
  }

  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "approach-driver", `Recrutement — ${driver.name}`, -cost);
  }

  const previousAgencyId = driver.agencyId;
  const previousAgencyName = isRivalManaged
    ? state.rivalAgencies.find((a) => a.id === previousAgencyId)?.name ?? "une agence rivale"
    : null;
  if (isRivalManaged) {
    bumpRivalReputation(state, previousAgencyId, -3);
  }

  releaseSeatAndBackfill(state, driver.id, rng);
  delete state.aiDrivers[driver.id];

  const isPro = category.tier >= PRO_TIER_THRESHOLD;
  driver.contract = isPro
    ? { weeksRemaining: SEASON_WEEKS, weeklyWage: 0, commissionRate: PRO_COMMISSION_RATE }
    : { weeksRemaining: SEASON_WEEKS, weeklyWage: Math.round(cost / 20), commissionRate: 0 };
  driver.weeksWithoutContract = 0;
  driver.isPro = isPro;
  driver.highestTierReached = Math.max(driver.highestTierReached ?? 0, category.tier);
  driver.isAI = false;
  driver.agencyId = null;
  driver.scouted = true;
  driver.teamId = null;
  state.drivers.push(driver);

  return { ok: true, driver, category, cost, wasRivalManaged: isRivalManaged, previousAgencyId, previousAgencyName };
}
