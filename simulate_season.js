// Headless 2-season stress test for Pit Wall — exercises every core mechanic through the
// real game modules (no DOM, no localStorage). Run with: node simulate_season.js
import {
  createNewGame,
  makeRng,
  scoutDriver,
  deepScoutDriver,
  signDriver,
  negotiateContract,
  contractBaseline,
  setInvestment,
} from "./src/game/state.js";
import { proposeToTeams, joinTeam } from "./src/game/team.js";
import { hireStaff } from "./src/game/staff.js";
import { beginWeek, continueWeekAfterChoice } from "./src/game/simulate.js";
import { overallRating } from "./src/game/driver.js";
import { weekInSeason, CATEGORY_BY_ID } from "./src/game/data.js";

const SEED = 20260716;
const TOTAL_WEEKS = 104;
const state = createNewGame("stress-slot", "Stress Test Agency", "#0a84ff", SEED);

const warnings = [];
function log(action, reaction, warning = null) {
  const season = Math.ceil(state.week / 52);
  const wk = weekInSeason(state.week);
  console.log(
    `[Season ${season} - Week ${wk}] Action: ${action} | Game Reaction: ${reaction} | Feedback/Balance Warning: ${warning ?? "None"}`
  );
  if (warning) warnings.push(`S${season}W${wk}: ${warning}`);
}
const money = () => `${Math.round(state.agency.money).toLocaleString("fr-FR")}€`;

// ---------------------------------------------------------------------------
// 1. World generation verification
// ---------------------------------------------------------------------------
{
  const f1 = state.teams["f1"];
  const f1Brands = f1.map((t) => t.carBrand);
  const wrc = state.teams["rally"];
  const wrcBrands = wrc.map((t) => t.carBrand);
  const hyper = state.teams["wec"].filter((t) => t.subClass === "hypercar");
  const gt3 = state.teams["wec"].filter((t) => t.subClass === "gt3");
  const gt3Brands = new Set(gt3.map((t) => t.carBrand));
  const gt3Pool = CATEGORY_BY_ID["wec"].classes.find((c) => c.id === "gt3").brands;
  const rivalStaffCounts = state.rivalAgencies.map((a) => `${a.name.split(" ")[0]}:${a.staff?.length ?? 0}`);

  log(
    "World generation audit (F1 / WRC / WEC / staff IA / agences rivales)",
    `F1: ${f1.length} équipes, ${new Set(f1Brands).size} marques uniques (1-to-1 ${new Set(f1Brands).size === f1.length ? "OK" : "VIOLÉ"}) · ` +
      `WRC: ${wrc.length} équipes, uniques=${new Set(wrcBrands).size === wrc.length} · ` +
      `WEC Hypercar: ${hyper.length} équipes / ${new Set(hyper.map((t) => t.carBrand)).size} marques uniques · ` +
      `WEC GT3: ${gt3.length} équipes, ${gt3Brands.size}/${gt3Pool.length} marques couvertes · ` +
      `Rivales avec staff IA: [${rivalStaffCounts.join(", ")}] · Staff libres: ${state.staffPool.length} · Budget: ${money()}`,
    gt3Brands.size < gt3Pool.length ? "GT3 minimum-occurrence violé" : null
  );
}

// ---------------------------------------------------------------------------
// Trackers & goal state machine
// ---------------------------------------------------------------------------
let driverA = null; // raced driver
let driverB = null; // deliberately benched driver
let staffHired = false;
let lawyerHired = false;
let investmentSet = false;
let dilemmaResolvedCount = 0;
let bPoached = false;
let aContractExpiredLogged = false;
let aRenegotiated = false;
let aReseated = false;
let minMoney = state.agency.money;
let weeksNegative = 0;
let testGrantGiven = false;
const ratingHistory = { A: [], B: [] };
let aRatingAtSign = null;
let bRatingAtSign = null;

