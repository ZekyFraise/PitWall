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
import { generateDriver, getDriverById, overallRating, pickRaceNumber, rollGrowthCeiling, TIER_ADAPTATION_WEEKS } from "./driver.js";
import { recordTransaction } from "./finance.js";
import { negotiationDiscount } from "./staff.js";
import { officeCommissionRate, officeTransferFeeRate } from "./infrastructure.js";

let nextTeamId = 1;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Agency-écurie relationship — distinct from driver.teamRelationship (personal to one driver's
// seat). Tracks how a TEAM feels about the agency as a whole, across every driver it has ever
// fielded for them. Stored lazily (state.agencyTeamRelationships[teamId]) rather than
// pre-seeded for every team in the game, since most teams the player never interacts with.
export const AGENCY_TEAM_RELATIONSHIP_DEFAULT = 60;

export function agencyTeamRelationship(state, teamId) {
  return state.agencyTeamRelationships?.[teamId] ?? AGENCY_TEAM_RELATIONSHIP_DEFAULT;
}

export function adjustAgencyTeamRelationship(state, teamId, delta) {
  if (!teamId || !delta) return;
  state.agencyTeamRelationships = state.agencyTeamRelationships ?? {};
  const current = agencyTeamRelationship(state, teamId);
  state.agencyTeamRelationships[teamId] = clamp(current + delta, 0, 200);
}

const NAME_PREFIXES = [
  "Apex", "Nordwind", "Vector", "Ignis", "Falcon", "Meridian", "Titan", "Volt",
  "Raptor", "Solstice", "Crimson", "Silverline", "Kinetic", "Obsidian", "Zenith",
  "Vertex", "Comet", "Aurora", "Tempest", "Quartz",
  "Onyx", "Radiant", "Eclipse", "Phantom", "Wraith", "Catalyst", "Nova", "Orbit",
  "Paragon", "Lumen", "Griffin", "Sentinel", "Cobalt", "Aegis", "Cipher",
];
const NAME_SUFFIXES = [
  "Racing", "Motorsport", "Competizione", "Racing Team", "GP", "Performance",
  "Dynamics", "Speedworks", "Works",
  "Engineering", "Motors", "Racing Squad", "Autosport",
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
  // Same rollGrowthCeiling distribution as generateDriver's own roll (driver.js) — recomputed
  // here since potential itself just changed above. growthLuck (also from generateDriver) is
  // left as-is.
  driver.growthCeiling = rollGrowthCeiling(driver.potential, rng);
  for (const key of Object.keys(driver.attributes)) {
    driver.attributes[key] = clamp(targetRating + (rng() * 2 - 1) * 8, 15, 99);
  }
  driver.isAI = true;
  driver.agencyId = rng() < 0.35 ? pickRandomRivalId(rng) : null;
  driver.teamId = team.id;
  driver.categoryId = category.id;
  driver.contract = null;
  // Deliberately left unscouted (base generateDriver default) — an AI/rival driver's stats
  // are hidden from the player's fiche until explicitly scouted (scoutRivalDriver, state.js),
  // same convention as a scout-pool prospect.
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

// Read-only cost preview for a second-championship seat — mirrors the empty-seat-or-weakest-AI
// logic joinSecondaryChampionship uses when it actually charges the player, so the price shown
// before joining matches the price paid.
export function secondarySeatCost(state, team) {
  const emptyIndex = team.seats.findIndex((s) => s.driverId === null);
  if (emptyIndex !== -1) return Math.round(teamSeatCost(team, null) * (1 - negotiationDiscount(state)));

  let weakestOccupant = null;
  let weakestRating = Infinity;
  for (const seat of team.seats) {
    const occ = getDriverById(state, seat.driverId);
    if (occ && occ.isAI) {
      const rating = overallRating(occ);
      if (rating < weakestRating) {
        weakestRating = rating;
        weakestOccupant = occ;
      }
    }
  }
  return Math.round(teamSeatCost(team, weakestOccupant) * (1 - negotiationDiscount(state)));
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

// Fully benches a driver: frees the team seat (releaseSeatAndBackfill) AND clears both
// teamId and categoryId — without the categoryId clear, "Mes pilotes" keeps showing the
// old category for a driver who no longer has any seat there.
export function benchDriver(state, driverId, rng) {
  const driver = state.drivers.find((d) => d.id === driverId) ?? getDriverById(state, driverId);
  if (!driver) return;
  releaseSeatAndBackfill(state, driverId, rng);
  driver.teamId = null;
  driver.categoryId = null;
}

// A driver who's actually raced before (highestTierReached > 0) but currently has no seat
// (benched — categoryId nulled by benchDriver) must NOT be treated the same as a brand-new
// signing who's never raced: nextCategories(null) alone would only ever offer tier-0 karting,
// silently demoting every released F4+ driver back to karting forever. Mirrors the
// categoryId-based branch below (current tier + promotion), just anchored on the last tier
// reached instead of a still-held categoryId. Tier-skip candidates are NOT added here — they're
// computed once in listJoinableTeams (uniformly for both the categoryId and free-agent paths,
// keyed off the same currentTier) instead of being duplicated in both places.
function categoriesForFreeAgent(driver) {
  const tier = driver.highestTierReached ?? 0;
  if (tier === 0) return nextCategories(null);
  return CATEGORIES.filter((c) => c.tier === tier || c.tier === tier + 1 || (c.branch && c.tier === tier));
}

// Skipping a tier (tier+2 instead of the normal tier+1) stays exceptional by construction:
// either the driver is wonderkid-tier (same 94+ threshold generateDriver already uses,
// driver.js) or the recruitment budget engaged dwarfs the target category's normal seat cost.
// The reputation gate already applied everywhere in listJoinableTeams still applies on top of
// this, unchanged — a skip never bypasses repRequired.
const TIER_SKIP_POTENTIAL_THRESHOLD = 94;
const TIER_SKIP_BUDGET_MULTIPLIER = 15;

function tierSkipEligible(driver, category, budget) {
  if (driver.potential >= TIER_SKIP_POTENTIAL_THRESHOLD) return true;
  return budget >= category.seatCost * TIER_SKIP_BUDGET_MULTIPLIER;
}

// One tier below the driver's current/last tier — only ever consulted as an explicit
// last-resort fallback (see proposeToTeams) when nothing at their own tier or above wants them.
function categoriesOneTierBelow(driver) {
  const tier = driver.categoryId ? CATEGORY_BY_ID[driver.categoryId]?.tier ?? 0 : driver.highestTierReached ?? 0;
  if (tier <= 0) return [];
  return CATEGORIES.filter((c) => c.tier === tier - 1);
}

// The driver's real current level for eligibility purposes — their held category if they have
// one, otherwise the highest tier they've ever raced at. Used to gate SECOND-championship
// eligibility the same way promotion already works for the primary seat (current tier or one
// above, never a wild jump): without this, nothing stopped a karting-only driver from being
// offered a WEC seat, since joinSecondaryChampionship only ever guarded against going DOWN.
function anchorTier(driver) {
  return Math.max(driver.categoryId ? CATEGORY_BY_ID[driver.categoryId]?.tier ?? 0 : 0, driver.highestTierReached ?? 0);
}

export function listJoinableTeams(state, driver, { allowDowngrade = false, budget = 0 } = {}) {
  const currentTier = driver.categoryId ? CATEGORY_BY_ID[driver.categoryId].tier : (driver.highestTierReached ?? 0);
  const categories = driver.categoryId
    ? [CATEGORY_BY_ID[driver.categoryId], ...nextCategories(driver.categoryId)]
    : categoriesForFreeAgent(driver);
  const skipCategories = CATEGORIES.filter((c) => c.tier === currentTier + 2 && tierSkipEligible(driver, c, budget));
  const searchCategories = allowDowngrade
    ? [...categories, ...skipCategories, ...categoriesOneTierBelow(driver)]
    : [...categories, ...skipCategories];

  const options = [];
  for (const category of searchCategories) {
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
        isSkip: category.tier > currentTier + 1,
      });
    }
  }
  return options;
}

