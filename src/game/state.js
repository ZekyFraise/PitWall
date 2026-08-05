import { CATEGORIES, CATEGORY_BY_ID, RIVAL_AGENCIES, AGENCY_SPECIALTIES, SEASON_WEEKS, weekInSeason, isMercatoWindow } from "./data.js";
import { generateDriver, overallRating } from "./driver.js";
import { generateAllTeams, benchDriver } from "./team.js";
import { driverMarketValue } from "./driverStats.js";
import {
  refillStaffPool,
  seedWorldStaff,
  averageScoutSkill,
  averagePrecisionSkill,
  negotiationDiscount,
  scoutCost,
  deepScoutCost,
} from "./staff.js";
import { rosterCapacity, officeCommissionRate, scoutPoolCapacity, effectiveScoutSkills, getFacilityLevelData } from "./infrastructure.js";
import { recordTransaction } from "./finance.js";
import { mulberry32 } from "./rng.js";
import { generateScoutReveal, generateStaffScoutReveal, shuffledRevealKeys, randomWidth, SCOUT_REVEAL_KEYS } from "./scoutReveal.js";
import { refillSponsorPool } from "./sponsors.js";
import { generateAcademies, maybeTagAcademyProspect, academySignSurchargeFactor, onAcademyProspectSigned } from "./academies.js";

const SAVE_PREFIX = "pit-wall-save-";
const LAST_SLOT_KEY = "pit-wall-last-slot";
const DEEP_SCOUT_COOLDOWN_WEEKS = 2;
const SIGN_BASE_COST = 3000;
const SCOUT_SEARCH_WEEKS = 3;
let nextSearchId = 1;
export const SCHEMA_VERSION = 30;

export function createNewGame(slotId, agencyName = "Nouvelle Agence", color = "#ff3b30", seed = Date.now() | 0, specialtyId = null) {
  const rng = mulberry32(seed);
  const { teams, aiDrivers } = generateAllTeams(rng);
  const state = {
    schemaVersion: SCHEMA_VERSION,
    slotId,
    saveName: null,
    seed,
    week: 1,
    agency: { name: agencyName, money: 50000, reputation: 0, color, loan: null, specialtyId: specialtyId ?? null },
    drivers: [],
    aiDrivers,
    teams,
    standings: {},
    rivalAgencies: RIVAL_AGENCIES.map((a) => ({ ...a, reputation: 10 })),
    staff: [],
    staffPool: [],
    scoutPool: [],
    sponsorPool: [],
    activeSponsor: null,
    investments: {},
    agencyTeamRelationships: {},
    academies: [],
    academyRelationships: {},
    academyFundCooldowns: {},
    shopCooldowns: {},
    seasonRepBonusApplied: {},
    scoutSearches: [],
    newTalentsThisWeek: 0,
    log: [],
    championsHistory: [],
    transactions: [],
    financeHistory: [],
    infrastructure: { offices: 1, training: 1, prestige: 1, recruiterQuality: 1, contactNetwork: 1 },
    lifestyle: { house: 1, car: 1, education: 1 },
    purchasedUpgrades: [],
    deepScoutCooldownWeeks: 0,
    eventCooldowns: {},
    // Dismissible "Premiers pas" checklist (Mes pilotes) — each flag flips true the first time
    // the player performs that action (set from main.js, the only layer that sees every
    // action's result), never reset. dismissed lets the player hide it permanently even before
    // completing every step.
    tutorial: { scouted: false, signed: false, proposed: false, simulated: false, dismissed: false },
    ui: { activeMenu: "mes-pilotes", mondeExpanded: false, focusedCategoryId: CATEGORIES[0].id, viewingDriverId: null },
  };
  const specialty = AGENCY_SPECIALTIES.find((s) => s.id === specialtyId);
  if (specialty?.facilityId) state.infrastructure[specialty.facilityId] = 2;
  state.academies = generateAcademies(rng, teams);
  seedWorldStaff(state, rng);
  refillStaffPool(state, rng);
  refillScoutPool(state, rng);
  refillSponsorPool(state, rng);
  return state;
}

export function makeRng(state) {
  return mulberry32((state.seed + state.week * 7919) | 0);
}

// Higher "Qualité des recruteurs" + averageScoutSkill (staff primary skill) give a prospect a
// chance to arrive with its potential already known — independent of (and in addition to) the
// normal deep-scout path, which is unchanged.
function rollPotentialAlreadyKnown(rng, recruiterQualityLevel, scoutSkill) {
  const chance = clamp(0.05 + recruiterQualityLevel * 0.05 + (scoutSkill / 99) * 0.15, 0, 0.5);
  return rng() < chance;
}

// A free-agent prospect above debut age (refillScoutPool's occasional 20-33 roll) shouldn't
// read as if this is their first-ever season — they've plausibly already raced somewhere.
// Backdated seasons walk a simple monoplace ladder (karting→F4→F3, capped at F3/tier 2 — a
// free agent nobody's kept on staff plausibly never broke into the pro tiers above that),
// each one using a REAL existing team from that category so the team name is never invented,
// only the fact that this driver used to be on its roster. Scoped deliberately: this backfills
// driver.seasonHistory (their own fiche) and highestTierReached (so they're offered the right
// tier immediately) — it does NOT touch state.seasonArchive, so the fabricated seasons won't
// appear if you browse that team/category's archived standings directly (that would require
// fabricating an entire plausible grid of opponents, not just one driver's own row).
const CAREER_LADDER = ["karting", "f4", "f3"];
const CAREER_START_AGE = 16;

