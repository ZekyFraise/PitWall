import { overallRating } from "./driver.js";
import { findTeamById } from "./team.js";

export function driverMarketValue(driver) {
  const rating = overallRating(driver);
  const ageFactor = driver.age <= 23 ? 1.3 : driver.age <= 28 ? 1.1 : driver.age <= 32 ? 0.9 : 0.6;
  return Math.round((rating * 500 + driver.potential * 300) * ageFactor);
}

function standingsFor(state, driver) {
  if (!driver.categoryId) return null;
  const team = driver.teamId ? findTeamById(state, driver.teamId) : null;
  const key = team?.subClass ? `${driver.categoryId}:${team.subClass}` : driver.categoryId;
  return state.standings[key] ?? null;
}

export function seasonResultsFor(state, driver) {
  const standings = standingsFor(state, driver);
  if (!standings) return { races: 0, wins: 0, podiums: 0 };

  const results = standings.race > 0
    ? driver.careerResults.filter((r) => r.categoryId === driver.categoryId).slice(-standings.race)
    : [];
  return {
    races: results.length,
    wins: results.filter((r) => !r.dnf && r.position === 1).length,
    podiums: results.filter((r) => !r.dnf && r.position <= 3).length,
  };
}

export function championshipStanding(state, driver) {
  const standings = standingsFor(state, driver);
  if (!standings || !(driver.id in standings.driverPoints)) return { position: null, points: 0 };

  const ranked = Object.entries(standings.driverPoints).sort((a, b) => b[1] - a[1]);
  const position = ranked.findIndex(([id]) => Number(id) === driver.id) + 1;
  return { position, points: standings.driverPoints[driver.id] };
}
