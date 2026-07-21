// Traits: fixed at generation (like attributes/potential), hidden behind deep scouting for
// drivers (same convention as potentialKnown — see scoutReveal.js), always visible for staff
// (staff has no scouting/reveal system at all). Modifiers on stats and dilemma outcomes.

export const DRIVER_TRAITS = {
  // Instinct
  daredevil: { label: "Casse-cou", description: "Plus instinctif en piste, mais prend plus de risques dans les moments délicats.", statEffects: { instinct: 4 } },
  timid: { label: "Timide", description: "Manque d'aplomb dans les moments décisifs.", statEffects: { instinct: -4 } },
  leader: { label: "Leader né", description: "Tire l'écurie vers le haut, gère bien la pression du groupe.", statEffects: { instinct: 3 }, eventBias: { "push-driver": 0.1 } },
  // Régularité
  cautious: { label: "Prudent", description: "Plus régulier, mais moins percutant dans les moments décisifs.", statEffects: { regularite: 4 } },
  steelNerves: { label: "Nerfs d'acier", description: "Garde son sang-froid dans les discussions les plus tendues.", statEffects: { regularite: 4 }, eventBias: { "salary-negotiation": 0.1 } },
  hotHead: { label: "Tête brûlée", description: "S'emporte facilement, ce qui lui joue parfois des tours.", statEffects: { regularite: -4 }, eventBias: { "bad-form": -0.1 } },
  // Résistance
  ironman: { label: "Increvable", description: "Résiste mieux à la fatigue et aux efforts physiques prolongés.", statEffects: { resistance: 4 } },
  fragile: { label: "Fragile", description: "Plus sujet aux petits pépins physiques.", statEffects: { resistance: -4 } },
  // Adaptabilité
  rainMaster: { label: "Pilote de pluie", description: "Sublime sous la pluie, plus quelconque par temps sec.", statEffects: { adaptabilite: 4 } },
  allWeather: { label: "Tout-terrain", description: "S'adapte vite à n'importe quelle monoplace ou situation de course.", statEffects: { adaptabilite: 4 } },
  rigid: { label: "Rigide", description: "A du mal à sortir de ses habitudes.", statEffects: { adaptabilite: -4 } },
  // Rythme
  flatOut: { label: "Pied au plancher", description: "Toujours à la limite, rarement en retrait sur un tour lancé.", statEffects: { rythme: 4 } },
  slowStarter: { label: "Lent au démarrage", description: "Met du temps à trouver son rythme en piste.", statEffects: { rythme: -4 } },
  standoffish: { label: "Solitaire", description: "Concentré à l'extrême sur sa performance, au détriment du collectif.", statEffects: { rythme: 3 }, eventBias: { "bad-form": -0.1 } },
  // Sans effet de stat, purement dilemmes
  charismatic: { label: "Charismatique", description: "À l'aise avec les médias et les sponsors.", eventBias: { "media-invitation": 0.15, "sponsor-conditions": 0.15 } },
};

export const STAFF_TRAITS = {
  mentor: { label: "Mentor", description: "Particulièrement pédagogue, améliore l'effet de son rôle et aide un pilote à encaisser la pression.", skillBonus: 5, eventBias: { "push-driver": 0.1 } },
  gifted: { label: "Doué", description: "Naturellement au-dessus du lot dans son domaine.", skillBonus: 5 },
  prodigy: { label: "Prodige", description: "Un talent rare, au-dessus de la moyenne du métier.", skillBonus: 7 },
  veteran: { label: "Vétéran", description: "L'expérience compense ce qui manque ailleurs, et aide un pilote à sortir d'une mauvaise passe.", skillBonus: 5, eventBias: { "bad-form": 0.1 } },
  workhorse: { label: "Bosseur", description: "Constant et appliqué, sans éclat mais fiable.", skillBonus: 3 },
  burnout: { label: "Fatigable", description: "Moins constant, l'effet de son rôle en pâtit.", skillBonus: -5 },
  sloppy: { label: "Négligent", description: "Manque de rigueur dans son travail.", skillBonus: -5 },
  inconsistent: { label: "Inconstant", description: "Des hauts et des bas qui nuisent à son efficacité.", skillBonus: -3 },
  persuasive: { label: "Beau parleur", description: "Doué pour convaincre en négociation comme face aux sponsors.", eventBias: { "salary-negotiation": 0.15, "sponsor-conditions": 0.1 } },
  mediaSavvy: { label: "Bon communicant", description: "À l'aise pour préparer un pilote face aux médias.", eventBias: { "media-invitation": 0.15 } },
};

