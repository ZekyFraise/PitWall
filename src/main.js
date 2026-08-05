import "./style.css";
import { renderApp } from "./ui/render.js";
import { renderTitleScreen } from "./ui/titleScreen.js";
import {
  createNewGame,
  loadGame,
  saveGame,
  getLastSlotId,
  listSaves,
  deleteSave,
  renameSave,
  scoutDriver,
  scoutRivalDriver,
  deepScoutRivalDriver,
  deepScoutDriver,
  signDriver,
  negotiateSigning,
  signCost,
  negotiateContract,
  setInvestment,
  makeRng,
  devAddMoney,
  devAddReputation,
  devForceAgencyContract,
  takeLoan,
  releaseDriver,
  requestScoutSearch,
  scoutStaff,
  deepScoutStaff,
} from "./game/state.js";
import {
  proposeToTeams,
  joinTeam,
  joinSecondaryChampionship,
  proposeSecondaryChampionship,
  acceptSubstituteOffer,
  devForceTeamContract,
  negotiateTransfer,
  buyTeam,
  upgradeTeamDevelopment,
} from "./game/team.js";
import { hireStaff, fireStaff } from "./game/staff.js";
import { signSponsor, terminateSponsor } from "./game/sponsors.js";
import { fundAcademyProgram } from "./game/academies.js";
import { upgradeFacility, purchaseShopItem } from "./game/infrastructure.js";
import { upgradeLifestyle } from "./game/lifestyle.js";
import { approachDriver } from "./game/recruit.js";
import { beginWeek, continueWeekAfterChoice } from "./game/simulate.js";
import { showToast, showConfirm, showEventModal, showSaveBanner, showResultModal, showResultToast, showNegotiationModal } from "./ui/dialogs.js";

const COMPARE_MAX = 4;
const SAVE_FAILED_MESSAGE =
  "La sauvegarde a échoué (stockage plein ?) — libère de l'espace puis sauvegarde à nouveau via le bouton \"Sauvegarder\".";

const app = document.getElementById("app");

let view = "title";
let titleUi = { screen: "main" };
let state = null;
let pendingWeekRng = null;

function render() {
  if (view === "title") {
    titleUi.hasContinue = !!getLastSlotId();
    titleUi.hasSaves = listSaves().length > 0;
    app.innerHTML = renderTitleScreen(titleUi);
  } else {
    app.innerHTML = renderApp(state);
  }
}

function enterGame(loadedState) {
  state = loadedState;
  document.documentElement.style.setProperty("--agency-color", state.agency.color || "#ffb020");
  view = "game";
  render();
}

// Dedicated alerts for events the player could easily miss in "Nouveautés" (a plain <li> among
// many) — shared between beginWeek's direct log entries and continueWeekAfterChoice's, since
// runWeekBody (and anything it resolves, like scoutSearches) only actually runs in whichever of
// the two produced entries this week.
function showSimulationLogToasts(logEntries) {
  for (const entry of logEntries) {
    if (entry.type === "rival-poach") {
      showToast(`${entry.agencyName} débauche ${entry.driverName}, resté sans contrat trop longtemps.`, "warning");
    } else if (entry.type === "rival-scout-sign") {
      showToast(`${entry.agencyName} signe ${entry.driverName} avant toi.`, "warning");
    } else if (entry.type === "scout-search-result") {
      showToast(`Un nouveau profil (${entry.driverName}) a été trouvé.`, "success");
    } else if (entry.type === "random-event") {
      // Only auto-resolved (kind: info) events reach here — a choice dilemma's own resolution is
      // already popped up via showEventModal's callback (handleSimulate slices it out below).
      showResultToast(entry.title, entry.text, entry.tone ?? "neutral");
    } else if (entry.type === "player-result") {
      // Only results that actually matter get a popup — every other position still lands in
      // "Résultats" as before, just without an interruption.
      const { position, dnf } = entry.result;
      if (dnf) {
        showResultModal(`Abandon — ${entry.category.name}`, `${entry.driver.name} ne termine pas la course.`, "bad", "⚠️");
      } else if (position === 1) {
        showResultModal(`Victoire ! — ${entry.category.name}`, `${entry.driver.name} remporte la course.`, "good", "🏆");
      } else if (position <= 3) {
        showResultModal(`Podium — ${entry.category.name}`, `${entry.driver.name} termine P${position}.`, "good", "🏁");
      }
    }
  }
}

