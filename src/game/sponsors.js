// Sponsoring: a single dedicated recurring contract for the agency (weekly income + win/podium
// bonuses), distinct from the one-off sponsor dilemmas in events.js. Pool/sign pattern mirrors
// staffPool/refillStaffPool/hireStaff (staff.js) exactly, just for a single-slot contract instead
// of a roster.

const SPONSOR_POOL_SIZE = 3;

export const SPONSOR_TIERS = [
  { id: "bronze", label: "Bronze", repRequired: 0, weeklyIncome: [150, 400], winBonus: 300, podiumBonus: 100, durationWeeks: [8, 16] },
  { id: "silver", label: "Argent", repRequired: 25, weeklyIncome: [400, 900], winBonus: 800, podiumBonus: 250, durationWeeks: [8, 16] },
  { id: "gold", label: "Or", repRequired: 55, weeklyIncome: [900, 1800], winBonus: 2000, podiumBonus: 600, durationWeeks: [8, 16] },
  { id: "platinum", label: "Platine", repRequired: 85, weeklyIncome: [1800, 3500], winBonus: 5000, podiumBonus: 1500, durationWeeks: [8, 16] },
];

const SPONSOR_NAMES = [
  "Voltis Énergie", "Meridian Bank", "Aurora Télécom", "Zenith Motors Oil", "Kryon Boissons",
  "Lumina Tech", "Cobalt Assurance", "Nordic Air", "Solstice Media", "Vantage Pneus",
  "Ferrovia Logistique", "Cascade Horlogerie", "Titan Constructions", "Nébuleuse Streaming", "Ravel Cosmétiques",
];

function pickEligibleTier(rng, reputation) {
  const eligible = SPONSOR_TIERS.filter((t) => reputation >= t.repRequired);
  return eligible[Math.floor(rng() * eligible.length)];
}

function randomInRange(rng, [min, max]) {
  return Math.round(min + rng() * (max - min));
}

let nextSponsorId = 1;

function generateSponsorOffer(rng, state) {
  const tier = pickEligibleTier(rng, state.agency.reputation);
  return {
    id: nextSponsorId++,
    name: SPONSOR_NAMES[Math.floor(rng() * SPONSOR_NAMES.length)],
    tierId: tier.id,
    weeklyIncome: randomInRange(rng, tier.weeklyIncome),
    winBonus: tier.winBonus,
    podiumBonus: tier.podiumBonus,
    durationWeeks: randomInRange(rng, tier.durationWeeks),
  };
}

export function refillSponsorPool(state, rng) {
  while (state.sponsorPool.length < SPONSOR_POOL_SIZE) {
    state.sponsorPool.push(generateSponsorOffer(rng, state));
  }
}

export function signSponsor(state, offerId) {
  if (state.activeSponsor) return { ok: false, error: "Un sponsor est déjà sous contrat — résilie-le d'abord." };
  const idx = state.sponsorPool.findIndex((o) => o.id === offerId);
  if (idx === -1) return { ok: false, error: "Offre introuvable." };
  const offer = state.sponsorPool[idx];
  state.sponsorPool.splice(idx, 1);
  state.activeSponsor = { ...offer, weeksRemaining: offer.durationWeeks };
  return { ok: true };
}

// Reputation-only exit cost (no cash fee) — scaled by tier rank so breaking a Platine deal stings
// more than a Bronze one. Mirrors releaseDriver's flat RELEASE_REPUTATION_PENALTY (state.js).
export function terminateSponsor(state) {
  if (!state.activeSponsor) return { ok: false, error: "Aucun sponsor sous contrat." };
  const tierRank = SPONSOR_TIERS.findIndex((t) => t.id === state.activeSponsor.tierId) + 1;
  state.agency.reputation = Math.max(0, state.agency.reputation - tierRank);
  state.activeSponsor = null;
  return { ok: true };
}