// Local Fisher-Yates shuffle — deliberately not shared with scoutReveal.js's shuffledRevealKeys,
// which is keyed on ATTRIBUTE_META; traits.js has no reason to depend on driver.js.
function shuffle(rng, arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// thresholds: [[count, cumulativeProbability], ...] in ascending order, e.g.
// [[0, 0.2], [1, 0.85], [2, 1]] -> 20% zero, 65% one, 15% two.
function pickCount(rng, thresholds) {
  const roll = rng();
  for (const [count, threshold] of thresholds) {
    if (roll < threshold) return count;
  }
  return thresholds[thresholds.length - 1][0];
}

export function assignDriverTraits(rng) {
  const count = pickCount(rng, [[0, 0.2], [1, 0.85], [2, 1]]);
  return shuffle(rng, Object.keys(DRIVER_TRAITS)).slice(0, count);
}

export function assignStaffTraits(rng) {
  const count = pickCount(rng, [[0, 0.6], [1, 1]]);
  return shuffle(rng, Object.keys(STAFF_TRAITS)).slice(0, count);
}

export function traitStatBonus(driver, superStatKey) {
  return (driver.traits ?? []).reduce((sum, id) => sum + (DRIVER_TRAITS[id]?.statEffects?.[superStatKey] ?? 0), 0);
}

export function traitEventBias(driver, eventId) {
  return (driver.traits ?? []).reduce((sum, id) => sum + (DRIVER_TRAITS[id]?.eventBias?.[eventId] ?? 0), 0);
}

export function staffTraitSkillBonus(member) {
  return (member.traits ?? []).reduce((sum, id) => sum + (STAFF_TRAITS[id]?.skillBonus ?? 0), 0);
}

// Sums the bias of ALL hired staff (not scoped to a single role) for a given dilemma — a
// dilemma only ever targets a driver (event.driverId), never a staff member, so staff act here
// as a general support layer rather than the direct actor of the event.
export function staffTraitEventBias(state, eventId) {
  return state.staff.reduce(
    (sum, member) => sum + (member.traits ?? []).reduce((s, id) => s + (STAFF_TRAITS[id]?.eventBias?.[eventId] ?? 0), 0),
    0
  );
}

// Local labels rather than importing SUPER_STATS from driver.js — driver.js already imports
// this module, so importing back would create a cycle.
const STAT_LABELS = {
  rythme: "Rythme",
  regularite: "Régularité",
  resistance: "Résistance",
  adaptabilite: "Adaptabilité",
  instinct: "Instinct",
};

// Human-readable names for the handful of dilemmas a trait's eventBias can target — matches
// each event's actual `title` in events.js.
const EVENT_LABELS = {
  "push-driver": "Programme d'entraînement intensif",
  "sponsor-conditions": "Sponsor exigeant",
  "media-invitation": "Invitation média exclusive",
  "salary-negotiation": "Négociation salariale",
  "bad-form": "Méforme",
};

function formatSigned(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function eventBiasParts(eventBias) {
  if (!eventBias) return [];
  // Guillemets, not straight double quotes — this string gets embedded inside a title="..."
  // HTML attribute, and a literal " would prematurely close it and truncate/corrupt the tooltip.
  return Object.entries(eventBias).map(
    ([eventId, value]) => `Dilemme « ${EVENT_LABELS[eventId] ?? eventId} » ${formatSigned(Math.round(value * 100))}%`
  );
}

// Tooltip text spelling out exactly which stat(s) a trait moves and by how much, plus any
// dilemma it biases — not just the flavor description, so the mechanical effect is never a
// mystery on hover.
export function driverTraitTooltip(id) {
  const trait = DRIVER_TRAITS[id];
  const parts = [];
  if (trait.statEffects) {
    for (const [key, value] of Object.entries(trait.statEffects)) {
      parts.push(`${STAT_LABELS[key] ?? key} ${formatSigned(value)}`);
    }
  }
  parts.push(...eventBiasParts(trait.eventBias));
  return parts.length ? `${trait.description} (${parts.join(" · ")})` : trait.description;
}

export function staffTraitTooltip(id) {
  const trait = STAFF_TRAITS[id];
  const parts = [];
  if (trait.skillBonus) parts.push(`Compétence principale ${formatSigned(trait.skillBonus)}`);
  parts.push(...eventBiasParts(trait.eventBias));
  return parts.length ? `${trait.description} (${parts.join(" · ")})` : trait.description;
}
