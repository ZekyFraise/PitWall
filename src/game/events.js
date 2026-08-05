import { recordTransaction } from "./finance.js";
import { POACH_WARNING_THRESHOLD, poachDriverAway } from "./rivals.js";
import { generateScoutReveal } from "./scoutReveal.js";
import { traitEventBias, staffTraitEventBias } from "./traits.js";
import { applyReputationGain, CATEGORY_BY_ID } from "./data.js";
import { findTeamById } from "./team.js";
import { driverMarketValue } from "./driverStats.js";
import { effectiveScoutSkills } from "./infrastructure.js";
import { overallRating } from "./driver.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const EVENT_TRIGGER_CHANCE = 0.35;

export const INJURY_WEEKS = 2;
export const SEVERE_INJURY_WEEKS = 6;
export const SEVERE_INJURY_WEEKS_UNTREATED = 12;
export const LIGHT_INJURY_WORSEN_WEEKS = 3;

// Magnitude scales for event impacts — s (+), m (++), l (+++), xl (++++).
// Halved from 3000/8000/20000 — a simulated 10-season run showed dilemma money dwarfing race
// prizes 5-10x every season (the dominant income source by far, not the racing itself), which
// is the real driver behind the game feeling too easy/rich by mid-game.
const MONEY = { s: 1500, m: 4000, l: 10000 };
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
  applyReputationGain(state, delta);
}
function addForm(driver, delta) {
  driver.form = clamp((driver.form ?? 50) + delta, 0, 100);
}
// Overall is a weighted average of attributes, so shifting every attribute by delta moves
// the driver's Pace/Consistency/Potential rating by ~delta points. A positive delta is capped
// by driver.growthCeiling (same cap growDriver respects) so a dilemma can never push a driver
// past the growth ceiling rolled at generation — only growDriver's own room-based curve, or an
// explicit growthCeiling bump (push-driver), may do that.
function adjustOverall(driver, delta) {
  let applied = delta;
  if (applied > 0) {
    const room = (driver.growthCeiling ?? driver.potential ?? 99) - overallRating(driver);
    applied = Math.max(0, Math.min(applied, room));
  }
  if (applied === 0) return;
  for (const key of Object.keys(driver.attributes)) {
    driver.attributes[key] = clamp(driver.attributes[key] + applied, 0, 99);
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
      return { tone: "good", title: "Sponsor ponctuel", text: `Un fabricant de boissons énergisantes cherche un coup de pub rapide et choisit ton agence : +${amount.toLocaleString("fr-FR")}€.` };
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
      return { tone: "bad", title: "Frais imprévus", text: `Entre un camion-atelier parti dans le mauvais sens et du matériel qui rend l'âme au pire moment, les frais s'accumulent : -${amount.toLocaleString("fr-FR")}€.` };
    },
  },
  {
    id: "media-buzz",
    weight: 2,
    condition: () => true,
    run: (state, rng) => {
      const delta = 1 + Math.floor(rng() * 2);
      addReputation(state, delta);
      return { tone: "good", title: "Buzz médiatique", text: `Une interview bien sentie fait le tour des réseaux du paddock : réputation +${delta}.` };
    },
  },
  {
    id: "pr-blunder",
    weight: 2,
    condition: (state) => state.agency.reputation > 0,
    run: (state, rng) => {
      const delta = Math.min(state.agency.reputation, 1 + Math.floor(rng() * 3));
      state.agency.reputation -= delta;
      return { tone: "bad", title: "Bourde de communication", text: `Un communiqué mal relu, une phrase sortie de son contexte, et voilà la bourde du jour : réputation -${delta}.` };
    },
  },
  {
    id: "driver-highlight",
    weight: 2,
    condition: (state) => state.drivers.length > 0,
    run: (state, rng) => {
      const driver = state.drivers[Math.floor(rng() * state.drivers.length)];
      driver.agencyRelationship = clamp(driver.agencyRelationship + 8, 0, 200);
      return { tone: "good", title: "Relation renforcée", driverName: driver.name, text: `${driver.name} passe te remercier en personne pour le suivi de ces dernières semaines (relation +8).` };
    },
  },
  {
    id: "driver-friction",
    weight: 2,
    condition: (state) => state.drivers.length > 0,
    run: (state, rng) => {
      const driver = state.drivers[Math.floor(rng() * state.drivers.length)];
      driver.agencyRelationship = clamp(driver.agencyRelationship - 6, 0, 200);
      return { tone: "bad", title: "Tension", driverName: driver.name, text: `${driver.name} rumine dans son coin — un appel resté sans réponse, sans doute (relation -6).` };
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
      return { tone: "good", title: "Investisseur intéressé", text: `Un investisseur en costume trop cintré veut "entrer dans l'aventure" : +${amount.toLocaleString("fr-FR")}€.` };
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
      const { discovery, precision } = effectiveScoutSkills(state);
      driver.scoutReveal = generateScoutReveal(rng, discovery, precision);
      return { tone: "good", title: "Tuyau de recruteur", text: `Un ancien recruteur, une bière à la main, te glisse tout ce qu'il sait sur ${driver.name} — scouté gratuitement.` };
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
      return { tone: "good", title: "Contrat de sponsoring personnel", driverName: driver.name, text: `${driver.name} négocie lui-même un partenariat avec une marque de casques : +${amount.toLocaleString("fr-FR")}€.` };
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
        text: `${driver.name} débarque motivé à bloc avec un programme d'entraînement "extrême" trouvé sur internet, à suivre avant la prochaine échéance.`,
        options: [
          {
            label: "Autoriser",
            tradeoff: "65% : potentiel +2, relation +4 · 35% : blessure, relation -6",
            successChance: 0.65,
            onSuccess: (state, rng, driver) => {
              // 94-99 ("extraordinaire") stays reserved for the rare wonderkid roll at
              // generation — an event nudge can only push a driver up to 93 ("excellente note")
              // unless they were already in the extraordinaire tier, in which case 99 still
              // applies as before.
              const cap = driver.growthCeiling >= 94 ? 99 : 93;
              driver.growthCeiling = Math.min(cap, driver.growthCeiling + 2);
              driver.agencyRelationship = clamp(driver.agencyRelationship + 4, 0, 200);
              return `${driver.name} en ressort méthodiquement plus solide, presque une nouvelle version de lui-même.`;
            },
            onFailure: (state, rng, driver) => {
              driver.injuryWeeksRemaining = INJURY_WEEKS;
              driver.agencyRelationship = clamp(driver.agencyRelationship - 6, 0, 200);
              return `Trop, c'est trop : ${driver.name} se blesse à l'entraînement — indisponible ${INJURY_WEEKS} semaines.`;
            },
          },
          {
            label: "Refuser, rester prudent",
            tradeoff: "Aucun risque, aucun gain",
            successChance: 1,
            onSuccess: (state, rng, driver) => `${driver.name} continue sagement son programme habituel — moins spectaculaire, mais personne ne se casse rien.`,
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
      text: "Un sponsor propose un contrat ponctuel, mais avec une liste de conditions longue comme le bras — logo en évidence, interviews imposées, charte graphique au pixel près.",
      options: [
        {
          label: "Accepter",
          tradeoff: "70% : +6 000 à 14 000€ · 30% : réputation -1 à -4",
          successChance: 0.7,
          onSuccess: (state, rng) => {
            const amount = Math.round(6000 + rng() * 8000);
            state.agency.money += amount;
            recordTransaction(state, "random-event", "Sponsor exigeant", amount);
            return `Le sponsor est ravi du résultat : +${amount.toLocaleString("fr-FR")}€.`;
          },
          onFailure: (state, rng) => {
            const loss = Math.min(state.agency.reputation, 1 + Math.floor(rng() * 4));
            addReputation(state, -loss);
            return `Une clause mal respectée, et le partenariat tourne au vinaigre : réputation -${loss}.`;
          },
        },
        {
          label: "Décliner",
          tradeoff: "Aucun risque, aucun gain",
          successChance: 1,
          onSuccess: () => "Tu refuses — la paperasse à elle seule valait le déclin.",
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
        text: `${driver.name} reçoit une invitation dorée pour un événement média la veille de la course — cocktails, photographes, petits-fours.`,
        options: [
          {
            label: "Jouer la carte médiatique à fond",
            tradeoff: "75% : réputation +3, relation +3 · 25% : indisponible 1 semaine",
            successChance: 0.75,
            onSuccess: (state, rng, driver) => {
              addReputation(state, 3);
              driver.agencyRelationship = clamp(driver.agencyRelationship + 3, 0, 200);
              return `La soirée est un succès, ${driver.name} rayonne devant les caméras : réputation +3, relation agence +3.`;
            },
            onFailure: (state, rng, driver) => {
              driver.injuryWeeksRemaining = 1;
              return `Entre les petits-fours et les mondanités qui s'éternisent, ${driver.name} revient sur les rotules — indisponible 1 semaine.`;
            },
          },
          {
            label: "Présence discrète, limiter l'exposition",
            tradeoff: "Réputation +1, sans risque",
            successChance: 1,
            onSuccess: (state) => {
              addReputation(state, 1);
              return "Présence discrète, quelques poignées de main : réputation +1, aucun risque pris.";
            },
          },
          {
            label: "Décliner l'invitation",
            tradeoff: "Aucun effet",
            successChance: 1,
            onSuccess: () => "Tu déclines poliment — dormir avant la course, c'est aussi ça, le métier.",
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
        text: `${driver.name} débarque dans ton bureau, dossier sous le bras, pour réclamer une revalorisation de son contrat.`,
        options: [
          {
            label: "Accepter la demande",
            tradeoff: "-4 000€, relation +8",
            successChance: 1,
            onSuccess: (state, rng, driver) => {
              state.agency.money -= 4000;
              recordTransaction(state, "random-event", `Revalorisation — ${driver.name}`, -4000);
              driver.agencyRelationship = clamp(driver.agencyRelationship + 8, 0, 200);
              return `${driver.name} repart avec le sourire : relation agence +8, -4 000€.`;
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
              return `${driver.name} fait la moue, pas convaincu par le compromis : relation agence -2, -1 500€.`;
            },
          },
          {
            label: "Refuser",
            tradeoff: "Aucun coût, relation -6",
            successChance: 1,
            onSuccess: (state, rng, driver) => {
              driver.agencyRelationship = clamp(driver.agencyRelationship - 6, 0, 200);
              return `${driver.name} claque presque la porte en sortant : relation agence -6.`;
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
        text: `Sans écurie depuis plusieurs semaines, ${driver.name} reçoit un appel d'une agence rivale qui promet monts et merveilles.`,
        options: [
          {
            label: "Le rassurer personnellement",
            tradeoff: "-2 000€, relation +15",
            successChance: 1,
            onSuccess: (state, rng, driver) => {
              state.agency.money -= 2000;
              recordTransaction(state, "random-event", `Fidélisation — ${driver.name}`, -2000);
              driver.agencyRelationship = clamp(driver.agencyRelationship + 15, 0, 200);
              return `Un café, une vraie conversation, et ${driver.name} se sent enfin écouté — reste fidèle à l'agence.`;
            },
          },
          {
            label: "Ne rien faire",
            tradeoff: "Aucun coût, risque de départ inchangé",
            successChance: 1,
            onSuccess: (state, rng, driver) => `Silence radio côté agence — ${driver.name} reste livré à lui-même face aux sirènes rivales.`,
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
        text: `${driver.name} a la tête ailleurs depuis quelques semaines — les tours de qualification n'ont plus la même saveur.`,
        options: [
          {
            label: "Faire appel à un psychologue",
            tradeoff: `-${MONEY.s.toLocaleString("fr-FR")}€, relation agence +${RELATION.s}`,
            successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.s, `Suivi psychologique — ${d.name}`); addRelation(d, RELATION.s); return `Quelques séances plus tard, ${d.name} retrouve sa sérénité et sa concentration.`; },
          },
          {
            label: "Ne rien faire",
            tradeoff: `Niveau -${OVERALL.s}`,
            successChance: 1,
            onSuccess: (s, r, d) => { adjustOverall(d, -OVERALL.s); return `Livré à lui-même, ${d.name} rumine et régresse légèrement.`; },
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
        text: `${driver.name} enchaîne les week-ends sans éclat — la mécanique est bonne, la tête un peu moins.`,
        options: [
          {
            label: "Le recadrer",
            tradeoff: `60% : forme +${FORM.s} · 40% : relation agence -${RELATION.s}`,
            successChance: 0.6,
            onSuccess: (s, r, d) => { addForm(d, FORM.s); return `${d.name} se reprend en main : forme en hausse.`; },
            onFailure: (s, r, d) => { addRelation(d, -RELATION.s); return `${d.name} prend la remarque de travers : relation agence en baisse.`; },
          },
          { label: "Ne rien faire", tradeoff: "Aucun effet", successChance: 1, onSuccess: (s, r, d) => `Tu laisses passer l'orage, en espérant que ça se tasse tout seul.` },
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
      text: "Un avocat en costume sombre te propose une enveloppe généreuse pour témoigner contre un club rival dans une affaire trouble.",
      options: [
        { label: "Pourquoi pas", tradeoff: `+${MONEY.m.toLocaleString("fr-FR")}€, réputation -${REP.s}`, successChance: 1,
          onSuccess: (state) => { gainMoney(state, MONEY.m, "Témoignage rémunéré"); addReputation(state, -REP.s); return `L'enveloppe change de mains dans un parking désert — mais la rumeur finit par courir : réputation -${REP.s}.`; } },
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
      text: "Une équipe de tournage débarque avec l'idée d'un documentaire façon \"coulisses\" sur ton agence — drones, micros-cravates, tout l'attirail.",
      options: [
        { label: "Accepter", tradeoff: `+${MONEY.m.toLocaleString("fr-FR")}€, réputation -${REP.s}`, successChance: 1,
          onSuccess: (state) => { gainMoney(state, MONEY.m, "Documentaire"); addReputation(state, -REP.s); return `Le cachet du documentaire est versé — mais le montage expose aussi les coulisses moins reluisantes : réputation -${REP.s}.`; } },
        { label: "Décliner", tradeoff: `50% : réputation +${REP.s}`, successChance: 0.5,
          onSuccess: (state) => { addReputation(state, REP.s); return `Ton refus discret séduit le milieu : réputation +${REP.s}.`; },
          onFailure: () => `Le studio hausse les épaules et va filmer une agence rivale à la place.` },
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
        text: `Un préparateur physique réputé, ancien d'une écurie de F1, propose ses services à ${driver.name}.`,
        options: [
          { label: "L'engager", tradeoff: `-${MONEY.m.toLocaleString("fr-FR")}€, niveau +${OVERALL.m}`, successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.m, `Préparateur — ${d.name}`); adjustOverall(d, OVERALL.m); return `Programme sur-mesure, résultats immédiats : ${d.name} progresse nettement.`; } },
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
        text: `${driver.name} débarque à l'entraînement une bonne heure en retard, café à la main, l'air à peine désolé.`,
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
        text: `L'écurie organise un stage intensif en altitude et y invite ${driver.name} — la facture, elle, atterrit chez toi.`,
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
        text: `${driver.name} bafouille en interview d'après-course face aux médias internationaux — des cours de langue lui feraient le plus grand bien.`,
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
        text: `${driver.name} publie un message maladroit à 2h du matin — les captures d'écran circulent déjà.`,
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
      text: "Une marque à la réputation sulfureuse — le genre qu'on évite de citer à table — propose un pont d'or pour un partenariat.",
      options: [
        { label: "Accepter", tradeoff: `+${MONEY.m.toLocaleString("fr-FR")}€, réputation -${REP.s}`, successChance: 1,
          onSuccess: (state) => { gainMoney(state, MONEY.m, "Sponsor controversé"); addReputation(state, -REP.s); return `Le chèque est confortable, l'image en pâtit un peu.`; } },
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
      // Losing your only driver here has no other consequence than the dilemme itself — for the
      // rest of the roster, a bad roll just costs one seat among several. Cut the instant-departure
      // odds when it would end the agency's whole active roster.
      const isOnlyDriver = state.drivers.length === 1;
      const departChance = isOnlyDriver ? 0.05 : 0.2;
      const departPercent = Math.round(departChance * 100);
      return {
        driverId: driver.id,
        title: "Tentative de débauchage",
        text: `Une agence rivale multiplie les attentions envers ${driver.name} — dîners, promesses, petits cadeaux.`,
        options: [
          { label: "Verser une prime de fidélité", tradeoff: `-${MONEY.s.toLocaleString("fr-FR")}€, relation agence +${RELATION.s}`, successChance: 1,
            onSuccess: (s, r, d) => { gainMoney(s, -MONEY.s, `Prime de fidélité — ${d.name}`); addRelation(d, RELATION.s); return `${d.name} est touché par le geste et reste.`; } },
          { label: "Refuser", tradeoff: `60% : relation -${RELATION.m} · ${departPercent}% : départ immédiat`, successChance: 1,
            onSuccess: (state, rng, driver) => {
              const roll = rng();
              if (roll < departChance) { poachDriverAway(state, driver, rng); return `${driver.name} claque la porte et rejoint l'agence rivale sur-le-champ !`; }
              if (roll < departChance + 0.6) { addRelation(driver, -RELATION.m); return `${driver.name} est vexé de ne pas être retenu : relation en forte baisse.`; }
              return `${driver.name} reste finalement, sans rancune notable.`;
            } },
        ],
      };
    },
  },
  {
    // 11b — Transfer Offer (a rival team wants a pro driver mid-contract). Accepting no longer
    // concludes the transfer immediately — it opens a negotiation over the fee (see
    // negotiateTransfer, team.js), surfaced on the driver's own fiche (agency.js). The fee
    // computed here is frozen as pendingTransferOffer.baselineFee — team.js can't import
    // driverMarketValue (driverStats.js already imports FROM team.js, a cycle), so this is the
    // only place that ever computes it for this flow.
    id: "transfer-offer",
    weight: 2,
    // Requires another team in the same category to exist, not just a pro/seated driver — a
    // single-team category (rare, but possible) would otherwise leave describe() with nowhere
    // to send the driver.
    condition: (state) => state.drivers.some((d) => d.isPro && seatedHealthy(d) && (state.teams[d.categoryId]?.length ?? 0) > 1),
    describe: (state, rng) => {
      const driver = pickDriver(state, rng, (d) => d.isPro && seatedHealthy(d) && (state.teams[d.categoryId]?.length ?? 0) > 1);
      const currentTeam = findTeamById(state, driver.teamId);
      const category = CATEGORY_BY_ID[driver.categoryId];
      const candidates = (state.teams[driver.categoryId] ?? []).filter((t) => t.id !== driver.teamId);
      const newTeam = candidates[Math.floor(rng() * candidates.length)];
      const baselineFee = Math.round(driverMarketValue(driver) * (0.3 + category.tier * 0.1));
      return {
        driverId: driver.id,
        title: "Offre de transfert",
        text: `${newTeam.name} tape à la porte pour ${driver.name}, aujourd'hui chez ${currentTeam.name}. Une vente t'intéresse-t-elle ?`,
        options: [
          {
            label: "Ouvrir les négociations",
            tradeoff: `Négocie l'indemnité sur la fiche de ${driver.name}`,
            successChance: 1,
            onSuccess: (state, rng, driver) => {
              driver.pendingTransferOffer = {
                teamId: newTeam.id,
                teamName: newTeam.name,
                categoryId: category.id,
                baselineFee,
                expiresAtWeek: state.week + 3,
              };
              return `${newTeam.name} attend ton offre pour ${driver.name} — direction sa fiche pour négocier.`;
            },
          },
          { label: "Refuser, garder le pilote", tradeoff: "Aucun effet", successChance: 1, onSuccess: () => "Le transfert n'a pas lieu." },
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
        text: `${driver.name} vient de signer un week-end de rêve — pole, victoire, et une interview d'après-course qui restera dans les mémoires.`,
        options: [
          { label: "Le féliciter publiquement", tradeoff: `70% : niveau +${OVERALL.s}, relation +${RELATION.m} · 30% : trop sûr de lui, niveau -${OVERALL.s}`, successChance: 0.7,
            onSuccess: (s, r, d) => { adjustOverall(d, OVERALL.s); addRelation(d, RELATION.m); return `${d.name} surfe sur la confiance : niveau +${OVERALL.s} et relation +${RELATION.m}.`; },
            onFailure: (s, r, d) => { adjustOverall(d, -OVERALL.s); return `${d.name} prend la grosse tête et se relâche : niveau -${OVERALL.s}.`; } },
          { label: "Reconnaissance discrète", tradeoff: `Relation +${RELATION.s}, sans risque`, successChance: 1, onSuccess: (s, r, d) => { addRelation(d, RELATION.s); return `${d.name} apprécie la reconnaissance mesurée : relation +${RELATION.s}.`; } },
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
      text: "Un ami d'enfance, reconverti trader du dimanche, te jure connaître LE placement infaillible du moment.",
      options: [
        { label: "Investir", tradeoff: `57% : +${MONEY.m.toLocaleString("fr-FR")}€ · 43% : -${MONEY.s.toLocaleString("fr-FR")}€`, successChance: 0.57,
          onSuccess: (state) => { gainMoney(state, MONEY.m, "Placement gagnant"); return `Le placement rapporte gros !`; },
          onFailure: (state) => { gainMoney(state, -MONEY.s, "Placement perdant"); return `Le tuyau était crevé : perte sèche.`; } },
        { label: "Non merci", tradeoff: "Aucun effet", successChance: 1, onSuccess: () => `Tu passes ton tour — l'amitié a ses limites.` },
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
      text: "Une fondation caritative locale sollicite le soutien de l'agence pour sa prochaine collecte.",
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
      text: "Ton comptable, un sourire un peu trop confiant aux lèvres, propose un montage \"optimisé\" à la limite de la légalité.",
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
        text: `${driver.name} évoque, mine de rien, des "compléments" qu'un ami masseur lui aurait recommandés.`,
        options: [
          { label: "Fermer les yeux", tradeoff: `40% : niveau +${OVERALL.s} · 60% : niveau -${OVERALL.s}`, successChance: 0.4,
            onSuccess: (s, r, d) => { adjustOverall(d, OVERALL.s); return `Les gains sont réels... pour l'instant.`; },
            onFailure: (s, r, d) => { adjustOverall(d, -OVERALL.s); return `Les effets secondaires plombent ${d.name}.`; } },
          { label: "Le sermonner fermement", tradeoff: `Relation agence -${RELATION.m}, réputation +${REP.s}`, successChance: 1,
            onSuccess: (s, r, d) => { addRelation(d, -RELATION.m); addReputation(s, REP.s); return `${d.name} prend mal ce recadrage, mais ton intégrité est reconnue : relation -${RELATION.m}, réputation +${REP.s}.`; } },
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
        text: `Un paparazzi surprend ${driver.name} dans un bar, verre à la main, bien après le couvre-feu officieux d'avant-course.`,
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
        text: `${driver.name} est victime d'une lourde sortie de piste — la blessure est sérieuse.`,
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
        text: `Poignet bandé, ${driver.name} insiste pour prendre le départ malgré la légère blessure.`,
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
