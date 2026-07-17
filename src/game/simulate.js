import { CATEGORIES, CATEGORY_BY_ID, PRO_COMMISSION_RATE, weekInSeason } from "./data.js";
import { overallRating, growDriver, getDriverById, reliability } from "./driver.js";
import { findTeamById, generateAIDriver, usedDriverNumbersInCategory, releaseSeatAndBackfill } from "./team.js";
import { refillScoutPool } from "./state.js";
import { tickScoutPoolPoaching, tickFreeAgentPoaching, tickBenchedDriverDecay, bumpRivalReputation } from "./rivals.js";
import { applyPoints, rolloverIfNeeded } from "./standings.js";
import { autoRevealCandidates, refillStaffPool, bestSkill } from "./staff.js";
import { trainingGrowthMultiplier, totalUpkeep, reputationMultiplier } from "./infrastructure.js";
import { recordTransaction, recordBalanceSnapshot } from "./finance.js";
import { triggerRandomEvent, resolveEventChoice } from "./events.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function dnfChance(reliabilityValue, physioReduction = 0) {
  const base = clamp(0.03 + ((100 - reliabilityValue) / 100) * 0.12, 0.02, 0.2);
  return base * (1 - physioReduction);
}

function applyMentalProtection(delta, protection) {
  return delta < 0 ? delta * (1 - protection) : delta;
}

function crewAverage(drivers, fn) {
  return drivers.reduce((sum, d) => sum + fn(d), 0) / drivers.length;
}

function participantScore(ratingValue, reliabilityValue, team, category, investment, rng) {
  const carScore = team.prestige * 0.9;
  const investmentBonus = investment > 0 ? clamp(Math.sqrt(investment / category.seatCost) * 10, 0, 10) : 0;
  const noiseSpread = 18 * category.difficulty * (1 - reliabilityValue / 200);
  const noise = (rng() * 2 - 1) * noiseSpread;
  return ratingValue * 0.65 + carScore * 0.35 + investmentBonus + noise;
}

function resultReputationDelta(position, gridSize) {
  if (position === 1) return 5;
  if (position <= 3) return 3;
  if (position <= 6) return 1;
  if (position > gridSize * 0.75) return -1;
  return 0;
}

function prizeForPosition(category, position, gridSize) {
  return Math.round(
    category.prizeScale * (0.08 + 0.92 * Math.max(0, (gridSize - position + 1) / gridSize) ** 1.4)
  );
}

export function simulateCategoryRace(state, category, rng) {
  if (category.classes) {
    const logEntries = [];
    for (const cls of category.classes) {
      const classTeams = (state.teams[category.id] ?? []).filter((t) => t.subClass === cls.id);
      logEntries.push(...simulateClassRace(state, category, classTeams, cls.id, rng));
    }
    return logEntries;
  }
  return simulateClassRace(state, category, state.teams[category.id] ?? [], null, rng);
}

function buildEntrants(state, teams, driversPerCar) {
  const entrants = [];
  for (const team of teams) {
    if (driversPerCar > 1) {
      const byCarIndex = new Map();
      team.seats.forEach((seat) => {
        if (seat.driverId == null) return;
        const driver = getDriverById(state, seat.driverId);
        if (!driver || (driver.injuryWeeksRemaining ?? 0) > 0) return;
        const idx = seat.carIndex ?? 0;
        if (!byCarIndex.has(idx)) byCarIndex.set(idx, []);
        byCarIndex.get(idx).push(driver);
      });
      for (const [carIndex, drivers] of byCarIndex) {
        if (drivers.length === 0) continue;
        const isPlayer = drivers.some((d) => state.drivers.some((pd) => pd.id === d.id));
        const investment = isPlayer
          ? drivers.reduce((sum, d) => sum + (state.investments[d.id] ?? 0), 0)
          : 0;
        entrants.push({ drivers, team, carId: `${team.id}:${carIndex}`, isPlayer, investment });
      }
    } else {
      for (const seat of team.seats) {
        if (seat.driverId == null) continue;
        const driver = getDriverById(state, seat.driverId);
        if (!driver || (driver.injuryWeeksRemaining ?? 0) > 0) continue;
        const isPlayer = state.drivers.some((d) => d.id === driver.id);
        entrants.push({
          drivers: [driver],
          team,
          carId: null,
          isPlayer,
          investment: isPlayer ? (state.investments[driver.id] ?? 0) : 0,
        });
      }
    }
  }
  return entrants;
}

