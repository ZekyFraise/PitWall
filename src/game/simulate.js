import { CATEGORIES, CATEGORY_BY_ID, PRO_COMMISSION_RATE, TRACK_STYLES, weekInSeason } from "./data.js";
import { overallRating, growDriver, getDriverById, reliability, groupAverage, superStat } from "./driver.js";
import { findTeamById, generateAIDriver, usedDriverNumbersInCategory } from "./team.js";
import { refillScoutPool, repayLoan } from "./state.js";
import { tickScoutPoolPoaching, tickFreeAgentPoaching, tickBenchedDriverDecay, bumpRivalReputation } from "./rivals.js";
import { applyPoints, recordRoundResult, rolloverIfNeeded } from "./standings.js";
import { autoRevealCandidates, refillStaffPool, bestSkill } from "./staff.js";
import { trainingGrowthMultiplier, totalUpkeep } from "./infrastructure.js";
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

// A round's track style favors specific attributes (ex. Pluie on a rain round) — the bonus/malus
// is relative to the crew's OWN general technique level, not an absolute value, so a driver
// whose whole profile happens to sit high everywhere doesn't swing wildly, while a genuine
// specialist (spiky attribute profile) is meaningfully advantaged or exposed by the round.
function styleBonus(drivers, styleId) {
  const style = TRACK_STYLES[styleId];
  if (!style) return 0;
  const styleAvg = crewAverage(drivers, (d) => style.attrs.reduce((sum, key) => sum + d.attributes[key], 0) / style.attrs.length);
  const techAvg = crewAverage(drivers, (d) => groupAverage(d, "technique"));
  return (styleAvg - techAvg) * 0.3;
}

function resultReputationDelta(position, gridSize) {
  if (position === 1) return 5;
  if (position <= 3) return 3;
  if (position <= 6) return 1;
  if (position > gridSize * 0.75) return -1;
  return 0;
}

// Judges relationship proportionally to how many drivers were actually engaged — a top-6 out
// of 60 (karting) isn't the same feat as a top-6 out of 16 (WRC). DNF counts as last place.
function raceRelationshipDelta(position, gridSize, dnf) {
  const ratio = dnf ? 1 : position / Math.max(1, gridSize);
  if (ratio <= 0.1) return 3;
  if (ratio <= 0.3) return 2;
  if (ratio <= 0.6) return 1;
  if (ratio <= 0.85) return 0;
  return -2;
}

function prizeForPosition(category, position, gridSize) {
  return Math.round(
    category.prizeScale * (0.08 + 0.92 * Math.max(0, (gridSize - position + 1) / gridSize) ** 1.4)
  );
}

