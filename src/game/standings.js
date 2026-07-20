import { generateAIDriver, findTeamById, usedDriverNumbersInCategory, benchDriver } from "./team.js";
import { getDriverById, overallRating } from "./driver.js";
import { driverMarketValue } from "./driverStats.js";
import { recordTransaction } from "./finance.js";
import { CATEGORY_BY_ID } from "./data.js";
import { reputationMultiplier } from "./infrastructure.js";

// Reputation now moves only at season end, scaled by final championship position — not per
// individual race — so a title fight matters more than any single race result.
function seasonReputationBonus(position) {
  if (position === 1) return 10;
  if (position === 2) return 6;
  if (position === 3) return 4;
  if (position <= 6) return 2;
  if (position <= 10) return 1;
  return 0;
}

export const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const RETIREMENT_CHANCE = 0.2;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function standingsKey(categoryId, classId = null) {
  return classId ? `${categoryId}:${classId}` : categoryId;
}

export function racesUntilSeasonEnd(state, categoryId) {
  const category = CATEGORY_BY_ID[categoryId];
  if (!category) return 6;
  const standings = ensureStandings(state, categoryId);
  return Math.max(1, category.roundCount - standings.race);
}

export function ensureStandings(state, categoryId, classId = null) {
  const key = standingsKey(categoryId, classId);
  if (!state.standings[key]) {
    state.standings[key] = { race: 0, seasonNumber: 1, driverPoints: {}, teamPoints: {}, carPoints: {} };
  }
  if (!state.standings[key].carPoints) state.standings[key].carPoints = {};
  return state.standings[key];
}

export function applyPoints(state, categoryId, rankedEntrants, options = {}) {
  const { classId = null, constructorsEnabled = true, constructorsTopN = Infinity, carClassification = false } = options;
  const standings = ensureStandings(state, categoryId, classId);
  const teamScorerCount = {};
  rankedEntrants.forEach((entrant, index) => {
    const points = POINTS_TABLE[index] ?? 0;
    if (points === 0) return;
    for (const driverId of entrant.driverIds) {
      standings.driverPoints[driverId] = (standings.driverPoints[driverId] ?? 0) + points;
    }
    if (carClassification && entrant.carId) {
      standings.carPoints[entrant.carId] = (standings.carPoints[entrant.carId] ?? 0) + points;
    } else if (constructorsEnabled) {
      const count = teamScorerCount[entrant.teamId] ?? 0;
      if (count < constructorsTopN) {
        standings.teamPoints[entrant.teamId] = (standings.teamPoints[entrant.teamId] ?? 0) + points;
        teamScorerCount[entrant.teamId] = count + 1;
      }
    }
  });
  standings.race += 1;
}

function topKey(pointsMap) {
  let bestKey = null;
  let bestValue = -Infinity;
  for (const [key, value] of Object.entries(pointsMap)) {
    if (value > bestValue) {
      bestValue = value;
      bestKey = key;
    }
  }
  return bestKey;
}