export function proposeToTeams(state, driverId, budget, rng, { force = false } = {}) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };

  budget = force ? 0 : Math.max(0, Math.round(budget));
  if (!force && budget > state.agency.money) return { ok: false, error: "Budget de recrutement supérieur à la trésorerie." };

  const rating = overallRating(driver);
  const outOfWindowPenalty =
    driver.teamId != null && !isMercatoWindow(weekInSeason(state.week)) ? 0.3 : 1;

  function collectOffers(candidates) {
    const result = [];
    for (const c of candidates) {
      const baseline = Math.max(1000, c.cost);
      const budgetBonus = budget > 0 ? clamp(Math.sqrt(budget / baseline) * 12, 0, 25) : 0;
      // How this specific team feels about the agency (distinct from any one driver's personal
      // teamRelationship) — a team the agency has a strong history with is more willing to take
      // another of its drivers, and vice versa. Centered on the default so a fresh/neutral
      // relationship changes nothing.
      const relationshipBonus = (agencyTeamRelationship(state, c.team.id) - AGENCY_TEAM_RELATIONSHIP_DEFAULT) / 10;
      // Baseline/floor/ceiling all tightened from the original 0.5/0.05/0.95 — too many teams
      // were accepting per proposal, making finding a seat feel trivial regardless of the
      // driver's actual standing. A driver clearly above a team's prestige still lands the
      // seat reliably; a mediocre match now genuinely struggles instead of getting ~50/50 odds.
      const acceptChance =
        clamp(0.25 + (rating + budgetBonus - c.team.prestige) / 50 + relationshipBonus, 0.03, 0.85) * outOfWindowPenalty;
      if (force || rng() < acceptChance) {
        result.push({
          teamId: c.team.id,
          teamName: c.team.name,
          categoryId: c.category.id,
          categoryName: c.category.name,
          prestige: c.team.prestige,
          cost: c.cost,
          isSkip: c.isSkip,
        });
      }
    }
    return result;
  }

  const primaryCandidates = listJoinableTeams(state, driver, { budget }).filter((c) => !c.full && !c.isCurrent);
  let offers = collectOffers(primaryCandidates);

  // A driver too weak for their own tier (or the one above) shouldn't be left with zero
  // options forever — but a downgrade is only ever offered as a last resort, never mixed in
  // alongside real same-tier-or-above offers.
  if (offers.length === 0 && !force) {
    const primaryTeamIds = new Set(primaryCandidates.map((c) => c.team.id));
    const downgradeCandidates = listJoinableTeams(state, driver, { allowDowngrade: true }).filter(
      (c) => !c.full && !c.isCurrent && !primaryTeamIds.has(c.team.id)
    );
    offers = collectOffers(downgradeCandidates);
  }

  offers.sort((a, b) => b.prestige - a.prestige);
  driver.pendingOffers = offers;
  driver.pendingOfferBudget = budget;
  driver.proposedAt = state.week;
  // Offers left unanswered go stale after a random 1-4 weeks rather than sitting forever —
  // checked in runWeekBody's per-driver weekly tick (simulate.js).
  driver.offersExpireAt = offers.length > 0 ? state.week + 1 + Math.floor(rng() * 4) : null;
  return { ok: true, offers };
}