function fabricatePriorCareer(state, rng, driver) {
  if (driver.age <= 19) return;
  const finalTierIndex = clamp(Math.floor((driver.age - 18) / 5), 0, CAREER_LADDER.length - 1);
  const maxPlausibleSeasons = clamp(driver.age - CAREER_START_AGE, 1, 6);
  const seasonCount = Math.min(maxPlausibleSeasons, 1 + Math.floor(rng() * 3));
  const startTierIndex = Math.max(0, finalTierIndex - (seasonCount - 1));

  driver.highestTierReached = Math.max(driver.highestTierReached ?? 0, finalTierIndex);

  const seasons = [];
  for (let i = 0; i < seasonCount; i++) {
    const tierIndex = Math.min(finalTierIndex, startTierIndex + i);
    const categoryId = CAREER_LADDER[tierIndex];
    const category = CATEGORY_BY_ID[categoryId];
    const teams = state.teams[categoryId] ?? [];
    if (teams.length === 0) continue;
    const team = teams[Math.floor(rng() * teams.length)];
    const gridSize = category.gridSize ?? 20;
    const position = 1 + Math.floor(rng() * gridSize);
    const races = category.roundCount;
    const wins = position <= 3 ? Math.round(rng() * 2) : 0;
    const podiums = position <= 10 ? wins + Math.round(rng() * 2) : 0;

    const yearsAgo = seasonCount - i;
    const pastAge = driver.age - yearsAgo;
    const pastRating = clamp(Math.round(overallRating(driver) - yearsAgo * (3 + rng() * 4)), 20, 90);
    const ageFactor = pastAge <= 23 ? 1.3 : pastAge <= 28 ? 1.1 : pastAge <= 32 ? 0.9 : 0.6;
    const value = Math.round((pastRating * 500 + driver.potential * 300) * ageFactor);

    seasons.push({
      seasonNumber: -yearsAgo,
      categoryId,
      classId: null,
      teamName: team.name,
      rating: pastRating,
      value,
      races,
      wins,
      podiums,
      championshipPosition: position,
    });
  }
  driver.seasonHistory = seasons;
}

function pushScoutedProspect(state, rng, discovery, qualityFloor, recruiterQualityLevel, ageRange = {}) {
  const driver = generateDriver(rng, { scoutSkill: discovery + qualityFloor, ...ageRange });
  if (rollPotentialAlreadyKnown(rng, recruiterQualityLevel, averageScoutSkill(state))) {
    driver.scoutReveal = { attributeWidths: {}, potentialKnown: true, priceKnown: false, traitsKnown: false };
  }
  maybeTagAcademyProspect(state, rng, driver);
  fabricatePriorCareer(state, rng, driver);
  state.scoutPool.push(driver);
  state.newTalentsThisWeek = (state.newTalentsThisWeek ?? 0) + 1;
}

// Refills only at mercato windows now (isMercatoWindow) — recruiters used to keep finding new
// prospects every single week, which made the vivier feel bottomless. Capacity/quality now come
// from the "Qualité des recruteurs" infra instead of raw staff headcount (staff.js) — hired
// recruiters remain useful as a modifier on discovery/precision (effectiveScoutSkills), just not
// as the primary driver of how many prospects show up.
export function refillScoutPool(state, rng) {
  if (!isMercatoWindow(weekInSeason(state.week))) return;
  const capacity = scoutPoolCapacity(state);
  const recruiterQualityLevel = state.infrastructure.recruiterQuality;
  const { discovery } = effectiveScoutSkills(state);
  const qualityFloor = getFacilityLevelData(state, "recruiterQuality").qualityFloorBonus;
  while (state.scoutPool.length < capacity) {
    // Most finds are raw young talent (generateDriver's own 16-19 default), but recruiters
    // occasionally turn up an older, already-experienced free agent instead — variety beyond
    // "every prospect is a teenager with everything still ahead of them".
    const ageRange = rng() < 0.25 ? { minAge: 20, maxAge: 33 } : {};
    pushScoutedProspect(state, rng, discovery, qualityFloor, recruiterQualityLevel, ageRange);
  }
}

// On-demand search — unlike the passive mercato refill, this can be triggered any week, costs
// money up front, and takes a few weeks to resolve (state.scoutSearches, resolved in
// resolveScoutSearches below). Cost scales with the "Qualité des recruteurs" level since the
// result inherits that level's characteristics (same as the passive path).
export function scoutSearchCost(state) {
  return 8000 + state.infrastructure.recruiterQuality * 4000;
}

export function requestScoutSearch(state, { force = false } = {}) {
  const cost = force ? 0 : scoutSearchCost(state);
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };
  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "scout-search", "Recherche de pilote à la demande", -cost);
  }
  state.scoutSearches.push({ id: nextSearchId++, resolvesAtWeek: state.week + SCOUT_SEARCH_WEEKS });
  return { ok: true };
}

