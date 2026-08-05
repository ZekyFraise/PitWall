import { CATEGORIES, CATEGORY_BY_ID, TRACK_STYLES, weekInSeason, pointsTableFor } from "./data.js";
import { overallRating, growDriver, getDriverById, reliability, groupAverage, superStat, tierAdaptationFactor } from "./driver.js";
import {
  findTeamById,
  generateAIDriver,
  usedDriverNumbersInCategory,
  tickSubstituteOffers,
  removeOneOffSecondarySeat,
  adjustAgencyTeamRelationship,
  teamDevelopmentScoreBonus,
  teamWeeklyRevenue,
  teamDevelopmentUpkeep,
} from "./team.js";
import { refillScoutPool, autoRevealCandidates, resolveScoutSearches, repayLoan, payDriverInstallments } from "./state.js";
import { tickScoutPoolPoaching, tickFreeAgentPoaching, tickBenchedDriverDecay, bumpRivalReputation } from "./rivals.js";
import { applyPoints, applyPowerStageBonus, recordRoundResult, rolloverIfNeeded } from "./standings.js";
import { refillStaffPool, bestSkill } from "./staff.js";
import { trainingGrowthMultiplier, totalUpkeep, officeCommissionRate, officePatienceBonus, eliteStaffChance } from "./infrastructure.js";
import { recordTransaction, recordBalanceSnapshot } from "./finance.js";
import { triggerRandomEvent, resolveEventChoice } from "./events.js";
import { refillSponsorPool } from "./sponsors.js";
import { tickAcademyGraduation, tickAcademyFundCooldowns } from "./academies.js";

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
  // A player-owned team's development level lifts EVERY driver racing for it, not just the
  // player's own — same as carScore/team.prestige already does. 0 for any non-owned team.
  const developmentBonus = teamDevelopmentScoreBonus(team);
  const noiseSpread = 18 * category.difficulty * (1 - reliabilityValue / 200);
  const noise = (rng() * 2 - 1) * noiseSpread;
  return ratingValue * 0.65 + carScore * 0.35 + investmentBonus + developmentBonus + noise;
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
  const isEndurance = category.profile === "endurance";
  const scored = entrants.map((e) => {
    const physio = e.isPlayer ? physioReduction : 0;
    const resistanceReduction = isEndurance ? (crewAverage(e.drivers, (d) => superStat(d, "resistance")) / 99) * 0.3 : 0;
    const reduction = 1 - (1 - physio) * (1 - resistanceReduction);
    const crewReliability = crewAverage(e.drivers, reliability);
    const dnf = rng() < dnfChance(crewReliability, reduction);
    // A driver freshly promoted to a tier they've never raced (tierAdaptationFactor, driver.js)
    // races below their real rating for a while — raw karting-honed skill doesn't transfer
    // 1:1 to F1. Never shown in the UI (overallRating itself is untouched), only affects the
    // race outcome, so a promoted rookie's stat sheet still reads exactly as strong as before.
    const crewRating = crewAverage(e.drivers, (d) => overallRating(d) * tierAdaptationFactor(d));
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
      pointsTable: pointsTableFor(category, classId),
    }
  );
  const stageResults = applyPowerStageBonus(state, category, classId, scored, rng);
  recordRoundResult(state, category.id, classId, scored);

  const logEntries = [];
  // Halved from 0.3 — same rebalance as trainingGrowthMultiplier's facility/experience bonuses
  // (infrastructure.js): the combined ceiling was letting a maxed-out agency's drivers grow up
  // to ~2.4x faster than AI drivers instead of just meaningfully faster.
  const coachBonus = (bestSkill(state, "drivingCoach") / 95) * 0.15;
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
        // Same result feeding the AGENCY's own standing with this team (distinct from the
        // driver's personal teamRelationship) — scaled down further since it accumulates
        // across every driver the agency has ever fielded there, not just this one seat.
        if (e.team) adjustAgencyTeamRelationship(state, e.team.id, Math.round(teamDelta / 2));
        const grossPrize = e.dnf ? 0 : prizeForPosition(category, position, gridSize);
        const commissionRate = driver.contract?.commissionRate ?? officeCommissionRate(state);
        const prize = driver.isPro ? Math.round(grossPrize * commissionRate) : grossPrize;
        state.agency.money += prize;
        if (prize > 0) recordTransaction(state, "race-prize", `${driver.name} — ${category.name}`, prize);
        if (state.activeSponsor && !e.dnf && position <= 3) {
          const bonus = position === 1 ? state.activeSponsor.winBonus : state.activeSponsor.podiumBonus;
          state.agency.money += bonus;
          recordTransaction(state, "sponsor-bonus", `Prime sponsor — ${state.activeSponsor.name}`, bonus);
        }
        driver.careerResults.push({
          week: state.week,
          categoryId: category.id,
          teamId: e.team.id,
          position,
          prize,
          dnf: e.dnf,
        });
        const stageBonus = stageResults.find((r) => r.driverIds.includes(driver.id))?.bonus ?? null;
        logEntries.push({
          type: "player-result",
          driver,
          category,
          team: e.team,
          result: { position, prize, dnf: e.dnf, gridSize, styleLabel: style?.label ?? null, stageBonus },
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

  // Ephemeral per-week signal for the topbar ticker (layout.js) — reset before anything can
  // add to it this week (refillScoutPool, resolved scoutSearches below).
  state.newTalentsThisWeek = 0;

  logEntries.push(...tickScoutPoolPoaching(state, rng));
  logEntries.push(...tickFreeAgentPoaching(state, rng));
  logEntries.push(...tickBenchedDriverDecay(state, rng));
  logEntries.push(...tickAcademyGraduation(state, rng));
  tickAcademyFundCooldowns(state);
  logEntries.push(...resolveScoutSearches(state, rng));
  tickSubstituteOffers(state, rng);

  if (state.deepScoutCooldownWeeks > 0) {
    state.deepScoutCooldownWeeks -= 1;
  } else {
    autoRevealCandidates(state, rng);
  }

  // Repeatable-purchase shop items (e.g. "Campagne PR") on a cooldown — see purchaseShopItem
  // (infrastructure.js) for why this exists (money-into-unlimited-reputation was the real leak).
  if (state.shopCooldowns) {
    for (const id of Object.keys(state.shopCooldowns)) {
      if (state.shopCooldowns[id] > 0) state.shopCooldowns[id] -= 1;
    }
  }

  for (const driver of state.drivers) {
    if (driver.injuryWeeksRemaining > 0) driver.injuryWeeksRemaining -= 1;
    if (driver.adaptationWeeksRemaining > 0) driver.adaptationWeeksRemaining -= 1;
    driver.negotiationPatience = Math.min(100, (driver.negotiationPatience ?? 100) + 3 + officePatienceBonus(state));
    // Agency contract duration is now in WEEKS, decremented unconditionally every week —
    // races missed to injury/benching still count against it, unlike the old per-race
    // decrement that only fired for drivers who actually raced.
    if (driver.contract) {
      driver.contract.weeksRemaining -= 1;
      if (driver.contract.weeksRemaining <= 0) driver.contract = null;
    }
    // Offers left unanswered go stale after the random 1-4 week window set in proposeToTeams
    // (team.js) — otherwise a batch of "Propositions reçues" would sit valid forever.
    if (driver.offersExpireAt != null && state.week >= driver.offersExpireAt) {
      driver.pendingOffers = [];
      driver.pendingOfferBudget = 0;
      driver.proposedAt = null;
      driver.offersExpireAt = null;
    }
    // Same staleness rule for second-championship offers (proposeSecondaryChampionship, team.js).
    if (driver.secondaryOffersExpireAt != null && state.week >= driver.secondaryOffersExpireAt) {
      driver.pendingSecondaryOffers = [];
      driver.secondaryProposedAt = null;
      driver.secondaryOffersExpireAt = null;
    }
    // A one-off substitute offer (tickSubstituteOffers) is tied to ONE specific round — once
    // that round's week arrives, the window to accept it has passed regardless.
    if (driver.pendingSubstituteOffer && driver.pendingSubstituteOffer.roundWeek <= state.week) {
      driver.pendingSubstituteOffer = null;
    }
    // A transfer negotiation left unresolved past its window simply lapses — the buying team
    // moves on, no penalty beyond the missed opportunity.
    if (driver.pendingTransferOffer && driver.pendingTransferOffer.expiresAtWeek <= state.week) {
      driver.pendingTransferOffer = null;
    }
  }

  const currentWeekInSeason = weekInSeason(state.week);

  // Birthday tick: +1 year at the start of every 52-week season (never in year 1, week 1) —
  // deterministic and world-wide (agency + every AI driver), not the old 2%-per-race roll
  // (~0.4 years/season), which was far slower than peakAge/ageFactor (driver.js) assume and let
  // drivers climb several tiers while staying practically the same age.
  if (currentWeekInSeason === 1 && state.week > 1) {
    for (const driver of state.drivers) driver.age += 1;
    for (const driver of Object.values(state.aiDrivers)) driver.age += 1;
  }

  const benched = resolveWeeklyConflicts(state, currentWeekInSeason, rng);
  for (const category of CATEGORIES) {
    const roundIndex = category.calendar.indexOf(currentWeekInSeason);
    if (roundIndex === -1) continue;
    logEntries.push(...simulateCategoryRace(state, category, rng, roundIndex));
  }
  restoreBenchedSeats(state, benched);

  // A one-off substitute seat (acceptSubstituteOffer, team.js) is only ever meant to last for
  // the exact round it was offered for — remove it right after that round has been simulated,
  // regardless of whether the driver actually raced it (bench due to a clash counts as "used").
  for (const driver of state.drivers) {
    const oneOff = driver.secondarySeats.find((s) => s.oneOff && s.roundWeek === state.week);
    if (oneOff) removeOneOffSecondarySeat(state, driver, oneOff, rng);
  }

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

  // A driverless agency has no race/amateur-fee income at all — halving staff wages ("mise en
  // sommeil") keeps the roster intact for when a driver comes back, instead of forcing the
  // player to fire everyone just to survive the gap.
  const staffWageFactor = state.drivers.length === 0 ? 0.5 : 1;
  let staffWageTotal = 0;
  for (const recruiter of state.staff) {
    const wage = Math.round(recruiter.weeklyWage * staffWageFactor);
    staffWageTotal += wage;
    state.agency.money -= wage;
  }
  if (staffWageTotal > 0) recordTransaction(state, "staff-wage", "Salaires staff", -staffWageTotal);

  if (state.activeSponsor) {
    state.agency.money += state.activeSponsor.weeklyIncome;
    recordTransaction(state, "sponsor-income", `Sponsor — ${state.activeSponsor.name}`, state.activeSponsor.weeklyIncome);
    state.activeSponsor.weeksRemaining -= 1;
    if (state.activeSponsor.weeksRemaining <= 0) {
      logEntries.push({ type: "sponsor-contract-ended", sponsorName: state.activeSponsor.name });
      state.activeSponsor = null;
    }
  }

  const upkeep = totalUpkeep(state);
  state.agency.money -= upkeep;
  if (upkeep > 0) recordTransaction(state, "infrastructure-upkeep", "Entretien infrastructures", -upkeep);

  // Owned teams (buyTeam, team.js) generate passive weekly income net of their own development
  // upkeep — flat across every category/subClass, so iterate state.teams generically rather
  // than special-case any one discipline.
  let teamRevenueNet = 0;
  for (const categoryTeams of Object.values(state.teams)) {
    for (const team of categoryTeams) {
      if (!team.ownedByPlayer) continue;
      const category = CATEGORY_BY_ID[team.categoryId];
      teamRevenueNet += teamWeeklyRevenue(team, category) - teamDevelopmentUpkeep(team, category);
    }
  }
  if (teamRevenueNet !== 0) {
    state.agency.money += teamRevenueNet;
    recordTransaction(state, "team-revenue", "Écuries possédées (revenus - entretien)", teamRevenueNet);
  }

  repayLoan(state);
  payDriverInstallments(state);

  recordBalanceSnapshot(state);

  state.week += 1;
  refillScoutPool(state, rng);
  refillStaffPool(state, rng, eliteStaffChance(state));
  refillSponsorPool(state, rng);
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
