import { CATEGORIES, CATEGORY_BY_ID } from "../../game/data.js";
import { getDriverById, overallRating } from "../../game/driver.js";
import { rosterCapacity } from "../../game/infrastructure.js";
import { approachTerms } from "../../game/recruit.js";
import { ROLES } from "../../game/staff.js";

const STAFF_ROLE_CATEGORY = {
  recruiter: "Sportif",
  physio: "Sportif",
  psychologist: "Sportif",
  drivingCoach: "Sportif",
  negotiator: "Business",
  cfo: "Business",
  lawyer: "Business",
};

function focusedCategory(state) {
  return CATEGORY_BY_ID[state.ui.focusedCategoryId ?? CATEGORIES[0].id];
}

function categoryTabs(state) {
  const focused = state.ui.focusedCategoryId ?? CATEGORIES[0].id;
  return CATEGORIES.map(
    (c) => `<button class="tab ${c.id === focused ? "active" : ""}" data-action="focus-category" data-id="${c.id}">${c.name}</button>`
  ).join("");
}

function statusTag(state, driver) {
  const isPlayer = state.drivers.some((d) => d.id === driver.id);
  if (isPlayer) return `<span class="pill accent">${state.agency.name}</span>`;
  if (driver.agencyId) {
    const agency = state.rivalAgencies.find((a) => a.id === driver.agencyId);
    return `<span class="pill">${agency ? agency.name : "Agence rivale"}</span>`;
  }
  return `<span class="pill muted">Indépendant</span>`;
}

function classificationBlock(state, category, classId, label) {
  const key = classId ? `${category.id}:${classId}` : category.id;
  const standings = state.standings[key] ?? { race: 0, seasonNumber: 1, driverPoints: {}, teamPoints: {}, carPoints: {} };
  const classTeams = classId
    ? (state.teams[category.id] ?? []).filter((t) => t.class === classId)
    : state.teams[category.id] ?? [];
  const carClassification = category.carClassification === true;
  const constructorsEnabled = category.constructorsEnabled !== false;
  const suffix = label ? `— ${label}` : `— ${category.name}`;

  const allDrivers = [];
  for (const team of classTeams) {
    for (const seat of team.seats) {
      if (seat.driverId == null) continue;
      const driver = getDriverById(state, seat.driverId);
      if (driver) allDrivers.push(driver);
    }
  }
  const driverRows = allDrivers
    .map((driver) => ({ driver, pts: standings.driverPoints[driver.id] ?? 0 }))
    .sort((a, b) => b.pts - a.pts)
    .map(({ driver, pts }, i) => {
      const isPlayer = state.drivers.some((d) => d.id === driver.id);
      const number = driver.raceNumber != null ? `#${driver.raceNumber} ` : "";
      return `<tr class="${isPlayer ? "highlight-row" : ""}"><td>${i + 1}</td><td>${number}${driver.name}</td><td>${pts}</td></tr>`;
    })
    .join("");

  const teamRows = classTeams
    .map((team) => ({ team, pts: standings.teamPoints[team.id] ?? 0 }))
    .sort((a, b) => b.pts - a.pts)
    .map(({ team, pts }, i) => {
      const hasPlayer = team.seats.some((s) => state.drivers.some((d) => d.id === s.driverId));
      return `<tr class="${hasPlayer ? "highlight-row" : ""}"><td>${i + 1}</td><td>${team.name}</td><td>${pts}</td></tr>`;
    })
    .join("");

  const allCars = [];
  for (const team of classTeams) {
    const carIndices = new Set(team.seats.map((s) => s.carIndex ?? 0));
    for (const carIndex of carIndices) allCars.push({ team, carIndex });
  }
  const carRows = allCars
    .map(({ team, carIndex }) => ({ team, carIndex, pts: standings.carPoints?.[`${team.id}:${carIndex}`] ?? 0 }))
    .sort((a, b) => b.pts - a.pts)
    .map(({ team, carIndex, pts }, i) => {
      const number = team.carNumbers?.[carIndex];
      const hasPlayer = team.seats.some(
        (s) => s.carIndex === carIndex && state.drivers.some((d) => d.id === s.driverId)
      );
      return `<tr class="${hasPlayer ? "highlight-row" : ""}"><td>${i + 1}</td><td>${team.name} ${number != null ? `#${number}` : ""}</td><td>${pts}</td></tr>`;
    })
    .join("");

  const secondaryBlock = carClassification
    ? `<div>
        <h3>Voitures ${suffix}</h3>
        <table class="table"><tbody>${carRows || `<tr><td class="muted">Pas encore de course.</td></tr>`}</tbody></table>
      </div>`
    : constructorsEnabled
      ? `<div>
        <h3>Écuries ${suffix}</h3>
        <table class="table"><tbody>${teamRows || `<tr><td class="muted">Pas encore de course.</td></tr>`}</tbody></table>
      </div>`
      : `<div class="muted">Pas de championnat constructeurs pour cette catégorie.</div>`;

  return `
    ${label ? `<h3 class="class-heading">${label}</h3>` : ""}
    <div class="standings-grid">
      <div>
        <h3>Pilotes ${suffix}</h3>
        <table class="table"><tbody>${driverRows || `<tr><td class="muted">Pas encore de course.</td></tr>`}</tbody></table>
      </div>
      ${secondaryBlock}
    </div>
    <div class="muted season-line">Saison ${standings.seasonNumber} · Manche ${standings.race}/${category.roundCount}</div>
  `;
}