export function joinTeam(state, driverId, teamId, rng, { force = false } = {}) {
  // A downgrade offer only ever appears in pendingOffers via proposeToTeams' explicit
  // last-resort fallback (nothing at the driver's own tier or above wanted them) — safe to
  // honor here without re-litigating the tier check, since it can't have gotten there any
  // other way.
  const proposingDriver = state.drivers.find((d) => d.id === driverId);
  const allowDowngrade = proposingDriver?.pendingOffers?.some((o) => o.teamId === teamId) ?? false;
  const result = assignSeat(state, driverId, teamId, rng, { force, allowDowngrade });
  if (result.ok) {
    const driver = state.drivers.find((d) => d.id === driverId);
    if (driver) {
      // The recruitment budget promised during the proposal is actually paid out
      // to the team once a seat is accepted — it is a real bribe, not free odds.
      const budget = force ? 0 : (driver.pendingOfferBudget ?? 0);
      if (budget > 0) {
        state.agency.money -= budget;
        recordTransaction(state, "recruitment-budget", `Budget de recrutement — ${driver.name}`, -budget);
      }
      driver.pendingOffers = [];
      driver.pendingOfferBudget = 0;
      driver.proposedAt = null;
      driver.offersExpireAt = null;
    }
  }
  return result;
}

