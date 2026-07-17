import { randomName } from "./data.js";
import { recordTransaction } from "./finance.js";

let nextStaffId = 1;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const STAFF_POOL_SIZE = 8;
const MAX_SCOUT_POOL = 10;
const WORLD_STAFF_POOL_SIZE = 30;
const RIVAL_STAFF_SHARE = 0.6;

export const ROLES = {
  recruiter: { name: "Recruteur", skillLabel: "Perspicacité", secondaryLabel: "Précision" },
  negotiator: { name: "Négociateur", skillLabel: "Négociation", secondaryLabel: "Charisme" },
  physio: { name: "Préparateur physique", skillLabel: "Physique", secondaryLabel: "Récupération" },
  psychologist: { name: "Préparateur mental", skillLabel: "Mental", secondaryLabel: "Motivation" },
  drivingCoach: { name: "Coach pilotage", skillLabel: "Pédagogie", secondaryLabel: "Analyse" },
  cfo: { name: "Directeur financier", skillLabel: "Gestion", secondaryLabel: "Relations" },
  lawyer: { name: "Avocat", skillLabel: "Droit", secondaryLabel: "Contentieux" },
};

const ROLE_IDS = Object.keys(ROLES);

export function generateStaffMember(rng, role) {
  const roll = () => Math.round(clamp(30 + rng() * 65, 30, 95));
  const primary = roll();
  const secondary = roll();
  const communication = roll();
  const experience = roll();
  return {
    id: nextStaffId++,
    name: randomName(rng),
    role,
    skills: { primary, secondary, communication, experience },
    hireCost: Math.round(2000 + primary * 150),
    weeklyWage: Math.round(150 + primary * 6),
  };
}

export function refillStaffPool(state, rng) {
  while (state.staffPool.length < STAFF_POOL_SIZE) {
    const role = ROLE_IDS[Math.floor(rng() * ROLE_IDS.length)];
    state.staffPool.push(generateStaffMember(rng, role));
  }
}

// World initialization: generate a large pool of AI staff, hand a portion to rival agencies
// (flavor roster, not directly hireable), and leave the rest as free agents in staffPool.
export function seedWorldStaff(state, rng) {
  const pool = Array.from(
    { length: WORLD_STAFF_POOL_SIZE },
    () => generateStaffMember(rng, ROLE_IDS[Math.floor(rng() * ROLE_IDS.length)])
  );
  const rivalCount = state.rivalAgencies.length > 0 ? Math.round(WORLD_STAFF_POOL_SIZE * RIVAL_STAFF_SHARE) : 0;

  for (const agency of state.rivalAgencies) {
    agency.staff = [];
  }
  for (let i = 0; i < rivalCount; i++) {
    const agency = state.rivalAgencies[i % state.rivalAgencies.length];
    agency?.staff.push(pool[i]);
  }
  state.staffPool.push(...pool.slice(rivalCount));
}

export function hireStaff(state, recruiterId) {
  const idx = state.staffPool.findIndex((r) => r.id === recruiterId);
  if (idx === -1) return false;
  const recruiter = state.staffPool[idx];
  if (state.agency.money < recruiter.hireCost) return false;
  state.agency.money -= recruiter.hireCost;
  recordTransaction(state, "hire-staff", `Recrutement — ${recruiter.name} (${ROLES[recruiter.role].name})`, -recruiter.hireCost);
  state.staffPool.splice(idx, 1);
  state.staff.push(recruiter);
  return true;
}

export function fireStaff(state, staffId) {
  const idx = state.staff.findIndex((r) => r.id === staffId);
  if (idx === -1) return false;
  state.staff.splice(idx, 1);
  return true;
}

function recruiters(state) {
  return state.staff.filter((s) => s.role === "recruiter");
}

export function averageScoutSkill(state) {
  const pool = recruiters(state);
  if (pool.length === 0) return 0;
  return pool.reduce((sum, r) => sum + r.skills.primary, 0) / pool.length;
}

export const averageDiscoverySkill = averageScoutSkill;

export function averagePrecisionSkill(state) {
  const pool = recruiters(state);
  if (pool.length === 0) return 0;
  return pool.reduce((sum, r) => sum + r.skills.secondary, 0) / pool.length;
}

export function scoutPoolCapacity(state) {
  return Math.min(4 + recruiters(state).length, MAX_SCOUT_POOL);
}

export function autoRevealCandidates(state, rng) {
  let remaining = recruiters(state).length;
  const unscouted = state.scoutPool.filter((d) => !d.scouted);
  while (remaining > 0 && unscouted.length > 0) {
    const idx = Math.floor(rng() * unscouted.length);
    unscouted[idx].scouted = true;
    unscouted.splice(idx, 1);
    remaining -= 1;
  }
}

export function bestSkill(state, role) {
  const members = state.staff.filter((s) => s.role === role);
  if (members.length === 0) return 0;
  return Math.max(...members.map((s) => s.skills.primary));
}

export function negotiationDiscount(state) {
  return (bestSkill(state, "negotiator") / 95) * 0.2;
}

export function bestCommunication(state) {
  if (state.staff.length === 0) return 0;
  return Math.max(...state.staff.map((s) => s.skills.communication));
}

export function averageExperience(state) {
  if (state.staff.length === 0) return 0;
  return state.staff.reduce((sum, s) => sum + s.skills.experience, 0) / state.staff.length;
}