export function simulateCategoryRace(state, category, rng, roundIndex) {
  if (category.classes) {
    const logEntries = [];
    for (const cls of category.classes) {
      const classTeams = (state.teams[category.id] ?? []).filter((t) => t.subClass === cls.id);
      logEntries.push(...simulateClassRace(state, category, classTeams, cls.id, rng, roundIndex));
    }
    return logEntries;
  }
  return simulateClassRace(state, category, state.teams[category.id] ?? [], null, rng, roundIndex);
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

function simulateClassRace(state, category, teams, classId, rng, roundIndex) {
  const entrants = buildEntrants(state, teams, category.driversPerCar ?? 1);
  if (entrants.length === 0) return [];

  const styleId = category.roundStyles?.[roundIndex] ?? null;
  const style = styleId ? TRACK_STYLES[styleId] : null;

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
    const resistanceReduction = isEndurance ? (crewAverage(e.drivers, (d) => superStat(d, "resistance")) / 99) * 0.3 : 0;
    const reduction = 1 - (1 - physio) * (1 - resistanceReduction);
    const crewReliability = crewAverage(e.drivers, reliability);
    const dnf = rng() < dnfChance(crewReliability, reduction);
    const crewRating = crewAverage(e.drivers, overallRating);
    // Form (0-100, neutral at 50) nudges race pace by up to ±4 points — a minor factor
    // next to the ~18-point noise spread, so it colours results without dominating them.
    const formBonus = (crewAverage(e.drivers, (d) => d.form ?? 50) - 50) / 50 * 4;
    const trackBonus = styleId ? styleBonus(e.drivers, styleId) : 0;
    const score = dnf ? -Infinity : participantScore(crewRating, crewReliability, e.team, category, e.investment, rng) + formBonus + trackBonus;
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
  recordRoundResult(state, category.id, classId, scored);

  const logEntries = [];
  const coachBonus = (bestSkill(state, "drivingCoach") / 95) * 0.3;
  const growthMultiplier = trainingGrowthMultiplier(state) * (1 + coachBonus);
  const mentalProtection = (bestSkill(state, "psychologist") / 95) * 0.5;

  scored.forEach((e, index) => {
    const position = index + 1;
    const repDelta = e.dnf ? -1 : resultReputationDelta(position, gridSize);

    // Tracked for EVERY entrant (not just the player's), unlike careerResults — lets the
    // Championnats standings break a points tie (most commonly "nobody has scored yet") by
    // best result instead of arbitrary team/seat order, without the memory cost of a full
    // result history for the hundreds of AI drivers/teams in a category.
    if (!e.dnf && e.team) {
      e.team.bestPositionThisSeason = Math.min(e.team.bestPositionThisSeason ?? Infinity, position);
    }

    for (const driver of e.drivers) {
      growDriver(driver, rng, e.isPlayer ? growthMultiplier : 1);
      driver.age += rng() < 0.02 ? 1 : 0;
      if (!e.dnf) driver.bestPositionThisSeason = Math.min(driver.bestPositionThisSeason ?? Infinity, position);

      if (e.isPlayer && state.drivers.some((d) => d.id === driver.id)) {
        const relationshipDelta = raceRelationshipDelta(position, gridSize, e.dnf);
        driver.agencyRelationship = clamp(
          driver.agencyRelationship + applyMentalProtection(relationshipDelta, mentalProtection),
          0,
          200
        );
        const teamDelta = relationshipDelta < 0 ? Math.ceil(relationshipDelta / 2) : relationshipDelta;
        driver.teamRelationship = clamp(
          driver.teamRelationship + applyMentalProtection(teamDelta, mentalProtection),
          0,
          200
        );
        const grossPrize = e.dnf ? 0 : prizeForPosition(category, position, gridSize);
        const commissionRate = driver.contract?.commissionRate ?? PRO_COMMISSION_RATE;
        const prize = driver.isPro ? Math.round(grossPrize * commissionRate) : grossPrize;
        state.agency.money += prize;
        if (prize > 0) recordTransaction(state, "race-prize", `${driver.name} — ${category.name}`, prize);
        driver.careerResults.push({
          week: state.week,
          categoryId: category.id,
          teamId: e.team.id,
          position,
          prize,
          dnf: e.dnf,
        });
        logEntries.push({
          type: "player-result",
          driver,
          category,
          team: e.team,
          result: { position, prize, dnf: e.dnf, gridSize, styleLabel: style?.label ?? null },
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
    driver.negotiationPatience = Math.min(100, (driver.negotiationPatience ?? 100) + 3);
    // Agency contract duration is now in WEEKS, decremented unconditionally every week —
    // races missed to injury/benching still count against it, unlike the old per-race
    // decrement that only fired for drivers who actually raced.
    if (driver.contract) {
      driver.contract.weeksRemaining -= 1;
      if (driver.contract.weeksRemaining <= 0) driver.contract = null;
    }
  }

  const currentWeekInSeason = weekInSeason(state.week);
  const benched = resolveWeeklyConflicts(state, currentWeekInSeason, rng);
  for (const category of CATEGORIES) {
    const roundIndex = category.calendar.indexOf(currentWeekInSeason);
    if (roundIndex === -1) continue;
    logEntries.push(...simulateCategoryRace(state, category, rng, roundIndex));
  }
  restoreBenchedSeats(state, benched);

  // Pros no longer draw a weekly wage from the agency — the agency now acts as their agent,
  // earning a negotiated commission on race prizes instead (see the race-prize cut above).
  let amateurFeeTotal = 0;
  for (const driver of state.drivers) {
    if (driver.contract && !driver.isPro) {
      amateurFeeTotal += driver.contract.weeklyWage;
      state.agency.money += driver.contract.weeklyWage;
    }
  }
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

  repayLoan(state);

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
