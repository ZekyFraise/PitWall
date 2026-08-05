import { randomName, CATEGORY_BY_ID, PRO_TIER_THRESHOLD } from "./data.js";
import { assignDriverTraits, traitStatBonus } from "./traits.js";

let nextId = 1;

// Kept rare so a bronze-rated driver stays a genuinely scarce commodity for PRO/AM seat
// requirements, not something every roster has a spare of.
const BRONZE_CHANCE = 0.08;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export const ATTRIBUTE_META = {
  pilotage: { group: "technique", label: "Pilotage", description: "Vitesse pure au volant." },
  freinage: { group: "technique", label: "Freinage", description: "Précision et distance de freinage." },
  trajectoire: { group: "technique", label: "Trajectoire", description: "Choix de la trajectoire idéale en virage." },
  depassement: { group: "technique", label: "Dépassement", description: "Efficacité en dépassement." },
  adaptation: { group: "technique", label: "Adaptation", description: "Rapidité à prendre en main une nouvelle monoplace/écurie." },
  gestionPneus: { group: "technique", label: "Gestion pneus", description: "Économie des pneus et du carburant en course." },
  defense: { group: "technique", label: "Défense", description: "Capacité à défendre sa position." },
  evitement: { group: "technique", label: "Évitement", description: "Capacité à éviter un accrochage." },
  depart: { group: "technique", label: "Départ", description: "Qualité des départs de course." },
  qualification: { group: "technique", label: "Qualification", description: "Performance sur un tour qualificatif." },
  pluie: { group: "technique", label: "Pluie", description: "Pilotage sous la pluie." },
  feeling: { group: "technique", label: "Feeling", description: "Ressenti et réglages du châssis." },
  concentration: { group: "mental", label: "Concentration", description: "Réduit le risque d'erreur/abandon (compte dans la fiabilité)." },
  agressivite: { group: "mental", label: "Agressivité", description: "Prise de risque en piste." },
  sangFroid: { group: "mental", label: "Sang-froid", description: "Gestion du stress (compte dans la fiabilité)." },
  rigueur: { group: "mental", label: "Rigueur", description: "Évite les fautes et pénalités (compte dans la fiabilité)." },
  leadership: { group: "mental", label: "Leadership", description: "Capacité à tirer l'écurie vers le haut." },
  anticipation: { group: "mental", label: "Anticipation", description: "Lecture de la course à l'avance." },
  decision: { group: "mental", label: "Décision", description: "Qualité des choix stratégiques en course." },
  inspiration: { group: "mental", label: "Inspiration", description: "Capacité à hausser son niveau dans les grands rendez-vous." },
  confiance: { group: "mental", label: "Confiance", description: "Assurance au volant." },
  professionnalisme: { group: "mental", label: "Professionnalisme", description: "Sérieux dans le travail avec l'écurie." },
  resilience: { group: "mental", label: "Résilience", description: "Capacité à rebondir après une contre-performance." },
  condition: { group: "physique", label: "Condition physique", description: "Forme physique générale." },
  reflexes: { group: "physique", label: "Réflexes", description: "Vitesse de réaction." },
  resistance: { group: "physique", label: "Résistance", description: "Endurance physique sur les longues courses ; réduit les abandons en Endurance." },
  visionPeripherique: { group: "physique", label: "Vision périphérique", description: "Perception des autres pilotes autour de la monoplace." },
  resistanceChaleur: { group: "physique", label: "Résistance chaleur", description: "Tolérance aux fortes chaleurs en cockpit." },
  circuit: { group: "discipline", label: "Circuit", description: "Niveau global sur circuit (Karting à F1)." },
  rallye: { group: "discipline", label: "Rallye", description: "Niveau global en rallye." },
  ovale: { group: "discipline", label: "Ovale", description: "Niveau global sur ovale (catégorie future)." },
  endurance: { group: "discipline", label: "Endurance", description: "Niveau global en endurance (WEC)." },
};

export const ATTRIBUTE_GROUPS = ["technique", "mental", "physique", "discipline"];
export const GROUP_LABELS = { technique: "Technique", mental: "Mental", physique: "Physique", discipline: "Discipline" };

function pickFavoriteNumbers(rng) {
  const numbers = new Set();
  while (numbers.size < 5) {
    numbers.add(1 + Math.floor(rng() * 99));
  }
  return [...numbers];
}

// How a driver's REAL ceiling compares to their displayed "potential" — three outcomes instead
// of one flat ratio: usually very close (scouts got it right), rarely a genuine shortfall
// (bust — 8%), and rarely an underestimate (scouts undersold them — 5%, capped at a modest
// overshoot rather than a second wonderkid roll in disguise). Shared by generateDriver and
// generateAIDriver (team.js) so both distributions stay identical.
export function rollGrowthCeiling(potential, rng) {
  const roll = rng();
  if (roll < 0.08) return potential * (0.6 + rng() * 0.25);
  if (roll < 0.13) return Math.min(99, potential * (1 + rng() * 0.08));
  return potential * (0.92 + rng() * 0.08);
}