// Candidate teams for a SECOND championship — same tier-gating principle as listJoinableTeams
// (current tier or one above, never a wild jump), but starting from the driver's PRIMARY seat
// instead of walking a chain of promotions, since a second championship is additive rather than
// a replacement. This is what actually fixes the karting-driver-offered-WEC bug: the category
// list itself now excludes anything more than one tier above the driver's real level.
export function listSecondaryJoinableTeams(state, driver) {
  const tier = anchorTier(driver);
  const used = totalWorkload(driver);
  const categories = CATEGORIES.filter(
    (c) =>
      c.id !== driver.categoryId &&
      !driver.secondarySeats.some((s) => s.categoryId === c.id) &&
      (c.tier === tier || c.tier === tier + 1) &&
      c.repRequired <= state.agency.reputation &&
      used + c.workload <= MAX_DRIVER_WORKLOAD
  );

  const options = [];
  for (const category of categories) {
    for (const team of state.teams[category.id] ?? []) {
      const emptySeatIndex = team.seats.findIndex((s) => s.driverId === null);
      const occupants = team.seats.map((s) => getDriverById(state, s.driverId)).filter(Boolean);
      const weakestAI = occupants.filter((o) => o.isAI).sort((a, b) => overallRating(a) - overallRating(b))[0] ?? null;
      const hasEmptySeat = emptySeatIndex !== -1;
      options.push({
        team,
        category,
        cost: secondarySeatCost(state, team),
        hasEmptySeat,
        full: !hasEmptySeat && !weakestAI,
      });
    }
  }
  return options;
}

