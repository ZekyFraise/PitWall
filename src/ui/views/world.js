import { CATEGORIES, CATEGORY_BY_ID, TRACK_STYLES } from "../../game/data.js";
import { getDriverById, overallRating } from "../../game/driver.js";
import { rosterCapacity } from "../../game/infrastructure.js";
import { approachTerms } from "../../game/recruit.js";
import { ROLES } from "../../game/staff.js";
import { POINTS_TABLE } from "../../game/standings.js";
import { STAFF_TRAITS, staffTraitTooltip } from "../../game/traits.js";

const STAFF_ROLE_CATEGORY = {
  recruiter: "Sportif",
  physio: "Sportif",
  psychologist: "Sportif",
  drivingCoach: "Sportif",
  negotiator: "Business",
  cfo: "Business",
  lawyer: "Business",
};

function driverIdTag(driver) {
  return `<span class="id-tag">[#${driver.id}]</span>`;
}

// Star scale: tier 0 (0-9) is a single empty star; each tier above adds either a full star
// (odd tier) or a half star (even tier), reaching 5 full stars at tier 9-10 (90-100).
function prestigeStars(prestige) {
  const tier = Math.min(9, Math.max(0, Math.floor(prestige / 10)));
  if (tier === 0) return "☆";
  const fullStars = Math.ceil(tier / 2);
  const hasHalf = tier % 2 === 0;
  return "★".repeat(fullStars) + (hasHalf ? "☆" : "");
}

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

// Wikipedia-F1-style round-by-round grid: one column per round showing each entrant's
// classification (position, or "Ret" if they retired), a "—" for a round not yet run (live
// season) or not entered at all, plus a final cumulative points column. Same rendering works
// for the live in-progress season and any archived past season (state.seasonArchive) since
// both share the exact shape { seasonNumber, driverPoints, teamPoints, carPoints, rounds }.

function lastKnownEntrant(rounds, driverId) {
  for (let i = rounds.length - 1; i >= 0; i--) {
    const found = rounds[i].find((e) => e.driverIds.includes(driverId));
    if (found) return found;
  }
  return null;
}

function lastKnownCarEntrant(rounds, carId) {
  for (let i = rounds.length - 1; i >= 0; i--) {
    const found = rounds[i].find((e) => e.carId === carId);
    if (found) return found;
  }
  return null;
}

function bestClassifiedPosition(rounds, matches) {
  return rounds.reduce((best, round) => {
    const idx = round.findIndex((e) => !e.dnf && matches(e));
    return idx === -1 ? best : Math.min(best, idx + 1);
  }, Infinity);
}

function driverRoundCell(rounds, roundIndex, driverId) {
  const round = rounds[roundIndex];
  if (!round) return `<td class="muted">—</td>`;
  const entry = round.find((e) => e.driverIds.includes(driverId));
  if (!entry) return `<td class="muted">—</td>`;
  if (entry.dnf) return `<td class="warn">Ret</td>`;
  return `<td>${round.indexOf(entry) + 1}</td>`;
}

function carRoundCell(rounds, roundIndex, carId) {
  const round = rounds[roundIndex];
  if (!round) return `<td class="muted">—</td>`;
  const idx = round.findIndex((e) => e.carId === carId);
  if (idx === -1) return `<td class="muted">—</td>`;
  if (round[idx].dnf) return `<td class="warn">Ret</td>`;
  return `<td>${idx + 1}</td>`;
}

// Round-derived carNumber is only known once at least one round has been captured this season
// (state.seasonArchive/standings.rounds) — for a brand-new live season with 0 races run yet,
// fall back to the team's own live carNumbers so the row isn't left without a car number.
function liveCarNumber(teamById, carId) {
  const [teamIdStr, carIndexStr] = carId.split(":");
  const team = teamById.get(Number(teamIdStr));
  return team?.carNumbers?.[Number(carIndexStr)] ?? null;
}

function teamRoundPoints(round, teamId, constructorsTopN) {
  if (!round) return null;
  let count = 0;
  let sum = 0;
  round.forEach((e, idx) => {
    if (e.teamId !== teamId) return;
    const pts = POINTS_TABLE[idx] ?? 0;
    if (pts === 0 || count >= constructorsTopN) return;
    sum += pts;
    count += 1;
  });
  return sum;
}