// Resolves any on-demand searches whose delay has elapsed — exempt from scoutPoolCapacity since
// it's a paid, targeted action, not the passive top-up. Returns log entries the same way
// tickScoutPoolPoaching/tickFreeAgentPoaching (rivals.js) do, for runWeekBody to collect.
export function resolveScoutSearches(state, rng) {
  const entries = [];
  const resolved = state.scoutSearches.filter((s) => state.week >= s.resolvesAtWeek);
  if (resolved.length === 0) return entries;
  state.scoutSearches = state.scoutSearches.filter((s) => state.week < s.resolvesAtWeek);
  const recruiterQualityLevel = state.infrastructure.recruiterQuality;
  const { discovery } = effectiveScoutSkills(state);
  const qualityFloor = getFacilityLevelData(state, "recruiterQuality").qualityFloorBonus;
  for (const search of resolved) {
    const before = state.scoutPool.length;
    pushScoutedProspect(state, rng, discovery, qualityFloor, recruiterQualityLevel);
    const driver = state.scoutPool[before];
    entries.push({ type: "scout-search-result", driverName: driver.name });
  }
  return entries;
}

// Moved from staff.js so it can read effectiveScoutSkills (infrastructure.js) without creating
// a circular import — infrastructure.js already depends on staff.js for bestSkill/etc.
export function autoRevealCandidates(state, rng) {
  let remaining = state.staff.filter((s) => s.role === "recruiter").length;
  const unscouted = state.scoutPool.filter((d) => !d.scouted);
  const { discovery, precision } = effectiveScoutSkills(state);
  while (remaining > 0 && unscouted.length > 0) {
    const idx = Math.floor(rng() * unscouted.length);
    const driver = unscouted[idx];
    driver.scouted = true;
    driver.scoutReveal = generateScoutReveal(rng, discovery, precision);
    unscouted.splice(idx, 1);
    remaining -= 1;
  }

  // Additive, not substitutive — recruiters keep revealing exactly one driver each as above, and
  // separately have a per-head chance to also reveal a staff candidate this week, so passive
  // driver discovery never regresses now that staff shares the same recruiters.
  const recruiterCount = state.staff.filter((s) => s.role === "recruiter").length;
  const unscoutedStaff = state.staffPool.filter((s) => !s.scouted);
  for (let i = 0; i < recruiterCount && unscoutedStaff.length > 0; i++) {
    if (rng() >= 0.3) continue;
    const idx = Math.floor(rng() * unscoutedStaff.length);
    const member = unscoutedStaff[idx];
    member.scouted = true;
    member.scoutReveal = generateStaffScoutReveal(rng, discovery, precision);
    unscoutedStaff.splice(idx, 1);
  }
}

// Deep scout's minimum/bonus are set higher so it always surfaces a meaningful batch of new
// traits on top of whatever the basic pass already found.
const DEEP_SCOUT_MIN_ADDED = 4;
const DEEP_SCOUT_MIN_TOTAL = 8;
const DEEP_SCOUT_FORCE_BONUS = 16;
// Deep scout doesn't guarantee a tighter window on characteristics it already knew about —
// each one has a chance (better with recruiter precision) to actually get refined.
const REFINE_CHANCE_MIN = 0.35;
const REFINE_CHANCE_BONUS = 0.5;

export function scoutDriver(state, driverId, { force = false } = {}) {
  const driver = state.scoutPool.find((d) => d.id === driverId);
  if (!driver || driver.scouted) return false;
  const cost = force ? 0 : scoutCost(state);
  if (!force && state.agency.money < cost) return false;
  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "scout", `Scouting — ${driver.name}`, -cost);
  }
  driver.scouted = true;

  const rng = makeRng(state);
  const { discovery, precision } = effectiveScoutSkills(state);
  driver.scoutReveal = generateScoutReveal(rng, discovery, precision);
  return true;
}

// Same reveal mechanic as scoutDriver, but for an AI/rival driver encountered via their
// read-only fiche (Monde ▸ Pilotes / Classement) rather than the scout pool — a driver never
// signed by the player's agency stays masked (attributes/super stats/traits) until scouted here.
export function scoutRivalDriver(state, driverId, { force = false } = {}) {
  const driver = state.aiDrivers[driverId];
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  if (driver.scouted) return { ok: false, error: "Ce pilote est déjà scouté." };
  const cost = force ? 0 : scoutCost(state);
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };
  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "scout", `Scouting — ${driver.name}`, -cost);
  }
  driver.scouted = true;

  const rng = makeRng(state);
  const { discovery, precision } = effectiveScoutSkills(state);
  driver.scoutReveal = generateScoutReveal(rng, discovery, precision);
  return { ok: true };
}

// Same deep-scout mechanic as deepScoutDriver below, but for an AI/rival driver (state.aiDrivers)
// reached from their read-only fiche or the Championnats standings — mirrors how scoutRivalDriver
// mirrors scoutDriver for the basic pass.
export function deepScoutRivalDriver(state, driverId, { force = false } = {}) {
  const driver = state.aiDrivers[driverId];
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  if (!driver.scouted) return { ok: false, error: "Il faut d'abord scouter ce pilote." };
  const cost = force ? 0 : deepScoutCost(state);
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };

  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "scout", `Scouting approfondi — ${driver.name}`, -cost);
  }

  const rng = makeRng(state);
  const { discovery: discoverySkill, precision: precisionSkill } = effectiveScoutSkills(state);
  const attributeWidths = { ...(driver.scoutReveal?.attributeWidths ?? {}) };
  const maxDeepWidth = clamp(20 - (precisionSkill / 99) * 18, 2, 20);
  const refineChance = clamp(REFINE_CHANCE_MIN + (precisionSkill / 99) * REFINE_CHANCE_BONUS, REFINE_CHANCE_MIN, REFINE_CHANCE_MIN + REFINE_CHANCE_BONUS);
  for (const key of Object.keys(attributeWidths)) {
    if (rng() < refineChance) {
      attributeWidths[key] = Math.min(attributeWidths[key], randomWidth(rng, 2, maxDeepWidth));
    }
  }

  const computedTarget = Math.round(
    clamp(DEEP_SCOUT_MIN_TOTAL + (discoverySkill / 99) * DEEP_SCOUT_FORCE_BONUS, DEEP_SCOUT_MIN_TOTAL, SCOUT_REVEAL_KEYS.length)
  );
  const revealedCount = Object.keys(attributeWidths).length;
  const targetCount = Math.min(SCOUT_REVEAL_KEYS.length, Math.max(revealedCount + DEEP_SCOUT_MIN_ADDED, computedTarget));
  const missing = shuffledRevealKeys(rng).filter((key) => !(key in attributeWidths));
  missing.slice(0, targetCount - revealedCount).forEach((key) => (attributeWidths[key] = randomWidth(rng, 2, maxDeepWidth)));

  driver.scoutReveal = {
    attributeWidths,
    potentialKnown: true,
    priceKnown: true,
    traitsKnown: true,
  };
  state.deepScoutCooldownWeeks = DEEP_SCOUT_COOLDOWN_WEEKS;
  return { ok: true };
}

