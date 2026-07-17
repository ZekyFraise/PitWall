import { CATEGORIES, CATEGORY_BY_ID, MAX_DRIVER_WORKLOAD, weekInSeason, isMercatoWindow } from "../../game/data.js";
import { overallRating, reliability, peakAge, ATTRIBUTE_META, ATTRIBUTE_GROUPS, GROUP_LABELS, groupAverage } from "../../game/driver.js";
import { signCost, contractBaseline } from "../../game/state.js";
import { findTeamById, totalWorkload } from "../../game/team.js";
import { FACILITIES, MAX_FACILITY_LEVEL, getFacilityLevelData, nextFacilityLevelData, SHOP_ITEMS } from "../../game/infrastructure.js";
import { ROLES } from "../../game/staff.js";
import { driverMarketValue, seasonResultsFor, championshipStanding } from "../../game/driverStats.js";
import { racesUntilSeasonEnd } from "../../game/standings.js";
import { weeklyTotals, breakdownByType, TRANSACTION_LABELS } from "../../game/finance.js";
import { lineChart, barChart } from "../charts.js";

function statBar(label, value, description) {
  const title = description ? `${label} — ${description}` : label;
  return `
    <div class="stat-row">
      <span class="stat-label" title="${title}">${label}</span>
      <div class="stat-track"><div class="stat-fill" style="width:${value}%"></div></div>
      <span class="stat-value">${Math.round(value)}</span>
    </div>`;
}

const SCOUT_REVEAL_LABELS = { technique: "Technique", mental: "Mental", physique: "Physique", circuit: "Circuit" };

function scoutStatValue(driver, key) {
  return key === "circuit" ? driver.attributes.circuit : groupAverage(driver, key);
}

function scoutRangeRow(label, low, high) {
  return `
    <div class="stat-row">
      <span class="stat-label" title="${label}">${label}</span>
      <div class="stat-track"><div class="stat-fill" style="margin-left:${low}%; width:${Math.max(2, high - low)}%"></div></div>
      <span class="stat-value">${low}-${high}</span>
    </div>`;
}

function scoutUnknownRow(label) {
  return `
    <div class="stat-row">
      <span class="stat-label" title="${label}">${label}</span>
      <div class="stat-track"></div>
      <span class="stat-value muted">?</span>
    </div>`;
}

function scoutCard(state, driver) {
  const cost = signCost(state, driver);
  const stats = driver.scouted
    ? Object.keys(SCOUT_REVEAL_LABELS)
        .map((key) => {
          const label = SCOUT_REVEAL_LABELS[key];
          if (!driver.scoutReveal?.groups?.includes(key)) return scoutUnknownRow(label);
          const actual = scoutStatValue(driver, key);
          const width = driver.scoutReveal.rangeWidth ?? 20;
          const low = Math.max(0, Math.round(actual - width / 2));
          const high = Math.min(99, Math.round(actual + width / 2));
          return scoutRangeRow(label, low, high);
        })
        .join("")
    : `<p class="unscouted">Statistiques inconnues — fais scouter ce pilote.</p>`;
  const potential = driver.scoutReveal?.potentialKnown ? `${driver.potential}` : "?";
  const pace = driver.scouted ? Math.round(overallRating(driver)) : "?";
  const consistency = driver.scouted ? Math.round(reliability(driver)) : "?";
  return `
    <div class="card">
      <div class="card-head">
        <strong>${driver.name}</strong>
        <span class="pill">${driver.sex} · ${driver.age} ans</span>
      </div>
      <div class="potential">Potentiel : <b>${potential}</b> · Rythme : <b>${pace}</b> · Régularité : <b>${consistency}</b></div>
      ${stats}
      <div class="card-actions">
        ${!driver.scouted ? `<button data-action="scout" data-id="${driver.id}">Scouter (500€)</button>` : ""}
        ${!driver.scoutReveal?.potentialKnown ? `<button data-action="deep-scout" data-id="${driver.id}" class="secondary">Scouting approfondi (2 500€)</button>` : ""}
        <button data-action="sign" data-id="${driver.id}" ${driver.scouted ? "" : "class=\"secondary\""}>Signer (${cost.toLocaleString("fr-FR")}€)</button>
      </div>
    </div>`;
}

