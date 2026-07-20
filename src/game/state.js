import { CATEGORIES, RIVAL_AGENCIES, SEASON_WEEKS, weekInSeason, PRO_COMMISSION_RATE } from "./data.js";
import { generateDriver, ATTRIBUTE_META } from "./driver.js";
import { generateAllTeams, benchDriver } from "./team.js";
import { driverMarketValue } from "./driverStats.js";
import {
  refillStaffPool,
  seedWorldStaff,
  averageScoutSkill,
  averageDiscoverySkill,
  averagePrecisionSkill,
  scoutPoolCapacity,
  negotiationDiscount,
  scoutCost,
  deepScoutCost,
} from "./staff.js";
import { rosterCapacity } from "./infrastructure.js";
import { recordTransaction } from "./finance.js";
import { mulberry32 } from "./rng.js";

const SAVE_PREFIX = "pit-wall-save-";
const LAST_SLOT_KEY = "pit-wall-last-slot";
const DEEP_SCOUT_COOLDOWN_WEEKS = 2;
const SIGN_BASE_COST = 3000;
// Individual characteristics get discovered one at a time, at random, across the whole
// attribute list — not by whole group — since a driver's traits can vary sharply between
// each other (see generateDriver's per-attribute swing).
const SCOUT_REVEAL_KEYS = Object.keys(ATTRIBUTE_META);
export const SCHEMA_VERSION = 23;

export function createNewGame(slotId, agencyName = "Nouvelle Agence", color = "#ff3b30", seed = Date.now() | 0) {
  const rng = mulberry32(seed);
  const { teams, aiDrivers } = generateAllTeams(rng);
  const state = {
    schemaVersion: SCHEMA_VERSION,
    slotId,
    seed,
    week: 1,
    agency: { name: agencyName, money: 50000, reputation: 0, color, loan: null },
    drivers: [],
    aiDrivers,
    teams,
    standings: {},
    rivalAgencies: RIVAL_AGENCIES.map((a) => ({ ...a, reputation: 10 })),
    staff: [],
    staffPool: [],
    scoutPool: [],
    investments: {},
    log: [],
    transactions: [],
    financeHistory: [],
    infrastructure: { offices: 1, training: 1, prestige: 1 },
    purchasedUpgrades: [],
    deepScoutCooldownWeeks: 0,
    eventCooldowns: {},
    ui: { activeMenu: "mes-pilotes", mondeExpanded: false, focusedCategoryId: CATEGORIES[0].id, viewingDriverId: null },
  };
  seedWorldStaff(state, rng);
  refillStaffPool(state, rng);
  refillScoutPool(state, rng);
  return state;
}

export function makeRng(state) {
  return mulberry32((state.seed + state.week * 7919) | 0);
}

export function refillScoutPool(state, rng) {
  const capacity = scoutPoolCapacity(state);
  const scoutSkill = averageScoutSkill(state);
  while (state.scoutPool.length < capacity) {
    state.scoutPool.push(generateDriver(rng, { scoutSkill }));
  }
}

function shuffledRevealKeys(rng) {
  const arr = [...SCOUT_REVEAL_KEYS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Each revealed characteristic gets its own random window width rather than one fixed value
// for the whole pass — maxWidth (set by recruiter force) only caps how wide that roll can go.
function randomWidth(rng, minWidth, maxWidth) {
  return Math.round(minWidth + rng() * Math.max(0, maxWidth - minWidth));
}

// How many of the ~30 individual characteristics a scouting pass uncovers, scaled by
// recruiter discovery force. Deep scout's minimum/bonus are set higher so it always surfaces
// a meaningful batch of new traits on top of whatever the basic pass already found.
const SCOUT_MIN_REVEAL = 4;
const SCOUT_FORCE_BONUS = 12;
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
  const discoverySkill = averageDiscoverySkill(state);
  const precisionSkill = averagePrecisionSkill(state);
  const revealCount = Math.round(
    clamp(SCOUT_MIN_REVEAL + (discoverySkill / 99) * SCOUT_FORCE_BONUS, SCOUT_MIN_REVEAL, SCOUT_REVEAL_KEYS.length)
  );
  const maxWidth = clamp(40 - (precisionSkill / 99) * 36, 4, 40);
  const attributeWidths = {};
  shuffledRevealKeys(rng)
    .slice(0, revealCount)
    .forEach((key) => (attributeWidths[key] = randomWidth(rng, 4, maxWidth)));
  driver.scoutReveal = { attributeWidths, potentialKnown: false, priceKnown: false };
  return true;
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
  const discoverySkill = averageDiscoverySkill(state);
  const precisionSkill = averagePrecisionSkill(state);
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
  };
  state.deepScoutCooldownWeeks = DEEP_SCOUT_COOLDOWN_WEEKS;
  return { ok: true };
}

export function signCost(state, driver) {
  const base = SIGN_BASE_COST + driver.potential * 400 + (driver.scouted ? 0 : 1500);
  return Math.round(base * (1 - negotiationDiscount(state)));
}