function handleSimulate() {
  state.tutorial.simulated = true;
  const occurredWeek = state.week;
  const rng = makeRng(state);
  const result = beginWeek(state, rng);
  result.logEntries.forEach((entry) => (entry.week = occurredWeek));
  state.log.push(...result.logEntries);

  showSimulationLogToasts(result.logEntries);

  if (result.awaitingChoice) {
    pendingWeekRng = rng;
    showEventModal(result.event, (optionIndex) => {
      const more = continueWeekAfterChoice(state, pendingWeekRng, result.event, optionIndex);
      more.forEach((entry) => (entry.week = occurredWeek));
      state.log.push(...more);
      // more[0] is the dilemma's own resolution — already shown via the result popup returned
      // below to showEventModal, so skip it here to avoid popping it up twice.
      showSimulationLogToasts(more.slice(1));
      if (!saveGame(state)) showToast(SAVE_FAILED_MESSAGE);
      render();
      return more[0] ?? null;
    });
    render();
    return;
  }

  if (!saveGame(state)) showToast(SAVE_FAILED_MESSAGE);
  render();
}

app.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const { action, id } = target.dataset;

  if (view === "title") {
    switch (action) {
      case "title-new":
        titleUi = { screen: "new", color: "#ff3b30", specialty: "none" };
        break;
      case "pick-agency-color":
        titleUi = { ...titleUi, color: id };
        break;
      case "pick-agency-specialty":
        titleUi = { ...titleUi, specialty: id };
        break;
      case "title-continue": {
        const slotId = getLastSlotId();
        const loaded = slotId ? loadGame(slotId) : null;
        if (loaded) {
          enterGame(loaded);
          return;
        }
        showToast("Aucune partie à continuer.");
        return;
      }
      case "title-load":
        titleUi = { screen: "load", saves: listSaves() };
        break;
      case "title-back":
        titleUi = { screen: "main" };
        break;
      case "confirm-new-game": {
        const nameInput = document.querySelector('[data-role="agency-name"]');
        const name = (titleUi.name || nameInput?.value || "").trim() || "Nouvelle Agence";
        const color = titleUi.color ?? "#ff3b30";
        const slotId = `slot-${Date.now()}`;
        try {
          const newState = createNewGame(slotId, name, color, undefined, titleUi.specialty ?? "none");
          const saved = saveGame(newState);
          enterGame(newState);
          if (!saved) showToast("Partie créée, mais la sauvegarde a échoué (stockage plein) — libère de l'espace puis sauvegarde à nouveau.");
        } catch (err) {
          console.error("World generation failed in createNewGame:", err);
          showToast("Échec de la création de la partie — voir la console pour le détail.");
        }
        return;
      }
      case "load-slot": {
        const loaded = loadGame(id);
        if (loaded) enterGame(loaded);
        return;
      }
      case "delete-slot":
        showConfirm("Supprimer cette sauvegarde ?", () => {
          deleteSave(id);
          titleUi = { screen: "load", saves: listSaves() };
          render();
        });
        return;
      case "rename-save": {
        const row = target.closest(".save-row");
        const newName = row?.querySelector('[data-role="save-name"]')?.value.trim();
        if (newName) renameSave(id, newName);
        titleUi = { screen: "load", saves: listSaves() };
        break;
      }
      default:
        return;
    }
    render();
    return;
  }

  // In dev mode, every action below accepts { force: true } — it bypasses cost checks
  // and RNG-based success/failure so testing isn't blocked by budget or bad rolls.
  const force = Boolean(state.ui.devMode);

  switch (action) {
    case "scout": {
      const result = scoutDriver(state, Number(id), { force });
      if (result) state.tutorial.scouted = true;
      break;
    }
    case "scout-rival": {
      const result = scoutRivalDriver(state, Number(id), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "deep-scout-rival": {
      const result = deepScoutRivalDriver(state, Number(id), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "deep-scout": {
      const result = deepScoutDriver(state, Number(id), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "request-scout-search": {
      const result = requestScoutSearch(state, { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "sign": {
      const driverId = Number(id);
      if (force) {
        const result = signDriver(state, driverId, { force: true });
        if (!result.ok) showToast(result.error);
        else state.tutorial.signed = true;
        break;
      }
      const prospect = state.scoutPool.find((d) => d.id === driverId);
      if (!prospect) break;
      const baseline = signCost(state, prospect);
      showNegotiationModal(
        `Négociation — ${prospect.name}`,
        `Propose un montant pour recruter ${prospect.name}. Une offre trop basse par rapport à sa valeur risque d'être refusée.`,
        baseline,
        (offer) => {
          const result = negotiateSigning(state, driverId, offer, {});
          if (result.ok) {
            state.tutorial.signed = true;
            render();
          }
          return result;
        }
      );
      return;
    }
    case "negotiate-contract": {
      const container = target.closest(".negotiate-box");
      const weeklyWage = Number(container?.querySelector('[data-role="negotiate-salary"]')?.value) || 0;
      const transferFee = Number(container?.querySelector('[data-role="negotiate-fee"]')?.value) || 0;
      const commissionRate = (Number(container?.querySelector('[data-role="negotiate-commission"]')?.value) || 0) / 100;
      const seasons = Number(container?.querySelector('[data-role="negotiate-seasons"]')?.value) || 1;
      const installments = Number(container?.querySelector('[data-role="negotiate-installments"]')?.value) || 1;
      const result = negotiateContract(state, Number(id), { weeklyWage, transferFee, commissionRate, seasons, installments }, { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "prefill-counter-offer": {
      // DOM-only — no game state change, so return early instead of falling through to the
      // common render() below, which would immediately overwrite the values just set (state
      // itself hasn't changed, so a re-render would just redraw the same empty/baseline fields).
      const container = target.closest(".negotiate-box");
      if (container) {
        if (target.dataset.commission != null) {
          const el = container.querySelector('[data-role="negotiate-commission"]');
          if (el) el.value = target.dataset.commission;
        }
        if (target.dataset.wage != null) {
          const el = container.querySelector('[data-role="negotiate-salary"]');
          if (el) el.value = target.dataset.wage;
        }
        if (target.dataset.fee != null) {
          const el = container.querySelector('[data-role="negotiate-fee"]');
          if (el) el.value = target.dataset.fee;
        }
      }
      return;
    }
    case "negotiate-transfer": {
      const container = target.closest(".negotiate-box");
      const askingFee = Number(container?.querySelector('[data-role="negotiate-transfer-fee"]')?.value) || 0;
      const result = negotiateTransfer(state, Number(id), { askingFee }, makeRng(state), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "release-driver": {
      const driverId = Number(id);
      showConfirm("Licencier ce pilote ? Coût de résiliation débité, -1 réputation, résiliation immédiate.", () => {
        const result = releaseDriver(state, driverId, makeRng(state));
        if (!result.ok) {
          showToast(result.error);
          return;
        }
        state.ui.activeMenu = state.ui.driverDetailOrigin ?? "mes-pilotes";
        render();
      });
      return;
    }
    case "propose-teams": {
      const container = target.closest(".propose-box");
      const budgetInput = container?.querySelector('[data-role="propose-budget"]');
      const budget = budgetInput ? Number(budgetInput.value) || 0 : 0;
      const result = proposeToTeams(state, Number(id), budget, makeRng(state), { force });
      if (!result.ok) showToast(result.error);
      else state.tutorial.proposed = true;
      break;
    }
    case "join-team": {
      const result = joinTeam(state, Number(id), Number(target.dataset.teamId), makeRng(state), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "join-secondary": {
      const result = joinSecondaryChampionship(state, Number(id), Number(target.dataset.teamId), makeRng(state), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "propose-secondary": {
      const result = proposeSecondaryChampionship(state, Number(id), makeRng(state), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "accept-substitute": {
      const result = acceptSubstituteOffer(state, Number(id), makeRng(state), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "buy-shop-item": {
      const result = purchaseShopItem(state, id, { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "hire-staff":
      hireStaff(state, Number(id), { force });
      break;
    case "fire-staff":
      fireStaff(state, Number(id));
      break;
    case "sign-sponsor": {
      const result = signSponsor(state, Number(id));
      if (!result.ok) showToast(result.error);
      break;
    }
    case "terminate-sponsor": {
      showConfirm("Résilier ce contrat sponsor ? Perte de réputation immédiate.", () => {
        terminateSponsor(state);
        render();
      });
      return;
    }
    case "fund-academy": {
      const result = fundAcademyProgram(state, Number(id), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "scout-staff": {
      const result = scoutStaff(state, Number(id), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "deep-scout-staff": {
      const result = deepScoutStaff(state, Number(id), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "filter-staff-pool":
      state.ui.staffFilter = { ...state.ui.staffFilter, role: id };
      break;
    case "upgrade-facility": {
      const result = upgradeFacility(state, id, { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "buy-team": {
      const result = buyTeam(state, Number(id), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "upgrade-team-development": {
      const result = upgradeTeamDevelopment(state, Number(id), { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "upgrade-lifestyle": {
      const result = upgradeLifestyle(state, id, { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "take-loan": {
      const container = target.closest(".propose-box");
      const amount = Number(container?.querySelector('[data-role="loan-amount"]')?.value) || 0;
      const months = Number(container?.querySelector('[data-role="loan-months"]')?.value) || 0;
      const result = takeLoan(state, amount, months, { force });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "approach-driver": {
      const result = approachDriver(state, Number(id), makeRng(state), { force });
      if (!result.ok) {
        showToast(result.error);
      } else {
        state.log.push({
          type: "recruit-established",
          week: state.week,
          driverName: result.driver.name,
          category: result.category,
          wasRivalManaged: result.wasRivalManaged,
          previousAgencyName: result.previousAgencyName,
        });
        if (!saveGame(state)) showToast(SAVE_FAILED_MESSAGE);
      }
      break;
    }
    case "simulate":
      handleSimulate();
      return;
    case "save": {
      const saved = saveGame(state);
      showSaveBanner(saved ? "Partie sauvegardée." : SAVE_FAILED_MESSAGE, saved ? "success" : "error");
      break;
    }
    case "main-menu":
      showConfirm("Retourner au menu principal ?", () => {
        if (!saveGame(state)) {
          showToast(SAVE_FAILED_MESSAGE);
          return;
        }
        state = null;
        view = "title";
        titleUi = { screen: "main" };
        render();
      });
      return;
    case "toggle-dev-mode":
      state.ui.devMode = !state.ui.devMode;
      if (!state.ui.devMode && state.ui.activeMenu === "dev") state.ui.activeMenu = "mes-pilotes";
      break;
    case "dev-add-money":
      devAddMoney(state, Number(id));
      break;
    case "dev-add-reputation":
      devAddReputation(state, Number(id));
      break;
    case "dev-force-sign": {
      const result = signDriver(state, Number(id), { force: true });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "dev-force-team-contract": {
      const result = devForceTeamContract(state, Number(id), makeRng(state));
      if (!result.ok) showToast(result.error);
      break;
    }
    case "dev-force-agency-contract": {
      const result = devForceAgencyContract(state, Number(id));
      if (!result.ok) showToast(result.error);
      break;
    }
    case "focus-category":
      state.ui.focusedCategoryId = id;
      state.ui.focusedSeasonNumber = null;
      break;
    case "filter-offers-category":
      state.ui.offersFilterCategoryId = id === "all" ? null : id;
      break;
    case "finance-window":
      state.ui.financeWindow = id;
      break;
    case "finance-granularity":
      state.ui.financeGranularity = id;
      break;
    case "sort-world-drivers": {
      const current = state.ui.worldDriversSort ?? { field: "rating", dir: "desc" };
      state.ui.worldDriversSort =
        current.field === id ? { field: id, dir: current.dir === "desc" ? "asc" : "desc" } : { field: id, dir: "desc" };
      break;
    }
    case "sort-world-staff": {
      const current = state.ui.worldStaffSort ?? { field: "primary", dir: "desc" };
      state.ui.worldStaffSort =
        current.field === id ? { field: id, dir: current.dir === "desc" ? "asc" : "desc" } : { field: id, dir: "desc" };
      state.ui.worldStaffPage = 0;
      break;
    }
    case "filter-world-staff":
      state.ui.worldStaffFilter = { ...state.ui.worldStaffFilter, role: id };
      state.ui.worldStaffPage = 0;
      break;
    case "filter-world-staff-category":
      state.ui.worldStaffFilter = { ...state.ui.worldStaffFilter, category: id };
      state.ui.worldStaffPage = 0;
      break;
    case "filter-world-staff-availability":
      state.ui.worldStaffFilter = { ...state.ui.worldStaffFilter, availability: id };
      state.ui.worldStaffPage = 0;
      break;
    case "world-staff-page": {
      const pageCount = Math.max(1, Number(target.dataset.pageCount) || 1);
      const current = state.ui.worldStaffPage ?? 0;
      state.ui.worldStaffPage = id === "next" ? Math.min(current + 1, pageCount - 1) : Math.max(current - 1, 0);
      break;
    }
    case "view-driver":
      state.ui.viewingDriverId = Number(id);
      state.ui.driverDetailOrigin = state.ui.activeMenu;
      state.ui.activeMenu = "driver-detail";
      state.ui.viewingDriverSeason = null;
      state.ui.offersFilterCategoryId = null;
      break;
    case "back-to-roster":
      state.ui.activeMenu = state.ui.driverDetailOrigin ?? "mes-pilotes";
      state.ui.viewingDriverSeason = null;
      state.ui.offersFilterCategoryId = null;
      break;
    case "view-driver-season": {
      const seasonNumber = Number(id);
      const categoryId = target.dataset.categoryId;
      const classId = target.dataset.classId || null;
      const current = state.ui.viewingDriverSeason;
      // Clicking the already-open season again collapses the detail block (toggle).
      const isSame = current && current.seasonNumber === seasonNumber && current.categoryId === categoryId && current.classId === classId;
      state.ui.viewingDriverSeason = isSame ? null : { seasonNumber, categoryId, classId };
      break;
    }
    case "toggle-compare-driver": {
      const ids = state.ui.compareDriverIds ?? (state.ui.compareDriverIds = []);
      const numId = Number(id);
      const idx = ids.indexOf(numId);
      if (idx !== -1) ids.splice(idx, 1);
      else if (ids.length < COMPARE_MAX) ids.push(numId);
      break;
    }
    case "toggle-compare-staff": {
      const ids = state.ui.compareStaffIds ?? (state.ui.compareStaffIds = []);
      const numId = Number(id);
      const idx = ids.indexOf(numId);
      if (idx !== -1) ids.splice(idx, 1);
      else if (ids.length < COMPARE_MAX) ids.push(numId);
      break;
    }
    case "compare-drivers":
      state.ui.compareOrigin = state.ui.activeMenu;
      state.ui.activeMenu = "compare-drivers";
      break;
    case "compare-staff":
      state.ui.compareOrigin = state.ui.activeMenu;
      state.ui.activeMenu = "compare-staff";
      break;
    case "clear-compare-drivers":
      state.ui.compareDriverIds = [];
      break;
    case "clear-compare-staff":
      state.ui.compareStaffIds = [];
      break;
    case "dismiss-tutorial":
      state.tutorial.dismissed = true;
      break;
    case "nav":
      if (id === "monde") {
        state.ui.mondeExpanded = !state.ui.mondeExpanded;
      } else {
        state.ui.activeMenu = id;
        if (id.startsWith("monde-")) state.ui.mondeExpanded = true;
      }
      break;
    default:
      return;
  }
  render();
});

app.addEventListener("change", (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const { action, id } = target.dataset;

  if (action === "invest") {
    setInvestment(state, Number(id), Number(target.value));
  } else if (action === "filter-world-staff-min-primary") {
    state.ui.worldStaffFilter = { ...state.ui.worldStaffFilter, minPrimary: Number(target.value) || 0 };
    state.ui.worldStaffPage = 0;
    render();
  } else if (action === "filter-world-staff-max-wage") {
    state.ui.worldStaffFilter = { ...state.ui.worldStaffFilter, maxWage: Number(target.value) || 0 };
    state.ui.worldStaffPage = 0;
    render();
  } else if (action === "filter-staff-pool-min-primary") {
    state.ui.staffFilter = { ...state.ui.staffFilter, minPrimary: Number(target.value) || 0 };
    render();
  } else if (action === "filter-staff-pool-max-wage") {
    state.ui.staffFilter = { ...state.ui.staffFilter, maxWage: Number(target.value) || 0 };
    render();
  } else if (action === "select-season") {
    state.ui.focusedSeasonNumber = target.value === "live" ? null : Number(target.value);
    render();
  }
});

// Keep titleUi.name in sync on every keystroke (not just on blur/change) so that a full
// re-render triggered by another action (e.g. picking a color) never wipes what was typed.
app.addEventListener("input", (e) => {
  if (view === "title" && e.target.matches('[data-role="agency-name"]')) {
    titleUi.name = e.target.value;
  }
});

// Spacebar mirrors clicking "Continuer" — skipped while typing in a field or while a modal
// (dilemma choice, confirm dialog) is open, so it never fires ahead of an unresolved event.
window.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  if (view !== "game") return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (document.querySelector(".modal-overlay")) return;
  e.preventDefault();
  handleSimulate();
});

render();