function attributeSection(driver, group) {
  const keys = Object.keys(ATTRIBUTE_META).filter((k) => ATTRIBUTE_META[k].group === group);
  return `
    <div class="attribute-group">
      <h3>${GROUP_LABELS[group]}</h3>
      ${keys.map((k) => statBar(ATTRIBUTE_META[k].label, driver.attributes[k], ATTRIBUTE_META[k].description)).join("")}
    </div>`;
}

function teamRankingLabel(state, teamId, categoryId) {
  const standings = state.standings[categoryId];
  if (!standings || !(teamId in standings.teamPoints)) return "Pas encore classée";
  const ranked = Object.entries(standings.teamPoints).sort((a, b) => b[1] - a[1]);
  const position = ranked.findIndex(([id]) => Number(id) === teamId) + 1;
  return `${position}e au championnat`;
}

function offersSection(state, driver) {
  const outOfWindow = driver.teamId != null && !isMercatoWindow(weekInSeason(state.week));
  const windowNotice = outOfWindow
    ? `<p class="warn">Hors fenêtre de transferts — chances réduites (attends la silly season ou le mercato hivernal).</p>`
    : "";

  if (driver.pendingOffers.length > 0) {
    const rows = driver.pendingOffers
      .map(
        (o) => `
        <div class="offer-row">
          <div>
            <strong>${o.teamName}</strong>
            <span class="muted">${o.categoryName} · Prestige ${o.prestige} · ${teamRankingLabel(state, o.teamId, o.categoryId)}</span>
          </div>
          <button data-action="join-team" data-id="${driver.id}" data-team-id="${o.teamId}">Rejoindre (${o.cost.toLocaleString("fr-FR")}€)</button>
        </div>`
      )
      .join("");
    return `
      <div class="propose-box">
        <h3>Propositions reçues</h3>
        ${windowNotice}
        ${rows}
        <label class="invest-line" title="Budget de recrutement : capital de l'AGENCE dépensé pour convaincre une écurie de prendre ce pilote — différent du budget course du pilote.">
          Nouveau budget de recrutement
          <input type="number" min="0" step="1000" data-role="propose-budget" value="0" />
          €
        </label>
        <button data-action="propose-teams" data-id="${driver.id}" class="secondary">Relancer une proposition</button>
      </div>`;
  }

  const noOffersMessage =
    driver.proposedAt != null
      ? `<p class="warn">Aucune écurie n'a répondu favorablement — augmente le budget ou réessaie plus tard.</p>`
      : `<p class="muted">${driver.teamId ? "Propose ton pilote à d'autres écuries pour en changer." : "Ce pilote n'a pas d'écurie — propose-le pour qu'il puisse courir."}</p>`;

  return `
    <div class="propose-box">
      <h3>Chercher une écurie</h3>
      ${windowNotice}
      ${noOffersMessage}
      <label class="invest-line" title="Budget de recrutement : capital de l'AGENCE dépensé pour convaincre une écurie de prendre ce pilote — différent du budget course du pilote.">
        Budget de recrutement
        <input type="number" min="0" step="1000" data-role="propose-budget" value="0" />
        €
      </label>
      <button data-action="propose-teams" data-id="${driver.id}">Proposer aux écuries</button>
    </div>`;
}

