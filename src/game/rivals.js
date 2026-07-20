import { RIVAL_AGENCIES, CATEGORY_BY_ID } from "./data.js";
import { releaseSeatAndBackfill } from "./team.js";
import { poachFactor } from "./infrastructure.js";
import { bestSkill } from "./staff.js";
import { driverMarketValue } from "./driverStats.js";
import { recordTransaction } from "./finance.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomAgency(rng) {
  return RIVAL_AGENCIES[Math.floor(rng() * RIVAL_AGENCIES.length)];
}

export function bumpRivalReputation(state, agencyId, delta) {
  const agency = state.rivalAgencies.find((a) => a.id === agencyId);
  if (agency) agency.reputation = Math.max(0, agency.reputation + delta);
}

export function tickScoutPoolPoaching(state, rng) {
  const entries = [];
  for (const candidate of state.scoutPool) {
    candidate.weeksInPool = (candidate.weeksInPool ?? 0) + 1;
  }

  const survivors = [];
  for (const candidate of state.scoutPool) {
    const eligible = candidate.weeksInPool >= 1;
    const chance = candidate.scouted ? 0.15 : 0.08;
    if (eligible && rng() < chance) {
      const agency = randomAgency(rng);
      bumpRivalReputation(state, agency.id, 2);
      entries.push({ type: "rival-scout-sign", agencyName: agency.name, driverName: candidate.name });
      continue;
    }
    survivors.push(candidate);
  }
  state.scoutPool = survivors;
  return entries;
}

const LOYALTY_AUTO_REJECT_THRESHOLD = 90;

export function tickFreeAgentPoaching(state, rng) {
  const entries = [];
  const stillSigned = [];

  for (const driver of state.drivers) {
    // Only free agents who still hold a team seat go through this path — a driver without a
    // seat is already handled by tickBenchedDriverDecay, and must not be poach-rolled twice.
    if (!driver.contract && driver.teamId != null) {
      driver.weeksWithoutContract = (driver.weeksWithoutContract ?? 0) + 1;

      if ((driver.agencyRelationship ?? 0) >= LOYALTY_AUTO_REJECT_THRESHOLD) {
        stillSigned.push(driver);
        continue;
      }

      const lawyerFactor = 1 - (bestSkill(state, "lawyer") / 95) * 0.5;
      const loyaltyFactor = 1.5 - (driver.agencyRelationship ?? 0) / 100;
      const chance =
        clamp(0.05 + driver.weeksWithoutContract * 0.15, 0, 0.6) * poachFactor(state) * lawyerFactor * loyaltyFactor;
      if (rng() < chance) {
        const agency = randomAgency(rng);
        const buyout = poachCompensation(driver);
        releaseSeatAndBackfill(state, driver.id, rng);
        bumpRivalReputation(state, agency.id, 2);
        state.agency.reputation = Math.max(0, state.agency.reputation - 2);
        state.agency.money += buyout;
        recordTransaction(state, "poach-buyout", `Indemnité de départ — ${driver.name}`, buyout);
        entries.push({ type: "rival-poach", agencyName: agency.name, driverName: driver.name, buyout });
        continue;
      }
    } else {
      driver.weeksWithoutContract = 0;
    }
    stillSigned.push(driver);
  }

  state.drivers = stillSigned;
  return entries;
}

// The warning popup (poach-dilemma event) triggers well before the silent backend roll,
// so the player always gets a reaction window before a driver can actually be stolen.
export const POACH_WARNING_THRESHOLD = 40;
export const POACH_RISK_THRESHOLD = 25;
const BENCHED_RELATIONSHIP_DECAY = 2;

// Compensation for a poached driver: a fraction of market value scaled by tier.
// Losing a driver must never be more profitable than what was invested in them.
export function poachCompensation(driver) {
  const tier = CATEGORY_BY_ID[driver.categoryId]?.tier ?? 0;
  return Math.round(driverMarketValue(driver) * (0.1 + tier * 0.05));
}

// Immediately removes a driver from the agency (used by the poaching dilemma "leaves now"
// outcome). Frees any team seat, pays the tier-scaled compensation, bumps a rival, and
// returns a news log entry describing the departure.
export function poachDriverAway(state, driver, rng) {
  const agency = randomAgency(rng);
  const buyout = poachCompensation(driver);
  if (driver.teamId != null) releaseSeatAndBackfill(state, driver.id, rng);
  bumpRivalReputation(state, agency.id, 2);
  state.agency.reputation = Math.max(0, state.agency.reputation - 2);
  state.agency.money += buyout;
  recordTransaction(state, "poach-buyout", `Indemnité de départ — ${driver.name}`, buyout);
  state.drivers = state.drivers.filter((d) => d.id !== driver.id);
  return { type: "rival-poach", agencyName: agency.name, driverName: driver.name, buyout };
}

export function tickBenchedDriverDecay(state, rng) {
  const entries = [];
  const stillSigned = [];

  for (const driver of state.drivers) {
    if (driver.teamId == null) {
      driver.agencyRelationship = clamp((driver.agencyRelationship ?? 0) - BENCHED_RELATIONSHIP_DECAY, 0, 200);
      driver.benchedWeeks = (driver.benchedWeeks ?? 0) + 1;

      if (driver.agencyRelationship < POACH_RISK_THRESHOLD) {
        const lawyerFactor = 1 - (bestSkill(state, "lawyer") / 95) * 0.5;
        const loyaltyFactor = 1.5 - driver.agencyRelationship / 100;
        const chance =
          clamp(0.04 + driver.benchedWeeks * 0.02, 0, 0.4) * poachFactor(state) * lawyerFactor * loyaltyFactor;
        if (rng() < chance) {
          const agency = randomAgency(rng);
          const buyout = poachCompensation(driver);
          bumpRivalReputation(state, agency.id, 2);
          state.agency.reputation = Math.max(0, state.agency.reputation - 2);
          state.agency.money += buyout;
          recordTransaction(state, "poach-buyout", `Indemnité de départ — ${driver.name}`, buyout);
          entries.push({ type: "rival-poach", agencyName: agency.name, driverName: driver.name, buyout });
          continue;
        }
      }
    } else {
      driver.benchedWeeks = 0;
    }
    stillSigned.push(driver);
  }

  state.drivers = stillSigned;
  return entries;
}
