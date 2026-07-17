import { CATEGORIES, RIVAL_AGENCIES } from "./data.js";
import { generateDriver } from "./driver.js";
import { generateAllTeams } from "./team.js";
import {
  refillStaffPool,
  seedWorldStaff,
  averageScoutSkill,
  averageDiscoverySkill,
  averagePrecisionSkill,
  scoutPoolCapacity,
  negotiationDiscount,
} from "./staff.js";
import { rosterCapacity } from "./infrastructure.js";
import { recordTransaction } from "./finance.js";
import { racesUntilSeasonEnd } from "./standings.js";
import { mulberry32 } from "./rng.js";

const SAVE_PREFIX = "pit-wall-save-";
const LAST_SLOT_KEY = "pit-wall-last-slot";
const SCOUT_COST = 500;
const DEEP_SCOUT_COST = 2500;
const DEEP_SCOUT_COOLDOWN_WEEKS = 2;
const SIGN_BASE_COST = 3000;
const SCOUT_REVEAL_KEYS = ["technique", "mental", "physique", "circuit"];
export const SCHEMA_VERSION = 21;

export function createNewGame(slotId, agencyName = "Nouvelle Agence", color = "#ff3b30", seed = Date.now() | 0) {
  const rng = mulberry32(seed);
  const { teams, aiDrivers } = generateAllTeams(rng);
  const state = {
    schemaVersion: SCHEMA_VERSION,
    slotId,
    seed,
    week: 1,
    agency: { name: agencyName, money: 50000, reputation: 0, color },
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

export function scoutDriver(state, driverId) {
  const driver = state.scoutPool.find((d) => d.id === driverId);
  if (!driver || driver.scouted) return false;
  if (state.agency.money < SCOUT_COST) return false;
  state.agency.money -= SCOUT_COST;
  recordTransaction(state, "scout", `Scouting — ${driver.name}`, -SCOUT_COST);
  driver.scouted = true;

  const rng = makeRng(state);
  const discoverySkill = averageDiscoverySkill(state);
  const precisionSkill = averagePrecisionSkill(state);
  const groupCount = Math.round(Math.max(1, Math.min(4, 1 + (discoverySkill / 99) * 3)));
  const rangeWidth = Math.round(Math.max(4, Math.min(20, 20 - (precisionSkill / 99) * 16)));
  driver.scoutReveal = {
    groups: shuffledRevealKeys(rng).slice(0, groupCount),
    rangeWidth,
    potentialKnown: false,
  };
  return true;
}

export function deepScoutDriver(state, driverId) {
  const driver = state.scoutPool.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  if (state.agency.money < DEEP_SCOUT_COST) return { ok: false, error: "Budget insuffisant." };

  state.agency.money -= DEEP_SCOUT_COST;
  recordTransaction(state, "scout", `Scouting approfondi — ${driver.name}`, -DEEP_SCOUT_COST);
  driver.scouted = true;
  driver.scoutReveal = {
    groups: driver.scoutReveal?.groups ?? [],
    rangeWidth: driver.scoutReveal?.rangeWidth ?? 20,
    potentialKnown: true,
  };
  state.deepScoutCooldownWeeks = DEEP_SCOUT_COOLDOWN_WEEKS;
  return { ok: true };
}

export function signCost(state, driver) {
  const base = SIGN_BASE_COST + driver.potential * 400 + (driver.scouted ? 0 : 1500);
  return Math.round(base * (1 - negotiationDiscount(state)));
}

export function signDriver(state, driverId) {
  const idx = state.scoutPool.findIndex((d) => d.id === driverId);
  if (idx === -1) return { ok: false, error: "Pilote introuvable." };
  if (state.drivers.length >= rosterCapacity(state)) {
    return { ok: false, error: "Effectif complet — améliore tes bureaux pour recruter davantage." };
  }
  const driver = state.scoutPool[idx];
  const cost = signCost(state, driver);
  if (state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };

  const kartingId = CATEGORIES.find((c) => c.tier === 0).id;
  state.agency.money -= cost;
  recordTransaction(state, "sign-driver", `Signature — ${driver.name}`, -cost);
  // /40 : les frais de gestion amateurs rentabilisent la signature en ~2 saisons, pas en une demi-saison.
  driver.contract = { racesRemaining: racesUntilSeasonEnd(state, kartingId), weeklyWage: Math.round(cost / 40) };
  driver.categoryId = kartingId;
  driver.teamId = null;
  driver.weeksWithoutContract = 0;
  state.scoutPool.splice(idx, 1);
  state.drivers.push(driver);
  return { ok: true, driver };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function contractBaseline(state, driver) {
  const base = 2000 + driver.potential * 150;
  return {
    weeklyWage: Math.round((base / 20) * (1 - negotiationDiscount(state))),
    transferFee: Math.round(base * (1 - negotiationDiscount(state))),
  };
}

export function negotiateContract(state, driverId, { weeklyWage, transferFee }) {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Pilote introuvable." };
  weeklyWage = Math.max(0, Math.round(weeklyWage));
  transferFee = Math.max(0, Math.round(transferFee));
  if (state.agency.money < transferFee) return { ok: false, error: "Budget insuffisant." };

  const baseline = contractBaseline(state, driver);
  // Un pro reçoit son salaire (plus = généreux) ; un amateur PAIE des frais de gestion à
  // l'agence (moins = généreux). Sans cette inversion, gonfler les frais d'un amateur
  // augmenterait à la fois ses chances d'accepter ET les revenus de l'agence (exploit).
  const wageGenerosity = driver.isPro
    ? weeklyWage / Math.max(1, baseline.weeklyWage)
    : baseline.weeklyWage / Math.max(1, weeklyWage);
  const generosity = (wageGenerosity + transferFee / Math.max(1, baseline.transferFee)) / 2;
  const acceptChance = clamp(0.3 + (generosity - 1) * 0.6 + (driver.agencyRelationship - 50) / 200, 0.05, 0.97);
  const rng = makeRng(state);

  if (rng() >= acceptChance) {
    driver.agencyRelationship = clamp(driver.agencyRelationship - 5, 0, 200);
    return { ok: false, error: `${driver.name} juge cette offre insuffisante — revois tes conditions.` };
  }

  // Temp change: contract duration is forced to end-of-season, ignoring any requested race count.
  const raceCount = driver.categoryId ? racesUntilSeasonEnd(state, driver.categoryId) : 6;
  // Garde-fou anti-exploit : les frais perçus sur un amateur sont plafonnés à 2× la base.
  const storedWage = driver.isPro ? weeklyWage : Math.min(weeklyWage, baseline.weeklyWage * 2);
  state.agency.money -= transferFee;
  recordTransaction(state, "renew-contract", `Renouvellement — ${driver.name}`, -transferFee);
  driver.contract = { racesRemaining: raceCount, weeklyWage: Math.round(storedWage) };
  driver.weeksWithoutContract = 0;
  driver.agencyRelationship = clamp(driver.agencyRelationship + Math.round((generosity - 1) * 10), 0, 200);
  return { ok: true };
}

export function setInvestment(state, driverId, amount) {
  state.investments[driverId] = Math.max(0, Math.round(amount));
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