// Mirrors proposeToTeams' active-proposal flow for a second championship — previously
// secondaryChampionshipSection just listed EVERY eligible team permanently, with no proposal
// step and no real chance of rejection, which is also how the tier bug went unnoticed (nothing
// ever said no). Same tightened acceptance formula as the primary flow, for the same reason:
// getting a second seat should take real standing, not be a standing offer.
export function proposeSecondaryChampionship(state, driverId, rng, { force = false } = {}) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  if (!driver.teamId) return { ok: false, error: "Le pilote doit déjà avoir un baquet principal." };

  const rating = overallRating(driver);
  const candidates = listSecondaryJoinableTeams(state, driver).filter((c) => !c.full);

  const offers = [];
  for (const c of candidates) {
    const relationshipBonus = (agencyTeamRelationship(state, c.team.id) - AGENCY_TEAM_RELATIONSHIP_DEFAULT) / 10;
    const acceptChance = clamp(0.25 + (rating - c.team.prestige) / 50 + relationshipBonus, 0.03, 0.85);
    if (force || rng() < acceptChance) {
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
  driver.pendingSecondaryOffers = offers;
  driver.secondaryProposedAt = state.week;
  driver.secondaryOffersExpireAt = offers.length > 0 ? state.week + 1 + Math.floor(rng() * 4) : null;
  return { ok: true, offers };
}

const SUBSTITUTE_OFFER_CHANCE = 0.04;
// A one-race arrangement is worth a fraction of a season-long secondary seat, not the full price.
const SUBSTITUTE_SEAT_COST_FACTOR = 0.15;

// The "occasional one-off offers" half of the second-championship redesign — separate from
// proposeSecondaryChampionship (season-long, player-initiated): teams occasionally need a
// one-race substitute and reach out on their own for exactly that race, tied to a specific
// upcoming round rather than a standing seat. Tier-gated the same way (anchorTier ±1) so this
// can't reproduce the karting-driver-offered-WEC bug in a different form.
export function tickSubstituteOffers(state, rng) {
  const targetWeekInSeason = weekInSeason(state.week + 1);
  for (const driver of state.drivers) {
    if (!driver.teamId || driver.pendingSubstituteOffer) continue;
    if (rng() >= SUBSTITUTE_OFFER_CHANCE) continue;

    const tier = anchorTier(driver);
    const candidateCategories = CATEGORIES.filter(
      (c) =>
        c.id !== driver.categoryId &&
        !driver.secondarySeats.some((s) => s.categoryId === c.id) &&
        (c.tier === tier || c.tier === tier + 1) &&
        c.calendar.includes(targetWeekInSeason)
    );
    if (candidateCategories.length === 0) continue;
    const category = candidateCategories[Math.floor(rng() * candidateCategories.length)];
    const teams = state.teams[category.id] ?? [];
    if (teams.length === 0) continue;
    const team = teams[Math.floor(rng() * teams.length)];

    driver.pendingSubstituteOffer = {
      teamId: team.id,
      teamName: team.name,
      categoryId: category.id,
      categoryName: category.name,
      roundWeek: state.week + 1,
      cost: Math.round(secondarySeatCost(state, team) * SUBSTITUTE_SEAT_COST_FACTOR),
    };
  }
}

// Accepting a one-off offer reuses the same seat/backfill mechanics as a season-long secondary
// seat, marked `oneOff` + the specific `roundWeek` it's for — runWeekBody (simulate.js) removes
// it automatically right after that round is simulated. Deliberately does NOT bump
// highestTierReached or trigger the pro-commission conversion: a single fill-in race isn't a
// real promotion, unlike actually taking a season-long seat in a higher tier.
export function acceptSubstituteOffer(state, driverId, rng, { force = false } = {}) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  const offer = driver.pendingSubstituteOffer;
  if (!offer) return { ok: false, error: "Aucune offre de remplacement en attente." };

  const team = findTeamById(state, offer.teamId);
  if (!team) {
    driver.pendingSubstituteOffer = null;
    return { ok: false, error: "Écurie introuvable." };
  }
  const category = CATEGORY_BY_ID[offer.categoryId];
  if (!force && state.agency.money < offer.cost) return { ok: false, error: "Budget insuffisant." };

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
    if (weakestIdx === -1) {
      driver.pendingSubstituteOffer = null;
      return { ok: false, error: "Aucun baquet disponible dans cette écurie." };
    }
    seatIndex = weakestIdx;
    occupant = getDriverById(state, team.seats[seatIndex].driverId);
  }

  if (offer.cost) {
    state.agency.money -= offer.cost;
    recordTransaction(state, "seat-cost", `${team.name} — ${driver.name} (remplaçant)`, -offer.cost);
  }
  if (occupant) delete state.aiDrivers[occupant.id];

  team.seats[seatIndex].driverId = driverId;
  driver.secondarySeats.push({ categoryId: category.id, teamId: team.id, oneOff: true, roundWeek: offer.roundWeek });
  const usedNumbers = usedDriverNumbersInCategory(state, category.id, driver.id);
  driver.secondaryRaceNumbers = driver.secondaryRaceNumbers ?? {};
  driver.secondaryRaceNumbers[category.id] = pickRaceNumber(driver.favoriteNumbers, usedNumbers, rng);
  driver.pendingSubstituteOffer = null;

  return { ok: true };
}

export function transferNegotiationWindow(driver) {
  const offer = driver.pendingTransferOffer;
  if (!offer) return null;
  return {
    baselineFee: offer.baselineFee,
    minFee: Math.round(offer.baselineFee * 0.5),
    maxFee: Math.round(offer.baselineFee * 1.8),
  };
}