function contractNegotiationSection(state, driver) {
  const baseline = contractBaseline(state, driver);
  const duration = driver.categoryId ? racesUntilSeasonEnd(state, driver.categoryId) : "—";
  return `
    <div class="propose-box negotiate-box">
      <h3>Négociation de contrat</h3>
      <p class="muted" title="Ce contrat lie le pilote à ton AGENCE (salaire, durée) — il est distinct du contrat d'écurie, qui expire à la fin de saison et fait passer le pilote en réserve.">Ce contrat lie le pilote à ton agence (pas à une écurie) : il fixe son salaire et sa fidélité envers toi. Le baquet en écurie est une affaire séparée, gérée plus bas.</p>
      <p class="muted">Fixe le salaire et l'indemnité de transfert. Une offre trop faible peut être refusée.</p>
      <p class="muted">Durée : ${duration} course(s) restante(s) cette saison (fin de saison forcée pour l'instant).</p>
      <label class="invest-line">
        Salaire hebdomadaire
        <input type="number" min="0" step="50" data-role="negotiate-salary" value="${baseline.weeklyWage}" />
        €
      </label>
      <label class="invest-line">
        Indemnité de transfert
        <input type="number" min="0" step="500" data-role="negotiate-fee" value="${baseline.transferFee}" />
        €
      </label>
      <div class="card-actions">
        <button data-action="negotiate-contract" data-id="${driver.id}">Proposer le contrat</button>
      </div>
    </div>`;
}

function secondaryChampionshipSection(state, driver) {
  if (!driver.teamId) return "";
  const used = totalWorkload(driver);

  const currentRows = driver.secondarySeats
    .map((s) => {
      const t = findTeamById(state, s.teamId);
      return `<div class="muted">${t?.name ?? "?"} — ${CATEGORY_BY_ID[s.categoryId]?.name ?? s.categoryId}</div>`;
    })
    .join("");

  const options = CATEGORIES.filter(
    (c) => c.id !== driver.categoryId && !driver.secondarySeats.some((s) => s.categoryId === c.id) && c.repRequired <= state.agency.reputation && used + c.workload <= MAX_DRIVER_WORKLOAD
  );
  const rows = options
    .flatMap((c) => (state.teams[c.id] ?? []).slice(0, 5).map((team) => ({ team, category: c })))
    .map(
      ({ team, category }) => `
      <div class="offer-row">
        <div><strong>${team.name}</strong><span class="muted">${category.name} · charge +${category.workload}</span></div>
        <button data-action="join-secondary" data-id="${driver.id}" data-team-id="${team.id}">Rejoindre</button>
      </div>`
    )
    .join("");

  return `
    <div class="propose-box">
      <h3>Second championnat (charge ${used}/${MAX_DRIVER_WORKLOAD})</h3>
      ${currentRows}
      ${rows || `<p class="muted">Aucune écurie disponible avec cette charge.</p>`}
    </div>`;
}

function logEntry(entry) {
  switch (entry.type) {
    case "player-result": {
      const { driver, category, result } = entry;
      const outcome = result.dnf
        ? "abandon"
        : `P${result.position}/${result.gridSize ?? category.gridSize}, +${result.prize.toLocaleString("fr-FR")}€, rép ${result.reputation >= 0 ? "+" : ""}${result.reputation}`;
      return `<li><b>${driver.name}</b> — ${category.name} : ${outcome}</li>`;
    }
    case "rival-scout-sign":
      return `<li class="muted">${entry.agencyName} signe ${entry.driverName} avant toi.</li>`;
    case "rival-poach":
      return `<li class="warn-text">${entry.agencyName} débauche ${entry.driverName}, resté sans contrat trop longtemps.</li>`;
    case "season-champion-driver":
      return `<li class="highlight-line">Titre pilote : ${entry.driverName} est champion de ${entry.category.name} (saison ${entry.seasonNumber}) — un de tes pilotes !</li>`;
    case "recruit-established":
      return `<li class="highlight-line">${entry.driverName} (${entry.category.name}) rejoint ton agence${entry.wasRivalManaged ? `, débauché à ${entry.previousAgencyName}` : ""}.</li>`;
    case "random-event":
      return `<li class="${entry.tone === "good" ? "good" : entry.tone === "bad" ? "warn-text" : "muted"}">${entry.text}</li>`;
    default:
      return "";
  }
}

