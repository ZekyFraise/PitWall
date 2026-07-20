import { randomName } from "./data.js";
import { recordTransaction } from "./finance.js";

let nextStaffId = 1;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const STAFF_POOL_SIZE = 8;
const MAX_SCOUT_POOL = 10;
// Scaled to match the volume/logic used for AI driver generation (hundreds of seats
// filled across all categories at world init), not a small flat handful of staff.
const WORLD_STAFF_POOL_SIZE = 600;
const RIVAL_STAFF_SHARE = 0.6;

export const ROLES = {
  recruiter: {
    name: "Recruteur",
    skillLabel: "Perspicacité",
    secondaryLabel: "Précision",
    description: "Améliore le scouting : révèle plus de caractéristiques et des fenêtres plus précises.",
  },
  negotiator: {
    name: "Négociateur",
    skillLabel: "Négociation",
    secondaryLabel: "Charisme",
    description: "Réduit le coût des signatures, du scouting, des baquets et du recrutement (jusqu'à -20%).",
  },
  physio: {
    name: "Préparateur physique",
    skillLabel: "Physique",
    secondaryLabel: "Récupération",
    description: "Réduit le risque d'abandon/DNF de tes pilotes en course (jusqu'à -40%).",
  },
  psychologist: {
    name: "Préparateur mental",
    skillLabel: "Mental",
    secondaryLabel: "Motivation",
    description: "Atténue les pertes de relation agence/équipe après un mauvais résultat (jusqu'à -50%).",
  },
  drivingCoach: {
    name: "Coach pilotage",
    skillLabel: "Pédagogie",
    secondaryLabel: "Analyse",
    description: "Accélère la progression des attributs de tes pilotes à l'entraînement (jusqu'à +30%).",
  },
  cfo: {
    name: "Directeur financier",
    skillLabel: "Gestion",
    secondaryLabel: "Relations",
    description: "Réduit les coûts d'entretien des infrastructures chaque semaine (jusqu'à -25%).",
  },
  lawyer: {
    name: "Avocat",
    skillLabel: "Droit",
    secondaryLabel: "Contentieux",
    description: "Réduit le risque de débauchage de tes pilotes par des agences rivales (jusqu'à -50%).",
  },
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

export function hireStaff(state, recruiterId, { force = false } = {}) {
  const idx = state.staffPool.findIndex((r) => r.id === recruiterId);
  if (idx === -1) return false;
  const recruiter = state.staffPool[idx];
  const cost = force ? 0 : recruiter.hireCost;
  if (!force && state.agency.money < cost) return false;
  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "hire-staff", `Recrutement — ${recruiter.name} (${ROLES[recruiter.role].name})`, -cost);
  }
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

// Both scale with recruiter force (perspicacité) — a stronger scouting team costs more
// to field but uncovers more (scoutDriver's groupCount already scales the same way).
export function scoutCost(state) {
  return Math.round(400 + averageScoutSkill(state) * 5);
}

export function deepScoutCost(state) {
  return Math.round(2000 + averageScoutSkill(state) * 12);
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