// Negotiates the fee for a pending transfer offer (events.js "transfer-offer" dilemma, "Ouvrir
// les négociations" branch) — the higher the asking fee relative to the offer's frozen
// baselineFee, the less likely the buying team accepts. Mirror-inverted from negotiateContract's
// generosity (state.js): there the AGENCY is generous toward the DRIVER; here it must be
// reasonable toward the BUYING TEAM. rng is a parameter, never makeRng called internally — team.js
// can't import state.js (state.js already imports FROM team.js, a cycle), same regime as
// acceptSubstituteOffer above.
export function negotiateTransfer(state, driverId, { askingFee }, rng, { force = false } = {}) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  const offer = driver.pendingTransferOffer;
  if (!offer) return { ok: false, error: "Aucune négociation de transfert en cours." };
  const newTeam = findTeamById(state, offer.teamId);
  if (!newTeam) {
    driver.pendingTransferOffer = null;
    return { ok: false, error: "Écurie introuvable — l'offre n'est plus valable." };
  }

  askingFee = Math.max(0, Math.round(Number(askingFee) || 0));
  const ratio = askingFee / Math.max(1, offer.baselineFee);
  const acceptChance = clamp(1.3 - ratio * 0.6, 0.05, 0.95);
  if (!force && rng() >= acceptChance) {
    return { ok: false, error: `${newTeam.name} juge cette indemnité trop élevée — baisse tes attentes ou attends une meilleure occasion.` };
  }

  const agencyCut = Math.round(askingFee * officeTransferFeeRate(state));
  assignSeat(state, driver.id, newTeam.id, rng, { force: true });
  state.agency.money += agencyCut;
  recordTransaction(state, "transfer-fee", `Commission de transfert — ${driver.name}`, agencyCut);
  driver.pendingTransferOffer = null;
  return { ok: true, teamName: newTeam.name, agencyCut };
}

// Reverses acceptSubstituteOffer's seat assignment once the one-off round has been simulated —
// called from runWeekBody right after the week's races. Deliberately looks the seat up via the
// KNOWN teamId from the secondarySeats entry rather than releaseSeatAndBackfill/
// findSeatOfDriver, which would resolve whichever of the driver's seats (primary or secondary)
// happens to come first in state.teams' iteration order — wrong target here.
export function removeOneOffSecondarySeat(state, driver, seatEntry, rng) {
  const team = findTeamById(state, seatEntry.teamId);
  if (team) {
    const category = CATEGORY_BY_ID[team.categoryId];
    const seatIdx = team.seats.findIndex((s) => s.driverId === driver.id);
    if (seatIdx !== -1) {
      const usedNumbers = usedDriverNumbersInCategory(state, category.id, driver.id);
      const fresh = generateAIDriver(rng, team, category, usedNumbers);
      state.aiDrivers[fresh.id] = fresh;
      team.seats[seatIdx].driverId = fresh.id;
    }
  }
  driver.secondarySeats = driver.secondarySeats.filter((s) => s !== seatEntry);
  if (driver.secondaryRaceNumbers) delete driver.secondaryRaceNumbers[seatEntry.categoryId];
}

export function totalWorkload(driver) {
  let total = driver.categoryId ? CATEGORY_BY_ID[driver.categoryId]?.workload ?? 0 : 0;
  for (const seat of driver.secondarySeats) {
    total += CATEGORY_BY_ID[seat.categoryId]?.workload ?? 0;
  }
  return total;
}