function teamRoundCell(rounds, roundIndex, teamId, constructorsTopN) {
  const pts = teamRoundPoints(rounds[roundIndex], teamId, constructorsTopN);
  return pts === null ? `<td class="muted">—</td>` : `<td>${pts}</td>`;
}

function roundHeaderCells(category, roundCount) {
  let cells = "";
  for (let i = 0; i < roundCount; i++) {
    const styleId = category.roundStyles?.[i];
    const styleLabel = styleId ? TRACK_STYLES[styleId]?.label : null;
    cells += `<th${styleLabel ? ` title="${styleLabel}"` : ""}>R${i + 1}</th>`;
  }
  return cells;
}

function classificationBlock(state, category, classId, label) {
  const key = classId ? `${category.id}:${classId}` : category.id;
  const liveStandings = state.standings[key] ?? { race: 0, seasonNumber: 1, driverPoints: {}, teamPoints: {}, carPoints: {}, rounds: [] };
  const focusedSeason = state.ui.focusedSeasonNumber;
  const archivedSeason = focusedSeason != null
    ? (state.seasonArchive?.[key] ?? []).find((s) => s.seasonNumber === focusedSeason)
    : null;
  const standings = archivedSeason ?? liveStandings;
  const isLive = !archivedSeason;
  const rounds = standings.rounds ?? [];

  const classTeams = classId
    ? (state.teams[category.id] ?? []).filter((t) => t.subClass === classId)
    : state.teams[category.id] ?? [];
  const carClassification = category.carClassification === true;
  const constructorsEnabled = category.constructorsEnabled !== false;
  const constructorsTopN = category.constructorsTopN ?? Infinity;
  const suffix = label ? `— ${label}` : `— ${category.name}`;
  const teamNameById = new Map(classTeams.map((t) => [t.id, t.name]));
  const teamById = new Map(classTeams.map((t) => [t.id, t]));

  // Driver rows: currently-seated roster (live only) UNION any driver who appeared in at least
  // one round this season — keeps a driver who left mid-season visible instead of vanishing
  // outright, and is the ONLY source of rows once viewing an archived (no longer current) season.
  const driverIds = new Set();
  if (isLive) {
    for (const team of classTeams) {
      for (const seat of team.seats) {
        if (seat.driverId != null) driverIds.add(seat.driverId);
      }
    }
  }
  for (const round of rounds) {
    for (const e of round) {
      for (const id of e.driverIds) driverIds.add(id);
    }
  }

  const driverRows = [...driverIds]
    .map((id) => {
      const last = lastKnownEntrant(rounds, id);
      const name = last ? last.driverNames[last.driverIds.indexOf(id)] : (getDriverById(state, id)?.name ?? `#${id}`);
      const pts = standings.driverPoints[id] ?? 0;
      const bestPosition = bestClassifiedPosition(rounds, (e) => e.driverIds.includes(id));
      return { id, name, pts, bestPosition };
    })
    .sort((a, b) => b.pts - a.pts || a.bestPosition - b.bestPosition)
    .map(({ id, name, pts }, i) => {
      const isPlayer = state.drivers.some((d) => d.id === id);
      let cells = "";
      for (let r = 0; r < category.roundCount; r++) cells += driverRoundCell(rounds, r, id);
      return `<tr class="${isPlayer ? "highlight-row" : ""}"><td>${i + 1}</td><td>${name} ${driverIdTag({ id })}</td>${cells}<td>${pts}</td></tr>`;
    })
    .join("");

  let secondaryRows = "";
  let secondaryHeading = "";
  if (carClassification) {
    secondaryHeading = `Voitures ${suffix}`;
    const carIds = new Set();
    if (isLive) {
      for (const team of classTeams) {
        const carIndices = new Set(team.seats.map((s) => s.carIndex ?? 0));
        for (const carIndex of carIndices) carIds.add(`${team.id}:${carIndex}`);
      }
    }
    for (const round of rounds) {
      for (const e of round) {
        if (e.carId) carIds.add(e.carId);
      }
    }
    secondaryRows = [...carIds]
      .map((carId) => {
        const last = lastKnownCarEntrant(rounds, carId);
        const pts = standings.carPoints?.[carId] ?? 0;
        const bestPosition = bestClassifiedPosition(rounds, (e) => e.carId === carId);
        return { carId, last, pts, bestPosition };
      })
      .sort((a, b) => b.pts - a.pts || a.bestPosition - b.bestPosition)
      .map(({ carId, last, pts }, i) => {
        const hasPlayer = isLive && classTeams.some((t) => t.seats.some((s) => `${t.id}:${s.carIndex ?? 0}` === carId && state.drivers.some((d) => d.id === s.driverId)));
        const teamName = last?.teamName ?? teamNameById.get(Number(carId.split(":")[0])) ?? "—";
        const carNumber = last?.carNumber ?? (isLive ? liveCarNumber(teamById, carId) : null);
        const numberLabel = carNumber != null ? ` #${carNumber}` : "";
        let cells = "";
        for (let r = 0; r < category.roundCount; r++) cells += carRoundCell(rounds, r, carId);
        return `<tr class="${hasPlayer ? "highlight-row" : ""}"><td>${i + 1}</td><td>${teamName}${numberLabel}</td>${cells}<td>${pts}</td></tr>`;
      })
      .join("");
  } else if (constructorsEnabled) {
    secondaryHeading = `Écuries ${suffix}`;
    const teamIds = new Set();
    if (isLive) for (const team of classTeams) teamIds.add(team.id);
    for (const round of rounds) for (const e of round) teamIds.add(e.teamId);
    secondaryRows = [...teamIds]
      .map((teamId) => {
        const pts = standings.teamPoints[teamId] ?? 0;
        const bestPosition = bestClassifiedPosition(rounds, (e) => e.teamId === teamId);
        return { teamId, pts, bestPosition };
      })
      .sort((a, b) => b.pts - a.pts || a.bestPosition - b.bestPosition)
      .map(({ teamId, pts }, i) => {
        const hasPlayer = isLive && classTeams.some((t) => t.id === teamId && t.seats.some((s) => state.drivers.some((d) => d.id === s.driverId)));
        const teamName = teamNameById.get(teamId) ?? "—";
        let cells = "";
        for (let r = 0; r < category.roundCount; r++) cells += teamRoundCell(rounds, r, teamId, constructorsTopN);
        return `<tr class="${hasPlayer ? "highlight-row" : ""}"><td>${i + 1}</td><td>${teamName}</td>${cells}<td>${pts}</td></tr>`;
      })
      .join("");
  }

  const headerCells = roundHeaderCells(category, category.roundCount);
  const secondaryBlock = secondaryHeading
    ? `<h3>${secondaryHeading}</h3>
      <div class="table-scroll">
        <table class="table wide">
          <thead><tr><th>Pos.</th><th>Écurie</th>${headerCells}<th>Pts</th></tr></thead>
          <tbody>${secondaryRows || `<tr><td class="muted" colspan="${category.roundCount + 3}">Pas encore de course.</td></tr>`}</tbody>
        </table>
      </div>`
    : `<div class="muted">Pas de championnat constructeurs pour cette catégorie.</div>`;

  const seasonLine = isLive
    ? `Saison ${standings.seasonNumber} · Manche ${standings.race}/${category.roundCount}`
    : `Saison ${standings.seasonNumber} · Terminée (${rounds.length}/${category.roundCount} manches)`;

  return `
    ${label ? `<h3 class="class-heading">${label}</h3>` : ""}
    <h3>Pilotes ${suffix}</h3>
    <div class="table-scroll">
      <table class="table wide">
        <thead><tr><th>Pos.</th><th>Pilote</th>${headerCells}<th>Pts</th></tr></thead>
        <tbody>${driverRows || `<tr><td class="muted" colspan="${category.roundCount + 3}">Pas encore de course.</td></tr>`}</tbody>
      </table>
    </div>
    ${secondaryBlock}
    <div class="muted season-line">${seasonLine}</div>
  `;
}