// Deep scout requires a prior basic scout — it sharpens the windows already uncovered
// (narrower per-characteristic width, never wider) and digs out further individual traits
// beyond what the basic pass found, rather than instantly revealing everything at once. Both
// the narrowing and the extra discovery scale with recruiter force, at a cost that scales too.
export function deepScoutDriver(state, driverId, { force = false } = {}) {
  const driver = state.scoutPool.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  if (!driver.scouted) return { ok: false, error: "Il faut d'abord scouter ce pilote." };
  const cost = force ? 0 : deepScoutCost(state);
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };

  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "scout", `Scouting approfondi — ${driver.name}`, -cost);
  }

  const rng = makeRng(state);
  const { discovery: discoverySkill, precision: precisionSkill } = effectiveScoutSkills(state);
  const attributeWidths = { ...(driver.scoutReveal?.attributeWidths ?? {}) };
  const maxDeepWidth = clamp(20 - (precisionSkill / 99) * 18, 2, 20);
  const refineChance = clamp(REFINE_CHANCE_MIN + (precisionSkill / 99) * REFINE_CHANCE_BONUS, REFINE_CHANCE_MIN, REFINE_CHANCE_MIN + REFINE_CHANCE_BONUS);
  for (const key of Object.keys(attributeWidths)) {
    if (rng() < refineChance) {
      attributeWidths[key] = Math.min(attributeWidths[key], randomWidth(rng, 2, maxDeepWidth));
    }
  }

  const computedTarget = Math.round(
    clamp(DEEP_SCOUT_MIN_TOTAL + (discoverySkill / 99) * DEEP_SCOUT_FORCE_BONUS, DEEP_SCOUT_MIN_TOTAL, SCOUT_REVEAL_KEYS.length)
  );
  const revealedCount = Object.keys(attributeWidths).length;
  const targetCount = Math.min(SCOUT_REVEAL_KEYS.length, Math.max(revealedCount + DEEP_SCOUT_MIN_ADDED, computedTarget));
  const missing = shuffledRevealKeys(rng).filter((key) => !(key in attributeWidths));
  missing.slice(0, targetCount - revealedCount).forEach((key) => (attributeWidths[key] = randomWidth(rng, 2, maxDeepWidth)));

  driver.scoutReveal = {
    attributeWidths,
    potentialKnown: true,
    priceKnown: true,
    traitsKnown: true,
  };
  state.deepScoutCooldownWeeks = DEEP_SCOUT_COOLDOWN_WEEKS;
  return { ok: true };
}

// Staff scouting mirrors scoutDriver/deepScoutDriver above, cheaper since the reveal surface is
// far smaller (4 skills, always all revealed at once — see generateStaffScoutReveal).
export function staffScoutCost(state) {
  return Math.round(300 + averageScoutSkill(state) * 4);
}

export function staffDeepScoutCost(state) {
  return Math.round(1200 + averageScoutSkill(state) * 8);
}

export function scoutStaff(state, staffId, { force = false } = {}) {
  const member = state.staffPool.find((s) => s.id === staffId);
  if (!member) return { ok: false, error: "Membre du staff introuvable." };
  if (member.scouted) return { ok: false, error: "Ce membre du staff est déjà scouté." };
  const cost = force ? 0 : staffScoutCost(state);
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };
  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "scout", `Scouting — ${member.name}`, -cost);
  }
  member.scouted = true;

  const rng = makeRng(state);
  const { discovery, precision } = effectiveScoutSkills(state);
  member.scoutReveal = generateStaffScoutReveal(rng, discovery, precision);
  return { ok: true };
}

// Same shared recruiter-attention cooldown as deepScoutDriver (state.deepScoutCooldownWeeks) —
// recruiters already do double duty on drivers and staff, so deep-scouting either one distracts
// them from passively revealing anything for the same 2 weeks.
export function deepScoutStaff(state, staffId, { force = false } = {}) {
  const member = state.staffPool.find((s) => s.id === staffId);
  if (!member) return { ok: false, error: "Membre du staff introuvable." };
  if (!member.scouted) return { ok: false, error: "Il faut d'abord scouter ce membre du staff." };
  const cost = force ? 0 : staffDeepScoutCost(state);
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };
  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "scout", `Scouting approfondi — ${member.name}`, -cost);
  }

  const rng = makeRng(state);
  const { precision: precisionSkill } = effectiveScoutSkills(state);
  const maxDeepWidth = clamp(20 - (precisionSkill / 99) * 18, 2, 20);
  const attributeWidths = { ...(member.scoutReveal?.attributeWidths ?? {}) };
  for (const key of Object.keys(attributeWidths)) {
    attributeWidths[key] = Math.min(attributeWidths[key], randomWidth(rng, 2, maxDeepWidth));
  }
  member.scoutReveal = { attributeWidths, traitsKnown: true };
  state.deepScoutCooldownWeeks = DEEP_SCOUT_COOLDOWN_WEEKS;
  return { ok: true };
}

