// Pilot academies: third-party entities (mirrors team.js's agencyTeamRelationship pattern) that
// sponsor a handful of young prospects in the scout pool, each tied to a "flagship" team in one
// of the three marquee categories (F1 / WEC Hypercar / WRC) they're grooming their talents for.
// A driver still in an academy's pipeline costs more to sign (poaching them from their own
// program) — that surcharge eases with a better agency<->academy relationship, and a prospect
// left unsigned for too long eventually "graduates" out of the recruitable pool entirely.
import { CATEGORY_BY_ID } from "./data.js";
import { recordTransaction } from "./finance.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Two academies per flagship program — enough variety without flooding the scout pool with
// affiliated prospects (see ACADEMY_TAG_CHANCE below).
const FLAGSHIP_SLOTS = [
  { categoryId: "f1", classId: null },
  { categoryId: "f1", classId: null },
  { categoryId: "wec", classId: "hypercar" },
  { categoryId: "wec", classId: "hypercar" },
  { categoryId: "rally", classId: null },
  { categoryId: "rally", classId: null },
];

let nextAcademyId = 1;

export function generateAcademies(rng, teams) {
  nextAcademyId = 1;
  const academies = [];
  const usedTeamIds = new Set();
  for (const slot of FLAGSHIP_SLOTS) {
    const pool = (teams[slot.categoryId] ?? []).filter(
      (t) => (slot.classId ? t.subClass === slot.classId : true) && !usedTeamIds.has(t.id)
    );
    if (pool.length === 0) continue;
    const team = pool[Math.floor(rng() * pool.length)];
    usedTeamIds.add(team.id);
    academies.push({
      id: nextAcademyId++,
      name: `Académie ${team.name}`,
      categoryId: slot.categoryId,
      classId: slot.classId,
      teamId: team.id,
      teamName: team.name,
    });
  }
  return academies;
}

export function academyById(state, academyId) {
  return state.academies?.find((a) => a.id === academyId) ?? null;
}

export function academyFlagshipLabel(academy) {
  const category = CATEGORY_BY_ID[academy.categoryId];
  const classLabel = academy.classId ? category.classes.find((c) => c.id === academy.classId)?.label : null;
  return classLabel ? `${category.name} — ${classLabel}` : category.name;
}

export const ACADEMY_RELATIONSHIP_DEFAULT = 50;

export function academyRelationship(state, academyId) {
  return state.academyRelationships?.[academyId] ?? ACADEMY_RELATIONSHIP_DEFAULT;
}

export function adjustAcademyRelationship(state, academyId, delta) {
  if (!academyId || !delta) return;
  state.academyRelationships = state.academyRelationships ?? {};
  const current = academyRelationship(state, academyId);
  state.academyRelationships[academyId] = clamp(current + delta, 0, 200);
}

// Academies only groom young talent (age + potential gate) — an older or unremarkable prospect
// has no business in one UNLESS their family is bankrolling the seat (the rare "pay driver"
// exception below, independent of age/potential).
const ACADEMY_TAG_CHANCE = 0.15;
const ACADEMY_TALENT_THRESHOLD = 70;
const PAY_DRIVER_CHANCE = 0.015;

function isAcademyTalentAge(driver) {
  return driver.age <= 19 && driver.potential >= ACADEMY_TALENT_THRESHOLD;
}

export function maybeTagAcademyProspect(state, rng, driver) {
  if (!state.academies?.length) return;
  const eligible = isAcademyTalentAge(driver) ? rng() < ACADEMY_TAG_CHANCE : rng() < PAY_DRIVER_CHANCE;
  if (!eligible) return;
  const academy = state.academies[Math.floor(rng() * state.academies.length)];
  driver.academyId = academy.id;
}

// Poaching a prospect still in their academy's pipeline costs more the worse the relationship —
// down to no surcharge at all with a very good one, up to +60% at the default/adversarial end.
export function academySignSurchargeFactor(state, driver) {
  if (!driver.academyId) return 1;
  const relation = academyRelationship(state, driver.academyId);
  return clamp(1.6 - relation / 200, 1.0, 1.6);
}

// Signing away one of their prospects sours the relationship — proportional so repeatedly
// poaching the same academy gets progressively harder, not a flat one-off hit.
const POACH_RELATIONSHIP_PENALTY = 10;

export function onAcademyProspectSigned(state, driver) {
  if (!driver.academyId) return;
  adjustAcademyRelationship(state, driver.academyId, -POACH_RELATIONSHIP_PENALTY);
}

// Weekly chance an unsigned academy prospect gets pulled out of the scout pool entirely — the
// academy moved them along its own pipeline toward the flagship program, out of reach. Kept
// deliberately simple: no attempt to simulate the actual multi-season placement, just the
// player-facing consequence (act before they're gone) with a flavor log entry.
const GRADUATION_CHANCE_PER_WEEK = 0.015;

export function tickAcademyGraduation(state, rng) {
  const entries = [];
  const candidates = state.scoutPool.filter((d) => d.academyId != null);
  for (const driver of candidates) {
    if (rng() >= GRADUATION_CHANCE_PER_WEEK) continue;
    const academy = academyById(state, driver.academyId);
    state.scoutPool = state.scoutPool.filter((d) => d.id !== driver.id);
    entries.push({
      type: "academy-graduation",
      driverName: driver.name,
      academyName: academy?.name ?? "Académie",
      flagshipLabel: academy ? academyFlagshipLabel(academy) : "",
    });
  }
  return entries;
}

export const FUND_ACADEMY_COST = 6000;
export const FUND_ACADEMY_RELATIONSHIP_GAIN = 15;
const FUND_COOLDOWN_WEEKS = 6;

export function academyFundCooldown(state, academyId) {
  return state.academyFundCooldowns?.[academyId] ?? 0;
}

export function fundAcademyProgram(state, academyId, { force = false } = {}) {
  const academy = academyById(state, academyId);
  if (!academy) return { ok: false, error: "Académie introuvable." };
  const cooldown = academyFundCooldown(state, academyId);
  if (!force && cooldown > 0) return { ok: false, error: `Disponible dans ${cooldown} sem.` };
  const cost = force ? 0 : FUND_ACADEMY_COST;
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };
  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "fund-academy", `Financement — ${academy.name}`, -cost);
  }
  adjustAcademyRelationship(state, academyId, FUND_ACADEMY_RELATIONSHIP_GAIN);
  state.academyFundCooldowns = state.academyFundCooldowns ?? {};
  state.academyFundCooldowns[academyId] = FUND_COOLDOWN_WEEKS;
  return { ok: true };
}

export function tickAcademyFundCooldowns(state) {
  if (!state.academyFundCooldowns) return;
  for (const id of Object.keys(state.academyFundCooldowns)) {
    if (state.academyFundCooldowns[id] > 0) state.academyFundCooldowns[id] -= 1;
  }
}