export function renderWorldChampionships(state) {
  const category = focusedCategory(state);
  const body = category.classes
    ? category.classes.map((cls) => classificationBlock(state, category, cls.id, cls.label)).join("")
    : classificationBlock(state, category, null, null);

  return `
    <h2>Monde — Championnats</h2>
    <div class="tabs">${categoryTabs(state)}</div>
    ${body}
  `;
}

function approachCell(state, driver) {
  if (state.drivers.some((d) => d.id === driver.id)) return "";
  if (state.drivers.length >= rosterCapacity(state)) {
    return `<button class="secondary small" disabled>Effectif complet</button>`;
  }
  const { threshold, appeal, cost, isRivalManaged } = approachTerms(state, driver);
  if (appeal < threshold) {
    return `<button class="secondary small" disabled>Réputation insuffisante (${threshold})</button>`;
  }
  const label = isRivalManaged ? `Débaucher (${cost.toLocaleString("fr-FR")}€)` : `Approcher (${cost.toLocaleString("fr-FR")}€)`;
  return `<button data-action="approach-driver" data-id="${driver.id}" class="small">${label}</button>`;
}

const DRIVER_SORTERS = {
  number: (d) => d.driver.raceNumber ?? 999,
  name: (d) => d.driver.name,
  age: (d) => d.driver.age,
  rating: (d) => overallRating(d.driver),
  team: (d) => d.team.name,
};

function sortHeader(state, field, label) {
  const sort = state.ui.worldDriversSort ?? { field: "rating", dir: "desc" };
  const active = sort.field === field;
  const arrow = active ? (sort.dir === "desc" ? " ▼" : " ▲") : "";
  return `<th data-action="sort-world-drivers" data-id="${field}" class="sortable ${active ? "active" : ""}">${label}${arrow}</th>`;
}

export function renderWorldDrivers(state) {
  const rows = [];
  for (const category of CATEGORIES) {
    const teams = state.teams[category.id] ?? [];
    for (const team of teams) {
      for (const seat of team.seats) {
        if (seat.driverId == null) continue;
        const driver = getDriverById(state, seat.driverId);
        if (!driver) continue;
        rows.push({ driver, team, category });
      }
    }
  }

  const sort = state.ui.worldDriversSort ?? { field: "rating", dir: "desc" };
  const getValue = DRIVER_SORTERS[sort.field] ?? DRIVER_SORTERS.rating;
  rows.sort((a, b) => {
    const va = getValue(a);
    const vb = getValue(b);
    const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
    return sort.dir === "desc" ? -cmp : cmp;
  });

  const rowsHtml = rows
    .map(
      ({ driver, team, category }) => `
      <tr>
        <td>${driver.raceNumber != null ? `#${driver.raceNumber}` : "—"}</td>
        <td>${driver.name}</td>
        <td>${driver.age}</td>
        <td>${Math.round(overallRating(driver))}</td>
        <td>${category.name}</td>
        <td>${team.name}</td>
        <td>${statusTag(state, driver)}</td>
        <td>${approachCell(state, driver)}</td>
      </tr>`
    )
    .join("");

  return `
    <h2>Monde — Pilotes</h2>
    <div class="table-scroll">
      <table class="table wide">
        <thead><tr>
          ${sortHeader(state, "number", "N°")}
          ${sortHeader(state, "name", "Pilote")}
          ${sortHeader(state, "age", "Âge")}
          ${sortHeader(state, "rating", "Niveau")}
          <th>Catégorie</th>
          ${sortHeader(state, "team", "Écurie")}
          <th>Statut</th><th>Recruter</th>
        </tr></thead>
        <tbody>${rowsHtml || `<tr><td class="muted" colspan="8">Aucun pilote.</td></tr>`}</tbody>
      </table>
    </div>`;
}

export function renderWorldTeams(state) {
  const category = focusedCategory(state);
  const teams = [...(state.teams[category.id] ?? [])].sort((a, b) => b.prestige - a.prestige);

  const cards = teams
    .map((team) => {
      const hasPlayer = team.seats.some((s) => state.drivers.some((d) => d.id === s.driverId));

      let occupants;
      if (category.driversPerCar) {
        const byCar = new Map();
        team.seats.forEach((seat) => {
          const idx = seat.carIndex ?? 0;
          if (!byCar.has(idx)) byCar.set(idx, []);
          byCar.get(idx).push(seat);
        });
        occupants = [...byCar.entries()]
          .map(([carIndex, seats]) => {
            const carHasPlayer = seats.some((s) => state.drivers.some((d) => d.id === s.driverId));
            const names = seats
              .map((seat) => {
                if (seat.driverId == null) return `<span class="muted">Baquet libre</span>`;
                const driver = getDriverById(state, seat.driverId);
                if (!driver) return `<span class="muted">Baquet libre</span>`;
                return `${driver.name} ${statusTag(state, driver)}`;
              })
              .join(" · ");
            const number = team.carNumbers?.[carIndex];
            return `<div class="roster-line ${carHasPlayer ? "highlight-row" : ""}">Voiture ${number != null ? `#${number}` : ""} — ${names}</div>`;
          })
          .join("");
      } else {
        occupants = team.seats
          .map((seat) => {
            if (seat.driverId == null) return `<div class="muted">Baquet libre</div>`;
            const driver = getDriverById(state, seat.driverId);
            if (!driver) return `<div class="muted">Baquet libre</div>`;
            const number = driver.raceNumber != null ? `#${driver.raceNumber} ` : "";
            return `<div class="roster-line">${number}${driver.name} ${statusTag(state, driver)}</div>`;
          })
          .join("");
      }

      return `
        <div class="card ${hasPlayer ? "highlight-card" : ""}">
          <div class="card-head">
            <strong>${team.name}</strong>
            <span class="pill">Prestige ${team.prestige}</span>
            ${team.carBrand ? `<span class="pill">${team.carBrand}</span>` : ""}
            ${team.subClass ? `<span class="pill accent">${category.classes.find((c) => c.id === team.subClass)?.label ?? team.subClass}</span>` : ""}
          </div>
          ${occupants}
        </div>`;
    })
    .join("");

  return `
    <h2>Monde — Écuries</h2>
    <div class="tabs">${categoryTabs(state)}</div>
    <div class="card-grid">${cards || `<p class="muted">Aucune écurie dans cette catégorie.</p>`}</div>`;
}