// An agency with zero drivers has no income and no other lever to recruit again
// (negotiateSigning still requires money >= offer) — a steep discount here is the actual
// recovery path, symmetrical to takeLoan's own reconstruction exception below.
const RECONSTRUCTION_DISCOUNT_FACTOR = 0.5;

export function signCost(state, driver) {
  const base = SIGN_BASE_COST + driver.potential * 400 + (driver.scouted ? 0 : 1500);
  const reconstructionFactor = state.drivers.length === 0 ? RECONSTRUCTION_DISCOUNT_FACTOR : 1;
  return Math.round(base * (1 - negotiationDiscount(state)) * academySignSurchargeFactor(state, driver) * reconstructionFactor);
}

// Pre-signature display range around the real signCost — mirrors how attribute stats are
// shown as a range until scouted more precisely. Width narrows with recruiter precision.
export function signCostRange(state, driver) {
  const cost = signCost(state, driver);
  const { precision: precisionSkill } = effectiveScoutSkills(state);
  const width = Math.max(0.08, Math.min(0.4, 0.4 - (precisionSkill / 99) * 0.32));
  const low = Math.max(0, Math.round((cost * (1 - width / 2)) / 100) * 100);
  const high = Math.round((cost * (1 + width / 2)) / 100) * 100;
  return { low, high };
}

// Shared by signDriver (instant/dev-force path) and negotiateSigning (the real negotiated
// path) — moves the prospect from scoutPool to drivers and sets up their first agency
// contract, whatever the agreed price ended up being (0 for a forced/free signing).
// /60 (nerfé depuis /40 sur demande explicite — cible : 2e pilote finançable en saison 2-3,
// pas en une demi-saison) : les frais de gestion amateurs seuls ne suffisent plus à
// rentabiliser une signature rapidement, les primes de course/dilemmes restent le principal
// moteur pour un pilote performant.
// A fresh signing starts with one season's worth of agency-contract duration (in weeks — see
// negotiateContract). categoryId stays null until they actually land a seat (assignSeat), so
// the UI doesn't claim they're competing somewhere before they've ever raced;
// listJoinableTeams/nextCategories already treat a null categoryId as "start from tier 0" —
// unless fabricatePriorCareer already raised highestTierReached, in which case they start from
// wherever their backstory left off instead.
function finalizeSigning(state, idx, cost) {
  const driver = state.scoutPool[idx];
  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "sign-driver", `Signature — ${driver.name}`, -cost);
  }
  driver.contract = { weeksRemaining: SEASON_WEEKS, weeklyWage: Math.round(cost / 60), commissionRate: officeCommissionRate(state) };
  driver.categoryId = null;
  driver.teamId = null;
  driver.weeksWithoutContract = 0;
  state.scoutPool.splice(idx, 1);
  state.drivers.push(driver);
  onAcademyProspectSigned(state, driver);
  return { ok: true, driver };
}

// Instant, flat-cost signing — kept for the dev-mode force path only (dev-force-sign, main.js).
// A real player action now goes through negotiateSigning instead (see below).
export function signDriver(state, driverId, { force = false } = {}) {
  const idx = state.scoutPool.findIndex((d) => d.id === driverId);
  if (idx === -1) return { ok: false, error: "Pilote introuvable." };
  if (!force && state.drivers.length >= rosterCapacity(state)) {
    return { ok: false, error: "Effectif complet — améliore tes bureaux pour recruter davantage." };
  }
  const driver = state.scoutPool[idx];
  const cost = force ? 0 : signCost(state, driver);
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };
  return finalizeSigning(state, idx, cost);
}

// Negotiated signing — the offer is a real proposal, not a fixed price: too far below signCost
// and the prospect turns it down (with a counter-offer suggestion the player can act on),
// comfortably at or above it and acceptance is close to certain. Deterministic acceptance
// curve like negotiateContract (state.js), not a fixed threshold, using the same makeRng(state)
// convention rather than requiring the caller to thread an rng through.
export function negotiateSigning(state, driverId, offer, { force = false } = {}) {
  const idx = state.scoutPool.findIndex((d) => d.id === driverId);
  if (idx === -1) return { ok: false, error: "Pilote introuvable." };
  if (!force && state.drivers.length >= rosterCapacity(state)) {
    return { ok: false, error: "Effectif complet — améliore tes bureaux pour recruter davantage." };
  }
  if (force) return finalizeSigning(state, idx, 0);

  const driver = state.scoutPool[idx];
  const baseline = signCost(state, driver);
  offer = Math.max(0, Math.round(offer ?? baseline));
  if (state.agency.money < offer) return { ok: false, error: "Budget insuffisant pour cette offre." };

  const generosity = offer / Math.max(1, baseline);
  const acceptChance = clamp(0.75 + (generosity - 1) * 1.2, 0.05, 0.97);
  const rng = makeRng(state);
  if (rng() >= acceptChance) {
    const counterOffer = Math.round((baseline * clamp(1 + (1 - generosity) * 0.6, 1, 1.8)) / 100) * 100;
    return {
      ok: false,
      error: `${driver.name} juge cette offre insuffisante — ${driver.sex === "F" ? "elle" : "il"} demanderait plutôt ${counterOffer.toLocaleString("fr-FR")}€.`,
      counterOffer,
    };
  }
  return finalizeSigning(state, idx, offer);
}

