import { recordTransaction } from "./finance.js";
import { POACH_WARNING_THRESHOLD } from "./rivals.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const EVENT_TRIGGER_CHANCE = 0.35;

export const INJURY_WEEKS = 2;

const INFO_EVENTS = [
  {
    id: "sponsor-bonus",
    weight: 3,
    condition: () => true,
    run: (state, rng) => {
      const amount = Math.round(2000 + rng() * 6000 + state.agency.reputation * 40);
      state.agency.money += amount;
      recordTransaction(state, "random-event", "Sponsor ponctuel", amount);
      return { tone: "good", title: "Sponsor ponctuel", text: `Un sponsor ponctuel soutient l'agence : +${amount.toLocaleString("fr-FR")}€.` };
    },
  },
  {
    id: "unexpected-expense",
    weight: 3,
    condition: () => true,
    run: (state, rng) => {
      const amount = Math.round(1000 + rng() * 4000);
      state.agency.money -= amount;
      recordTransaction(state, "random-event", "Frais imprévus", -amount);
      return { tone: "bad", title: "Frais imprévus", text: `Déplacement, matériel : -${amount.toLocaleString("fr-FR")}€.` };
    },
  },
  {
    id: "media-buzz",
    weight: 2,
    condition: () => true,
    run: (state, rng) => {
      const delta = 1 + Math.floor(rng() * 2);
      state.agency.reputation += delta;
      return { tone: "good", title: "Buzz médiatique", text: `Bon coup médiatique pour l'agence : réputation +${delta}.` };
    },
  },
  {
    id: "pr-blunder",
    weight: 2,
    condition: (state) => state.agency.reputation > 0,
    run: (state, rng) => {
      const delta = Math.min(state.agency.reputation, 1 + Math.floor(rng() * 3));
      state.agency.reputation -= delta;
      return { tone: "bad", title: "Bourde de communication", text: `Réputation -${delta}.` };
    },
  },
  {
    id: "driver-highlight",
    weight: 2,
    condition: (state) => state.drivers.length > 0,
    run: (state, rng) => {
      const driver = state.drivers[Math.floor(rng() * state.drivers.length)];
      driver.agencyRelationship = clamp(driver.agencyRelationship + 8, 0, 200);
      return { tone: "good", title: "Relation renforcée", driverName: driver.name, text: `${driver.name} apprécie particulièrement le suivi de l'agence (relation +8).` };
    },
  },
  {
    id: "driver-friction",
    weight: 2,
    condition: (state) => state.drivers.length > 0,
    run: (state, rng) => {
      const driver = state.drivers[Math.floor(rng() * state.drivers.length)];
      driver.agencyRelationship = clamp(driver.agencyRelationship - 6, 0, 200);
      return { tone: "bad", title: "Tension", driverName: driver.name, text: `${driver.name} traverse une phase de doute vis-à-vis de l'agence (relation -6).` };
    },
  },
  {
    id: "investor-interest",
    weight: 1,
    condition: (state) => state.agency.reputation >= 15,
    run: (state, rng) => {
      const amount = Math.round(8000 + rng() * 12000);
      state.agency.money += amount;
      recordTransaction(state, "random-event", "Investisseur intéressé", amount);
      return { tone: "good", title: "Investisseur intéressé", text: `Un investisseur voit du potentiel dans l'agence : +${amount.toLocaleString("fr-FR")}€.` };
    },
  },
  {
    id: "scouting-tip",
    weight: 2,
    condition: (state) => state.scoutPool.some((d) => !d.scouted),
    run: (state, rng) => {
      const candidates = state.scoutPool.filter((d) => !d.scouted);
      const driver = candidates[Math.floor(rng() * candidates.length)];
      driver.scouted = true;
      return { tone: "good", title: "Tuyau de recruteur", text: `Un tuyau permet de scouter gratuitement ${driver.name}.` };
    },
  },
];

