// Shared by the whole FIA single-seater ladder (F4/F3/F2/F1) — in reality they've converged on
// the same top-10 scale, so differentiating them from each other would be less realistic, not
// more. Karting and WEC/WRC get their own tables below, where the real-world disciplines
// actually do diverge (smaller/less formal grids, endurance class-size gaps, rally's Power Stage).
const STANDARD_POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export const CATEGORIES = [
  {
    id: "karting",
    name: "Karting Senior",
    tier: 0,
    difficulty: 0.6,
    seatCost: 2000,
    prizeScale: 400,
    repRequired: 0,
    gridSize: 60,
    variableSeats: { min: 1, max: 4 },
    constructorsTopN: 2,
    brands: ["Tony Kart", "CRG", "Birel ART", "Sodikart", "Kosmic", "Praga"],
    // Grassroots/regional-style scoring — a much shorter payout than the FIA ladder above it,
    // reflecting karting's status as the entry rung rather than a full pro championship.
    pointsTable: [20, 16, 13, 11, 9, 7, 5, 3],
  },
  {
    id: "f4",
    name: "Formule 4",
    tier: 1,
    difficulty: 0.7,
    seatCost: 15000,
    prizeScale: 1500,
    repRequired: 5,
    gridSize: 40,
    variableSeats: { min: 2, max: 4 },
    constructorsTopN: 2,
    fixedBrand: "Tatuus",
    pointsTable: STANDARD_POINTS_TABLE,
  },
  {
    id: "f3",
    name: "Formule 3",
    tier: 2,
    difficulty: 0.8,
    seatCost: 60000,
    prizeScale: 6000,
    repRequired: 20,
    gridSize: 36,
    seatsPerTeam: 3,
    fixedBrand: "Dallara",
    pointsTable: STANDARD_POINTS_TABLE,
  },
  {
    id: "f2",
    name: "Formule 2",
    tier: 3,
    difficulty: 0.9,
    seatCost: 200000,
    prizeScale: 20000,
    repRequired: 45,
    gridSize: 24,
    seatsPerTeam: 2,
    fixedBrand: "Dallara",
    pointsTable: STANDARD_POINTS_TABLE,
  },
  {
    id: "f1",
    name: "Formule 1",
    tier: 4,
    difficulty: 1.0,
    seatCost: 800000,
    prizeScale: 80000,
    repRequired: 80,
    gridSize: 20,
    seatsPerTeam: 2,
    brands: ["Ferrari", "Mercedes", "Red Bull", "McLaren", "Aston Martin", "Alpine", "Williams", "RB", "Sauber", "Haas"],
    pointsTable: STANDARD_POINTS_TABLE,
  },
  {
    id: "wec",
    name: "WEC",
    tier: 3,
    difficulty: 0.85,
    seatCost: 150000,
    prizeScale: 15000,
    repRequired: 40,
    driversPerCar: 2,
    carClassification: true,
    branch: true,
    classes: [
      {
        id: "hypercar",
        label: "Hypercar",
        brands: ["Toyota", "Porsche", "Ferrari", "Peugeot", "Cadillac", "Alpine", "BMW", "Lamborghini", "Aston Martin"],
        teamCount: 9,
        carsPerTeam: 2,
        strictUnique: true,
        // Grid tops out around 18 cars — a top-10 table would pay out almost the whole field,
        // so Hypercar gets a shorter, more front-loaded table instead.
        pointsTable: [25, 20, 16, 13, 10, 8, 6, 4],
      },
      {
        id: "gt3",
        label: "GT3",
        brands: [
          "Porsche", "Ferrari", "Aston Martin", "BMW", "Lamborghini", "McLaren", "Ford",
          "Corvette", "Lexus", "Mercedes-AMG", "Audi", "Honda", "Bentley", "Nissan",
        ],
        teamCount: 18,
        carsPerTeam: 2,
        // Twice the grid of Hypercar — a full top-10 stays meaningful here.
        pointsTable: STANDARD_POINTS_TABLE,
      },
    ],
  },
  {
    id: "rally",
    name: "WRC",
    tier: 3,
    difficulty: 0.85,
    seatCost: 120000,
    prizeScale: 14000,
    repRequired: 35,
    gridSize: 16,
    teamSizes: [5, 5, 6],
    constructorsEnabled: false,
    branch: true,
    brands: ["Toyota", "Hyundai", "Ford", "Skoda", "Citroën"],
    pointsTable: STANDARD_POINTS_TABLE,
    // Real WRC's signature bonus: the top 5 on the rally's closing Power Stage earn extra points
    // on top of the overall result, independent of final classification (see
    // applyPowerStageBonus, standings.js).
    powerStageBonus: [5, 4, 3, 2, 1],
  },
];

export function pointsTableFor(category, classId = null) {
  if (classId) return category.classes.find((c) => c.id === classId).pointsTable;
  return category.pointsTable;
}