// Dev-only cheats, gated behind state.ui.devMode in the UI — deliberately bypass every
// normal guard (budget, roster capacity, scouting) since they exist purely for fast manual
// testing, not for the player to use in a real playthrough.
export function devAddMoney(state, amount) {
  state.agency.money += amount;
  recordTransaction(state, "dev-tool", "Développeur — argent ajouté", amount);
}

export function devAddReputation(state, amount) {
  state.agency.reputation = Math.max(0, state.agency.reputation + amount);
}

// Dev-only: force an agency contract onto a driver who doesn't have one yet, using the
// baseline salary and negotiateContract's own force flag to guarantee acceptance at zero
// upfront cost — mirrors devForceTeamContract in team.js for the écurie side.
export function devForceAgencyContract(state, driverId) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  const baseline = contractBaseline(state, driver);
  return negotiateContract(
    state,
    driverId,
    { weeklyWage: baseline.weeklyWage, transferFee: 0, commissionRate: baseline.commissionRate, seasons: 1 },
    { force: true }
  );
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const NEGOTIATION_TOLERANCE = 0.25;

// Baseline terms plus an indicative acceptable window (± tolerance) — the window lets the UI
// show the player a realistic target instead of negotiating blind.
export function contractBaseline(state, driver) {
  const base = 2000 + driver.potential * 150;
  const weeklyWage = Math.round((base / 20) * (1 - negotiationDiscount(state)));
  const transferFee = Math.round(base * (1 - negotiationDiscount(state)));
  const commissionRate = clamp(officeCommissionRate(state) * (1 + negotiationDiscount(state) * 0.3), 0.05, 0.6);
  return {
    weeklyWage,
    transferFee,
    commissionRate,
    weeklyWageWindow: {
      min: Math.round((weeklyWage * (1 - NEGOTIATION_TOLERANCE)) / 10) * 10,
      max: Math.round((weeklyWage * (1 + NEGOTIATION_TOLERANCE)) / 10) * 10,
    },
    commissionWindow: {
      min: Math.round(commissionRate * (1 - NEGOTIATION_TOLERANCE) * 100) / 100,
      max: Math.round(commissionRate * (1 + NEGOTIATION_TOLERANCE) * 100) / 100,
    },
  };
}

// A driver in poor relationship or worn down on patience holds out for tougher terms than the
// neutral baseline; one who still trusts the agency and hasn't been ground down settles for
// terms close to (or even under) that baseline. Reuses contractBaseline rather than a second
// cost formula.
function counterOfferDemandFactor(driver) {
  const relationshipTerm = (50 - (driver.agencyRelationship ?? 100)) / 150;
  const patienceTerm = (100 - (driver.negotiationPatience ?? 100)) / 200;
  return clamp(1 + relationshipTerm + patienceTerm, 0.7, 1.6);
}

function buildCounterOffer(driver, baseline) {
  const demand = counterOfferDemandFactor(driver);
  return driver.isPro
    ? { commissionRate: Math.round(clamp(baseline.commissionRate / demand, 0.01, 0.9) * 1000) / 1000 }
    : { weeklyWage: Math.round(baseline.weeklyWage / demand), transferFee: Math.round(baseline.transferFee * demand) };
}

