import { randomName } from "./data.js";
import { recordTransaction } from "./finance.js";
import { assignStaffTraits, staffTraitSkillBonus } from "./traits.js";
import { generateStaffScoutReveal } from "./scoutReveal.js";

let nextStaffId = 1;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const STAFF_POOL_SIZE = 8;
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

// Elite profiles (surfaced via the "Réseau de contacts" infrastructure, see infrastructure.js
// eliteStaffChance) roll from a much higher floor — a network connection means you only ever
// hear about the good ones.
const ELITE_SKILL_FLOOR = 65;

export function generateStaffMember(rng, role, { elite = false } = {}) {
  const roll = () => Math.round(elite ? clamp(ELITE_SKILL_FLOOR + rng() * 34, ELITE_SKILL_FLOOR, 99) : clamp(30 + rng() * 65, 30, 95));
  const primary = roll();
  const secondary = roll();
  const communication = roll();
  const experience = roll();
  return {
    id: nextStaffId++,
    name: randomName(rng),
    role,
    // A recruiter's specialty is the staff role they're best at sourcing — feeds
    // pickWeightedRole below. Non-recruiters have no use for it.
    specialty: role === "recruiter" ? ROLE_IDS[Math.floor(rng() * ROLE_IDS.length)] : null,
    elite,
    skills: { primary, secondary, communication, experience },
    hireCost: Math.round(2000 + primary * 150),
    weeklyWage: Math.round(150 + primary * 6),
    traits: assignStaffTraits(rng),
    // Fog of war, mirroring the driver scoutPool convention (scoutReveal.js) — a fresh candidate
    // shows nothing until scouted. Elite candidates are the one exception (see refillStaffPool).
    scouted: false,
    scoutReveal: null,
  };
}

// Recruiters biased toward a role via their specialty make that role show up more often in the
// pool — mirrors how scoutSkill already biases driver generation, applied categorically instead
// of numerically since a specialty is "which role", not "how good".
export function pickWeightedRole(rng, state) {
  const weights = ROLE_IDS.map((id) => {
    const bonus = state.staff.filter((s) => s.role === "recruiter" && s.specialty === id).length * 2;
    return 1 + bonus;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < ROLE_IDS.length; i++) {
    roll -= weights[i];
    if (roll < 0) return ROLE_IDS[i];
  }
  return ROLE_IDS[ROLE_IDS.length - 1];
}

export function refillStaffPool(state, rng, eliteChance = 0) {
  while (state.staffPool.length < STAFF_POOL_SIZE) {
    state.staffPool.push(generateStaffMember(rng, pickWeightedRole(rng, state)));
  }
  const hasElite = state.staffPool.some((s) => s.elite);
  if (!hasElite && rng() < eliteChance) {
    const idx = Math.floor(rng() * state.staffPool.length);
    const elite = generateStaffMember(rng, pickWeightedRole(rng, state), { elite: true });
    // The network already vouches for them — pre-scouted, using your recruiters' raw skill
    // (not the infra-boosted effectiveScoutSkills, to avoid staff.js importing infrastructure.js
    // and creating a circular dependency — infrastructure.js already imports FROM staff.js).
    elite.scouted = true;
    elite.scoutReveal = generateStaffScoutReveal(rng, averageScoutSkill(state), averagePrecisionSkill(state));
    state.staffPool[idx] = elite;
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
    // Flavor-only roster, never recruitable — no point gating it behind a scouting action that
    // doesn't exist for rival-owned staff, so it's shown fully like it always has been.
    pool[i].scouted = true;
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

export function averagePrecisionSkill(state) {
  const pool = recruiters(state);
  if (pool.length === 0) return 0;
  return pool.reduce((sum, r) => sum + r.skills.secondary, 0) / pool.length;
}

// Both scale with recruiter force (perspicacité) — a stronger scouting team costs more
// to field but uncovers more (scoutDriver's groupCount already scales the same way).
export function scoutCost(state) {
  return Math.round(400 + averageScoutSkill(state) * 5);
}

export function deepScoutCost(state) {
  return Math.round(2000 + averageScoutSkill(state) * 12);
}

export function bestSkill(state, role) {
  const members = state.staff.filter((s) => s.role === role);
  if (members.length === 0) return 0;
  return Math.max(...members.map((s) => clamp(s.skills.primary + staffTraitSkillBonus(s), 0, 99)));
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
