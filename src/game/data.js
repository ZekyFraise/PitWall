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
  },
];

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

for (const category of CATEGORIES) {
  category.roundCount = ROUND_COUNTS[category.id];
  category.calendar = spreadRounds(category.roundCount, RACE_WEEKS);
  category.workload = category.roundCount;
}

export const MAX_DRIVER_WORKLOAD = 30;

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const FIELD_STRENGTH_BY_TIER = { 0: 32, 1: 48, 2: 60, 3: 72, 4: 88 };

export const PRO_TIER_THRESHOLD = 2;
export const PRO_COMMISSION_RATE = 0.25;

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

const FIRST_NAMES = [
  "Lucas", "Enzo", "Nathan", "Leo", "Rayan", "Mateo", "Adam", "Noah", "Gabriel", "Theo",
  "Mia", "Chiara", "Sofia", "Amelia", "Lena", "Nora", "Elena", "Julia", "Sara", "Ines",
  "Kenji", "Diego", "Marco", "Lars", "Otto", "Bjorn", "Pierre", "Antoine", "Hugo", "Victor",
];
const LAST_NAMES = [
  "Moreau", "Dubois", "Lefevre", "Girard", "Andersson", "Nilsson", "Rossi", "Bianchi",
  "Fischer", "Weber", "Novak", "Kowalski", "Silva", "Santos", "Herrera", "Ramos",
  "Tanaka", "Sato", "Wallace", "Bennett", "Cortez", "Duval", "Renard", "Lopez",
];

export function randomName(rng) {
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  return `${first} ${last}`;
}