// Agence contract: salaire/frais (amateur) OU commission négociée (pro), durée en SEMAINES
// (indépendante des courses disputées — voir simulate.js), avec patience et engagement
// pluriannuel. Distinct du baquet écurie, qui expire désormais à la fin de saison
// (rolloverIfNeeded, standings.js), pas ici.
export function negotiateContract(state, driverId, { weeklyWage, transferFee, commissionRate, seasons = 1, installments = 1 }, { force = false } = {}) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  seasons = clamp(Math.round(seasons) || 1, 1, 5);
  const baseline = contractBaseline(state, driver);
  const installmentCount = force ? 1 : clamp(Math.round(installments) || 1, 1, 6);

  let generosity;
  let firstPayment = 0;
  transferFee = force ? 0 : Math.max(0, Math.round(transferFee ?? 0));
  if (driver.isPro) {
    // Un taux de commission plus BAS est plus généreux pour le pilote (il garde plus de ses gains).
    commissionRate = clamp(Number(commissionRate) || baseline.commissionRate, 0.01, 0.9);
    generosity = baseline.commissionRate / Math.max(0.01, commissionRate);
  } else {
    weeklyWage = Math.max(0, Math.round(weeklyWage ?? 0));
    firstPayment = Math.ceil(transferFee / installmentCount);
    if (!force && state.agency.money < firstPayment) {
      return {
        ok: false,
        error: `${installmentCount > 1 ? `Premier versement (${firstPayment.toLocaleString("fr-FR")}€)` : `Indemnité de transfert (${transferFee.toLocaleString("fr-FR")}€)`} supérieur à ta trésorerie (${state.agency.money.toLocaleString("fr-FR")}€) — étale-la sur plus de versements ou baisse le montant.`,
      };
    }
    // Un amateur PAIE des frais de gestion à l'agence (moins = généreux) — inverse d'un pro. La
    // générosité perçue reste basée sur le montant TOTAL de l'indemnité, pas sur son étalement —
    // étaler est un lissage de trésorerie côté agence, pas un levier de négociation. Le poids de
    // l'indemnité est réduit (0.25 contre 0.75 au salaire) : un renouvellement ne devrait pas
    // dépendre d'un gros paiement cash ponctuel autant que d'un salaire correct dans la durée.
    const wageGenerosity = baseline.weeklyWage / Math.max(1, weeklyWage);
    generosity = wageGenerosity * 0.75 + (transferFee / Math.max(1, baseline.transferFee)) * 0.25;
  }

  const commitmentBonus = (seasons - 1) * 0.04;
  const patienceFactor = clamp((driver.negotiationPatience ?? 100) / 100, 0.15, 1);
  const acceptChance = clamp(
    (0.3 + (generosity - 1) * 0.6 + commitmentBonus + (driver.agencyRelationship - 50) / 200) * patienceFactor,
    0.05,
    0.97
  );
  const rng = makeRng(state);

  if (!force && rng() >= acceptChance) {
    const distance = Math.abs(generosity - 1);
    driver.negotiationPatience = clamp((driver.negotiationPatience ?? 100) - Math.round(10 + distance * 40), 0, 100);
    driver.agencyRelationship = clamp(driver.agencyRelationship - 5, 0, 200);
    driver.negotiationCounterOffer = buildCounterOffer(driver, baseline);
    return { ok: false, error: `${driver.name} juge cette offre insuffisante — revois tes conditions.` };
  }

  const weeksRemaining = force
    ? 9999
    : SEASON_WEEKS - weekInSeason(state.week) + 1 + (seasons - 1) * SEASON_WEEKS;

  if (driver.isPro) {
    driver.contract = { weeksRemaining, weeklyWage: 0, commissionRate: Math.round(commissionRate * 1000) / 1000 };
  } else {
    // Garde-fou anti-exploit : les frais perçus sur un amateur sont plafonnés à 2× la base.
    const storedWage = Math.min(weeklyWage, baseline.weeklyWage * 2);
    if (transferFee) {
      state.agency.money -= firstPayment;
      recordTransaction(state, "renew-contract", `Renouvellement — ${driver.name}`, -firstPayment);
      const remaining = transferFee - firstPayment;
      driver.pendingContractInstallment = remaining > 0 ? { remaining, weeklyPayment: firstPayment } : null;
    }
    driver.contract = { weeksRemaining, weeklyWage: Math.round(storedWage), commissionRate: 0 };
  }
  driver.weeksWithoutContract = 0;
  driver.negotiationPatience = 100;
  driver.negotiationCounterOffer = null;
  driver.agencyRelationship = clamp(driver.agencyRelationship + Math.round((generosity - 1) * 10), 0, 200);
  return { ok: true };
}

// Weekly tick for a renewal indemnity spread over several payments (negotiateContract's
// installments option) — same shape/pattern as the agency-wide loan (repayLoan below), just
// scoped to one driver's pendingContractInstallment instead of state.agency.loan. A driver who
// leaves the agency (release/poach) simply stops appearing in state.drivers, so there is nothing
// extra to clean up here.
export function payDriverInstallments(state) {
  for (const driver of state.drivers) {
    const installment = driver.pendingContractInstallment;
    if (!installment) continue;
    const payment = Math.min(installment.weeklyPayment, installment.remaining);
    state.agency.money -= payment;
    recordTransaction(state, "contract-installment", `Versement — ${driver.name}`, -payment);
    installment.remaining -= payment;
    if (installment.remaining <= 0) driver.pendingContractInstallment = null;
  }
}

const RELEASE_COST_RATE = 0.15;
const RELEASE_REPUTATION_PENALTY = 1;

// Player-initiated agency contract termination ("Licencier") — distinct from poachDriverAway
// (rivals.js), which is a departure the player suffers, not chooses; hence a smaller
// reputation hit (-1 vs -2) and a cost the player pays rather than receives.
export function releaseDriver(state, driverId, rng) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  const cost = Math.round(driverMarketValue(driver) * RELEASE_COST_RATE);
  if (state.agency.money < cost) {
    return { ok: false, error: `Coût de résiliation (${cost.toLocaleString("fr-FR")}€) supérieur à ta trésorerie.` };
  }
  if (driver.teamId != null) benchDriver(state, driver.id, rng);
  state.agency.money -= cost;
  recordTransaction(state, "driver-release", `Résiliation — ${driver.name}`, -cost);
  state.agency.reputation = Math.max(0, state.agency.reputation - RELEASE_REPUTATION_PENALTY);
  state.drivers = state.drivers.filter((d) => d.id !== driver.id);
  return { ok: true };
}

export function setInvestment(state, driverId, amount) {
  state.investments[driverId] = Math.max(0, Math.round(amount));
}

