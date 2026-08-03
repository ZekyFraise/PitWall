import { recordTransaction } from "./finance.js";
import { applyReputationGain } from "./data.js";

// Personal lifestyle of the agent — deliberately separate from FACILITIES (infrastructure.js).
// Corrected in chat: no weekly upkeep at all (removed) — instead each purchase grants +1
// reputation (routed through applyReputationGain like every other source, so the diminishing
// curve still applies), paid for by the escalating upgradeCost itself. 10 levels per category
// (far more than the agency's 5-8) so there's always somewhere further to sink a growing
// treasury, cost roughly doubling each level up into the tens of millions.
export const LIFESTYLE = {
  house: {
    name: "Logement",
    description: "Cadre de vie personnel de l'agent — pur confort, aucun effet sur l'agence.",
    levels: [
      { label: "Studio", upgradeCost: 0 },
      { label: "Appartement modeste", upgradeCost: 40000 },
      { label: "Appartement", upgradeCost: 100000 },
      { label: "Maison", upgradeCost: 250000 },
      { label: "Maison spacieuse", upgradeCost: 500000 },
      { label: "Villa", upgradeCost: 1000000 },
      { label: "Villa de luxe", upgradeCost: 2000000 },
      { label: "Manoir", upgradeCost: 4000000 },
      { label: "Château", upgradeCost: 8000000 },
      { label: "Propriété d'exception", upgradeCost: 15000000 },
    ],
  },
  car: {
    name: "Véhicule",
    description: "Voiture personnelle de l'agent — pur confort, aucun effet sur l'agence.",
    levels: [
      { label: "Citadine", upgradeCost: 0 },
      { label: "Compacte", upgradeCost: 20000 },
      { label: "Berline", upgradeCost: 50000 },
      { label: "Break premium", upgradeCost: 120000 },
      { label: "Sportive", upgradeCost: 250000 },
      { label: "Sportive haut de gamme", upgradeCost: 500000 },
      { label: "Supercar", upgradeCost: 1000000 },
      { label: "Hypercar", upgradeCost: 2000000 },
      { label: "Collection (2 véhicules)", upgradeCost: 4000000 },
      { label: "Collection complète", upgradeCost: 7500000 },
    ],
  },
  education: {
    name: "Formation personnelle",
    description: "Développement personnel de l'agent — pur confort, aucun effet sur l'agence.",
    levels: [
      { label: "Autodidacte", upgradeCost: 0 },
      { label: "Formation continue", upgradeCost: 25000 },
      { label: "Certification", upgradeCost: 60000 },
      { label: "Executive MBA", upgradeCost: 150000 },
      { label: "MBA prestigieux", upgradeCost: 300000 },
      { label: "Coaching exécutif", upgradeCost: 600000 },
      { label: "Coaching de haut niveau", upgradeCost: 1200000 },
      { label: "Cercle fermé", upgradeCost: 2500000 },
      { label: "Réseau international", upgradeCost: 5000000 },
      { label: "Académie personnelle", upgradeCost: 9000000 },
    ],
  },
};

const LIFESTYLE_REPUTATION_GAIN = 1;

export function lifestyleMaxLevel(id) {
  return LIFESTYLE[id].levels.length;
}

export function getLifestyleLevelData(state, id) {
  return LIFESTYLE[id].levels[state.lifestyle[id] - 1];
}

export function nextLifestyleLevelData(state, id) {
  return LIFESTYLE[id].levels[state.lifestyle[id]] ?? null;
}

export function upgradeLifestyle(state, id, { force = false } = {}) {
  const next = nextLifestyleLevelData(state, id);
  if (!next) return { ok: false, error: "Niveau maximum atteint." };
  const cost = force ? 0 : next.upgradeCost;
  if (!force && state.agency.money < cost) return { ok: false, error: "Budget insuffisant." };
  if (cost) {
    state.agency.money -= cost;
    recordTransaction(state, "lifestyle-upgrade", `${LIFESTYLE[id].name} — ${next.label}`, -cost);
  }
  state.lifestyle[id] += 1;
  applyReputationGain(state, LIFESTYLE_REPUTATION_GAIN);
  return { ok: true };
}