function driverTableRow(state, driver) {
  const rating = Math.round(overallRating(driver));
  const { races, wins, podiums } = seasonResultsFor(state, driver);
  const { position, points } = championshipStanding(state, driver);
  const value = driverMarketValue(driver);
  const salary = driver.contract
    ? `${driver.isPro ? "-" : "+"}${driver.contract.weeklyWage.toLocaleString("fr-FR")}€/sem`
    : "—";
  const contractEnd = driver.contract ? `Dans ${driver.contract.racesRemaining} course(s)` : "Sans contrat";
  const categoryName = CATEGORY_BY_ID[driver.categoryId]?.name ?? "—";
  const team = driver.teamId ? findTeamById(state, driver.teamId) : null;

  return `
    <tr data-action="view-driver" data-id="${driver.id}" class="clickable-row">
      <td>${driver.name} <span class="debug-id"><!-- DEBUG: remove this id tag before release -->[#${driver.id}]</span></td>
      <td>${driver.sex}, ${driver.age}</td>
      <td>${driver.isPro ? "Pro" : "Amateur"}</td>
      <td>${categoryName}</td>
      <td>${team ? team.name : "—"}</td>
      <td>${rating}</td>
      <td>${races}</td>
      <td>${wins}</td>
      <td>${podiums}</td>
      <td>${position ?? "—"}</td>
      <td>${points}</td>
      <td>${value.toLocaleString("fr-FR")}€</td>
      <td>${salary}</td>
      <td>${contractEnd}</td>
      <td>${Math.round(driver.agencyRelationship)}</td>
      <td>${Math.round(driver.teamRelationship)}</td>
    </tr>`;
}