const sizeAt = {};
function snapshotSize(label) {
  sizeAt[label] = {
    stateKB: Math.round(JSON.stringify(state).length / 1024),
    transactions: state.transactions.length,
    financeHistory: state.financeHistory.length,
    heapMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };
}
snapshotSize("start");

function tryWeeklyActions() {
  // Hire cheapest recruiter first (scouting quality), then a lawyer (slows poaching).
  if (!staffHired) {
    const recruiters = state.staffPool.filter((s) => s.role === "recruiter").sort((a, b) => a.hireCost - b.hireCost);
    if (recruiters[0] && state.agency.money > recruiters[0].hireCost + 30000) {
      hireStaff(state, recruiters[0].id);
      staffHired = true;
      log(`Recruter le staff : ${recruiters[0].name} (recruteur, ${recruiters[0].hireCost}€)`, `Staff engagé, salaire ${recruiters[0].weeklyWage}€/sem · Budget: ${money()}`);
    }
  }
  if (staffHired && !lawyerHired) {
    const lawyers = state.staffPool.filter((s) => s.role === "lawyer").sort((a, b) => a.hireCost - b.hireCost);
    if (lawyers[0] && state.agency.money > lawyers[0].hireCost + 35000) {
      hireStaff(state, lawyers[0].id);
      lawyerHired = true;
      log(`Recruter un avocat : ${lawyers[0].name} (${lawyers[0].hireCost}€)`, `Réduit les chances de débauchage rival · Budget: ${money()}`);
    }
  }

  // Driver A: normal scout -> sign -> seat via recruitment budget -> race budget.
  if (!driverA) {
    const candidate = state.scoutPool[0];
    if (candidate && staffHired) {
      const scoutedNow = scoutDriver(state, candidate.id);
      const reveal = candidate.scoutReveal;
      const revealedKeys = reveal ? Object.keys(reveal.attributeWidths) : [];
      const avgWidth = revealedKeys.length
        ? Math.round(revealedKeys.reduce((sum, key) => sum + reveal.attributeWidths[key], 0) / revealedKeys.length)
        : 0;
      log(
        `Scouting normal sur ${candidate.name} (500€)`,
        reveal
          ? `Caractéristiques révélées: [${revealedKeys.join(", ")}], largeur moyenne ±${Math.round(avgWidth / 2)} (potentiel affiché: "?") · Budget: ${money()}`
          : `Aucune fourchette disponible (candidate.scoutReveal absent) · Budget: ${money()}`,
        !scoutedNow && !reveal
          ? "scoutDriver() a retourné false — pilote déjà marqué scouted=true (probablement par autoRevealCandidates en arrière-plan) sans scoutReveal jamais renseigné"
          : scoutedNow && revealedKeys.length === 0
            ? "Scouting normal ne révèle aucune caractéristique"
            : null
      );
      const res = signDriver(state, candidate.id);
      if (res.ok) {
        driverA = res.driver;
        aRatingAtSign = overallRating(driverA);
        log(
          `Signer ${driverA.name} sous contrat d'AGENCE`,
          `Contrat agence: ${driverA.contract.weeksRemaining} semaines, ${driverA.contract.weeklyWage}€/sem (amateur => l'agence PERÇOIT ces frais), teamId=null (pas encore de baquet — contrat agence ≠ baquet équipe) · Budget: ${money()}`
        );
      } else {
        log(`Tentative de signature de ${candidate.name}`, `Refusée: ${res.error} · Budget: ${money()}`, "Signature impossible — budget de départ trop serré pour le coût de signature");
      }
    }
  }
  if (driverA && state.drivers.includes(driverA) && !driverA.teamId && !aContractExpiredLogged) {
    if (!driverA.pendingOffers?.length) {
      proposeToTeams(state, driverA.id, 4000, makeRng(state));
      log(
        `Proposer ${driverA.name} aux écuries avec un BUDGET DE RECRUTEMENT de 4 000€`,
        `${driverA.pendingOffers.length} offre(s) reçue(s) — budget engagé, débité si un baquet est accepté · Budget: ${money()}`
      );
    }
    if (driverA.pendingOffers?.length) {
      const offer = [...driverA.pendingOffers].sort((a, b) => a.cost - b.cost)[0];
      const res = joinTeam(state, driverA.id, offer.teamId, makeRng(state));
      if (res.ok) {
        const budgetTx = [...state.transactions].reverse().find((t) => t.type === "recruitment-budget");
        log(
          `Accepter l'offre de ${offer.teamName} (${offer.categoryName})`,
          `Baquet payé ${offer.cost.toLocaleString("fr-FR")}€ + budget de recrutement débité ${budgetTx ? (-budgetTx.amount).toLocaleString("fr-FR") : 0}€ (FIX 2 vérifié) · Budget: ${money()}`,
          budgetTx ? null : "FIX 2 NON EFFECTIF: budget de recrutement toujours pas débité"
        );
      }
    }
  }
  if (driverA?.teamId && !investmentSet) {
    setInvestment(state, driverA.id, 500);
    investmentSet = true;
    log(`Fixer le BUDGET COURSE de ${driverA.name} à 500€/course`, `Investissement récurrent débité chaque week-end de course pour booster la performance · Budget: ${money()}`);
  }

  // Driver B: deep scout -> sign -> intentionally NEVER seated (loyalty decay test).
  if (!driverB && driverA?.teamId) {
    const candidate = state.scoutPool.find((d) => d !== driverA && !d.scouted) ?? state.scoutPool[0];
    const bCost = candidate ? 2500 + 3000 + candidate.potential * 400 : Infinity;
    if (candidate && state.agency.money < bCost && state.week >= 20 && !testGrantGiven) {
      testGrantGiven = true;
      state.agency.money += 25000;
      log(
        "SUBVENTION DE TEST +25 000€ (affordance de harnais, hors gameplay)",
        `Fonds propres insuffisants pour un 2e pilote après 20 semaines — injection pour pouvoir tester la chaîne loyauté/dilemme/débauchage · Budget: ${money()}`,
        "ÉQUILIBRAGE: avec frais amateurs /40 et primes karting faibles, un 2e pilote est infinançable en S1 sur fonds propres — nerf peut-être trop agressif"
      );
    }
    if (candidate && state.agency.money > bCost) {
      deepScoutDriver(state, candidate.id);
      log(
        `SCOUTING APPROFONDI sur ${candidate.name} (2 500€)`,
        `Potentiel EXACT révélé: ${candidate.potential} (vs fourchettes du scouting normal), cooldown scouting auto: ${state.deepScoutCooldownWeeks} sem · Budget: ${money()}`
      );
      const res = signDriver(state, candidate.id);
      if (res.ok) {
        driverB = res.driver;
        bRatingAtSign = overallRating(driverB);
        log(
          `Signer ${driverB.name} et le laisser VOLONTAIREMENT sans baquet`,
          `Contrat agence actif, teamId=null => la décadence de loyauté (-2 relation/sem) va s'enclencher · Relation: ${driverB.agencyRelationship} · Budget: ${money()}`
        );
      }
    }
  }

  // Season 2 recovery for driver A after team-contract expiry.
  if (driverA && state.drivers.includes(driverA) && aContractExpiredLogged && !aRenegotiated) {
    const base = contractBaseline(state, driverA);
    // Sémantique post-fix: pour un amateur, des frais de gestion PLUS BAS sont plus généreux.
    const offer = { weeklyWage: Math.round(base.weeklyWage * 0.8), transferFee: Math.round(base.transferFee * 1.3) };
    if (state.agency.money >= offer.transferFee) {
      const res = negotiateContract(state, driverA.id, offer);
      if (res.ok) {
        aRenegotiated = true;
        log(
          `RENÉGOCIER le contrat d'agence de ${driverA.name} (salaire ${offer.weeklyWage}€, indemnité ${offer.transferFee}€, +30% vs base)`,
          `Contrat accepté: ${driverA.contract.weeksRemaining} semaines restantes, relation ${Math.round(driverA.agencyRelationship)} · Budget: ${money()}`
        );
      } else {
        log(`Offre de renégociation à ${driverA.name}`, `REFUSÉE (${res.error}) — relation -5, nouvel essai la semaine prochaine · Budget: ${money()}`);
      }
    }
  }
  if (driverA && state.drivers.includes(driverA) && aRenegotiated && !aReseated) {
    if (!driverA.pendingOffers?.length) proposeToTeams(state, driverA.id, 4000, makeRng(state));
    if (driverA.pendingOffers?.length) {
      const offer = [...driverA.pendingOffers].sort((a, b) => a.cost - b.cost)[0];
      const res = joinTeam(state, driverA.id, offer.teamId, makeRng(state));
      if (res.ok) {
        aReseated = true;
        log(
          `Saison 2 : replacer ${driverA.name} chez ${offer.teamName} (${offer.categoryName})`,
          `Baquet payé ${offer.cost.toLocaleString("fr-FR")}€ — le pilote resté sous contrat d'agence retrouve un volant · Budget: ${money()}`
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main 104-week loop
// ---------------------------------------------------------------------------
try {
  while (state.week <= TOTAL_WEEKS) {
    tryWeeklyActions();

    const aContractBefore = driverA?.contract ?? null;
    const rng = makeRng(state);
    const result = beginWeek(state, rng);
    let weekEntries = result.logEntries;
    let eventNote = null;

    if (result.awaitingChoice) {
      const ev = result.event;
      let optionIndex;
      if (ev.eventId === "poach-dilemma") {
        dilemmaResolvedCount++;
        // 1er dilemme: rassurer (-2 000€, relation +15) pour prouver la fenêtre de réaction ;
        // suivants: ignorer, pour laisser la décadence aller jusqu'au débauchage réel.
        optionIndex = dilemmaResolvedCount === 1 ? 0 : 1;
      } else {
        optionIndex = ev.options.length - 1; // safest/decline option to keep the run controlled
      }
      const resolved = continueWeekAfterChoice(state, rng, ev, optionIndex);
      weekEntries = resolved;
      eventNote = `Événement "${ev.title}" -> option ${optionIndex}${ev.eventId === "poach-dilemma" ? " (DILEMME DE DÉBAUCHAGE: rassurer, -2 000€/relation +15)" : ""} -> ${resolved[0]?.text ?? ""}`;
    }

    const poaches = weekEntries.filter((e) => e.type === "rival-poach");
    const raceResults = weekEntries.filter((e) => e.type === "player-result");

    if (state.agency.money < minMoney) minMoney = state.agency.money;
    if (state.agency.money < 0) weeksNegative++;

    // Detections (no `continue`: both must run the same week if they coincide)
    if (driverB && bRatingAtSign != null && !bPoached && !state.drivers.includes(driverB)) {
      bPoached = true;
      const buyoutTx = [...state.transactions].reverse().find((t) => t.type === "poach-buyout");
      log(
        "Constat : pilote benché débauché par une agence rivale",
        `${driverB.name} parti après décadence de loyauté · Indemnité perçue: ${buyoutTx ? buyoutTx.amount.toLocaleString("fr-FR") + "€" : "?"} · Budget: ${money()}`,
        dilemmaResolvedCount === 0 ? "Débauchage backend SANS déclenchement préalable du popup dilemme — le joueur n'a aucun avertissement interactif" : null
      );
    }
    if (driverA && state.drivers.includes(driverA) && aContractBefore && !driverA.contract && !aContractExpiredLogged) {
      aContractExpiredLogged = true;
      log(
        "EXPIRATION DU CONTRAT D'AGENCE de " + driverA.name,
        `contract=null, teamId=${driverA.teamId} (le baquet écurie est désormais indépendant — il n'expire qu'au rollover de fin de saison, pas ici) MAIS le pilote reste dans state.drivers (reste sous l'aile de l'AGENCE) · Budget: ${money()}`
      );
    }

    // Weekly line
    const parts = [];
    if (eventNote) parts.push(eventNote);
    if (raceResults.length) {
      const r = raceResults[0].result;
      parts.push(`Course: P${r.position}/${r.gridSize}${r.dnf ? " (abandon)" : ""}, prime +${r.prize.toLocaleString("fr-FR")}€`);
    }
    if (poaches.length) parts.push(`Débauchages rivaux cette semaine: ${poaches.map((p) => p.driverName).join(", ")}`);
    if (driverB && state.drivers.includes(driverB)) parts.push(`Relation ${driverB.name} (benché): ${Math.round(driverB.agencyRelationship)}`);
    if (weekInSeason(state.week) % 10 === 0 || weekInSeason(state.week) === 1) {
      const aNow = driverA && state.drivers.includes(driverA) ? overallRating(driverA).toFixed(1) : "parti";
      const bNow = driverB ? (state.drivers.includes(driverB) ? overallRating(driverB).toFixed(1) : "parti") : "—";
      ratingHistory.A.push(aNow);
      ratingHistory.B.push(bNow);
      parts.push(`Progression: A ${aRatingAtSign?.toFixed(1)}→${aNow} | B ${bRatingAtSign?.toFixed(1) ?? "—"}→${bNow}`);
    }
    log("Simuler la semaine", `${parts.length ? parts.join(" · ") + " · " : ""}Budget: ${money()}`);

    if (state.week === 53) snapshotSize("endS1");
  }
} catch (err) {
  log("CRASH", `Exception à la semaine ${state.week}: ${err.stack}`, "Crash fatal de la simulation");
}
snapshotSize("endS2");

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n=== RÉSUMÉ DU STRESS TEST (2 SAISONS / 104 SEMAINES) ===");
console.log(`Stabilité: ${state.week > TOTAL_WEEKS ? "aucun crash sur 104 semaines" : "CRASH avant la fin"}`);
console.log(`Économie: budget final ${money()}, minimum atteint ${Math.round(minMoney).toLocaleString("fr-FR")}€, semaines dans le rouge: ${weeksNegative} — faillite: ${minMoney < -20000 ? "OUI" : "NON"}`);
console.log(`Dilemmes de débauchage résolus: ${dilemmaResolvedCount} · Pilote benché débauché: ${bPoached ? "oui (mécanique complète loyauté→débauchage validée)" : "non"}`);
console.log(`Transition S1→S2: expiration contrat=${aContractExpiredLogged}, renégociation agence=${aRenegotiated}, nouveau baquet trouvé=${aReseated}, pilote resté à l'agence=${driverA ? state.drivers.includes(driverA) : false}`);
console.log(`Progression (échantillons aux semaines 1/10/20/...): A: ${ratingHistory.A.join(" → ")} | B: ${ratingHistory.B.join(" → ")}`);
console.log(
  `Stockage/Mémoire: état ${sizeAt.start.stateKB}KB → ${sizeAt.endS1?.stateKB ?? "?"}KB (fin S1) → ${sizeAt.endS2.stateKB}KB (fin S2) · ` +
    `transactions ${sizeAt.start.transactions}→${sizeAt.endS2.transactions} · financeHistory ${sizeAt.start.financeHistory}→${sizeAt.endS2.financeHistory} · ` +
    `heap Node ${sizeAt.start.heapMB}MB→${sizeAt.endS2.heapMB}MB`
);
console.log(`\nAvertissements collectés (${warnings.length}):`);
for (const w of warnings) console.log(" - " + w);