const CHOICE_EVENTS = [
  {
    id: "push-driver",
    weight: 3,
    condition: (state) => state.drivers.some((d) => (d.injuryWeeksRemaining ?? 0) <= 0),
    describe: (state, rng) => {
      const eligible = state.drivers.filter((d) => (d.injuryWeeksRemaining ?? 0) <= 0);
      const driver = eligible[Math.floor(rng() * eligible.length)];
      return {
        driverId: driver.id,
        title: "Programme d'entraînement intensif",
        text: `${driver.name} veut suivre un programme d'entraînement intensif avant la prochaine échéance.`,
        options: [
          {
            label: "Autoriser",
            tradeoff: "65% : potentiel +2, relation +4 · 35% : blessure, relation -6",
            successChance: 0.65,
            onSuccess: (state, rng, driver) => {
              driver.growthCeiling = Math.min(99, driver.growthCeiling + 2);
              driver.agencyRelationship = clamp(driver.agencyRelationship + 4, 0, 200);
              return `${driver.name} progresse bien, son potentiel de développement augmente.`;
            },
            onFailure: (state, rng, driver) => {
              driver.injuryWeeksRemaining = INJURY_WEEKS;
              driver.agencyRelationship = clamp(driver.agencyRelationship - 6, 0, 200);
              return `${driver.name} se blesse à l'entraînement — indisponible ${INJURY_WEEKS} semaines.`;
            },
          },
          {
            label: "Refuser, rester prudent",
            tradeoff: "Aucun risque, aucun gain",
            successChance: 1,
            onSuccess: (state, rng, driver) => `${driver.name} continue son programme habituel.`,
          },
        ],
      };
    },
  },
  {
    id: "sponsor-conditions",
    weight: 2,
    condition: (state) => state.agency.reputation >= 5,
    describe: () => ({
      title: "Sponsor exigeant",
      text: "Un sponsor propose un contrat ponctuel à conditions strictes.",
      options: [
        {
          label: "Accepter",
          tradeoff: "70% : +6 000 à 14 000€ · 30% : réputation -1 à -4",
          successChance: 0.7,
          onSuccess: (state, rng) => {
            const amount = Math.round(6000 + rng() * 8000);
            state.agency.money += amount;
            recordTransaction(state, "random-event", "Sponsor exigeant", amount);
            return `Le sponsor est satisfait : +${amount.toLocaleString("fr-FR")}€.`;
          },
          onFailure: (state, rng) => {
            const loss = Math.min(state.agency.reputation, 1 + Math.floor(rng() * 4));
            state.agency.reputation -= loss;
            return `Le partenariat tourne mal : réputation -${loss}.`;
          },
        },
        {
          label: "Décliner",
          tradeoff: "Aucun risque, aucun gain",
          successChance: 1,
          onSuccess: () => "L'agence décline poliment l'offre.",
        },
      ],
    }),
  },
  {
    id: "media-invitation",
    weight: 2,
    condition: (state) => state.drivers.some((d) => (d.injuryWeeksRemaining ?? 0) <= 0),
    describe: (state, rng) => {
      const eligible = state.drivers.filter((d) => (d.injuryWeeksRemaining ?? 0) <= 0);
      const driver = eligible[Math.floor(rng() * eligible.length)];
      return {
        driverId: driver.id,
        title: "Invitation média exclusive",
        text: `${driver.name} est invité à un événement média avant la course.`,
        options: [
          {
            label: "Jouer la carte médiatique à fond",
            tradeoff: "75% : réputation +3, relation +3 · 25% : indisponible 1 semaine",
            successChance: 0.75,
            onSuccess: (state, rng, driver) => {
              state.agency.reputation += 3;
              driver.agencyRelationship = clamp(driver.agencyRelationship + 3, 0, 200);
              return `L'événement se passe bien : réputation +3, relation agence +3.`;
            },
            onFailure: (state, rng, driver) => {
              driver.injuryWeeksRemaining = 1;
              return `${driver.name} revient épuisé de l'événement — indisponible 1 semaine.`;
            },
          },
          {
            label: "Présence discrète, limiter l'exposition",
            tradeoff: "Réputation +1, sans risque",
            successChance: 1,
            onSuccess: (state) => {
              state.agency.reputation += 1;
              return "Présence discrète : réputation +1, aucun risque pris.";
            },
          },
          {
            label: "Décliner l'invitation",
            tradeoff: "Aucun effet",
            successChance: 1,
            onSuccess: () => "L'agence décline poliment l'invitation.",
          },
        ],
      };
    },
  },
  {
    id: "salary-negotiation",
    weight: 2,
    condition: (state) => state.drivers.some((d) => d.contract),
    describe: (state, rng) => {
      const eligible = state.drivers.filter((d) => d.contract);
      const driver = eligible[Math.floor(rng() * eligible.length)];
      return {
        driverId: driver.id,
        title: "Négociation salariale",
        text: `${driver.name} demande une revalorisation de son contrat.`,
        options: [
          {
            label: "Accepter la demande",
            tradeoff: "-4 000€, relation +8",
            successChance: 1,
            onSuccess: (state, rng, driver) => {
              state.agency.money -= 4000;
              recordTransaction(state, "random-event", `Revalorisation — ${driver.name}`, -4000);
              driver.agencyRelationship = clamp(driver.agencyRelationship + 8, 0, 200);
              return `${driver.name} est satisfait : relation agence +8, -4 000€.`;
            },
          },
          {
            label: "Proposer un compromis",
            tradeoff: "-1 500€ · 60% : relation +3 · 40% : relation -2",
            successChance: 0.6,
            onSuccess: (state, rng, driver) => {
              state.agency.money -= 1500;
              recordTransaction(state, "random-event", `Compromis salarial — ${driver.name}`, -1500);
              driver.agencyRelationship = clamp(driver.agencyRelationship + 3, 0, 200);
              return `Compromis accepté : relation agence +3, -1 500€.`;
            },
            onFailure: (state, rng, driver) => {
              state.agency.money -= 1500;
              recordTransaction(state, "random-event", `Compromis salarial — ${driver.name}`, -1500);
              driver.agencyRelationship = clamp(driver.agencyRelationship - 2, 0, 200);
              return `${driver.name} juge le compromis insuffisant : relation agence -2, -1 500€.`;
            },
          },
          {
            label: "Refuser",
            tradeoff: "Aucun coût, relation -6",
            successChance: 1,
            onSuccess: (state, rng, driver) => {
              driver.agencyRelationship = clamp(driver.agencyRelationship - 6, 0, 200);
              return `${driver.name} est déçu : relation agence -6.`;
            },
          },
        ],
      };
    },
  },
  {
    id: "poach-dilemma",
    weight: 4,
    condition: (state) =>
      state.drivers.some((d) => d.teamId == null && (d.agencyRelationship ?? 0) < POACH_WARNING_THRESHOLD),
    describe: (state, rng) => {
      const eligible = state.drivers.filter((d) => d.teamId == null && (d.agencyRelationship ?? 0) < POACH_WARNING_THRESHOLD);
      const driver = eligible[Math.floor(rng() * eligible.length)];
      return {
        driverId: driver.id,
        title: "Dilemme : approche d'une agence rivale",
        text: `Sans écurie depuis plusieurs semaines, ${driver.name} est directement approché par une agence rivale.`,
        options: [
          {
            label: "Le rassurer personnellement",
            tradeoff: "-2 000€, relation +15",
            successChance: 1,
            onSuccess: (state, rng, driver) => {
              state.agency.money -= 2000;
              recordTransaction(state, "random-event", `Fidélisation — ${driver.name}`, -2000);
              driver.agencyRelationship = clamp(driver.agencyRelationship + 15, 0, 200);
              return `${driver.name} se sent écouté et reste fidèle à l'agence.`;
            },
          },
          {
            label: "Ne rien faire",
            tradeoff: "Aucun coût, risque de départ inchangé",
            successChance: 1,
            onSuccess: (state, rng, driver) => `L'agence ne réagit pas — ${driver.name} reste livré à lui-même.`,
          },
        ],
      };
    },
  },
];

