import { CATEGORIES, CATEGORY_BY_ID, CATEGORY_EMOJI } from "../../game/data.js";

function categoryLabel(categoryId) {
  const name = CATEGORY_BY_ID[categoryId]?.name ?? categoryId;
  const emoji = CATEGORY_EMOJI[categoryId];
  return emoji ? `${emoji} ${name}` : name;
}

function classLabel(categoryId, classId) {
  if (!classId) return "";
  const cls = CATEGORY_BY_ID[categoryId]?.classes?.find((c) => c.id === classId);
  return ` — ${cls?.label ?? classId}`;
}

function driverIdTag(id) {
  return `<span class="id-tag">[#${id}]</span>`;
}

// "Pilote de l'agence de la saison" — the best championship finish among the player's CURRENTLY
// signed drivers for that season number, reusing driver.seasonHistory (already recorded at every
// rollover). Same known limitation as the driver detail page's own Historique table: a driver's
// history disappears if they leave the agency (release, poaching) — not tracked independently here.
function bestAgencyFinish(state, seasonNumber) {
  let best = null;
  for (const driver of state.drivers) {
    for (const entry of driver.seasonHistory) {
      if (entry.seasonNumber !== seasonNumber || entry.championshipPosition == null) continue;
      if (!best || entry.championshipPosition < best.position) {
        best = { driver, position: entry.championshipPosition, categoryId: entry.categoryId };
      }
    }
  }
  return best;
}

function championshipRow(entry) {
  const label = categoryLabel(entry.categoryId) + classLabel(entry.categoryId, entry.classId);
  const driverCell = entry.driverChampion
    ? `${entry.driverChampion.name} ${driverIdTag(entry.driverChampion.id)}${entry.driverChampion.isPlayer ? ` <span class="pill accent">un de tes pilotes !</span>` : ""}`
    : "—";
  const teamCell = entry.teamChampion ? entry.teamChampion.name : "—";
  return `
    <tr class="${entry.driverChampion?.isPlayer ? "highlight-row" : ""}">
      <td>${label}</td>
      <td>${driverCell}</td>
      <td>${teamCell}</td>
    </tr>`;
}

export function renderPalmares(state) {
  const history = state.championsHistory ?? [];
  if (history.length === 0) {
    return `
      <h2>Palmarès</h2>
      <p class="muted">Aucun championnat terminé pour l'instant — reviens ici après la première fin de saison d'une catégorie.</p>`;
  }

  const bySeason = new Map();
  for (const entry of history) {
    if (!bySeason.has(entry.seasonNumber)) bySeason.set(entry.seasonNumber, []);
    bySeason.get(entry.seasonNumber).push(entry);
  }
  const categoryOrder = new Map(CATEGORIES.map((c, i) => [c.id, i]));

  const seasons = [...bySeason.keys()].sort((a, b) => b - a);
  const blocks = seasons
    .map((seasonNumber) => {
      const entries = [...bySeason.get(seasonNumber)].sort(
        (a, b) => (categoryOrder.get(a.categoryId) ?? 0) - (categoryOrder.get(b.categoryId) ?? 0)
      );
      const distinction = bestAgencyFinish(state, seasonNumber);
      const distinctionLine = distinction
        ? `<p class="muted">🏅 Pilote de l'agence de la saison ${seasonNumber} : <b>${distinction.driver.name}</b> ${driverIdTag(distinction.driver.id)} — P${distinction.position} en ${categoryLabel(distinction.categoryId)}</p>`
        : "";
      return `
        <h3 class="class-heading">Saison ${seasonNumber}</h3>
        ${distinctionLine}
        <div class="table-scroll">
          <table class="table">
            <thead><tr><th>Championnat</th><th>Pilote champion</th><th>Écurie championne</th></tr></thead>
            <tbody>${entries.map(championshipRow).join("")}</tbody>
          </table>
        </div>`;
    })
    .join("");

  return `
    <h2>Palmarès</h2>
    <p class="muted">Champions par saison et par catégorie, toutes écuries confondues.</p>
    ${blocks}`;
}