export function generateDriver(rng, { minAge = 16, maxAge = 19, scoutSkill = 0 } = {}) {
  const age = Math.floor(minAge + rng() * (maxAge - minAge + 1));

  // Wonderkid: a rare, exceptionally gifted YOUNG prospect — low probability by design, so
  // finding one stays a genuine "did I just find a gem" moment instead of a routine outcome.
  // Potential scale: 94-99 is "extraordinaire" and reserved for this rare branch alone; 93 is
  // the best an ordinary roll can ever reach ("excellente note"). Without that 93 cap, the
  // normal 40-99 spread already put a prospect at 94+ too often (~13% of the time) for the
  // wonderkid label to mean anything.
  const isWonderkid = age <= 19 && rng() < 0.03;
  const potential = isWonderkid ? clamp(94 + rng() * 5, 94, 99) : clamp(40 + scoutSkill * 0.15 + rng() * 53, 40, 93);

  // How far below potential a driver's CURRENT attributes sit — shrinks with age. A raw
  // 16-year-old is mostly unrealized promise; an older prospect (recruiters can turn up
  // experienced free agents too, see refillScoutPool) has already had years to develop toward
  // whatever they're going to become, so their current level should read as a known quantity,
  // not a rookie's blank slate.
  const ageProgress = clamp((age - minAge) / 12, 0, 1);
  const baseGap = clamp(25 - scoutSkill * 0.15 + rng() * 20, 5, 45);
  const startingGap = baseGap * (1 - ageProgress * 0.75);
  // Bounding the center before applying the swing keeps the swing a genuine spread rather
  // than a floor-collapse: for a low-potential driver, potential - startingGap can sit near
  // 0, and a ±25 swing on top of that pinned most of their attributes at the 20 floor instead
  // of actually varying.
  const attributeCenter = clamp(potential - startingGap, 30, 90);
  const attributes = {};
  for (const key of Object.keys(ATTRIBUTE_META)) {
    // Wide per-attribute swing so a driver's individual characteristics can differ sharply
    // from one another (a weak Freinage next to a strong Pilotage), not just cluster tightly
    // around the same base level — this is what makes scouting individual traits meaningful.
    const swing = (rng() * 2 - 1) * 20;
    attributes[key] = clamp(attributeCenter + swing, 20, 95);
  }
  const sex = rng() < 0.5 ? "F" : "M";
  return {
    id: nextId++,
    name: randomName(rng, sex),
    sex,
    age,
    categoryId: null,
    contract: null,
    scouted: false,
    scoutReveal: null,
    isPro: false,
    // Rare "Bronze" driver rating (endurance Pro-Am convention — MLMC/ELMS PRO/AM & GT3
    // classes require at least one bronze crewmate per car, see team.js/data.js). Fixed at
    // generation like isPro, never recalculated.
    isBronze: rng() < BRONZE_CHANCE,
    attributes,
    potential: Math.round(potential),
    // Never revealed anywhere (not even deep scouting) — see rollGrowthCeiling above.
    growthCeiling: rollGrowthCeiling(potential, rng),
    // A second, fully independent hidden factor — how FAST a driver develops toward their
    // ceiling, not WHERE that ceiling sits. Rolled once at generation, never surfaced in any
    // tooltip or scouting reveal. Two prospects with identical displayed stats can age into
    // clearly different careers, and there's no way for the player to find out which is which
    // ahead of time — same principle real scouting struggles with (intangible "coachability").
    growthLuck: 0.75 + rng() * 0.5,
    favoriteNumbers: pickFavoriteNumbers(rng),
    raceNumber: null,
    raceNumberCategoryId: null,
    secondarySeats: [],
    injuryWeeksRemaining: 0,
    highestTierReached: 0,
    adaptationWeeksRemaining: 0,
    benchedWeeks: 0,
    agencyRelationship: 70,
    teamRelationship: 60,
    negotiationPatience: 100,
    negotiationCounterOffer: null,
    bestPositionThisSeason: null,
    form: 50,
    careerResults: [],
    seasonHistory: [],
    pendingOffers: [],
    pendingOfferBudget: 0,
    proposedAt: null,
    offersExpireAt: null,
    pendingSecondaryOffers: [],
    secondaryProposedAt: null,
    secondaryOffersExpireAt: null,
    pendingSubstituteOffer: null,
    pendingTransferOffer: null,
    // Appended last so it consumes rng() after every other field — preserves the existing
    // rng call sequence (and thus seeded/deterministic generation) for everything above.
    traits: assignDriverTraits(rng),
    acquiredTraitIds: [],
  };
}