export function renderMyDrivers(state) {
  const rows = state.drivers.map((d) => driverTableRow(state, d)).join("");
  return `
    <h2>Mes pilotes</h2>
    <div class="table-scroll">
      <table class="table wide">
        <thead>
          <tr>
            <th>Nom</th><th>Sexe, Âge</th><th>Statut</th><th>Catégorie</th><th>Écurie</th><th>Niveau</th><th>Courses</th><th>Victoires</th><th>Podiums</th>
            <th>Pos. champ.</th><th>Points</th><th>Valeur</th><th>Salaire</th><th>Fin contrat</th>
            <th>Rel. agence</th><th>Rel. équipe</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td class="muted" colspan="16">Aucun pilote signé pour l'instant.</td></tr>`}</tbody>
      </table>
    </div>`;
}

function seasonHistoryRow(entry) {
  return `
    <tr>
      <td>${entry.seasonNumber}</td>
      <td>${CATEGORY_BY_ID[entry.categoryId]?.name ?? entry.categoryId}</td>
      <td>${entry.teamName}</td>
      <td>${entry.rating}</td>
      <td>${entry.value.toLocaleString("fr-FR")}€</td>
      <td>${entry.races}</td>
      <td>${entry.wins}</td>
      <td>${entry.podiums}</td>
      <td>${entry.championshipPosition ?? "—"}</td>
    </tr>`;
}

export function renderDriverDetail(state) {
  const driver = state.drivers.find((d) => d.id === state.ui.viewingDriverId);
  if (!driver) {
    return `
      <button data-action="back-to-roster" class="secondary small">← Retour</button>
      <h2>Fiche pilote</h2>
      <p class="muted">Pilote introuvable.</p>`;
  }

  const category = CATEGORY_BY_ID[driver.categoryId];
  const team = driver.teamId ? findTeamById(state, driver.teamId) : null;
  const rating = Math.round(overallRating(driver));
  const value = driverMarketValue(driver);
  const { races, wins, podiums } = seasonResultsFor(state, driver);
  const { position, points } = championshipStanding(state, driver);
  const contractLabel = driver.contract
    ? `${driver.contract.racesRemaining} course(s) restante(s) · ${driver.isPro ? "Salaire versé : " : "Frais de gestion perçus : "}${driver.contract.weeklyWage.toLocaleString("fr-FR")}€/sem`
    : `<span class="warn">Sans contrat — risque de débauchage</span>`;
  const seatLabel = team ? `${team.name} · Prestige ${team.prestige}` : `<span class="warn">Sans écurie — ne court pas</span>`;

  const currentSeasonRow = driver.categoryId
    ? `
      <tr class="highlight-row">
        <td>${state.standings[driver.categoryId]?.seasonNumber ?? 1} (en cours)</td>
        <td>${category?.name ?? ""}</td>
        <td>${team ? team.name : "Sans écurie"}</td>
        <td>${rating}</td>
        <td>${value.toLocaleString("fr-FR")}€</td>
        <td>${races}</td>
        <td>${wins}</td>
        <td>${podiums}</td>
        <td>${position ?? "—"}</td>
      </tr>`
    : "";
  const historyRows = driver.seasonHistory.map(seasonHistoryRow).join("") + currentSeasonRow;

  return `
    <button data-action="back-to-roster" class="secondary small">← Retour</button>
    <h2>${driver.name}</h2>
    <div class="card">
      <div class="card-head">
        <strong>${driver.name}</strong>
        <span class="pill">${driver.sex} · ${driver.age} ans · OVR ${rating} · ${driver.isPro ? "Pro" : "Amateur"}</span>
      </div>
      <div class="muted">${seatLabel} · ${category ? category.name : "Non affecté"} · Peak à ${peakAge(driver)} ans</div>
      <div class="contract-line">${contractLabel}</div>
      <div class="muted">Valeur estimée : <b>${value.toLocaleString("fr-FR")}€</b></div>
      <div class="muted">Cette saison : ${races} course(s) · ${wins} victoire(s) · ${podiums} podium(s) · ${points} pts · ${position ? `P${position}` : "—"} au championnat</div>
      <div class="muted">Relation agence : ${Math.round(driver.agencyRelationship)}/200 · Relation équipe : ${Math.round(driver.teamRelationship)}/200</div>
      <label class="invest-line" title="Budget course : somme apportée au pilote pour l'aider à s'offrir/garder un baquet en écurie. Distinct du budget de recrutement de l'agence.">
        Budget course
        <input type="number" min="0" step="500" data-action="invest" data-id="${driver.id}" value="${state.investments[driver.id] ?? 0}" />
        €
      </label>
      <p class="muted hint">Budget course : l'argent que ce pilote peut engager pour décrocher/garder un baquet — à ne pas confondre avec le budget de recrutement de l'agence, utilisé pour convaincre des écuries de le prendre.</p>
    </div>
    ${!driver.contract ? contractNegotiationSection(state, driver) : ""}
    ${offersSection(state, driver)}
    ${secondaryChampionshipSection(state, driver)}
    <h3>Attributs</h3>
    <div class="card attributes-card">
      ${ATTRIBUTE_GROUPS.map((g) => attributeSection(driver, g)).join("")}
    </div>
    <h3>Traits</h3>
    <p class="muted">Aucun trait pour l'instant.</p>
    <h3>Historique</h3>
    <div class="table-scroll">
      <table class="table">
        <thead><tr><th>Saison</th><th>Catégorie</th><th>Écurie</th><th>Niveau</th><th>Valeur</th><th>Courses</th><th>Victoires</th><th>Podiums</th><th>Pos.</th></tr></thead>
        <tbody>${historyRows || `<tr><td class="muted" colspan="9">Pas encore d'historique.</td></tr>`}</tbody>
      </table>
    </div>`;
}

export function renderTalents(state) {
  // Free agents only — exclude anyone already signed to this agency or managed by a rival.
  const freeAgents = state.scoutPool.filter(
    (d) => !d.agencyId && !state.drivers.some((owned) => owned.id === d.id)
  );
  return `
    <h2>Talents</h2>
    <div class="card-grid">${freeAgents.map((d) => scoutCard(state, d)).join("")}</div>`;
}

function staffCard(member, hired) {
  const role = ROLES[member.role];
  return `
    <div class="card">
      <div class="card-head">
        <strong>${member.name}</strong>
        <span class="pill">${role.name}</span>
      </div>
      ${statBar(role.skillLabel, member.skills.primary)}
      ${statBar(role.secondaryLabel, member.skills.secondary)}
      <div class="muted">Communication ${member.skills.communication} · Expérience ${member.skills.experience}</div>
      <div class="muted">Salaire ${member.weeklyWage.toLocaleString("fr-FR")}€/sem</div>
      <div class="card-actions">
        ${
          hired
            ? `<button data-action="fire-staff" data-id="${member.id}" class="secondary">Licencier</button>`
            : `<button data-action="hire-staff" data-id="${member.id}">Engager (${member.hireCost.toLocaleString("fr-FR")}€)</button>`
        }
      </div>
    </div>`;
}

export function renderStaff(state) {
  const grouped = {};
  for (const member of state.staff) {
    (grouped[member.role] ??= []).push(member);
  }
  const groupsHtml = Object.entries(grouped)
    .map(
      ([role, members]) => `
        <h3>${ROLES[role].name}</h3>
        <div class="card-grid">${members.map((m) => staffCard(m, true)).join("")}</div>`
    )
    .join("");

  return `
    <h2>Staff</h2>
    ${state.staff.length ? groupsHtml : `<p class="muted">Aucun membre du staff engagé.</p>`}
    <h3>Candidats disponibles</h3>
    <div class="card-grid">
      ${state.staffPool.map((r) => staffCard(r, false)).join("")}
    </div>`;
}

function describeFacilityEffect(facilityId, levelData) {
  if (facilityId === "offices") return `Capacité : ${levelData.capacity} pilotes`;
  if (facilityId === "training") return `Progression ×${levelData.growthMultiplier.toFixed(2)}`;
  if (facilityId === "prestige") return `Attrait +${levelData.appealBonus} · Débauchage ×${levelData.poachFactor.toFixed(2)}`;
  return "";
}

function facilityCard(state, facilityId) {
  const meta = FACILITIES[facilityId];
  const level = state.infrastructure[facilityId];
  const current = getFacilityLevelData(state, facilityId);
  const next = nextFacilityLevelData(state, facilityId);

  return `
    <div class="card">
      <div class="card-head">
        <strong>${meta.name}</strong>
        <span class="pill">Niveau ${level}/${MAX_FACILITY_LEVEL}</span>
      </div>
      <div class="muted">${meta.description}</div>
      <div class="finance-figure">${describeFacilityEffect(facilityId, current)}</div>
      <div class="muted">Entretien ${current.upkeep.toLocaleString("fr-FR")}€/sem</div>
      <div class="card-actions">
        ${
          next
            ? `<button data-action="upgrade-facility" data-id="${facilityId}">Améliorer (${next.upgradeCost.toLocaleString("fr-FR")}€)</button>`
            : `<span class="pill">Niveau maximum</span>`
        }
      </div>
    </div>`;
}

function shopCard(state, item) {
  const owned = item.type === "multiplier" && state.purchasedUpgrades.includes(item.id);
  const effect =
    item.type === "flat" ? `Réputation +${item.reputationBonus}` : `Réputation gagnée ×${item.reputationMultiplier}`;
  return `
    <div class="card">
      <div class="card-head">
        <strong>${item.name}</strong>
        <span class="pill">${item.cost.toLocaleString("fr-FR")}€</span>
      </div>
      <div class="muted">${item.description}</div>
      <div class="finance-figure">${effect}</div>
      <div class="card-actions">
        ${
          owned
            ? `<span class="pill">Déjà acheté</span>`
            : `<button data-action="buy-shop-item" data-id="${item.id}">Acheter</button>`
        }
      </div>
    </div>`;
}

function breakdownRows(list) {
  return list.length
    ? list.map((e) => `<tr><td>${e.label}</td><td>${e.total.toLocaleString("fr-FR")}€</td></tr>`).join("")
    : `<tr><td class="muted" colspan="2">Rien sur les 10 dernières semaines.</td></tr>`;
}

function tooltipLine(label, amt) {
  return `<div class="chart-tooltip-line"><span>${label}</span><span>${amt >= 0 ? "+" : ""}${Math.round(amt).toLocaleString("fr-FR")}€</span></div>`;
}

function weekBreakdownTooltip(state, week) {
  const income = {};
  const expenses = {};
  for (const tx of state.transactions) {
    if (tx.week !== week) continue;
    const label = TRANSACTION_LABELS[tx.type] ?? tx.type;
    const bucket = tx.amount >= 0 ? income : expenses;
    bucket[label] = (bucket[label] ?? 0) + tx.amount;
  }
  const incomeLines = Object.entries(income).map(([label, amt]) => tooltipLine(label, amt));
  const expenseLines = Object.entries(expenses).map(([label, amt]) => tooltipLine(label, amt));
  return `
    <div class="chart-tooltip-title">Semaine ${week}</div>
    <div class="chart-tooltip-section"><b>Recettes</b>${incomeLines.join("") || `<div class="muted">Aucune</div>`}</div>
    <div class="chart-tooltip-section"><b>Dépenses</b>${expenseLines.join("") || `<div class="muted">Aucune</div>`}</div>`;
}

export function renderFinances(state) {
  const totals = weeklyTotals(state, 10);
  const lastWeekTotals = totals[totals.length - 1] ?? { income: 0, expenses: 0 };
  const { income, expenses } = breakdownByType(state, 10);

  const balancePoints = state.financeHistory.map((h) => ({ value: h.balance }));
  const barSeries = totals.map((t) => ({
    label: `S${t.week}`,
    income: t.income,
    expenses: t.expenses,
    tooltip: weekBreakdownTooltip(state, t.week),
  }));
  const netTrend = totals.map((t) => ({ value: t.income - t.expenses }));

  return `
    <h2>Finances</h2>
    <div class="card-grid">
      <div class="card">
        <div class="muted">Trésorerie actuelle</div>
        <div class="finance-figure ${state.agency.money < 0 ? "warn" : ""}">${state.agency.money.toLocaleString("fr-FR")}€</div>
      </div>
      <div class="card">
        <div class="muted">Revenus de la semaine écoulée</div>
        <div class="finance-figure good">+${lastWeekTotals.income.toLocaleString("fr-FR")}€</div>
      </div>
      <div class="card">
        <div class="muted">Dépenses de la semaine écoulée</div>
        <div class="finance-figure warn">-${lastWeekTotals.expenses.toLocaleString("fr-FR")}€</div>
      </div>
    </div>

    <h3>Trésorerie dans le temps</h3>
    <div class="chart-card">${lineChart(balancePoints)}</div>

    <h3>Recettes vs dépenses (10 dernières semaines)</h3>
    <div class="chart-card">
      ${barChart(barSeries, { trend: netTrend })}
      <div class="chart-legend"><span class="legend-swatch good"></span>Recettes<span class="legend-swatch danger"></span>Dépenses<span class="legend-swatch accent"></span>Tendance nette</div>
    </div>

    <h3>Ventilation (10 dernières semaines)</h3>
    <div class="standings-grid">
      <div>
        <h3>Recettes</h3>
        <table class="table"><tbody>${breakdownRows(income)}</tbody></table>
      </div>
      <div>
        <h3>Dépenses</h3>
        <table class="table"><tbody>${breakdownRows(expenses)}</tbody></table>
      </div>
    </div>

    <h3>Infrastructures</h3>
    <div class="card-grid">
      ${Object.keys(FACILITIES).map((id) => facilityCard(state, id)).join("")}
    </div>

    <h3>Boutique de l'agence</h3>
    <div class="card-grid">
      ${SHOP_ITEMS.map((item) => shopCard(state, item)).join("")}
    </div>`;
}

const NEWS_TYPES = new Set(["player-result", "rival-scout-sign", "rival-poach", "recruit-established", "random-event"]);

export function renderNews(state) {
  const entries = state.log.filter(
    (e) => NEWS_TYPES.has(e.type) || (e.type === "season-champion-driver" && e.isPlayer)
  );
  return `
    <h2>Nouveautés</h2>
    <ul class="log">
      ${entries.length ? entries.slice(-40).reverse().map(logEntry).join("") : `<li class="muted">Pas encore d'actualité.</li>`}
    </ul>`;
}