const EVENT_COOLDOWN_WEEKS = 4;

function offCooldown(state, eventId) {
  const lastWeek = state.eventCooldowns?.[eventId];
  return lastWeek == null || state.week - lastWeek >= EVENT_COOLDOWN_WEEKS;
}

export function triggerRandomEvent(state, rng) {
  // Le dilemme de débauchage est PRIORITAIRE : dès qu'un pilote entre en zone de risque
  // (et hors cooldown), il se déclenche à coup sûr au lieu de concourir à la loterie des
  // événements — sinon le vol backend peut arriver sans qu'aucun avertissement n'ait tiré.
  const dilemma = CHOICE_EVENTS.find((e) => e.id === "poach-dilemma");
  if (dilemma.condition(state) && offCooldown(state, dilemma.id)) {
    state.eventCooldowns ??= {};
    state.eventCooldowns[dilemma.id] = state.week;
    const described = dilemma.describe(state, rng);
    return { type: "random-event", kind: "choice", eventId: dilemma.id, week: state.week, ...described };
  }

  if (rng() >= EVENT_TRIGGER_CHANCE) return null;

  const pool = [
    ...INFO_EVENTS.filter((e) => e.condition(state) && offCooldown(state, e.id)).map((e) => ({ e, kind: "info" })),
    ...CHOICE_EVENTS.filter((e) => e.condition(state) && offCooldown(state, e.id)).map((e) => ({ e, kind: "choice" })),
  ];
  if (pool.length === 0) return null;

  const totalWeight = pool.reduce((sum, p) => sum + p.e.weight, 0);
  let roll = rng() * totalWeight;
  let chosen = pool[0];
  for (const p of pool) {
    if (roll < p.e.weight) {
      chosen = p;
      break;
    }
    roll -= p.e.weight;
  }

  state.eventCooldowns ??= {};
  state.eventCooldowns[chosen.e.id] = state.week;

  if (chosen.kind === "info") {
    const result = chosen.e.run(state, rng);
    return { type: "random-event", kind: "info", eventId: chosen.e.id, week: state.week, ...result };
  }

  const described = chosen.e.describe(state, rng);
  return { type: "random-event", kind: "choice", eventId: chosen.e.id, week: state.week, ...described };
}

export function resolveEventChoice(state, rng, event, optionIndex) {
  const option = event.options[optionIndex];
  const driver = event.driverId ? state.drivers.find((d) => d.id === event.driverId) : null;
  const success = rng() < option.successChance;
  const text = success
    ? option.onSuccess(state, rng, driver)
    : option.onFailure
      ? option.onFailure(state, rng, driver)
      : "Rien ne se passe.";
  return {
    type: "random-event",
    kind: "info",
    eventId: event.eventId,
    week: state.week,
    tone: success ? "good" : "bad",
    title: event.title,
    text,
  };
}