export function pickRaceNumber(favoriteNumbers, usedSet, rng) {
  let chosen = favoriteNumbers.find((n) => !usedSet.has(n));
  if (chosen == null) {
    // Bounded random retries first; if the 1-99 pool is nearly exhausted, fall back to a
    // deterministic linear scan so this can never spin forever on an array/count mismatch.
    let attempts = 0;
    do {
      chosen = 1 + Math.floor(rng() * 99);
      attempts += 1;
    } while (usedSet.has(chosen) && attempts < 200);
    if (usedSet.has(chosen)) {
      chosen = null;
      for (let n = 1; n <= 99; n++) {
        if (!usedSet.has(n)) {
          chosen = n;
          break;
        }
      }
      chosen ??= 1 + Math.floor(rng() * 99);
    }
  }
  usedSet.add(chosen);
  return chosen;
}

export function getDriverById(state, id) {
  return state.drivers.find((d) => d.id === id) ?? state.aiDrivers[id] ?? null;
}

function disciplineKeyFor(category) {
  return category?.profile ?? "circuit";
}

export function groupAverage(driver, group) {
  const keys = Object.keys(ATTRIBUTE_META).filter((k) => ATTRIBUTE_META[k].group === group);
  return keys.reduce((sum, k) => sum + driver.attributes[k], 0) / keys.length;
}

// Super stats: the real performance/negotiation/growth inputs, each a plain average of a
// handful of the 32 raw attributes. Raw attributes stay the generation/growth/scouting layer
// underneath (per-attribute scouting windows, individual drift) — the super stats are what
// the rest of the game actually reads. Régularité mirrors the old reliability() attribute set
// (+2 related attributes); the other four replace the old technique/mental/physique split.
export const SUPER_STATS = {
  rythme: { label: "Rythme", attrs: ["pilotage", "freinage", "trajectoire", "qualification", "feeling", "depart"] },
  regularite: { label: "Régularité", attrs: ["sangFroid", "concentration", "rigueur", "professionnalisme", "resilience"] },
  resistance: { label: "Résistance", attrs: ["condition", "reflexes", "resistance", "visionPeripherique", "resistanceChaleur"] },
  adaptabilite: { label: "Adaptabilité", attrs: ["adaptation", "gestionPneus", "pluie", "evitement", "defense", "depassement"] },
  instinct: { label: "Instinct", attrs: ["agressivite", "leadership", "anticipation", "decision", "inspiration", "confiance"] },
};

export function superStat(driver, key) {
  const stat = SUPER_STATS[key];
  const base = stat.attrs.reduce((sum, k) => sum + driver.attributes[k], 0) / stat.attrs.length;
  return clamp(base + traitStatBonus(driver, key), 0, 99);
}

export function superStatTooltip(key) {
  return SUPER_STATS[key].attrs.map((a) => ATTRIBUTE_META[a].label).join(", ");
}

// A scouted-but-not-owned driver's super stats are no longer shown as an exact number —
// derived instead from whichever component attributes scouting has actually windowed
// (attributeWidths), same uncertainty-propagation idea as the raw attributes themselves.
// A component with no window yet contributes its full [0, 99] range to the average, so an
// unrevealed attribute widens the super stat's bounds instead of silently being ignored.
// Trait bonus is only folded in once traits are actually known (deep scout) — omitted
// otherwise rather than guessed, since an unknown trait's effect is unknown too.
export function superStatRange(driver, key) {
  const stat = SUPER_STATS[key];
  const widths = driver.scoutReveal?.attributeWidths;
  let sumLow = 0;
  let sumHigh = 0;
  let revealedCount = 0;
  for (const a of stat.attrs) {
    const width = widths?.[a];
    if (width !== undefined) {
      const actual = driver.attributes[a];
      sumLow += clamp(actual - width / 2, 0, 99);
      sumHigh += clamp(actual + width / 2, 0, 99);
      revealedCount += 1;
    } else {
      sumHigh += 99;
    }
  }
  const bonus = driver.scoutReveal?.traitsKnown ? traitStatBonus(driver, key) : 0;
  const low = clamp(Math.round(sumLow / stat.attrs.length + bonus), 0, 99);
  const high = clamp(Math.round(sumHigh / stat.attrs.length + bonus), 0, 99);
  return { low, high, revealedCount, total: stat.attrs.length };
}