export function rolloverIfNeeded(state, category, rng, classId = null) {
  const standings = ensureStandings(state, category.id, classId);
  if (standings.race < category.roundCount) return [];

  const classTeams = classId
    ? (state.teams[category.id] ?? []).filter((t) => t.subClass === classId)
    : state.teams[category.id] ?? [];

  // Snapshot final team rankings before the reset below wipes teamPoints — used as a
  // pre-season fallback ranking display until the new season has standings of its own.
  const rankedTeamIds = Object.entries(standings.teamPoints).sort((a, b) => b[1] - a[1]);
  const rankedTeamIdSet = new Set(rankedTeamIds.map(([idStr]) => Number(idStr)));
  rankedTeamIds.forEach(([idStr], index) => {
    const team = classTeams.find((t) => t.id === Number(idStr));
    if (team) team.lastSeasonRank = index + 1;
  });
  // Teams that scored no points this season keep a stale, arbitrarily old rank otherwise —
  // clear it so they correctly fall through to "Pas encore classée" instead.
  classTeams.forEach((team) => {
    if (!rankedTeamIdSet.has(team.id)) team.lastSeasonRank = null;
  });

  const entries = [];
  const driverChampionId = topKey(standings.driverPoints);
  const teamChampionId = category.carClassification ? null : topKey(standings.teamPoints);

  if (driverChampionId != null) {
    const champion = getDriverById(state, Number(driverChampionId));
    if (champion) {
      const isPlayer = state.drivers.some((d) => d.id === champion.id);
      entries.push({
        type: "season-champion-driver",
        category,
        driverName: champion.name,
        isPlayer,
        seasonNumber: standings.seasonNumber,
      });
      if (isPlayer) {
        const bonus = category.prizeScale * 3;
        state.agency.money += bonus;
        recordTransaction(state, "season-title-bonus", `Titre ${category.name}`, bonus);
      }
    }
  }

  if (teamChampionId != null) {
    const team = classTeams.find((t) => t.id === Number(teamChampionId));
    if (team) {
      entries.push({
        type: "season-champion-team",
        category,
        teamName: team.name,
        seasonNumber: standings.seasonNumber,
      });
    }
  }

  const usedNumbers = usedDriverNumbersInCategory(state, category.id);
  for (const team of classTeams) {
    team.seats.forEach((seat) => {
      const occupant = seat.driverId != null ? getDriverById(state, seat.driverId) : null;
      if (occupant && occupant.isAI && rng() < RETIREMENT_CHANCE) {
        delete state.aiDrivers[occupant.id];
        const fresh = generateAIDriver(rng, team, category, usedNumbers);
        state.aiDrivers[fresh.id] = fresh;
        seat.driverId = fresh.id;
      }
    });
  }

  const rankedDrivers = Object.entries(standings.driverPoints).sort((a, b) => b[1] - a[1]);
  rankedDrivers.forEach(([idStr], index) => {
    const id = Number(idStr);
    const driver = state.drivers.find((d) => d.id === id);
    if (!driver) return;
    const team = driver.teamId ? findTeamById(state, driver.teamId) : null;
    // Scoped to the driver's CURRENT team's races this season, not the whole season — a
    // mid-season team change already closed out the prior team's stint as its own history row
    // (recordSeasonStint in team.js/simulate.js), so counting all of this season's races here
    // too would double-count the races run before the switch.
    const seasonResults = driver.careerResults.filter((r) => r.categoryId === category.id).slice(-standings.race);
    const stintResults = driver.teamId != null ? seasonResults.filter((r) => r.teamId === driver.teamId) : [];
    const races = stintResults.length;
    const wins = stintResults.filter((r) => !r.dnf && r.position === 1).length;
    const podiums = stintResults.filter((r) => !r.dnf && r.position <= 3).length;
    const position = index + 1;
    driver.seasonHistory.push({
      seasonNumber: standings.seasonNumber,
      categoryId: category.id,
      teamName: team ? team.name : "Sans écurie",
      rating: Math.round(overallRating(driver)),
      value: driverMarketValue(driver),
      races,
      wins,
      podiums,
      championshipPosition: position,
    });
    const repBonus = seasonReputationBonus(position);
    if (repBonus > 0) {
      state.agency.reputation = Math.max(0, state.agency.reputation + Math.round(repBonus * reputationMultiplier(state)));
    }
  });

  // Team seats now expire at season rollover instead of at agency-contract expiry (which is
  // now a separate, weeks-based concept — see negotiateContract). Each player driver's PRIMARY
  // seat (not a secondary-championship seat) is either renewed — silently, the seat just
  // carries into next season — or the driver is benched, freeing the seat for the next mercato.
  for (const team of classTeams) {
    for (const seat of team.seats) {
      if (seat.driverId == null) continue;
      const occupant = state.drivers.find((d) => d.id === seat.driverId);
      if (!occupant || occupant.teamId !== team.id) continue;
      const renewChance = clamp((occupant.teamRelationship ?? 60) / 200, 0.1, 0.9);
      if (rng() >= renewChance) benchDriver(state, occupant.id, rng);
    }
  }

  standings.race = 0;
  standings.seasonNumber += 1;
  standings.driverPoints = {};
  standings.teamPoints = {};
  standings.carPoints = {};

  return entries;
}