// Pre-signature display range around the real signCost — mirrors how attribute stats are
// shown as a range until scouted more precisely. Width narrows with recruiter precision.
export function signCostRange(state, driver) {
  const cost = signCost(state, driver);
  const precisionSkill = averagePrecisionSkill(state);
  const width = Math.max(0.08, Math.min(0.4, 0.4 - (precisionSkill / 99) * 0.32));
  const low = Math.max(0, Math.round((cost * (1 - width / 2)) / 100) * 100);
  const high = Math.round((cost * (1 + width / 2)) / 100) * 100;
  return { low, high };
}

export function signDriver(state, driverId, { force = false } = {}) {
  const idx = state.scoutPool.findIndex((d) => d.id === driverId);
  if (idx === -1) return { ok: false, error: "Pilote introuvable." };
  if (!force && state.drivers.length >= rosterCapacity(state)) {
    return { ok: false, error: "Effectif complet — améliore tes bureaux pour recruter davantage." };
  }
  const driver = state.scoutPool[idx];
  const cost = force ? 0 : signCost(state, driver);
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };

  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "sign-driver", `Signature — ${driver.name}`, -cost);
  }
  // /40 : les frais de gestion amateurs rentabilisent la signature en ~2 saisons, pas en une demi-saison.
  // A fresh signing starts with one season's worth of agency-contract duration (in weeks —
  // see negotiateContract). categoryId stays null until they actually land a seat
  // (assignSeat), so the UI doesn't claim they're competing somewhere before they've ever
  // raced; listJoinableTeams/nextCategories already treat a null categoryId as "start from
  // tier 0" for matchmaking purposes.
  driver.contract = { weeksRemaining: SEASON_WEEKS, weeklyWage: Math.round(cost / 40), commissionRate: PRO_COMMISSION_RATE };
  driver.categoryId = null;
  driver.teamId = null;
  driver.weeksWithoutContract = 0;
  state.scoutPool.splice(idx, 1);
  state.drivers.push(driver);
  return { ok: true, driver };
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
  const commissionRate = clamp(PRO_COMMISSION_RATE * (1 + negotiationDiscount(state) * 0.3), 0.05, 0.6);
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

// Agence contract: salaire/frais (amateur) OU commission négociée (pro), durée en SEMAINES
// (indépendante des courses disputées — voir simulate.js), avec patience et engagement
// pluriannuel. Distinct du baquet écurie, qui expire désormais à la fin de saison
// (rolloverIfNeeded, standings.js), pas ici.
export function negotiateContract(state, driverId, { weeklyWage, transferFee, commissionRate, seasons = 1 }, { force = false } = {}) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  seasons = clamp(Math.round(seasons) || 1, 1, 5);
  const baseline = contractBaseline(state, driver);

  let generosity;
  transferFee = force ? 0 : Math.max(0, Math.round(transferFee ?? 0));
  if (driver.isPro) {
    // Un taux de commission plus BAS est plus généreux pour le pilote (il garde plus de ses gains).
    commissionRate = clamp(Number(commissionRate) || baseline.commissionRate, 0.01, 0.9);
    generosity = baseline.commissionRate / Math.max(0.01, commissionRate);
  } else {
    weeklyWage = Math.max(0, Math.round(weeklyWage ?? 0));
    if (!force && state.agency.money < transferFee) {
      return {
        ok: false,
        error: `Indemnité de transfert (${transferFee.toLocaleString("fr-FR")}€) supérieure à ta trésorerie (${state.agency.money.toLocaleString("fr-FR")}€) — elle est payée cash à la signature, baisse le montant.`,
      };
    }
    // Un amateur PAIE des frais de gestion à l'agence (moins = généreux) — inverse d'un pro.
    const wageGenerosity = baseline.weeklyWage / Math.max(1, weeklyWage);
    generosity = (wageGenerosity + transferFee / Math.max(1, baseline.transferFee)) / 2;
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
      state.agency.money -= transferFee;
      recordTransaction(state, "renew-contract", `Renouvellement — ${driver.name}`, -transferFee);
    }
    driver.contract = { weeksRemaining, weeklyWage: Math.round(storedWage), commissionRate: 0 };
  }
  driver.weeksWithoutContract = 0;
  driver.negotiationPatience = 100;
  driver.agencyRelationship = clamp(driver.agencyRelationship + Math.round((generosity - 1) * 10), 0, 200);
  return { ok: true };
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
const LOAN_INTEREST_RATE = 0.25;
const LOAN_WEEKS = 15;

export function takeLoan(state, amount, { force = false } = {}) {
  if (state.agency.loan) {
    return { ok: false, error: "Un prêt est déjà en cours — rembourse-le avant d'en contracter un autre." };
  }
  if (!force && state.agency.money >= LOAN_ELIGIBLE_THRESHOLD) {
    return {
      ok: false,
      error: `Prêt réservé aux agences en difficulté (trésorerie sous ${LOAN_ELIGIBLE_THRESHOLD.toLocaleString("fr-FR")}€).`,
    };
  }
  amount = Math.round(clamp(amount, 0, LOAN_MAX_AMOUNT));
  if (amount <= 0) return { ok: false, error: "Montant invalide." };

  const totalOwed = Math.round(amount * (1 + LOAN_INTEREST_RATE));
  state.agency.loan = { totalOwed, weeklyPayment: Math.ceil(totalOwed / LOAN_WEEKS) };
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
