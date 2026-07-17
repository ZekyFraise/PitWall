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
  scoutDriver,
  deepScoutDriver,
  signDriver,
  negotiateContract,
  setInvestment,
  makeRng,
} from "./game/state.js";
import { proposeToTeams, joinTeam, joinSecondaryChampionship } from "./game/team.js";
import { hireStaff, fireStaff } from "./game/staff.js";
import { upgradeFacility, purchaseShopItem } from "./game/infrastructure.js";
import { approachDriver } from "./game/recruit.js";
import { beginWeek, continueWeekAfterChoice } from "./game/simulate.js";
import { showToast, showConfirm, showEventModal } from "./ui/dialogs.js";

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

function handleSimulate() {
  const occurredWeek = state.week;
  const rng = makeRng(state);
  const result = beginWeek(state, rng);
  result.logEntries.forEach((entry) => (entry.week = occurredWeek));
  state.log.push(...result.logEntries);

  if (result.awaitingChoice) {
    pendingWeekRng = rng;
    showEventModal(result.event, (optionIndex) => {
      const more = continueWeekAfterChoice(state, pendingWeekRng, result.event, optionIndex);
      more.forEach((entry) => (entry.week = occurredWeek));
      state.log.push(...more);
      saveGame(state);
      render();
      return more[0]?.text ?? "";
    });
    render();
    return;
  }

  saveGame(state);
  render();
}

app.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const { action, id } = target.dataset;

  if (view === "title") {
    switch (action) {
      case "title-new":
        titleUi = { screen: "new", color: "#ff3b30" };
        break;
      case "pick-agency-color":
        titleUi = { ...titleUi, color: id };
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
          const newState = createNewGame(slotId, name, color);
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
      default:
        return;
    }
    render();
    return;
  }

  switch (action) {
    case "scout":
      scoutDriver(state, Number(id));
      break;
    case "deep-scout": {
      const result = deepScoutDriver(state, Number(id));
      if (!result.ok) showToast(result.error);
      break;
    }
    case "sign": {
      const result = signDriver(state, Number(id));
      if (!result.ok) showToast(result.error);
      break;
    }
    case "negotiate-contract": {
      const container = target.closest(".negotiate-box");
      const weeklyWage = Number(container?.querySelector('[data-role="negotiate-salary"]')?.value) || 0;
      const transferFee = Number(container?.querySelector('[data-role="negotiate-fee"]')?.value) || 0;
      const result = negotiateContract(state, Number(id), { weeklyWage, transferFee });
      if (!result.ok) showToast(result.error);
      break;
    }
    case "propose-teams": {
      const container = target.closest(".propose-box");
      const budgetInput = container?.querySelector('[data-role="propose-budget"]');
      const budget = budgetInput ? Number(budgetInput.value) || 0 : 0;
      const result = proposeToTeams(state, Number(id), budget, makeRng(state));
      if (!result.ok) showToast(result.error);
      break;
    }
    case "join-team": {
      const result = joinTeam(state, Number(id), Number(target.dataset.teamId), makeRng(state));
      if (!result.ok) showToast(result.error);
      break;
    }
    case "join-secondary": {
      const result = joinSecondaryChampionship(state, Number(id), Number(target.dataset.teamId), makeRng(state));
      if (!result.ok) showToast(result.error);
      break;
    }
    case "buy-shop-item": {
      const result = purchaseShopItem(state, id);
      if (!result.ok) showToast(result.error);
      break;
    }
    case "hire-staff":
      hireStaff(state, Number(id));
      break;
    case "fire-staff":
      fireStaff(state, Number(id));
      break;
    case "upgrade-facility":
      upgradeFacility(state, id);
      break;
    case "approach-driver": {
      const result = approachDriver(state, Number(id), makeRng(state));
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
        saveGame(state);
      }
      break;
    }
    case "simulate":
      handleSimulate();
      return;
    case "save":
      saveGame(state);
      break;
    case "main-menu":
      showConfirm("Retourner au menu principal ? La partie est déjà sauvegardée.", () => {
        saveGame(state);
        state = null;
        view = "title";
        titleUi = { screen: "main" };
        render();
      });
      return;
    case "focus-category":
      state.ui.focusedCategoryId = id;
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
      break;
    }
    case "view-driver":
      state.ui.viewingDriverId = Number(id);
      state.ui.activeMenu = "driver-detail";
      break;
    case "back-to-roster":
      state.ui.activeMenu = "mes-pilotes";
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
  }
});

// Keep titleUi.name in sync on every keystroke (not just on blur/change) so that a full
// re-render triggered by another action (e.g. picking a color) never wipes what was typed.
app.addEventListener("input", (e) => {
  if (view === "title" && e.target.matches('[data-role="agency-name"]')) {
    titleUi.name = e.target.value;
  }
});

render();