export const SEASON_WEEKS = 52;
export const WINTER_MERCATO_WEEKS = [1, 2, 3, 4, 5, 6];
export const SILLY_SEASON_WEEKS = [26, 27, 28, 29, 30, 31];
export const RACE_WEEKS = [];
for (let w = 1; w <= SEASON_WEEKS; w++) {
  if (!WINTER_MERCATO_WEEKS.includes(w) && !SILLY_SEASON_WEEKS.includes(w)) RACE_WEEKS.push(w);
}

export function weekInSeason(week) {
  return ((week - 1) % SEASON_WEEKS) + 1;
}

export function isMercatoWindow(weekNum) {
  return WINTER_MERCATO_WEEKS.includes(weekNum) || SILLY_SEASON_WEEKS.includes(weekNum);
}

function spreadRounds(count, weekPool) {
  const step = weekPool.length / count;
  const weeks = [];
  for (let i = 0; i < count; i++) {
    weeks.push(weekPool[Math.floor(i * step + step / 2)]);
  }
  return weeks;
}

export function allocateVariableTeamSizes(total, min, max, rng) {
  const sizes = [];
  let remaining = total;
  while (remaining > 0) {
    if (remaining <= max) {
      sizes.push(remaining);
      remaining = 0;
    } else if (remaining < min * 2) {
      const size = Math.max(min, remaining - max);
      sizes.push(size);
      remaining -= size;
    } else {
      const size = min + Math.floor(rng() * (max - min + 1));
      sizes.push(size);
      remaining -= size;
    }
  }
  return sizes;
}

const ROUND_COUNTS = { karting: 20, f4: 11, f3: 15, f2: 18, f1: 24, wec: 8, rally: 12 };

// Each round has a track style favoring specific attributes — a driver strong in Pluie is
// advantaged on a "pluvieux" round, relative to their OWN general level, rather than every
// round being pure uniform noise. Cycled in a fixed rotation per round index (like the
// calendar itself, this is static across games, not seeded per-game).
export const TRACK_STYLES = {
  rapide: { label: "Rapide", attrs: ["qualification", "pilotage", "depart"] },
  technique: { label: "Technique", attrs: ["trajectoire", "freinage", "feeling"] },
  pluvieux: { label: "Pluvieux", attrs: ["pluie", "evitement", "concentration"] },
  usant: { label: "Usant en pneus", attrs: ["gestionPneus", "resistance", "rigueur"] },
  bagarre: { label: "Bagarre", attrs: ["depassement", "defense", "agressivite"] },
};
const TRACK_STYLE_IDS = Object.keys(TRACK_STYLES);

for (const category of CATEGORIES) {
  category.roundCount = ROUND_COUNTS[category.id];
  category.calendar = spreadRounds(category.roundCount, RACE_WEEKS);
  category.workload = category.roundCount;
  category.roundStyles = category.calendar.map((_, i) => TRACK_STYLE_IDS[i % TRACK_STYLE_IDS.length]);
}

export const MAX_DRIVER_WORKLOAD = 30;

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// One distinct icon per category so it's recognizable at a glance in dense tables — the
// single-seater ladder (karting → f1) reads as a progression, WEC/rally get their own icons.
export const CATEGORY_EMOJI = {
  karting: "🏎️",
  f4: "🔰",
  f3: "🥉",
  f2: "🥈",
  f1: "🏆",
  wec: "⏱️",
  rally: "🌲",
};

export const FIELD_STRENGTH_BY_TIER = { 0: 32, 1: 48, 2: 60, 3: 72, 4: 88 };

export const PRO_TIER_THRESHOLD = 3;

// Shared by every reputation source (season-end bonus, event/dilemma outcomes, boutique agence
// purchases — standings.js/events.js/infrastructure.js) rather than each mutating
// state.agency.reputation directly. The dominant runaway source turned out to be the season-end
// bonus (rolloverIfNeeded in standings.js): it's awarded PER DRIVER in the standings, so a full
// multi-driver roster stacks several +1..+10 grants at every season change — a passive 6-driver
// squad that never touches a dilemma or the shop was still reaching ~45 reputation (past the F2
// gate) after 5 seasons on raw addition alone. This diminishing-returns curve keeps early
// reputation easy to build (a new agency proving itself) while taxing each additional point
// increasingly hard past a comfortable level, regardless of how many simultaneous sources
// (roster size, dilemmas, shop) the player happens to trigger. Denominator tuned so the 0.25
// floor kicks in around reputation 30, just under the F2 threshold (45) — reaching pro tier
// should take sustained effort, not one lucky multi-driver season. Negative deltas (penalties)
// are never softened — a scandal should sting exactly as hard as written.
export function applyReputationGain(state, rawDelta) {
  if (rawDelta <= 0) {
    state.agency.reputation = Math.max(0, state.agency.reputation + rawDelta);
    return;
  }
  const scale = Math.max(0.25, 1 - state.agency.reputation / 40);
  state.agency.reputation = Math.max(0, state.agency.reputation + rawDelta * scale);
}

