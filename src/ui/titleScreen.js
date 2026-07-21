import { LOGO_SVG } from "./layout.js";
import { SEASON_WEEKS, weekInSeason } from "../game/data.js";

function brand() {
  return `
    <div class="title-brand">
      ${LOGO_SVG}
      <span class="brand-text"><span class="brand-pit">PIT</span><span class="brand-wall">WALL</span></span>
    </div>`;
}

function renderMainScreen(ui) {
  return `
    <div class="title-screen">
      ${brand()}
      <div class="title-menu">
        <button data-action="title-new" class="primary">Nouvelle partie</button>
        <button data-action="title-continue" ${ui.hasContinue ? "" : "disabled"}>Continuer</button>
        <button data-action="title-load" ${ui.hasSaves ? "" : "disabled"}>Charger une sauvegarde</button>
      </div>
    </div>`;
}

const AGENCY_COLORS = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00c7be", "#30b0c7", "#0a84ff", "#5e5ce6", "#af52de", "#ff2d55"];

function colorSwatches(selected) {
  return AGENCY_COLORS.map(
    (c) =>
      `<button type="button" class="color-swatch ${c === selected ? "active" : ""}" data-action="pick-agency-color" data-id="${c}" style="background:${c}"></button>`
  ).join("");
}

function escapeAttr(text) {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function renderNewGameScreen(ui) {
  const color = ui.color ?? AGENCY_COLORS[0];
  return `
    <div class="title-screen">
      ${brand()}
      <div class="title-panel">
        <h2>Nouvelle agence</h2>
        <label class="title-field">
          Nom de l'agence
          <input type="text" data-role="agency-name" placeholder="Nouvelle Agence" maxlength="30" value="${escapeAttr(ui.name ?? "")}" />
        </label>
        <label class="title-field">
          Couleur de l'agence
          <div class="color-swatches">${colorSwatches(color)}</div>
        </label>
        <div class="title-actions">
          <button data-action="title-back" class="secondary">Retour</button>
          <button data-action="confirm-new-game" class="primary">Créer</button>
        </div>
      </div>
    </div>`;
}

function renderLoadScreen(saves) {
  const rows = saves
    .map(
      (s) => `
      <div class="save-row">
        <div>
          <input type="text" class="save-name-input" data-role="save-name" maxlength="40" value="${escapeAttr(s.saveName ?? s.agencyName)}" />
          <span class="muted">${s.agencyName} · Semaine ${weekInSeason(s.week)}/${SEASON_WEEKS} · An ${Math.ceil(s.week / SEASON_WEEKS)} · ${s.money.toLocaleString("fr-FR")}€</span>
        </div>
        <div class="card-actions">
          <button data-action="rename-save" data-id="${s.slotId}" class="secondary small">Renommer</button>
          <button data-action="load-slot" data-id="${s.slotId}">Charger</button>
          <button data-action="delete-slot" data-id="${s.slotId}" class="secondary">Supprimer</button>
        </div>
      </div>`
    )
    .join("");

  return `
    <div class="title-screen">
      ${brand()}
      <div class="title-panel">
        <h2>Charger une sauvegarde</h2>
        ${saves.length ? rows : `<p class="muted">Aucune sauvegarde.</p>`}
        <div class="title-actions">
          <button data-action="title-back" class="secondary">Retour</button>
        </div>
      </div>
    </div>`;
}

export function renderTitleScreen(ui) {
  if (ui.screen === "new") return renderNewGameScreen(ui);
  if (ui.screen === "load") return renderLoadScreen(ui.saves ?? []);
  return renderMainScreen(ui);
}
