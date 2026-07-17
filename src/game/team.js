import {
  CATEGORIES,
  CATEGORY_BY_ID,
  FIELD_STRENGTH_BY_TIER,
  nextCategories,
  pickRandomRivalId,
  PRO_TIER_THRESHOLD,
  weekInSeason,
  isMercatoWindow,
  allocateVariableTeamSizes,
  MAX_DRIVER_WORKLOAD,
} from "./data.js";
import { generateDriver, getDriverById, overallRating, pickRaceNumber } from "./driver.js";
import { recordTransaction } from "./finance.js";
import { negotiationDiscount } from "./staff.js";

let nextTeamId = 1;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const NAME_PREFIXES = [
  "Apex", "Nordwind", "Vector", "Ignis", "Falcon", "Meridian", "Titan", "Volt",
  "Raptor", "Solstice", "Crimson", "Silverline", "Kinetic", "Obsidian", "Zenith",
  "Vertex", "Comet", "Aurora", "Tempest", "Quartz",
];
const NAME_SUFFIXES = [
  "Racing", "Motorsport", "Competizione", "Racing Team", "GP", "Performance",
  "Dynamics", "Speedworks", "Works",
];

function generateTeamName(rng, usedNames) {
  for (let i = 0; i < 25; i++) {
    const name = `${NAME_PREFIXES[Math.floor(rng() * NAME_PREFIXES.length)]} ${NAME_SUFFIXES[Math.floor(rng() * NAME_SUFFIXES.length)]}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  const fallback = `Écurie ${usedNames.size + 1}`;
  usedNames.add(fallback);
  return fallback;
}

const AGE_RANGE_BY_TIER = { 0: [15, 19], 1: [17, 21], 2: [18, 23], 3: [19, 27], 4: [21, 34] };

export function usedDriverNumbersInCategory(state, categoryId, excludeDriverId = null) {
  const used = new Set();
  for (const d of state.drivers) {
    if (d.id !== excludeDriverId && d.raceNumberCategoryId === categoryId && d.raceNumber != null) used.add(d.raceNumber);
  }
  for (const d of Object.values(state.aiDrivers)) {
    if (d.id !== excludeDriverId && d.raceNumberCategoryId === categoryId && d.raceNumber != null) used.add(d.raceNumber);
  }
  return used;
}

export function generateAIDriver(rng, team, category, usedNumbers = null) {
  const [minAge, maxAge] = AGE_RANGE_BY_TIER[category.tier] ?? [18, 30];
  const driver = generateDriver(rng, { minAge, maxAge });
  const targetRating = clamp(team.prestige + (rng() * 2 - 1) * 10, 15, 99);
  driver.potential = Math.round(clamp(targetRating + rng() * 15, targetRating, 99));
  driver.growthCeiling = driver.potential * (0.8 + rng() * 0.2);
  for (const key of Object.keys(driver.attributes)) {
    driver.attributes[key] = clamp(targetRating + (rng() * 2 - 1) * 8, 15, 99);
  }
  driver.isAI = true;
  driver.agencyId = rng() < 0.35 ? pickRandomRivalId(rng) : null;
  driver.teamId = team.id;
  driver.categoryId = category.id;
  driver.contract = null;
  driver.scouted = true;
  if (usedNumbers && !category.driversPerCar) {
    driver.raceNumber = pickRaceNumber(driver.favoriteNumbers, usedNumbers, rng);
    driver.raceNumberCategoryId = category.id;
  }
  return driver;
}

const STRICT_UNIQUE_BRAND_CATEGORIES = new Set(["f1", "rally"]);
const MIN_OCCURRENCE_BRAND_CATEGORIES = new Set(["karting"]);

function shuffleArray(arr, rng) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const FALLBACK_BRAND = "Constructeur";

// Failsafe: never work with an empty brand pool — fall back to a single placeholder
// brand rather than let downstream modulo/index math produce undefined or crash.
function safeBrandPool(brands) {
  return brands && brands.length > 0 ? brands : [FALLBACK_BRAND];
}

function assignTeamBrands(category, teamCount, rng) {
  if (category.fixedBrand) return Array(teamCount).fill(category.fixedBrand);
  const brands = safeBrandPool(category.brands);
  if (STRICT_UNIQUE_BRAND_CATEGORIES.has(category.id)) {
    const shuffled = shuffleArray(brands, rng);
    return Array.from({ length: teamCount }, (_, i) => shuffled[i % shuffled.length]);
  }
  if (MIN_OCCURRENCE_BRAND_CATEGORIES.has(category.id)) {
    const shuffled = shuffleArray(brands, rng);
    return Array.from({ length: teamCount }, (_, i) =>
      i < shuffled.length ? shuffled[i] : brands[Math.floor(rng() * brands.length)]
    );
  }
  return Array.from({ length: teamCount }, () => brands[Math.floor(rng() * brands.length)]);
}

function buildWecClassSpecs(cls, category, rng) {
  const seatsPerTeam = cls.carsPerTeam * category.driversPerCar;
  const brands = safeBrandPool(cls.brands);
  const shuffled = shuffleArray(brands, rng);
  if (cls.strictUnique) {
    const teamCount = Math.min(cls.teamCount, shuffled.length);
    return Array.from({ length: teamCount }, (_, i) => ({ size: seatsPerTeam, classId: cls.id, brand: shuffled[i] }));
  }
  return Array.from({ length: cls.teamCount }, (_, i) => ({
    size: seatsPerTeam,
    classId: cls.id,
    brand: i < shuffled.length ? shuffled[i] : brands[Math.floor(rng() * brands.length)],
  }));
}

function teamSizesFor(category, rng) {
  if (category.classes) {
    return category.classes.flatMap((cls) => buildWecClassSpecs(cls, category, rng));
  }
  if (category.teamSizes) {
    return category.teamSizes.map((size) => ({ size, classId: null }));
  }
  return null;
}

export function generateAllTeams(rng) {
  const teams = {};
  const aiDrivers = {};

  for (const category of CATEGORIES) {
    const usedNames = new Set();
    const usedNumbers = new Set();
    const usedCarNumbers = new Set();
    const categoryTeams = [];
    const prestigeBase = FIELD_STRENGTH_BY_TIER[category.tier] ?? 60;

    let specs = teamSizesFor(category, rng);
    if (!specs) {
      if (category.variableSeats) {
        const sizes = allocateVariableTeamSizes(category.gridSize, category.variableSeats.min, category.variableSeats.max, rng);
        specs = sizes.map((size) => ({ size, classId: null }));
      } else {
        const teamCount = category.gridSize / category.seatsPerTeam;
        specs = Array(teamCount).fill({ size: category.seatsPerTeam, classId: null });
      }
    }

    const teamBrands = category.classes ? specs.map((s) => s.brand) : assignTeamBrands(category, specs.length, rng);
    specs.forEach((spec, teamIndex) => {
      const team = {
        id: nextTeamId++,
        categoryId: category.id,
        subClass: spec.classId,
        name: generateTeamName(rng, usedNames),
        prestige: Math.round(clamp(prestigeBase + (rng() * 2 - 1) * 22, 10, 99)),
        carBrand: teamBrands[teamIndex],
        carNumbers: {},
        seats: Array.from({ length: spec.size }, (_, i) => ({
          driverId: null,
          carIndex: category.driversPerCar ? Math.floor(i / category.driversPerCar) : null,
        })),
      };
      if (category.driversPerCar) {
        const carCount = Math.ceil(spec.size / category.driversPerCar);
        for (let carIndex = 0; carIndex < carCount; carIndex++) {
          team.carNumbers[carIndex] = pickRaceNumber([], usedCarNumbers, rng);
        }
      }
      for (const seat of team.seats) {
        const aiDriver = generateAIDriver(rng, team, category, usedNumbers);
        aiDrivers[aiDriver.id] = aiDriver;
        seat.driverId = aiDriver.id;
      }
      categoryTeams.push(team);
    });
    teams[category.id] = categoryTeams;
  }

  return { teams, aiDrivers };
}

export function findTeamById(state, teamId) {
  for (const list of Object.values(state.teams)) {
    const found = list.find((t) => t.id === teamId);
    if (found) return found;
  }
  return null;
}

export function findSeatOfDriver(state, driverId) {
  for (const list of Object.values(state.teams)) {
    for (const team of list) {
      const seat = team.seats.find((s) => s.driverId === driverId);
      if (seat) return { team, seat };
    }
  }
  return null;
}

export function teamSeatCost(team, occupantDriver) {
  const base = 800 + team.prestige * 250;
  const bump = occupantDriver ? Math.round(overallRating(occupantDriver) * 200) : 0;
  return Math.round(base + bump);
}

export function releaseSeatAndBackfill(state, driverId, rng) {
  const found = findSeatOfDriver(state, driverId);
  if (!found) return;
  const category = CATEGORY_BY_ID[found.team.categoryId];
  const usedNumbers = usedDriverNumbersInCategory(state, category.id, driverId);
  const freshAI = generateAIDriver(rng, found.team, category, usedNumbers);
  state.aiDrivers[freshAI.id] = freshAI;
  found.seat.driverId = freshAI.id;
}

export function listJoinableTeams(state, driver) {
  const categories = driver.categoryId
    ? [CATEGORY_BY_ID[driver.categoryId], ...nextCategories(driver.categoryId)]
    : nextCategories(null);

  const options = [];
  for (const category of categories) {
    if (!category) continue;
    if (category.id !== driver.categoryId && category.repRequired > state.agency.reputation) continue;

    for (const team of state.teams[category.id]) {
      const emptySeatIndex = team.seats.findIndex((s) => s.driverId === null);
      const occupants = team.seats.map((s) => getDriverById(state, s.driverId)).filter(Boolean);
      const weakestAI = occupants
        .filter((o) => o.isAI)
        .sort((a, b) => overallRating(a) - overallRating(b))[0] ?? null;
      const hasEmptySeat = emptySeatIndex !== -1;
      const isCurrent = driver.teamId === team.id;
      const cost = isCurrent ? 0 : teamSeatCost(team, hasEmptySeat ? null : weakestAI);
      options.push({
        team,
        category,
        cost,
        isCurrent,
        hasEmptySeat,
        full: !hasEmptySeat && !weakestAI,
      });
    }
  }
  return options;
}

export function proposeToTeams(state, driverId, budget, rng) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };

  budget = Math.max(0, Math.round(budget));
  if (budget > state.agency.money) return { ok: false, error: "Budget de recrutement supérieur à la trésorerie." };

  const rating = overallRating(driver);
  const candidates = listJoinableTeams(state, driver).filter((c) => !c.full && !c.isCurrent);
  const outOfWindowPenalty =
    driver.teamId != null && !isMercatoWindow(weekInSeason(state.week)) ? 0.3 : 1;

  const offers = [];
  for (const c of candidates) {
    const baseline = Math.max(1000, c.cost);
    const budgetBonus = budget > 0 ? clamp(Math.sqrt(budget / baseline) * 12, 0, 25) : 0;
    const acceptChance = clamp(0.5 + (rating + budgetBonus - c.team.prestige) / 55, 0.05, 0.95) * outOfWindowPenalty;
    if (rng() < acceptChance) {
      offers.push({
        teamId: c.team.id,
        teamName: c.team.name,
        categoryId: c.category.id,
        categoryName: c.category.name,
        prestige: c.team.prestige,
        cost: c.cost,
      });
    }
  }
  offers.sort((a, b) => b.prestige - a.prestige);
  driver.pendingOffers = offers;
  driver.pendingOfferBudget = budget;
  driver.proposedAt = state.week;
  return { ok: true, offers };
}

export function joinTeam(state, driverId, teamId, rng) {
  const result = assignSeat(state, driverId, teamId, rng);
  if (result.ok) {
    const driver = state.drivers.find((d) => d.id === driverId);
    if (driver) {
      // The recruitment budget promised during the proposal is actually paid out
      // to the team once a seat is accepted — it is a real bribe, not free odds.
      const budget = driver.pendingOfferBudget ?? 0;
      if (budget > 0) {
        state.agency.money -= budget;
        recordTransaction(state, "recruitment-budget", `Budget de recrutement — ${driver.name}`, -budget);
      }
      driver.pendingOffers = [];
      driver.pendingOfferBudget = 0;
      driver.proposedAt = null;
    }
  }
  return result;
}

export function totalWorkload(driver) {
  let total = driver.categoryId ? CATEGORY_BY_ID[driver.categoryId]?.workload ?? 0 : 0;
  for (const seat of driver.secondarySeats) {
    total += CATEGORY_BY_ID[seat.categoryId]?.workload ?? 0;
  }
  return total;
}

export function joinSecondaryChampionship(state, driverId, teamId, rng) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };

  const team = findTeamById(state, teamId);
  if (!team) return { ok: false, error: "Écurie introuvable." };

  const category = CATEGORY_BY_ID[team.categoryId];
  if (category.id === driver.categoryId || driver.secondarySeats.some((s) => s.categoryId === category.id)) {
    return { ok: false, error: "Déjà engagé dans cette catégorie." };
  }
  if (category.repRequired > state.agency.reputation) {
    return { ok: false, error: "Réputation insuffisante pour cette catégorie." };
  }
  if (category.tier < (driver.highestTierReached ?? 0)) {
    return { ok: false, error: "Ce pilote ne peut plus redescendre dans une catégorie inférieure." };
  }
  if (totalWorkload(driver) + category.workload > MAX_DRIVER_WORKLOAD) {
    return { ok: false, error: "Charge de travail du pilote dépassée." };
  }

  let seatIndex = team.seats.findIndex((s) => s.driverId === null);
  let occupant = null;
  if (seatIndex === -1) {
    let weakestIdx = -1;
    let weakestRating = Infinity;
    team.seats.forEach((s, i) => {
      const occ = getDriverById(state, s.driverId);
      if (occ && occ.isAI) {
        const rating = overallRating(occ);
        if (rating < weakestRating) {
          weakestRating = rating;
          weakestIdx = i;
        }
      }
    });
    if (weakestIdx === -1) return { ok: false, error: "Aucun baquet disponible dans cette écurie." };
    seatIndex = weakestIdx;
    occupant = getDriverById(state, team.seats[seatIndex].driverId);
  }

  const cost = Math.round(teamSeatCost(team, occupant) * (1 - negotiationDiscount(state)));
  if (state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };

  state.agency.money -= cost;
  recordTransaction(state, "seat-cost", `${team.name} — ${driver.name} (2e championnat)`, -cost);
  if (occupant) delete state.aiDrivers[occupant.id];

  team.seats[seatIndex].driverId = driverId;
  driver.secondarySeats.push({ categoryId: category.id, teamId: team.id });
  driver.highestTierReached = Math.max(driver.highestTierReached ?? 0, category.tier);

  const usedNumbers = usedDriverNumbersInCategory(state, category.id, driver.id);
  driver.secondaryRaceNumbers = driver.secondaryRaceNumbers ?? {};
  driver.secondaryRaceNumbers[category.id] = pickRaceNumber(driver.favoriteNumbers, usedNumbers, rng);

  if (!driver.isPro && category.tier >= PRO_TIER_THRESHOLD) {
    driver.isPro = true;
    const commission = Math.round(team.prestige * 400);
    state.agency.money += commission;
    recordTransaction(state, "pro-commission", `Passage pro — ${driver.name}`, commission);
  }

  return { ok: true };
}

export function assignSeat(state, driverId, teamId, rng) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };

  const team = findTeamById(state, teamId);
  if (!team) return { ok: false, error: "Écurie introuvable." };

  const category = CATEGORY_BY_ID[team.categoryId];
  if (category.id !== driver.categoryId && category.repRequired > state.agency.reputation) {
    return { ok: false, error: "Réputation insuffisante pour cette catégorie." };
  }
  if (category.tier < (driver.highestTierReached ?? 0)) {
    return { ok: false, error: "Ce pilote ne peut plus redescendre dans une catégorie inférieure." };
  }

  let seatIndex = team.seats.findIndex((s) => s.driverId === null);
  let occupant = null;
  if (seatIndex === -1) {
    let weakestIdx = -1;
    let weakestRating = Infinity;
    team.seats.forEach((s, i) => {
      const occ = getDriverById(state, s.driverId);
      if (occ && occ.isAI) {
        const rating = overallRating(occ);
        if (rating < weakestRating) {
          weakestRating = rating;
          weakestIdx = i;
        }
      }
    });
    if (weakestIdx === -1) return { ok: false, error: "Aucun baquet disponible dans cette écurie." };
    seatIndex = weakestIdx;
    occupant = getDriverById(state, team.seats[seatIndex].driverId);
  }

  const cost = Math.round(teamSeatCost(team, occupant) * (1 - negotiationDiscount(state)));
  if (state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };

  state.agency.money -= cost;
  recordTransaction(state, "seat-cost", `${team.name} — ${driver.name}`, -cost);
  if (occupant) delete state.aiDrivers[occupant.id];

  releaseSeatAndBackfill(state, driverId, rng);

  if (driver.teamId !== team.id) {
    driver.teamRelationship = 60;
  }
  const wasBenched = driver.teamId == null;
  team.seats[seatIndex].driverId = driverId;
  driver.teamId = team.id;
  driver.categoryId = team.categoryId;
  driver.highestTierReached = Math.max(driver.highestTierReached ?? 0, category.tier);

  if (wasBenched) {
    // Bug fix: getting a seat immediately clears poaching risk instead of waiting for next week's tick.
    driver.benchedWeeks = 0;
    driver.agencyRelationship = clamp(driver.agencyRelationship + 10, 0, 200);
  }

  if (!category.driversPerCar && driver.raceNumberCategoryId !== category.id) {
    const usedNumbers = usedDriverNumbersInCategory(state, category.id, driver.id);
    driver.raceNumber = pickRaceNumber(driver.favoriteNumbers, usedNumbers, rng);
    driver.raceNumberCategoryId = category.id;
  }

  if (!driver.isPro && category.tier >= PRO_TIER_THRESHOLD) {
    driver.isPro = true;
    const commission = Math.round(team.prestige * 400);
    state.agency.money += commission;
    recordTransaction(state, "pro-commission", `Passage pro — ${driver.name}`, commission);
  }

  return { ok: true };
}