// Same category differentiation as before (circuit/endurance/rallye), just redistributed
// across the 5 super stats instead of the old technique/mental/physique/discipline groups —
// same totals per profile, same discipline weight.
const OVERALL_WEIGHTS_BY_PROFILE = {
  circuit: { rythme: 0.2, adaptabilite: 0.2, instinct: 0.25, resistance: 0.1, discipline: 0.25 },
  endurance: { rythme: 0.15, adaptabilite: 0.15, instinct: 0.2, resistance: 0.25, discipline: 0.25 },
  rallye: { rythme: 0.15, adaptabilite: 0.15, instinct: 0.25, resistance: 0.15, discipline: 0.3 },
};

function overallWeightsFor(category) {
  return OVERALL_WEIGHTS_BY_PROFILE[category?.profile] ?? OVERALL_WEIGHTS_BY_PROFILE.circuit;
}

export function overallRating(driver) {
  const category = driver.categoryId ? CATEGORY_BY_ID[driver.categoryId] : null;
  const weights = overallWeightsFor(category);
  const disciplineKey = disciplineKeyFor(category);
  return (
    superStat(driver, "rythme") * weights.rythme +
    superStat(driver, "adaptabilite") * weights.adaptabilite +
    superStat(driver, "instinct") * weights.instinct +
    superStat(driver, "resistance") * weights.resistance +
    driver.attributes[disciplineKey] * weights.discipline
  );
}

// A driver moving up to a genuinely new tier (assignSeat/joinSecondaryChampionship, team.js —
// not a one-off substitute, which deliberately never triggers this) doesn't perform at their
// full rating right away: raw skill built up dominating karting doesn't transfer 1:1 to F1.
// The penalty only ever applies inside race simulation (simulateClassRace, simulate.js) — the
// driver's displayed stats/rating never change, so this reads as "underperforming their stats"
// on track while they adapt, not a stat regression the player can see coming.
export const TIER_ADAPTATION_WEEKS = 12;
const TIER_ADAPTATION_MAX_PENALTY = 0.25;

export function tierAdaptationFactor(driver) {
  const weeksRemaining = driver.adaptationWeeksRemaining ?? 0;
  if (weeksRemaining <= 0) return 1;
  return 1 - (weeksRemaining / TIER_ADAPTATION_WEEKS) * TIER_ADAPTATION_MAX_PENALTY;
}

export function reliability(driver) {
  return superStat(driver, "regularite");
}

// F3 (tier PRO_TIER_THRESHOLD - 1) runs Amateur economics (isPro false) but is displayed as
// its own "Semi-Pro" tier rather than lumped in with karting/F4's plain "Amateur" label.
export function driverStatusLabel(driver, category) {
  if (driver.isPro) return "Pro";
  if (category?.tier === PRO_TIER_THRESHOLD - 1) return "Semi-Pro";
  return "Amateur";
}

export function peakAge(driver) {
  return 27 + Math.round((driver.potential - 70) / 15);
}

export function growDriver(driver, rng, growthMultiplier = 1) {
  const peak = peakAge(driver);
  const rating = overallRating(driver);
  const keys = Object.keys(driver.attributes);
  if (driver.age < peak) {
    const room = (driver.growthCeiling ?? driver.potential) - rating;
    // Growth is fastest early in a career and tapers off as the driver approaches their peak
    // age — most development happens as a young prospect, not at a flat rate all the way to
    // physical/mental maturity. 10+ years from peak caps the bonus at 1.3x; right at the peak
    // it floors at 0.3x (the age<peak branch simply stops applying once age reaches peak).
    const yearsToPeak = Math.max(1, peak - driver.age);
    const ageFactor = clamp(yearsToPeak / 10, 0.3, 1.3);
    // A higher-potential prospect isn't just capped higher (growthCeiling) — they also pick
    // things up a bit faster, on top of that larger ceiling.
    const potentialFactor = 0.85 + (driver.potential / 99) * 0.3;
    // Base rate halved from the original 0.06-0.12 — progression (especially for a young,
    // high-potential driver at a fully-upgraded agency) was reaching full potential within a
    // single season, leaving no sense of a multi-season development arc.
    // growthLuck (0.75-1.25, fixed at generation, never shown anywhere) is the invisible
    // component — two prospects with identical known stats can still turn out to develop at
    // meaningfully different paces.
    const growth =
      Math.max(0, room * (0.035 + rng() * 0.035)) * growthMultiplier * ageFactor * potentialFactor * (driver.growthLuck ?? 1);
    const breakthrough = rng() < 0.02 ? rng() * 2 : 0;
    for (const key of keys) {
      driver.attributes[key] = clamp(driver.attributes[key] + (growth + breakthrough) * (0.7 + rng() * 0.3), 0, 99);
    }
  } else if (driver.age > peak + 3) {
    const decline = 0.5 + rng() * 1.2;
    for (const key of keys) {
      driver.attributes[key] = clamp(driver.attributes[key] - decline * (0.7 + rng() * 0.3), 0, 99);
    }
  }
}