export function joinSecondaryChampionship(state, driverId, teamId, rng, { force = false } = {}) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };

  const team = findTeamById(state, teamId);
  if (!team) return { ok: false, error: "Écurie introuvable." };

  const category = CATEGORY_BY_ID[team.categoryId];
  if (category.id === driver.categoryId || driver.secondarySeats.some((s) => s.categoryId === category.id)) {
    return { ok: false, error: "Déjà engagé dans cette catégorie." };
  }
  if (!force && category.repRequired > state.agency.reputation) {
    return { ok: false, error: "Réputation insuffisante pour cette catégorie." };
  }
  if (!force && category.tier < (driver.highestTierReached ?? 0)) {
    return { ok: false, error: "Ce pilote ne peut plus redescendre dans une catégorie inférieure." };
  }
  // Fixes the karting-driver-offered-WEC bug at its source (not just in the offer listing) —
  // a second championship can only be one tier above the driver's real level, same ceiling as
  // primary promotion (nextCategories). Without this, only the downgrade guard above existed,
  // so nothing ever stopped an arbitrarily large jump UP in tier.
  if (!force && category.tier > anchorTier(driver) + 1) {
    return { ok: false, error: "Écart de niveau trop important pour ce second championnat." };
  }
  if (!force && totalWorkload(driver) + category.workload > MAX_DRIVER_WORKLOAD) {
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

  const cost = force ? 0 : Math.round(teamSeatCost(team, occupant) * (1 - negotiationDiscount(state)));
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };

  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "seat-cost", `${team.name} — ${driver.name} (2e championnat)`, -cost);
  }
  if (occupant) delete state.aiDrivers[occupant.id];

  team.seats[seatIndex].driverId = driverId;
  driver.secondarySeats.push({ categoryId: category.id, teamId: team.id });
  // Same tier-adaptation trigger as assignSeat — a season-long second championship at a new
  // tier is a real step up too, unlike a one-off substitute (acceptSubstituteOffer deliberately
  // skips both this and the highestTierReached bump).
  if (category.tier > (driver.highestTierReached ?? 0)) {
    driver.adaptationWeeksRemaining = TIER_ADAPTATION_WEEKS;
  }
  driver.highestTierReached = Math.max(driver.highestTierReached ?? 0, category.tier);
  driver.pendingSecondaryOffers = [];
  driver.secondaryProposedAt = null;
  driver.secondaryOffersExpireAt = null;

  const usedNumbers = usedDriverNumbersInCategory(state, category.id, driver.id);
  driver.secondaryRaceNumbers = driver.secondaryRaceNumbers ?? {};
  driver.secondaryRaceNumbers[category.id] = pickRaceNumber(driver.favoriteNumbers, usedNumbers, rng);

  if (!driver.isPro && category.tier >= PRO_TIER_THRESHOLD) {
    driver.isPro = true;
    // An existing agency contract was negotiated under amateur terms (weeklyWage, no
    // commission) — convert it to pro terms (commission, no wage) so promotion doesn't
    // silently leave a 0% commission in effect until the next renegotiation.
    if (driver.contract) driver.contract = { weeksRemaining: driver.contract.weeksRemaining, weeklyWage: 0, commissionRate: officeCommissionRate(state) };
    const commission = Math.round(team.prestige * 400);
    state.agency.money += commission;
    recordTransaction(state, "pro-commission", `Passage pro — ${driver.name}`, commission);
  }

  return { ok: true };
}

// Closes out a driver's time with their current team as a standalone "Historique" row before
// they move on — without this, a mid-season team change would only ever leave the LAST team's
// stats in the season-end summary, silently losing every race raced with the team(s) before
// it. Called from both assignSeat (driver actively changes team) and simulate.js's contract
// expiry path (driver loses their seat without immediately picking up a new one).
export function recordSeasonStint(state, driver) {
  if (driver.teamId == null) return;
  const oldTeam = findTeamById(state, driver.teamId);
  const standingsKey = oldTeam?.subClass ? `${driver.categoryId}:${oldTeam.subClass}` : driver.categoryId;
  const standings = state.standings[standingsKey];
  const seasonResults = standings
    ? driver.careerResults.filter((r) => r.categoryId === driver.categoryId).slice(-standings.race)
    : [];
  const stintResults = seasonResults.filter((r) => r.teamId === driver.teamId);
  if (stintResults.length === 0) return;

  const rating = overallRating(driver);
  // Mirrors driverStats.js's driverMarketValue formula — duplicated here (not imported) to
  // avoid a team.js -> driverStats.js -> team.js circular import (driverStats.js already
  // imports findTeamById from this file).
  const ageFactor = driver.age <= 23 ? 1.3 : driver.age <= 28 ? 1.1 : driver.age <= 32 ? 0.9 : 0.6;
  const value = Math.round((rating * 500 + driver.potential * 300) * ageFactor);

  driver.seasonHistory.push({
    seasonNumber: standings?.seasonNumber ?? 1,
    categoryId: driver.categoryId,
    classId: oldTeam?.subClass ?? null,
    teamName: oldTeam ? oldTeam.name : "Écurie précédente",
    rating: Math.round(rating),
    value,
    races: stintResults.length,
    wins: stintResults.filter((r) => !r.dnf && r.position === 1).length,
    podiums: stintResults.filter((r) => !r.dnf && r.position <= 3).length,
    championshipPosition: null,
  });
}