const STAFF_SORTERS = {
  name: (r) => r.member.name,
  category: (r) => r.category,
  role: (r) => ROLES[r.member.role].name,
  primary: (r) => r.member.skills.primary,
  wage: (r) => r.member.weeklyWage,
};

function staffSortHeader(state, field, label) {
  const sort = state.ui.worldStaffSort ?? { field: "primary", dir: "desc" };
  const active = sort.field === field;
  const arrow = active ? (sort.dir === "desc" ? " ▼" : " ▲") : "";
  return `<th data-action="sort-world-staff" data-id="${field}" class="sortable ${active ? "active" : ""}">${label}${arrow}</th>`;
}

export function renderWorldStaff(state) {
  const rows = [
    ...state.staff.map((member) => ({ member, hired: true })),
    ...state.staffPool.map((member) => ({ member, hired: false })),
  ].map((r) => ({ ...r, category: STAFF_ROLE_CATEGORY[r.member.role] ?? "—" }));

  const sort = state.ui.worldStaffSort ?? { field: "primary", dir: "desc" };
  const getValue = STAFF_SORTERS[sort.field] ?? STAFF_SORTERS.primary;
  rows.sort((a, b) => {
    const va = getValue(a);
    const vb = getValue(b);
    const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
    return sort.dir === "desc" ? -cmp : cmp;
  });

  const rowsHtml = rows
    .map(({ member, hired, category }) => {
      const role = ROLES[member.role];
      const statusHtml = hired
        ? `<span class="pill accent">${state.agency.name}</span>`
        : `<span class="pill muted">Disponible</span>`;
      const actionHtml = hired
        ? ""
        : `<button data-action="hire-staff" data-id="${member.id}" class="small">Recruter (${member.hireCost.toLocaleString("fr-FR")}€)</button>`;
      return `
      <tr>
        <td>${member.name}</td>
        <td>${category}</td>
        <td>${role.name}</td>
        <td>${member.skills.primary}</td>
        <td>${member.skills.secondary}</td>
        <td>${member.weeklyWage.toLocaleString("fr-FR")}€</td>
        <td>${statusHtml}</td>
        <td>${actionHtml}</td>
      </tr>`;
    })
    .join("");

  return `
    <h2>Monde — Staff</h2>
    <div class="table-scroll">
      <table class="table wide">
        <thead><tr>
          ${staffSortHeader(state, "name", "Nom")}
          ${staffSortHeader(state, "category", "Catégorie")}
          ${staffSortHeader(state, "role", "Rôle")}
          ${staffSortHeader(state, "primary", "Compétence principale")}
          <th>Compétence secondaire</th>
          ${staffSortHeader(state, "wage", "Salaire")}
          <th>Statut</th><th>Action</th>
        </tr></thead>
        <tbody>${rowsHtml || `<tr><td class="muted" colspan="8">Aucun membre de staff.</td></tr>`}</tbody>
      </table>
    </div>`;
}