function seasonSelectHtml(state, category) {
  const representativeKey = category.classes ? `${category.id}:${category.classes[0].id}` : category.id;
  const liveSeasonNumber = state.standings[representativeKey]?.seasonNumber ?? 1;
  const archivedSeasons = (state.seasonArchive?.[representativeKey] ?? [])
    .map((s) => s.seasonNumber)
    .sort((a, b) => b - a);
  const focused = state.ui.focusedSeasonNumber;
  const liveOption = `<option value="live" ${focused == null ? "selected" : ""}>Saison ${liveSeasonNumber} (en cours)</option>`;
  const archivedOptions = archivedSeasons
    .map((n) => `<option value="${n}" ${focused === n ? "selected" : ""}>Saison ${n}</option>`)
    .join("");
  return `
    <div class="filter-row">
      <label>Saison <select data-action="select-season">${liveOption}${archivedOptions}</select></label>
    </div>`;
}

export function renderWorldChampionships(state) {
  const category = focusedCategory(state);
  const body = category.classes
    ? category.classes.map((cls) => classificationBlock(state, category, cls.id, cls.label)).join("")
    : classificationBlock(state, category, null, null);

  return `
    <h2>Monde — Championnats</h2>
    <div class="tabs">${categoryTabs(state)}</div>
    ${seasonSelectHtml(state, category)}
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
      <tr data-action="view-driver" data-id="${driver.id}" class="clickable-row">
        <td>${driver.raceNumber != null ? `#${driver.raceNumber}` : "—"}</td>
        <td>${driver.name} ${driverIdTag(driver)}</td>
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
                return `${driver.name} ${driverIdTag(driver)} ${statusTag(state, driver)}`;
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
            return `<div class="roster-line">${number}${driver.name} ${driverIdTag(driver)} ${statusTag(state, driver)}</div>`;
          })
          .join("");
      }

      return `
        <div class="card ${hasPlayer ? "highlight-card" : ""}">
          <div class="card-head">
            <strong>${team.name}</strong>
            <span class="pill">Prestige ${prestigeStars(team.prestige)} (${team.prestige})</span>
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

const WORLD_STAFF_PAGE_SIZE = 50;

function staffRoleFilterTabs(state) {
  const active = state.ui.worldStaffFilter?.role ?? "all";
  const tabs = [{ id: "all", label: "Tous les rôles" }, ...Object.entries(ROLES).map(([id, r]) => ({ id, label: r.name }))];
  return tabs
    .map((t) => `<button class="tab ${t.id === active ? "active" : ""}" data-action="filter-world-staff" data-id="${t.id}">${t.label}</button>`)
    .join("");
}

function staffCategoryFilterTabs(state) {
  const active = state.ui.worldStaffFilter?.category ?? "all";
  const tabs = [
    { id: "all", label: "Tous les types" },
    { id: "Sportif", label: "Sportif" },
    { id: "Business", label: "Business" },
  ];
  return tabs
    .map((t) => `<button class="tab ${t.id === active ? "active" : ""}" data-action="filter-world-staff-category" data-id="${t.id}">${t.label}</button>`)
    .join("");
}

function staffAvailabilityFilterTabs(state) {
  const active = state.ui.worldStaffFilter?.availability ?? "all";
  const tabs = [
    { id: "all", label: "Tous" },
    { id: "available", label: "Disponible" },
    { id: "hired", label: "Chez toi" },
    { id: "rival", label: "Agences rivales" },
  ];
  return tabs
    .map((t) => `<button class="tab ${t.id === active ? "active" : ""}" data-action="filter-world-staff-availability" data-id="${t.id}">${t.label}</button>`)
    .join("");
}

function staffAttributeFilterRow(state) {
  const filter = state.ui.worldStaffFilter ?? {};
  return `
    <div class="filter-row">
      <label>Compétence principale min. <input type="number" min="0" max="99" data-action="filter-world-staff-min-primary" value="${filter.minPrimary ?? 0}" /></label>
      <label>Salaire max. <input type="number" min="0" step="50" data-action="filter-world-staff-max-wage" value="${filter.maxWage ?? 0}" placeholder="Aucun plafond" /> €/sem</label>
    </div>`;
}

const WORLD_COMPARE_MAX = 4;

function worldStaffCompareBar(state) {
  const ids = state.ui.compareStaffIds ?? [];
  if (ids.length === 0) return "";
  return `
    <div class="compare-bar">
      <span class="muted">${ids.length}/${WORLD_COMPARE_MAX} membre(s) de staff sélectionné(s) pour comparaison</span>
      ${ids.length >= 2 ? `<button data-action="compare-staff" class="small">Comparer</button>` : ""}
      <button data-action="clear-compare-staff" class="secondary small">Effacer la sélection</button>
    </div>`;
}

export function renderWorldStaff(state) {
  const allRows = [
    ...state.staff.map((member) => ({ member, hired: true, owner: null })),
    ...state.staffPool.map((member) => ({ member, hired: false, owner: null })),
    ...state.rivalAgencies.flatMap((agency) => (agency.staff ?? []).map((member) => ({ member, hired: false, owner: agency }))),
  ].map((r) => ({ ...r, category: STAFF_ROLE_CATEGORY[r.member.role] ?? "—" }));

  const filter = state.ui.worldStaffFilter ?? {};
  const roleFilter = filter.role ?? "all";
  const categoryFilter = filter.category ?? "all";
  const availabilityFilter = filter.availability ?? "all";
  const minPrimary = filter.minPrimary ?? 0;
  const maxWage = filter.maxWage ?? 0;
  const filteredRows = allRows.filter((r) => {
    if (roleFilter !== "all" && r.member.role !== roleFilter) return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    if (availabilityFilter === "available" && (r.hired || r.owner)) return false;
    if (availabilityFilter === "hired" && !r.hired) return false;
    if (availabilityFilter === "rival" && !r.owner) return false;
    if (minPrimary > 0 && r.member.skills.primary < minPrimary) return false;
    if (maxWage > 0 && r.member.weeklyWage > maxWage) return false;
    return true;
  });

  const sort = state.ui.worldStaffSort ?? { field: "primary", dir: "desc" };
  const getValue = STAFF_SORTERS[sort.field] ?? STAFF_SORTERS.primary;
  filteredRows.sort((a, b) => {
    const va = getValue(a);
    const vb = getValue(b);
    const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
    return sort.dir === "desc" ? -cmp : cmp;
  });

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / WORLD_STAFF_PAGE_SIZE));
  const page = Math.min(state.ui.worldStaffPage ?? 0, pageCount - 1);
  const pageRows = filteredRows.slice(page * WORLD_STAFF_PAGE_SIZE, (page + 1) * WORLD_STAFF_PAGE_SIZE);

  const rowsHtml = pageRows
    .map(({ member, hired, owner, category }) => {
      const role = ROLES[member.role];
      const statusHtml = hired
        ? `<span class="pill accent">${state.agency.name}</span>`
        : owner
          ? `<span class="pill">${owner.name}</span>`
          : `<span class="pill muted">Disponible</span>`;
      const actionHtml = !hired && !owner
        ? `<button data-action="hire-staff" data-id="${member.id}" class="small">Recruter (${member.hireCost.toLocaleString("fr-FR")}€)</button>`
        : "";
      const traitsHtml = (member.traits ?? [])
        .map((id) => `<span class="pill" title="${staffTraitTooltip(id)}">${STAFF_TRAITS[id].label}</span>`)
        .join(" ");
      return `
      <tr>
        <td>${member.name}</td>
        <td>${category}</td>
        <td title="${role.description}">${role.name}</td>
        <td>${member.skills.primary}</td>
        <td>${member.skills.secondary}</td>
        <td>${traitsHtml}</td>
        <td>${member.weeklyWage.toLocaleString("fr-FR")}€</td>
        <td>${statusHtml}</td>
        <td>${actionHtml}</td>
      </tr>`;
    })
    .join("");

  const paginationHtml = `
    <div class="pagination">
      <button data-action="world-staff-page" data-id="prev" data-page-count="${pageCount}" class="secondary small" ${page <= 0 ? "disabled" : ""}>← Précédent</button>
      <span class="muted">Page ${page + 1} / ${pageCount} · ${filteredRows.length} membre(s)</span>
      <button data-action="world-staff-page" data-id="next" data-page-count="${pageCount}" class="secondary small" ${page >= pageCount - 1 ? "disabled" : ""}>Suivant →</button>
    </div>`;

  return `
    <h2>Monde — Staff</h2>
    <div class="tabs">${staffRoleFilterTabs(state)}</div>
    <div class="tabs">${staffCategoryFilterTabs(state)}</div>
    <div class="tabs">${staffAvailabilityFilterTabs(state)}</div>
    ${staffAttributeFilterRow(state)}
    ${worldStaffCompareBar(state)}
    <div class="table-scroll">
      <table class="table wide">
        <thead><tr>
          ${staffSortHeader(state, "name", "Nom")}
          ${staffSortHeader(state, "category", "Catégorie")}
          ${staffSortHeader(state, "role", "Rôle")}
          ${staffSortHeader(state, "primary", "Compétence principale")}
          <th>Compétence secondaire</th>
          <th>Traits</th>
          ${staffSortHeader(state, "wage", "Salaire")}
          <th>Statut</th><th>Action</th>
        </tr></thead>
        <tbody>${rowsHtml || `<tr><td class="muted" colspan="9">Aucun membre de staff.</td></tr>`}</tbody>
      </table>
    </div>
    ${paginationHtml}`;
}