export function assignSeat(state, driverId, teamId, rng, { force = false, allowDowngrade = false } = {}) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };

  const team = findTeamById(state, teamId);
  if (!team) return { ok: false, error: "Écurie introuvable." };

  const category = CATEGORY_BY_ID[team.categoryId];
  if (!force && category.id !== driver.categoryId && category.repRequired > state.agency.reputation) {
    return { ok: false, error: "Réputation insuffisante pour cette catégorie." };
  }
  if (!force && !allowDowngrade && category.tier < (driver.highestTierReached ?? 0)) {
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

  const cost = force ? 0 : Math.round(teamSeatCost(team, occupant) * (1 - negotiationDiscount(state)));
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };

  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "seat-cost", `${team.name} — ${driver.name}`, -cost);
  }
  if (occupant) delete state.aiDrivers[occupant.id];

  releaseSeatAndBackfill(state, driverId, rng);

  if (driver.teamId !== team.id) {
    recordSeasonStint(state, driver);
    driver.teamRelationship = 60;
  }
  const wasBenched = driver.teamId == null;
  team.seats[seatIndex].driverId = driverId;
  driver.teamId = team.id;
  driver.categoryId = team.categoryId;
  // Genuinely stepping up a tier for the first time (not a lateral move or a return to a tier
  // already raced) — raw karting-honed skill doesn't transfer 1:1 to F1, so the driver
  // underperforms their real rating for a while (tierAdaptationFactor, driver.js/simulate.js)
  // rather than being instantly as competitive as someone who's actually raced at this level.
  if (category.tier > (driver.highestTierReached ?? 0)) {
    driver.adaptationWeeksRemaining = TIER_ADAPTATION_WEEKS;
  }
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
    // An existing agency contract was negotiated under amateur terms (weeklyWage, no
    // commission) — convert it to pro terms (commission, no wage) so promotion doesn't
    // silently leave a 0% commission in effect until the next renegotiation.
    if (driver.contract) driver.contract = { weeksRemaining: driver.contract.weeksRemaining, weeklyWage: 0, commissionRate: officeCommissionRate(state) };
    const commission = Math.round(team.prestige * 400);
    state.agency.money += commission;
    recordTransaction(state, "pro-commission", `Passage pro — ${driver.name}`, commission);
  }

  return { ok: true };
}

// Dev-only: force a driver into the first available team seat (its current category first,
// then the next ones up), bypassing reputation/tier gating and seat cost via assignSeat's
// force flag — for quickly testing team-dependent features without a real negotiation.
export function devForceTeamContract(state, driverId, rng) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };

  const categories = driver.categoryId
    ? [CATEGORY_BY_ID[driver.categoryId], ...nextCategories(driver.categoryId)]
    : nextCategories(null);

  for (const category of categories) {
    if (!category) continue;
    for (const team of state.teams[category.id]) {
      const result = assignSeat(state, driverId, team.id, rng, { force: true });
      if (result.ok) return result;
    }
  }
  return { ok: false, error: "Aucune écurie disponible pour ce pilote." };
}