// Optional one-time founder perk chosen at agency creation — each maps to bumping ONE existing
// facility (infrastructure.js) to its 2nd tier for free, exactly as if the player had just
// bought that upgrade (same bonus, same recurring upkeep from week 1). "none" preserves the
// exact starting state (all facilities at level 1) as the default/first option.
export const AGENCY_SPECIALTIES = [
  { id: "none", label: "Aucune spécialité", description: "Un départ classique, sans bonus ni charge supplémentaire.", facilityId: null },
  { id: "former-driver", label: "Ancien pilote", description: "Ta carrière sur circuit accélère la progression de tes protégés (Centre d'entraînement niveau 2).", facilityId: "training" },
  { id: "manager", label: "Gestionnaire chevronné", description: "Une organisation déjà rodée : capacité et commission améliorées (Bureaux niveau 2).", facilityId: "offices" },
  { id: "well-connected", label: "Bien introduit", description: "Ton carnet d'adresses attire déjà les pilotes établis (Bureau de standing niveau 2).", facilityId: "prestige" },
  { id: "talent-scout", label: "Chasseur de talents", description: "Un œil aiguisé pour repérer les meilleurs profils dès le départ (Qualité des recruteurs niveau 2).", facilityId: "recruiterQuality" },
  { id: "well-networked", label: "Réseau solide", description: "Des contacts dans le recrutement de staff (Réseau de contacts niveau 2).", facilityId: "contactNetwork" },
];

export const RIVAL_AGENCIES = [
  { id: "nordwind", name: "Nordwind Talent" },
  { id: "apex-mgmt", name: "Apex Management" },
  { id: "meridian", name: "Meridian Sports Group" },
  { id: "vantage", name: "Vantage Motorsport Agency" },
];

export function pickRandomRivalId(rng) {
  return RIVAL_AGENCIES[Math.floor(rng() * RIVAL_AGENCIES.length)].id;
}

export function nextCategories(currentId) {
  const current = CATEGORY_BY_ID[currentId];
  if (!current) return CATEGORIES.filter((c) => c.tier === 0);
  return CATEGORIES.filter((c) => c.tier === current.tier + 1 || (c.branch && c.tier === current.tier));
}

// Split by sex so randomName can pick a first name consistent with a character's sex instead
// of drawing from one mixed pool (which used to let a "F" driver end up named "Lucas").
const FIRST_NAMES_M = [
  "Lucas", "Enzo", "Nathan", "Leo", "Rayan", "Mateo", "Adam", "Noah", "Gabriel", "Theo",
  "Kenji", "Diego", "Marco", "Lars", "Otto", "Bjorn", "Pierre", "Antoine", "Hugo", "Victor",
  "Ethan", "Louis", "Tom", "Jules", "Arthur", "Maxime", "Yanis", "Nolan", "Axel", "Ivan",
  "Erik", "Felix", "Milo", "Oscar", "Ryo", "Haruto", "Dmitri", "Pavel", "Miguel", "Rafael",
];
const FIRST_NAMES_F = [
  "Mia", "Chiara", "Sofia", "Amelia", "Lena", "Nora", "Elena", "Julia", "Sara", "Ines",
  "Emma", "Chloe", "Camille", "Alice", "Maya", "Livia", "Anna", "Clara", "Lucia", "Zoe",
  "Yui", "Sakura", "Freya", "Astrid", "Greta", "Olga", "Irina", "Paula", "Carla", "Nina",
  "Iris", "Luna", "Stella", "Aria", "Mila", "Talia", "Vera", "Selma", "Romy", "Noemie",
];
const LAST_NAMES = [
  "Moreau", "Dubois", "Lefevre", "Girard", "Andersson", "Nilsson", "Rossi", "Bianchi",
  "Fischer", "Weber", "Novak", "Kowalski", "Silva", "Santos", "Herrera", "Ramos",
  "Tanaka", "Sato", "Wallace", "Bennett", "Cortez", "Duval", "Renard", "Lopez",
  "Martin", "Bernard", "Petit", "Roux", "Fontaine", "Chevalier", "Muller", "Schmidt",
  "Schneider", "Hoffmann", "Ferrari", "Romano", "Conti", "Esposito", "Suzuki", "Watanabe",
  "Kobayashi", "Nakamura", "Petrov", "Sokolov", "Volkov", "Garcia", "Fernandez", "Torres",
  "Almeida", "Costa",
];

export function randomName(rng, sex = null) {
  const pool = sex === "F" ? FIRST_NAMES_F : sex === "M" ? FIRST_NAMES_M : [...FIRST_NAMES_M, ...FIRST_NAMES_F];
  const first = pool[Math.floor(rng() * pool.length)];
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  return `${first} ${last}`;
}
