import { generateAIDriver, findTeamById, usedDriverNumbersInCategory, benchDriver } from "./team.js";
import { getDriverById, overallRating } from "./driver.js";
import { driverMarketValue } from "./driverStats.js";
import { recordTransaction } from "./finance.js";
import { CATEGORY_BY_ID, SEASON_WEEKS } from "./data.js";
import { reputationMultiplier } from "./infrastructure.js";
import { checkSeasonTraitMilestone } from "./traits.js";

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

// Kept exported for backward compatibility — no longer read internally by applyPoints, which
// now takes its table from the caller (pointsTableFor, data.js) since each category/class has
// its own scale.
export const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const RETIREMENT_CHANCE = 0.2;
// Independent jitter applied to the same race score to derive the WRC "Super-Spéciale" (Power
// Stage) ranking — same scale as formBonus/trackBonus in simulate.js, deliberately modest so the
// stage ranking correlates with overall pace without being identical to the finishing order.
const POWER_STAGE_JITTER = 6;

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
    state.standings[key] = { race: 0, seasonNumber: 1, driverPoints: {}, teamPoints: {}, carPoints: {}, rounds: [] };
  }
  if (!state.standings[key].carPoints) state.standings[key].carPoints = {};
  if (!state.standings[key].rounds) state.standings[key].rounds = [];
  return state.standings[key];
}

// Read-only lookup for a specific past-or-current season's standings snapshot (live or
// archived), by category/class/season number — shared by the "Monde ▸ Championnats" season
// selector and a driver's own "Historique" row click-through, so both resolve live-vs-archived
// the exact same way. Returns null if that season simply isn't resolvable (e.g. it predates
// the round-capture feature, or the category/season combination never existed).
export function resolveSeasonView(state, categoryId, classId, seasonNumber) {
  const key = standingsKey(categoryId, classId);
  const live = state.standings[key];
  if (live && live.seasonNumber === seasonNumber) return live;
  return (state.seasonArchive?.[key] ?? []).find((s) => s.seasonNumber === seasonNumber) ?? null;
}

// Captures the full round classification (already computed as `scored` right before points are
// awarded) for EVERY entrant — not just the player's, unlike driver.careerResults — so a
// Wikipedia-style round-by-round grid can be rendered for any driver/team later. Names are
// duplicated per round rather than resolved live at render time: AI drivers are sometimes
// deleted and replaced at season-end retirement (see rolloverIfNeeded), which would otherwise
// make an archived season's driver names unresolvable after the fact.
export function recordRoundResult(state, categoryId, classId, scored) {
  const standings = ensureStandings(state, categoryId, classId);
  standings.rounds.push(
    scored.map((e) => {
      const carIndex = e.carId != null ? Number(e.carId.split(":")[1]) : null;
      return {
        driverIds: e.drivers.map((d) => d.id),
        driverNames: e.drivers.map((d) => d.name),
        teamId: e.team.id,
        teamName: e.team.name,
        carId: e.carId,
        carNumber: carIndex != null ? e.team.carNumbers?.[carIndex] ?? null : null,
        dnf: e.dnf,
      };
    })
  );
}