// A loan is a lifeline for a near-bankrupt agency, not a growth tool — gated to when the
// treasury is already critical, and never stackable, so it can't become a free-money exploit.
export const LOAN_ELIGIBLE_THRESHOLD = 10000;
export const LOAN_MAX_AMOUNT = 30000;
// A driverless agency has no other way back into the game (negotiateSigning still needs
// money >= offer, even at the reconstruction discount above) — a higher ceiling here funds an
// actual rebuild rather than a single low-cost driver.
const LOAN_RECONSTRUCTION_MAX_AMOUNT = 60000;
const LOAN_INTEREST_RATE = 0.25;
// Durations offered to the player, in months — converted to weeks (the unit the simulation
// actually runs on) via the average month length (52/12), not a flat 4-week approximation.
export const LOAN_DURATION_MONTHS_OPTIONS = [6, 12, 18, 24, 30, 36];
const LOAN_DEFAULT_MONTHS = 12;

export function loanWeeksForMonths(months) {
  return Math.max(1, Math.round(months * (52 / 12)));
}

export function loanMaxAmount(state) {
  return state.drivers.length === 0 ? LOAN_RECONSTRUCTION_MAX_AMOUNT : LOAN_MAX_AMOUNT;
}

export function takeLoan(state, amount, months, { force = false } = {}) {
  if (state.agency.loan) {
    return { ok: false, error: "Un prêt est déjà en cours — rembourse-le avant d'en contracter un autre." };
  }
  if (!force && state.agency.money >= LOAN_ELIGIBLE_THRESHOLD) {
    return {
      ok: false,
      error: `Prêt réservé aux agences en difficulté (trésorerie sous ${LOAN_ELIGIBLE_THRESHOLD.toLocaleString("fr-FR")}€).`,
    };
  }
  amount = Math.round(clamp(amount, 0, loanMaxAmount(state)));
  if (amount <= 0) return { ok: false, error: "Montant invalide." };
  if (!force && !LOAN_DURATION_MONTHS_OPTIONS.includes(months)) {
    return { ok: false, error: "Durée de remboursement invalide." };
  }
  const weeks = loanWeeksForMonths(LOAN_DURATION_MONTHS_OPTIONS.includes(months) ? months : LOAN_DEFAULT_MONTHS);

  const totalOwed = Math.round(amount * (1 + LOAN_INTEREST_RATE));
  state.agency.loan = { totalOwed, weeklyPayment: Math.ceil(totalOwed / weeks) };
  state.agency.money += amount;
  recordTransaction(state, "loan", "Prêt contracté", amount);
  return { ok: true };
}

export function repayLoan(state) {
  if (!state.agency.loan) return;
  const payment = Math.min(state.agency.loan.weeklyPayment, state.agency.loan.totalOwed);
  state.agency.money -= payment;
  state.agency.loan.totalOwed -= payment;
  recordTransaction(state, "loan-repayment", "Remboursement du prêt", -payment);
  if (state.agency.loan.totalOwed <= 0) state.agency.loan = null;
}

function isQuotaExceededError(err) {
  return err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014);
}

// Saves from an older/newer schema can never be loaded (loadGame/listSaves reject them) —
// they're pure dead weight sitting in localStorage. Clear them out first before touching
// anything the player can actually see or load.
function pruneOrphanedSaves() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(SAVE_PREFIX)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) keysToRemove.push(key);
    } catch {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) localStorage.removeItem(key);
  return keysToRemove.length;
}

function pruneOldestValidSaves(keepSlotId, keepCount = 3) {
  const saves = listSaves().filter((s) => s.slotId !== keepSlotId);
  const toRemove = saves.slice(keepCount);
  for (const s of toRemove) deleteSave(s.slotId);
  return toRemove.length;
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_PREFIX + state.slotId, JSON.stringify(state));
    localStorage.setItem(LAST_SLOT_KEY, state.slotId);
    return true;
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      console.error("saveGame failed:", err);
      return false;
    }
    console.error("saveGame: storage quota exceeded — pruning outdated saves and retrying.", err);
    pruneOrphanedSaves();
    pruneOldestValidSaves(state.slotId);
    try {
      localStorage.setItem(SAVE_PREFIX + state.slotId, JSON.stringify(state));
      localStorage.setItem(LAST_SLOT_KEY, state.slotId);
      return true;
    } catch (err2) {
      console.error("saveGame: still failing after pruning old saves.", err2);
      return false;
    }
  }
}

export function loadGame(slotId) {
  const raw = localStorage.getItem(SAVE_PREFIX + slotId);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (!state || state.schemaVersion !== SCHEMA_VERSION) return null;
    return state;
  } catch {
    return null;
  }
}

export function getLastSlotId() {
  return localStorage.getItem(LAST_SLOT_KEY);
}

export function listSaves() {
  const saves = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(SAVE_PREFIX)) continue;
    try {
      const state = JSON.parse(localStorage.getItem(key));
      if (!state || state.schemaVersion !== SCHEMA_VERSION) continue;
      saves.push({
        slotId: key.slice(SAVE_PREFIX.length),
        agencyName: state.agency.name,
        saveName: state.saveName ?? null,
        week: state.week,
        money: state.agency.money,
      });
    } catch {
      // skip corrupt entry
    }
  }
  return saves.sort((a, b) => b.week - a.week);
}

export function deleteSave(slotId) {
  localStorage.removeItem(SAVE_PREFIX + slotId);
}

// Patches just the save's display name directly in localStorage, without needing to load the
// full game into memory first (renaming happens from the title screen's load list).
export function renameSave(slotId, newName) {
  const raw = localStorage.getItem(SAVE_PREFIX + slotId);
  if (!raw) return false;
  try {
    const state = JSON.parse(raw);
    if (!state || state.schemaVersion !== SCHEMA_VERSION) return false;
    state.saveName = newName;
    localStorage.setItem(SAVE_PREFIX + slotId, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
