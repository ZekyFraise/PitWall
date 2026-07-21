import { recordTransaction } from "./finance.js";
import { POACH_WARNING_THRESHOLD, poachDriverAway } from "./rivals.js";
import { averageDiscoverySkill, averagePrecisionSkill } from "./staff.js";
import { generateScoutReveal } from "./scoutReveal.js";
import { traitEventBias, staffTraitEventBias } from "./traits.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const EVENT_TRIGGER_CHANCE = 0.35;

export const INJURY_WEEKS = 2;
export const SEVERE_INJURY_WEEKS = 6;
export const SEVERE_INJURY_WEEKS_UNTREATED = 12;
export const LIGHT_INJURY_WORSEN_WEEKS = 3;

// Magnitude scales for event impacts — s (+), m (++), l (+++), xl (++++).
const MONEY = { s: 3000, m: 8000, l: 20000 };
const RELATION = { s: 6, m: 12, l: 22 };
// Réputation reste volontairement peu mobile via les dilemmes : +/-1 pour le palier
// s (+/-), +/-2 pour le palier m (++/--).
const REP = { s: 1, m: 2, l: 10 };
const OVERALL = { s: 1, m: 2, l: 3, xl: 5 };
const FORM = { s: 15, m: 30 };

function gainMoney(state, amount, label) {
  state.agency.money += amount;
  recordTransaction(state, "random-event", label, amount);
}
function addRelation(driver, delta) {
  driver.agencyRelationship = clamp((driver.agencyRelationship ?? 70) + delta, 0, 200);
}
function addTeamRelation(driver, delta) {
  driver.teamRelationship = clamp((driver.teamRelationship ?? 60) + delta, 0, 200);
}
function addReputation(state, delta) {
  state.agency.reputation = Math.max(0, state.agency.reputation + delta);
}
function addForm(driver, delta) {
  driver.form = clamp((driver.form ?? 50) + delta, 0, 100);
}
// Overall is a weighted average of attributes, so shifting every attribute by delta moves
// the driver's Pace/Consistency/Potential rating by ~delta points.
function adjustOverall(driver, delta) {
  for (const key of Object.keys(driver.attributes)) {
    driver.attributes[key] = clamp(driver.attributes[key] + delta, 0, 99);
  }
}
function pickDriver(state, rng, filter = () => true) {
  const eligible = state.drivers.filter(filter);
  return eligible[Math.floor(rng() * eligible.length)];
}
const isHealthy = (d) => (d.injuryWeeksRemaining ?? 0) <= 0;
const hasDriver = (state) => state.drivers.length > 0;
const hasHealthyDriver = (state) => state.drivers.some(isHealthy);
const hasSeatedHealthyDriver = (state) => state.drivers.some((d) => d.teamId != null && isHealthy(d));
const seatedHealthy = (d) => d.teamId != null && isHealthy(d);

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
      driver.scoutReveal = generateScoutReveal(rng, averageDiscoverySkill(state), averagePrecisionSkill(state));
      return { tone: "good", title: "Tuyau de recruteur", text: `Un tuyau permet de scouter gratuitement ${driver.name}.` };
    },
  },
  {
    // Event 21 — Solo Sponsorship Deal (single-choice info event).
    id: "solo-sponsorship",
    weight: 2,
    condition: hasDriver,
    run: (state, rng) => {
      const driver = pickDriver(state, rng);
      const amount = MONEY.m + Math.round(rng() * MONEY.s);
      gainMoney(state, amount, `Sponsor personnel — ${driver.name}`);
      return { tone: "good", title: "Contrat de sponsoring personnel", driverName: driver.name, text: `${driver.name} décroche un sponsor personnel : +${amount.toLocaleString("fr-FR")}€.` };
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
  {
    // 1 — Psychological Issues
    id: "psychological-issues",
    weight: 2,
    condition: hasHealthyDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng, isHealthy);
      return {
        driverId: driver.id,
        title: "Troubles psychologiques",
        text: `${driver.name} a du mal à se concentrer ces derniers temps.`,
        options: [
          {
            label: "Faire appel à un psychologue",
            tradeoff: `-${MONEY.s.toLocaleString("fr-FR")}€, relation agence +${RELATION.s}`,
            successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.s, `Suivi psychologique — ${d.name}`); addRelation(d, RELATION.s); return `${d.name} retrouve sa sérénité grâce au suivi.`; },
          },
          {
            label: "Ne rien faire",
            tradeoff: `Niveau -${OVERALL.s}`,
            successChance: 1,
            onSuccess: (s, r, d) => { adjustOverall(d, -OVERALL.s); return `Sans accompagnement, ${d.name} régresse légèrement.`; },
          },
        ],
      };
    },
  },
  {
    // 2 — Bad Form
    id: "bad-form",
    weight: 2,
    condition: hasDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng);
      return {
        driverId: driver.id,
        title: "Méforme",
        text: `${driver.name} est en méforme depuis plusieurs semaines.`,
        options: [
          {
            label: "Le recadrer",
            tradeoff: `60% : forme +${FORM.s} · 40% : relation agence -${RELATION.s}`,
            successChance: 0.6,
            onSuccess: (s, r, d) => { addForm(d, FORM.s); return `${d.name} se reprend en main : forme en hausse.`; },
            onFailure: (s, r, d) => { addRelation(d, -RELATION.s); return `${d.name} prend mal la remarque : relation agence en baisse.`; },
          },
          { label: "Ne rien faire", tradeoff: "Aucun effet", successChance: 1, onSuccess: (s, r, d) => `Tu laisses passer l'orage.` },
        ],
      };
    },
  },
  {
    // 3 — Famous Driver Lawsuit
    id: "driver-lawsuit",
    weight: 1,
    condition: () => true,
    describe: () => ({
      title: "Procès d'un pilote célèbre",
      text: "On te propose un pot-de-vin pour témoigner contre un club.",
      options: [
        { label: "Pourquoi pas", tradeoff: `+${MONEY.m.toLocaleString("fr-FR")}€`, successChance: 1,
          onSuccess: (state) => { gainMoney(state, MONEY.m, "Témoignage rémunéré"); return `L'argent est encaissé, discrètement.`; } },
        { label: "Ce ne sont pas mes affaires", tradeoff: `Réputation +${REP.s}`, successChance: 1,
          onSuccess: (state) => { addReputation(state, REP.s); return `Ton intégrité est remarquée : réputation en hausse.`; } },
      ],
    }),
  },
  {
    // 4 — Documentary Offer
    id: "documentary-offer",
    weight: 2,
    condition: () => true,
    describe: () => ({
      title: "Offre de documentaire",
      text: "Un studio veut réaliser un documentaire sur ton agence.",
      options: [
        { label: "Accepter", tradeoff: `+${MONEY.m.toLocaleString("fr-FR")}€`, successChance: 1,
          onSuccess: (state) => { gainMoney(state, MONEY.m, "Documentaire"); return `Le cachet du documentaire est versé.`; } },
        { label: "Décliner", tradeoff: `50% : réputation +${REP.s}`, successChance: 0.5,
          onSuccess: (state) => { addReputation(state, REP.s); return `Ton refus discret séduit le milieu : réputation +${REP.s}.`; },
          onFailure: () => `Le studio va voir ailleurs, sans conséquence.` },
      ],
    }),
  },
  {
    // 5 — Personal Trainer
    id: "personal-trainer",
    weight: 2,
    condition: hasHealthyDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng, isHealthy);
      return {
        driverId: driver.id,
        title: "Préparateur personnel",
        text: `${driver.name} peut s'attacher les services d'un préparateur personnel.`,
        options: [
          { label: "L'engager", tradeoff: `-${MONEY.m.toLocaleString("fr-FR")}€, niveau +${OVERALL.m}`, successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.m, `Préparateur — ${d.name}`); adjustOverall(d, OVERALL.m); return `${d.name} progresse nettement.`; } },
          { label: "Ne rien faire", tradeoff: `Relation agence -${RELATION.s}`, successChance: 1,
            onSuccess: (s, r, d) => { addRelation(d, -RELATION.s); return `${d.name} est déçu du manque d'investissement.`; } },
        ],
      };
    },
  },
  {
    // 6 — Late for Training
    id: "late-training",
    weight: 2,
    condition: hasSeatedHealthyDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng, seatedHealthy);
      return {
        driverId: driver.id,
        title: "Retard à l'entraînement",
        text: `${driver.name} fait la grasse matinée et arrive en retard.`,
        options: [
          { label: "Le recadrer", tradeoff: `57% : niveau +${OVERALL.s} · 43% : niveau -${OVERALL.s}`, successChance: 0.57,
            onSuccess: (s, r, d) => { adjustOverall(d, OVERALL.s); return `${d.name} se ressaisit et travaille mieux.`; },
            onFailure: (s, r, d) => { adjustOverall(d, -OVERALL.s); return `${d.name} se braque et se relâche.`; } },
          { label: "Ce ne sont pas mes affaires", tradeoff: `Relation équipe -${RELATION.s}`, successChance: 1,
            onSuccess: (s, r, d) => { addTeamRelation(d, -RELATION.s); return `L'écurie voit d'un mauvais œil ce laisser-aller.`; } },
        ],
      };
    },
  },
  {
    // 7 — Special Team Camp
    id: "team-camp",
    weight: 2,
    condition: hasSeatedHealthyDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng, seatedHealthy);
      return {
        driverId: driver.id,
        title: "Stage d'équipe spécial",
        text: `L'écurie invite ${driver.name} à un stage, mais l'agence doit régler la note.`,
        options: [
          { label: "Payer le stage", tradeoff: `-${MONEY.s.toLocaleString("fr-FR")}€, niveau +${OVERALL.s}, relation équipe +${RELATION.s}`, successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.s, `Stage d'équipe — ${d.name}`); adjustOverall(d, OVERALL.s); addTeamRelation(d, RELATION.s); return `${d.name} revient affûté et soudé à l'écurie.`; } },
          { label: "Il n'en a pas besoin", tradeoff: `Relation équipe -${RELATION.s}`, successChance: 1,
            onSuccess: (s, r, d) => { addTeamRelation(d, -RELATION.s); return `L'écurie prend mal ce refus.`; } },
        ],
      };
    },
  },
  {
    // 8 — Language Course
    id: "language-course",
    weight: 2,
    condition: hasHealthyDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng, isHealthy);
      return {
        driverId: driver.id,
        title: "Cours de langue",
        text: `${driver.name} gagnerait à suivre des cours de langue pour les médias internationaux.`,
        options: [
          { label: "L'inscrire", tradeoff: `-${MONEY.s.toLocaleString("fr-FR")}€, niveau +${OVERALL.s}`, successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.s, `Cours de langue — ${d.name}`); adjustOverall(d, OVERALL.s); return `${d.name} s'ouvre à l'international.`; } },
          { label: "Pas nécessaire", tradeoff: `Relation agence -${RELATION.s}`, successChance: 1,
            onSuccess: (s, r, d) => { addRelation(d, -RELATION.s); return `${d.name} se sent bridé dans sa carrière.`; } },
        ],
      };
    },
  },
  {
    // 9 — Controversial Social Media Post
    id: "social-media-post",
    weight: 2,
    condition: hasDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng);
      return {
        driverId: driver.id,
        title: "Post polémique sur les réseaux",
        text: `${driver.name} publie un message controversé qui fait du bruit.`,
        options: [
          { label: "Engager une agence de com", tradeoff: `-${MONEY.m.toLocaleString("fr-FR")}€, réputation +${REP.s}, relation agence +${RELATION.s}`, successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.m, `Gestion de crise — ${d.name}`); addReputation(s, REP.s); addRelation(d, RELATION.s); return `La crise est désamorcée avec brio.`; } },
          { label: "Ne rien faire", tradeoff: `Relation agence -${RELATION.s}`, successChance: 1,
            onSuccess: (s, r, d) => { addRelation(d, -RELATION.s); return `${d.name} se sent lâché par l'agence.`; } },
        ],
      };
    },
  },
  {
    // 10 — Controversial Sponsor Offer
    id: "controversial-sponsor",
    weight: 2,
    condition: () => true,
    describe: () => ({
      title: "Sponsor controversé",
      text: "Une marque sulfureuse propose un pont d'or.",
      options: [
        { label: "Accepter", tradeoff: `+${MONEY.l.toLocaleString("fr-FR")}€, réputation -${REP.s}`, successChance: 1,
          onSuccess: (state) => { gainMoney(state, MONEY.l, "Sponsor controversé"); addReputation(state, -REP.s); return `Le chèque est énorme, l'image en pâtit un peu.`; } },
        { label: "Refuser", tradeoff: `30% : réputation -${REP.s}`, successChance: 0.7,
          onSuccess: () => `Tu refuses proprement, sans vagues.`,
          onFailure: (state) => { addReputation(state, -REP.s); return `La marque se venge dans la presse : réputation -${REP.s}.`; } },
      ],
    }),
  },
  {
    // 11 — Poaching Attempt (rival agency offer)
    id: "poaching-attempt",
    weight: 2,
    condition: hasDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng);
      return {
        driverId: driver.id,
        title: "Tentative de débauchage",
        text: `Une agence rivale fait les yeux doux à ${driver.name}.`,
        options: [
          { label: "Verser une prime de fidélité", tradeoff: `-${MONEY.s.toLocaleString("fr-FR")}€, relation agence +${RELATION.s}`, successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.s, `Prime de fidélité — ${d.name}`); addRelation(d, RELATION.s); return `${d.name} est touché par le geste et reste.`; } },
          { label: "Refuser", tradeoff: `60% : relation -${RELATION.m} · 20% : départ immédiat`, successChance: 1,
            onSuccess: (state, rng, driver) => {
              const roll = rng();
              if (roll < 0.2) { poachDriverAway(state, driver, rng); return `${driver.name} claque la porte et rejoint l'agence rivale sur-le-champ !`; }
              if (roll < 0.8) { addRelation(driver, -RELATION.m); return `${driver.name} est vexé de ne pas être retenu : relation en forte baisse.`; }
              return `${driver.name} reste finalement, sans rancune notable.`;
            } },
        ],
      };
    },
  },
  {
    // 12 — Great Weekly Performance
    id: "great-performance",
    weight: 3,
    condition: hasSeatedHealthyDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng, seatedHealthy);
      return {
        driverId: driver.id,
        title: "Grosse performance",
        text: `${driver.name} a signé un week-end exceptionnel.`,
        options: [
          { label: "Le féliciter", tradeoff: `Relation agence +${RELATION.m} · 30% : niveau +${OVERALL.s}`, successChance: 0.3,
            onSuccess: (s, r, d) => { adjustOverall(d, OVERALL.s); addRelation(d, RELATION.m); return `${d.name} surfe sur la confiance : niveau +${OVERALL.s} et relation +${RELATION.m}.`; },
            onFailure: (s, r, d) => { addRelation(d, RELATION.m); return `${d.name} apprécie la reconnaissance : relation +${RELATION.m}.`; } },
          { label: "Ne rien dire", tradeoff: "Aucun effet", successChance: 1, onSuccess: (s, r, d) => `Tu restes concentré sur la suite.` },
        ],
      };
    },
  },
  {
    // 13 — Friend's Investment Tip
    id: "investment-tip",
    weight: 2,
    condition: () => true,
    describe: () => ({
      title: "Tuyau d'investissement",
      text: "Un ami te souffle un placement « sûr ».",
      options: [
        { label: "Investir", tradeoff: `57% : +${MONEY.m.toLocaleString("fr-FR")}€ · 43% : -${MONEY.s.toLocaleString("fr-FR")}€`, successChance: 0.57,
          onSuccess: (state) => { gainMoney(state, MONEY.m, "Placement gagnant"); return `Le placement rapporte gros !`; },
          onFailure: (state) => { gainMoney(state, -MONEY.s, "Placement perdant"); return `Le tuyau était crevé : perte sèche.`; } },
        { label: "Non merci", tradeoff: "Aucun effet", successChance: 1, onSuccess: () => `Tu passes ton tour.` },
      ],
    }),
  },
  {
    // 14 — Driver Needs a Loan
    id: "driver-loan",
    weight: 2,
    condition: hasDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng);
      return {
        driverId: driver.id,
        title: "Demande de prêt",
        text: `« Patron, je suis à sec en ce moment... » — ${driver.name}`,
        options: [
          { label: "L'aider", tradeoff: `-${MONEY.s.toLocaleString("fr-FR")}€`, successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.s, `Avance — ${d.name}`); return `${d.name} te remercie chaleureusement.`; } },
          { label: "Non", tradeoff: `Relation agence -${RELATION.m}`, successChance: 1,
            onSuccess: (s, r, d) => { addRelation(d, -RELATION.m); return `${d.name} encaisse mal le refus.`; } },
        ],
      };
    },
  },
  {
    // 15 — Charity Foundation Request
    id: "charity-request",
    weight: 2,
    condition: () => true,
    describe: () => ({
      title: "Demande d'une fondation caritative",
      text: "Une fondation sollicite le soutien de l'agence.",
      options: [
        { label: "Les aider", tradeoff: `-${MONEY.s.toLocaleString("fr-FR")}€, 60% : réputation +${REP.m}`, successChance: 0.6,
          onSuccess: (state) => { gainMoney(state, -MONEY.s, "Don caritatif"); addReputation(state, REP.m); return `Ton don est largement relayé : réputation +${REP.m}.`; },
          onFailure: (state) => { gainMoney(state, -MONEY.s, "Don caritatif"); return `Ton don passe inaperçu médiatiquement.`; } },
        { label: "Pas les moyens", tradeoff: "Aucun effet", successChance: 1, onSuccess: () => `Tu déclines poliment.` },
      ],
    }),
  },
  {
    // 16 — Tax Evasion
    id: "tax-evasion",
    weight: 1,
    condition: () => true,
    describe: () => ({
      title: "Optimisation fiscale douteuse",
      text: "Ton comptable propose un montage à la limite de la légalité.",
      options: [
        { label: "Continuer l'évasion", tradeoff: `+${MONEY.m.toLocaleString("fr-FR")}€, réputation -${REP.s}`, successChance: 1,
          onSuccess: (state) => { gainMoney(state, MONEY.m, "Montage fiscal"); addReputation(state, -REP.s); return `Les caisses se remplissent... à tes risques.`; } },
        { label: "Y mettre fin", tradeoff: `-${MONEY.m.toLocaleString("fr-FR")}€, réputation +${REP.s}`, successChance: 1,
          onSuccess: (state) => { gainMoney(state, -MONEY.m, "Régularisation fiscale"); addReputation(state, REP.s); return `Tu régularises : coûteux mais sain.`; } },
      ],
    }),
  },
  {
    // 17 — Doping Request
    id: "doping-request",
    weight: 1,
    condition: hasHealthyDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng, isHealthy);
      return {
        driverId: driver.id,
        title: "Demande de dopage",
        text: `${driver.name} veut recourir à des produits dopants.`,
        options: [
          { label: "Fermer les yeux", tradeoff: `40% : niveau +${OVERALL.s} · 60% : niveau -${OVERALL.s}`, successChance: 0.4,
            onSuccess: (s, r, d) => { adjustOverall(d, OVERALL.s); return `Les gains sont réels... pour l'instant.`; },
            onFailure: (s, r, d) => { adjustOverall(d, -OVERALL.s); return `Les effets secondaires plombent ${d.name}.`; } },
          { label: "Le sermonner fermement", tradeoff: `Relation agence -${RELATION.l}`, successChance: 1,
            onSuccess: (s, r, d) => { addRelation(d, -RELATION.l); return `${d.name} prend très mal ce recadrage : relation en chute libre.`; } },
        ],
      };
    },
  },
  {
    // 18 — Paparazzi at the Bar
    id: "paparazzi-bar",
    weight: 2,
    condition: hasDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng);
      return {
        driverId: driver.id,
        title: "Paparazzi au bar",
        text: `${driver.name} est surpris à boire tard dans la nuit.`,
        options: [
          { label: "Soudoyer le photographe", tradeoff: `-${MONEY.s.toLocaleString("fr-FR")}€`, successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.s, `Étouffer un scandale — ${d.name}`); return `Les clichés ne sortiront jamais.`; } },
          { label: "Ce ne sont pas mes affaires", tradeoff: `Relation agence -${RELATION.m}`, successChance: 1,
            onSuccess: (s, r, d) => { addRelation(d, -RELATION.m); return `${d.name} se sent abandonné dans la tempête médiatique.`; } },
        ],
      };
    },
  },
  {
    // 19 — Severe Injury
    id: "severe-injury",
    weight: 1,
    condition: hasHealthyDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng, isHealthy);
      return {
        driverId: driver.id,
        title: "Blessure grave",
        text: `${driver.name} est victime d'une blessure sérieuse.`,
        options: [
          { label: "Payer un traitement de pointe", tradeoff: `-${MONEY.s.toLocaleString("fr-FR")}€, niveau -${OVERALL.m}, absent ${SEVERE_INJURY_WEEKS} sem`, successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.s, `Traitement — ${d.name}`); adjustOverall(d, -OVERALL.m); d.injuryWeeksRemaining = SEVERE_INJURY_WEEKS; return `${d.name} sera indisponible ${SEVERE_INJURY_WEEKS} semaines mais bien soigné.`; } },
          { label: "Soins standard", tradeoff: `relation agence -${RELATION.m}, niveau -${OVERALL.xl}, absent ${SEVERE_INJURY_WEEKS_UNTREATED} sem`, successChance: 1,
            onSuccess: (s, r, d) => { addRelation(d, -RELATION.m); adjustOverall(d, -OVERALL.xl); d.injuryWeeksRemaining = SEVERE_INJURY_WEEKS_UNTREATED; return `${d.name} traîne sa blessure : ${SEVERE_INJURY_WEEKS_UNTREATED} semaines d'absence.`; } },
        ],
      };
    },
  },
  {
    // 20 — Private Life Crisis
    id: "private-crisis",
    weight: 1,
    condition: hasDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng);
      return {
        driverId: driver.id,
        title: "Crise personnelle",
        text: `${driver.name} traverse une épreuve personnelle (divorce, deuil...).`,
        options: [
          { label: "Garder le secret et le soutenir", tradeoff: `-${MONEY.s.toLocaleString("fr-FR")}€, relation agence +${RELATION.s}, réputation +${REP.s}`, successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.s, `Soutien — ${d.name}`); addRelation(d, RELATION.s); addReputation(s, REP.s); return `${d.name} n'oubliera pas ce soutien.`; } },
          { label: "Sa vie, son problème", tradeoff: `Relation agence -${RELATION.m}, réputation -${REP.s}`, successChance: 1,
            onSuccess: (s, r, d) => { addRelation(d, -RELATION.m); addReputation(s, -REP.s); return `${d.name} se sent seul face à l'agence.`; } },
        ],
      };
    },
  },
  {
    // 22 — Light Injury but Wants to Race
    id: "light-injury-race",
    weight: 1,
    condition: hasSeatedHealthyDriver,
    describe: (state, rng) => {
      const driver = pickDriver(state, rng, seatedHealthy);
      return {
        driverId: driver.id,
        title: "Blessure légère, veut courir",
        text: `${driver.name} est légèrement blessé mais veut absolument courir.`,
        options: [
          { label: "Le laisser courir", tradeoff: "50% : forme au max · 50% : aggravation, 3 sem d'absence", successChance: 0.5,
            onSuccess: (s, r, d) => { d.form = 100; return `${d.name} se transcende : forme au maximum !`; },
            onFailure: (s, r, d) => { d.injuryWeeksRemaining = LIGHT_INJURY_WORSEN_WEEKS; return `La blessure s'aggrave : ${LIGHT_INJURY_WORSEN_WEEKS} semaines d'arrêt.`; } },
          { label: "Le mettre au repos", tradeoff: `Relation équipe -${RELATION.s}`, successChance: 1,
            onSuccess: (s, r, d) => { addTeamRelation(d, -RELATION.s); return `L'écurie regrette son absence.`; } },
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
  // Traits bias the success roll: the driver's own traits, plus every hired staff member's
  // traits (a dilemma only ever targets a driver, never a staff member, so staff act here as
  // a general support layer rather than the direct actor of the event) — both sources stack.
  const driverBias = driver ? traitEventBias(driver, event.eventId) : 0;
  const bias = driverBias + staffTraitEventBias(state, event.eventId);
  const chance = clamp(option.successChance + bias, 0, 1);
  const success = rng() < chance;
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