export function applyPoints(state, categoryId, rankedEntrants, options = {}) {
  const { classId = null, constructorsEnabled = true, constructorsTopN = Infinity, carClassification = false, pointsTable = POINTS_TABLE } = options;
  const standings = ensureStandings(state, categoryId, classId);
  const teamScorerCount = {};
  rankedEntrants.forEach((entrant, index) => {
    const points = pointsTable[index] ?? 0;
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

// WRC-only bonus (category.powerStageBonus, data.js) — awarded on top of the normal finishing
// points, to a ranking derived from the SAME race score with an independent jitter rather than a
// fully separate stage simulation (see plan notes). No-op (returns []) for any category without
// a powerStageBonus table, so this is safe to call unconditionally from simulateClassRace.
export function applyPowerStageBonus(state, category, classId, scored, rng) {
  if (!category.powerStageBonus) return [];
  const standings = ensureStandings(state, category.id, classId);
  const results = [];
  scored
    .filter((e) => !e.dnf)
    .map((e) => ({ e, stageScore: e.score + (rng() - 0.5) * POWER_STAGE_JITTER }))
    .sort((a, b) => b.stageScore - a.stageScore)
    .slice(0, category.powerStageBonus.length)
    .forEach(({ e }, idx) => {
      const bonus = category.powerStageBonus[idx];
      for (const driver of e.drivers) {
        standings.driverPoints[driver.id] = (standings.driverPoints[driver.id] ?? 0) + bonus;
      }
      results.push({ driverIds: e.drivers.map((d) => d.id), bonus });
    });
  return results;
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
  let driverChampionRecord = null;
  let teamChampionRecord = null;

  if (driverChampionId != null) {
    const champion = getDriverById(state, Number(driverChampionId));
    if (champion) {
      const isPlayer = state.drivers.some((d) => d.id === champion.id);
      driverChampionRecord = { id: champion.id, name: champion.name, isPlayer };
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
      teamChampionRecord = { id: team.id, name: team.name };
      entries.push({
        type: "season-champion-team",
        category,
        teamName: team.name,
        seasonNumber: standings.seasonNumber,
      });
    }
  }

  // Durable record for the Palmarès screen — state.log is only ever shown truncated to its
  // last 40-60 entries (renderNews/renderResults), so early-season champions would otherwise
  // become permanently unreachable in a long game.
  if (driverChampionRecord || teamChampionRecord) {
    state.championsHistory = state.championsHistory ?? [];
    state.championsHistory.push({
      seasonNumber: standings.seasonNumber,
      categoryId: category.id,
      classId,
      driverChampion: driverChampionRecord,
      teamChampion: teamChampionRecord,
    });
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
  let bestCategoryRepBonus = 0;
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
      classId: classId ?? null,
      teamName: team ? team.name : "Sans écurie",
      rating: Math.round(overallRating(driver)),
      value: driverMarketValue(driver),
      races,
      wins,
      podiums,
      championshipPosition: position,
    });
    const milestone = checkSeasonTraitMilestone(driver, { wins, podiums, races, position, totalDrivers: rankedDrivers.length }, rng);
    if (milestone) {
      entries.push({
        type: "driver-trait-acquired",
        driverName: driver.name,
        driverId: driver.id,
        traitId: milestone.traitId,
        replacedTraitId: milestone.replaced,
        seasonNumber: standings.seasonNumber,
      });
    }
    bestCategoryRepBonus = Math.max(bestCategoryRepBonus, seasonReputationBonus(position));
  });
  // Only the single BEST result across the whole agency counts per season — not summed per
  // driver (a big roster shouldn't out-earn one great driver) NOR summed per category (running
  // 3 championships at once shouldn't out-earn running 1 well). rolloverIfNeeded fires once per
  // category/class whenever THAT series hits its final round, so several calls can land for the
  // same season at different weeks — seasonRepBonusApplied tracks what's already been credited
  // for this season index and only tops up the difference when a later category beats it,
  // instead of re-adding from zero each time. Unscaled (bypasses applyReputationGain's
  // diminishing curve on purpose): the curve is reserved for the farmable dilemma/shop channel,
  // while this racing-performance channel is already self-limiting — capped at +10/season, it
  // takes a genuinely dominant campaign to approach ~80-100 reputation over 10 seasons.
  const seasonIndex = Math.floor((state.week - 1) / SEASON_WEEKS);
  state.seasonRepBonusApplied = state.seasonRepBonusApplied ?? {};
  const alreadyApplied = state.seasonRepBonusApplied[seasonIndex] ?? 0;
  if (bestCategoryRepBonus > alreadyApplied) {
    const delta = bestCategoryRepBonus - alreadyApplied;
    state.seasonRepBonusApplied[seasonIndex] = bestCategoryRepBonus;
    state.agency.reputation = Math.max(0, state.agency.reputation + Math.round(delta * reputationMultiplier(state)));
  }

  // Team seats now expire at season rollover instead of at agency-contract expiry (which is
  // now a separate, weeks-based concept — see negotiateContract). Each player driver's PRIMARY
  // seat (not a secondary-championship seat) is either renewed — silently, the seat just
  // carries into next season — or the driver is benched, freeing the seat for the next mercato.
  // Pro seats (driver.isPro, tier >= PRO_TIER_THRESHOLD) are exempt from this roll — a pro
  // contract is assumed multi-year and simply carries over untouched every season.
  for (const team of classTeams) {
    for (const seat of team.seats) {
      if (seat.driverId == null) continue;
      const occupant = state.drivers.find((d) => d.id === seat.driverId);
      if (!occupant || occupant.teamId !== team.id) continue;
      if (occupant.isPro) continue;
      const renewChance = clamp((occupant.teamRelationship ?? 60) / 200, 0.1, 0.9);
      if (rng() >= renewChance) benchDriver(state, occupant.id, rng);
    }
  }

  // Reset the "best result this season" tiebreak (see simulate.js) for the new season.
  for (const team of classTeams) {
    team.bestPositionThisSeason = null;
    for (const seat of team.seats) {
      const occupant = seat.driverId != null ? getDriverById(state, seat.driverId) : null;
      if (occupant) occupant.bestPositionThisSeason = null;
    }
  }

  // Durable round-by-round archive for the "Monde ▸ Championnats" season selector — same shape
  // as the live standings entry (driverPoints/teamPoints/carPoints/rounds), so one rendering
  // function can read either without a special case. Kept indefinitely (no cap/prune) per an
  // explicit request to browse every past season, not just recent ones.
  const archiveKey = standingsKey(category.id, classId);
  state.seasonArchive = state.seasonArchive ?? {};
  (state.seasonArchive[archiveKey] ??= []).push({
    seasonNumber: standings.seasonNumber,
    driverPoints: standings.driverPoints,
    teamPoints: standings.teamPoints,
    carPoints: standings.carPoints,
    rounds: standings.rounds,
  });

  standings.race = 0;
  standings.seasonNumber += 1;
  standings.driverPoints = {};
  standings.teamPoints = {};
  standings.carPoints = {};
  standings.rounds = [];

  return entries;
}