function simulateClassRace(state, category, teams, classId, rng) {
  const entrants = buildEntrants(state, teams, category.driversPerCar ?? 1);
  if (entrants.length === 0) return [];

  for (const e of entrants) {
    if (e.isPlayer && e.investment > 0) {
      for (const driver of e.drivers) {
        const share = state.investments[driver.id] ?? 0;
        if (share <= 0) continue;
        if (share > state.agency.money) continue;
        state.agency.money -= share;
        recordTransaction(state, "investment", `${driver.name} — Budget course`, -share);
      }
    }
  }

  const physioReduction = (bestSkill(state, "physio") / 95) * 0.4;
  const isEndurance = category.id === "wec";
  const scored = entrants.map((e) => {
    const physio = e.isPlayer ? physioReduction : 0;
    const resistanceReduction = isEndurance ? (crewAverage(e.drivers, (d) => d.attributes.resistance) / 99) * 0.3 : 0;
    const reduction = 1 - (1 - physio) * (1 - resistanceReduction);
    const crewReliability = crewAverage(e.drivers, reliability);
    const dnf = rng() < dnfChance(crewReliability, reduction);
    const crewRating = crewAverage(e.drivers, overallRating);
    const score = dnf ? -Infinity : participantScore(crewRating, crewReliability, e.team, category, e.investment, rng);
    return { ...e, dnf, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const gridSize = scored.length;
  applyPoints(
    state,
    category.id,
    scored.map((e) => ({ driverIds: e.drivers.map((d) => d.id), teamId: e.team.id, carId: e.carId })),
    {
      classId,
      constructorsEnabled: category.constructorsEnabled !== false,
      constructorsTopN: category.constructorsTopN ?? Infinity,
      carClassification: category.carClassification === true,
    }
  );

  const logEntries = [];
  const coachBonus = (bestSkill(state, "drivingCoach") / 95) * 0.3;
  const growthMultiplier = trainingGrowthMultiplier(state) * (1 + coachBonus);
  const mentalProtection = (bestSkill(state, "psychologist") / 95) * 0.5;

  scored.forEach((e, index) => {
    const position = index + 1;
    const repDelta = e.dnf ? -1 : resultReputationDelta(position, gridSize);

    for (const driver of e.drivers) {
      growDriver(driver, rng, e.isPlayer ? growthMultiplier : 1);
      driver.age += rng() < 0.02 ? 1 : 0;

      if (e.isPlayer && state.drivers.some((d) => d.id === driver.id)) {
        const scaledRepDelta = repDelta > 0 ? Math.round(repDelta * reputationMultiplier(state)) : repDelta;
        state.agency.reputation = Math.max(0, state.agency.reputation + scaledRepDelta);
        const relationshipDelta = e.dnf ? -2 : position === 1 ? 2 : position <= 3 ? 1 : 0;
        driver.agencyRelationship = clamp(
          driver.agencyRelationship + applyMentalProtection(relationshipDelta, mentalProtection),
          0,
          200
        );
        driver.teamRelationship = clamp(
          driver.teamRelationship + applyMentalProtection(e.dnf ? -1 : relationshipDelta, mentalProtection),
          0,
          200
        );
        const grossPrize = e.dnf ? 0 : prizeForPosition(category, position, gridSize);
        const prize = driver.isPro ? Math.round(grossPrize * PRO_COMMISSION_RATE) : grossPrize;
        state.agency.money += prize;
        if (prize > 0) recordTransaction(state, "race-prize", `${driver.name} — ${category.name}`, prize);
        if (driver.contract) {
          driver.contract.racesRemaining -= 1;
          if (driver.contract.racesRemaining <= 0) {
            // TEAM contract expiry: the seat is vacated (driver becomes benched), but the
            // driver stays in the player's agency roster — a separate, AGENCY-level contract
            // concern (renewed via the contract negotiation screen), not an agency departure.
            driver.contract = null;
            releaseSeatAndBackfill(state, driver.id, rng);
            driver.teamId = null;
          }
        }
        driver.careerResults.push({
          week: state.week,
          categoryId: category.id,
          position,
          prize,
          reputation: scaledRepDelta,
          dnf: e.dnf,
        });
        logEntries.push({
          type: "player-result",
          driver,
          category,
          team: e.team,
          result: { position, prize, reputation: scaledRepDelta, dnf: e.dnf, gridSize },
        });
      } else if (driver.agencyId) {
        bumpRivalReputation(state, driver.agencyId, repDelta);
      }
    }
  });

  const winner = scored.find((e) => !e.dnf) ?? scored[0];
  if (winner && !winner.isPlayer) {
    logEntries.push({
      type: "ai-highlight",
      category,
      driverName: winner.drivers.map((d) => d.name).join(" / "),
      teamName: winner.team.name,
    });
  }

  logEntries.push(...rolloverIfNeeded(state, category, rng, classId));

  return logEntries;
}

function driverSeatCategories(driver) {
  const ids = [driver.categoryId, ...driver.secondarySeats.map((s) => s.categoryId)].filter(Boolean);
  return ids.map((id) => CATEGORY_BY_ID[id]).filter(Boolean);
}

function teamIdForCategory(driver, categoryId) {
  if (driver.categoryId === categoryId) return driver.teamId;
  return driver.secondarySeats.find((s) => s.categoryId === categoryId)?.teamId ?? null;
}

function resolveWeeklyConflicts(state, currentWeekInSeason, rng) {
  const racingCategoryIds = new Set(CATEGORIES.filter((c) => c.calendar.includes(currentWeekInSeason)).map((c) => c.id));
  const benched = [];

  for (const driver of state.drivers) {
    if (driver.secondarySeats.length === 0) continue;
    const clashing = driverSeatCategories(driver).filter((c) => racingCategoryIds.has(c.id));
    if (clashing.length <= 1) continue;

    const winner = clashing.reduce((best, c) => (c.tier > best.tier ? c : best));
    for (const category of clashing) {
      if (category.id === winner.id) continue;
      const teamId = teamIdForCategory(driver, category.id);
      const team = teamId ? findTeamById(state, teamId) : null;
      if (!team) continue;
      const seatIndex = team.seats.findIndex((s) => s.driverId === driver.id);
      if (seatIndex === -1) continue;

      const usedNumbers = usedDriverNumbersInCategory(state, category.id, driver.id);
      const reserve = generateAIDriver(rng, team, category, usedNumbers);
      reserve.isReserve = true;
      state.aiDrivers[reserve.id] = reserve;
      team.seats[seatIndex].driverId = reserve.id;
      benched.push({ teamId: team.id, seatIndex, driverId: driver.id, reserveId: reserve.id });
    }
  }

  return benched;
}

function restoreBenchedSeats(state, benched) {
  for (const b of benched) {
    const team = findTeamById(state, b.teamId);
    if (!team) continue;
    delete state.aiDrivers[b.reserveId];
    team.seats[b.seatIndex].driverId = b.driverId;
  }
}

function runWeekBody(state, rng) {
  const logEntries = [];

  logEntries.push(...tickScoutPoolPoaching(state, rng));
  logEntries.push(...tickFreeAgentPoaching(state, rng));
  logEntries.push(...tickBenchedDriverDecay(state, rng));

  if (state.deepScoutCooldownWeeks > 0) {
    state.deepScoutCooldownWeeks -= 1;
  } else {
    autoRevealCandidates(state, rng);
  }

  for (const driver of state.drivers) {
    if (driver.injuryWeeksRemaining > 0) driver.injuryWeeksRemaining -= 1;
  }

  const currentWeekInSeason = weekInSeason(state.week);
  const benched = resolveWeeklyConflicts(state, currentWeekInSeason, rng);
  for (const category of CATEGORIES) {
    if (!category.calendar.includes(currentWeekInSeason)) continue;
    logEntries.push(...simulateCategoryRace(state, category, rng));
  }
  restoreBenchedSeats(state, benched);

  let driverWageTotal = 0;
  let amateurFeeTotal = 0;
  for (const driver of state.drivers) {
    if (driver.contract) {
      if (driver.isPro) {
        driverWageTotal += driver.contract.weeklyWage;
        state.agency.money -= driver.contract.weeklyWage;
      } else {
        amateurFeeTotal += driver.contract.weeklyWage;
        state.agency.money += driver.contract.weeklyWage;
      }
    }
  }
  if (driverWageTotal > 0) recordTransaction(state, "driver-wage", "Salaires pilotes pro", -driverWageTotal);
  if (amateurFeeTotal > 0) recordTransaction(state, "amateur-fee", "Frais de gestion (amateurs)", amateurFeeTotal);

  let staffWageTotal = 0;
  for (const recruiter of state.staff) {
    staffWageTotal += recruiter.weeklyWage;
    state.agency.money -= recruiter.weeklyWage;
  }
  if (staffWageTotal > 0) recordTransaction(state, "staff-wage", "Salaires staff", -staffWageTotal);

  const upkeep = totalUpkeep(state);
  state.agency.money -= upkeep;
  if (upkeep > 0) recordTransaction(state, "infrastructure-upkeep", "Entretien infrastructures", -upkeep);

  recordBalanceSnapshot(state);

  state.week += 1;
  refillScoutPool(state, rng);
  refillStaffPool(state, rng);
  return logEntries;
}

export function beginWeek(state, rng) {
  const event = triggerRandomEvent(state, rng);
  if (event && event.kind === "choice") {
    return { logEntries: [], awaitingChoice: true, event };
  }
  const logEntries = event ? [event] : [];
  logEntries.push(...runWeekBody(state, rng));
  return { logEntries, awaitingChoice: false };
}

export function continueWeekAfterChoice(state, rng, event, optionIndex) {
  const resolution = resolveEventChoice(state, rng, event, optionIndex);
  const logEntries = [resolution, ...runWeekBody(state, rng)];
  return logEntries;
}
