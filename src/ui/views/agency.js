import { CATEGORIES, CATEGORY_BY_ID, CATEGORY_EMOJI, SEASON_WEEKS, MAX_DRIVER_WORKLOAD, weekInSeason, isMercatoWindow, TRACK_STYLES, pointsTableFor } from "../../game/data.js";
import { overallRating, peakAge, driverStatusLabel, getDriverById, ATTRIBUTE_META, ATTRIBUTE_GROUPS, GROUP_LABELS, SUPER_STATS, superStat, superStatRange, superStatTooltip } from "../../game/driver.js";
import {
  signCost,
  signCostRange,
  contractBaseline,
  LOAN_ELIGIBLE_THRESHOLD,
  loanMaxAmount,
  LOAN_DURATION_MONTHS_OPTIONS,
  loanWeeksForMonths,
  scoutSearchCost,
  staffScoutCost,
  staffDeepScoutCost,
} from "../../game/state.js";
import {
  findTeamById,
  totalWorkload,
  agencyTeamRelationship,
  AGENCY_TEAM_RELATIONSHIP_DEFAULT,
  transferNegotiationWindow,
  MAX_TEAM_DEVELOPMENT_LEVEL,
  teamDevelopmentUpgradeCost,
  teamDevelopmentUpkeep,
  teamDevelopmentScoreBonus,
  teamWeeklyRevenue,
} from "../../game/team.js";
import { POACH_WARNING_THRESHOLD } from "../../game/rivals.js";
import {
  FACILITIES,
  facilityMaxLevel,
  getFacilityLevelData,
  nextFacilityLevelData,
  SHOP_ITEMS,
  rosterCapacity,
  shopCooldownRemaining,
} from "../../game/infrastructure.js";
import { ROLES, scoutCost, deepScoutCost } from "../../game/staff.js";
import { LIFESTYLE, lifestyleMaxLevel, getLifestyleLevelData, nextLifestyleLevelData } from "../../game/lifestyle.js";
import { driverMarketValue, seasonResultsFor, championshipStanding } from "../../game/driverStats.js";
import { racesUntilSeasonEnd, resolveSeasonView } from "../../game/standings.js";
import { positionColorClass, approachCell } from "./world.js";
import { academyById, academyFlagshipLabel } from "../../game/academies.js";
import { aggregatedTotals, breakdownByType, TRANSACTION_LABELS } from "../../game/finance.js";
import { lineChart, barChart } from "../charts.js";
import { DRIVER_TRAITS, STAFF_TRAITS, driverTraitTooltip, staffTraitTooltip } from "../../game/traits.js";
import { SPONSOR_TIERS } from "../../game/sponsors.js";

function driverIdTag(driver) {
  return `<span class="id-tag">[#${driver.id}]</span>`;
}

const SUPER_STAT_KEYS = ["rythme", "regularite", "resistance", "adaptabilite", "instinct"];

// The 5 super stats — the real performance inputs (driver.js) — displayed together wherever
// Rythme/Régularité already appeared. `mode` is "exact" for a signed/owned driver (never
// hidden), "range" for a scouted-but-not-owned driver (prospect or AI/rival — fourchette
// derived from whichever component attributes are actually windowed, superStatRange), or
// false/undefined to show "?" outright. Each carries a tooltip listing its component attributes.
function superStatDisplay(driver, key, mode) {
  if (mode === "exact") return `${Math.round(superStat(driver, key))}`;
  if (mode === "range") {
    const { low, high, revealedCount } = superStatRange(driver, key);
    if (revealedCount === 0) return "?";
    return low === high ? `${low}` : `${low}-${high}`;
  }
  return "?";
}

function superStatsLine(driver, mode) {
  return SUPER_STAT_KEYS.map((key) => {
    const value = superStatDisplay(driver, key, mode);
    return `<span title="${superStatTooltip(key)}">${SUPER_STATS[key].label} : <b>${value}</b></span>`;
  }).join(" · ");
}

// Same visual form as the classic attribute stat bars, grouped in their own card just above
// the "Attributs" card — kept as a separate encart rather than folded into attributeSection
// since super stats are composites (5-6 attributes each), not a 5th raw attribute group.
function superStatSection(driver, mode) {
  const rowsFor = (keys) =>
    keys
      .map((key) => {
        const label = SUPER_STATS[key].label;
        const description = superStatTooltip(key);
        if (mode === "exact") return statBar(label, superStat(driver, key), description);
        if (mode === "range") {
          const { low, high, revealedCount } = superStatRange(driver, key);
          return revealedCount === 0 ? scoutUnknownRow(label, description) : scoutRangeRow(label, low, high, description);
        }
        return scoutUnknownRow(label, description);
      })
      .join("");
  const half = Math.ceil(SUPER_STAT_KEYS.length / 2);
  return `
    <h3>Super statistiques</h3>
    <div class="card attributes-card super-stats-card">
      <div class="attribute-group">${rowsFor(SUPER_STAT_KEYS.slice(0, half))}</div>
      <div class="attribute-group">${rowsFor(SUPER_STAT_KEYS.slice(half))}</div>
    </div>`;
}

// Most traits are fixed at generation and hidden behind deep scouting for a prospect (same
// convention as potentialKnown) — a signed driver always sees their own traits unconditionally,
// like attributeSection/superStatSection already do. A handful (acquirable: true in traits.js)
// can also be gained/replaced dynamically at season-end (checkSeasonTraitMilestone) — those are
// tracked in driver.acquiredTraitIds and marked with 🌱 here to distinguish them from innate ones.
function traitsSection(driver, revealed) {
  if (!revealed) return `<p class="muted">Traits inconnus — nécessite un scouting approfondi.</p>`;
  const traits = driver.traits ?? [];
  if (traits.length === 0) return `<p class="muted">Aucun trait particulier.</p>`;
  return traits
    .map((id) => {
      const acquired = driver.acquiredTraitIds?.includes(id);
      const tooltip = acquired ? `${driverTraitTooltip(id)} (trait acquis en cours de carrière)` : driverTraitTooltip(id);
      return `<span class="pill" title="${tooltip}">${acquired ? "🌱 " : ""}${DRIVER_TRAITS[id].label}</span>`;
    })
    .join(" ");
}

function statBar(label, value, description) {
  const title = description ? `${label} — ${description}` : label;
  return `
    <div class="stat-row">
      <span class="stat-label" title="${title}">${label}</span>
      <div class="stat-track"><div class="stat-fill" style="width:${value}%"></div></div>
      <span class="stat-value">${Math.round(value)}</span>
    </div>`;
}

// Relation is 0-200 (unlike the 0-100 attribute stats statBar assumes) — this variant scales
// the fill width accordingly and colors it red→green by percentage instead of the fixed
// amber/red gradient statBar always uses.
function relationGauge(label, value) {
  const pct = Math.max(0, Math.min(100, (value / 200) * 100));
  const hue = (pct / 100) * 120;
  return `
    <div class="stat-row">
      <span class="stat-label">${label}</span>
      <div class="stat-track"><div class="stat-fill" style="width:${pct}%; background:hsl(${hue.toFixed(0)}, 70%, 45%)"></div></div>
      <span class="stat-value">${Math.round(value)}</span>
    </div>`;
}

// Compact red/amber/green tiering for dense table cells where a full gauge bar doesn't fit.
function relationColorClass(value) {
  if (value >= 140) return "rel-good";
  if (value >= 80) return "rel-mid";
  return "rel-bad";
}

function formEmote(form) {
  if (form <= 20) return "😞";
  if (form <= 40) return "😕";
  if (form <= 60) return "😐";
  if (form <= 80) return "🙂";
  return "😃";
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

function categoryLabel(categoryId) {
  const name = CATEGORY_BY_ID[categoryId]?.name ?? categoryId;
  const emoji = CATEGORY_EMOJI[categoryId];
  return emoji ? `${emoji} ${name}` : name;
}

const COMPARE_MAX = 4;

function compareBar(action, clearAction, selectedIds, noun) {
  if (selectedIds.length === 0) return "";
  return `
    <div class="compare-bar">
      <span class="muted">${selectedIds.length}/${COMPARE_MAX} ${noun} sélectionné(s) pour comparaison</span>
      ${selectedIds.length >= 2 ? `<button data-action="${action}" class="small">Comparer</button>` : ""}
      <button data-action="${clearAction}" class="secondary small">Effacer la sélection</button>
    </div>`;
}

function compareToggleButton(toggleAction, id, selectedIds, extraClass = "") {
  const inCompare = selectedIds.includes(id);
  const disabled = !inCompare && selectedIds.length >= COMPARE_MAX;
  const classes = ["secondary", extraClass].filter(Boolean).join(" ");
  return `<button data-action="${toggleAction}" data-id="${id}" class="${classes}" ${disabled ? "disabled" : ""}>${inCompare ? "Retirer de la comparaison" : "Ajouter à la comparaison"}</button>`;
}

function scoutRangeRow(label, low, high, description) {
  const title = description ? `${label} — ${description}` : label;
  return `
    <div class="stat-row">
      <span class="stat-label" title="${title}">${label}</span>
      <div class="stat-track"><div class="stat-fill" style="margin-left:${low}%; width:${Math.max(2, high - low)}%"></div></div>
      <span class="stat-value">${low}-${high}</span>
    </div>`;
}

function scoutUnknownRow(label, description) {
  const title = description ? `${label} — ${description}` : label;
  return `
    <div class="stat-row">
      <span class="stat-label" title="${title}">${label}</span>
      <div class="stat-track"></div>
      <span class="stat-value muted">?</span>
    </div>`;
}

// Same grouped layout as a signed driver's "Attributs" card, but each attribute still
// respects the scouting reveal: a range once its group is revealed, "?" otherwise. A
// prospect's individual attributes were never exposed as exact numbers pre-signature —
// reusing the exact signed-driver component here would silently bypass the whole
// scouting/hidden-potential system, so the visuals match but the values stay gated.
function prospectAttributeSection(driver, group) {
  const keys = Object.keys(ATTRIBUTE_META).filter((k) => ATTRIBUTE_META[k].group === group);
  const rows = keys
    .map((k) => {
      const meta = ATTRIBUTE_META[k];
      const width = driver.scouted ? driver.scoutReveal?.attributeWidths?.[k] : undefined;
      if (width === undefined) return scoutUnknownRow(meta.label, meta.description);
      const actual = driver.attributes[k];
      const low = Math.max(0, Math.round(actual - width / 2));
      const high = Math.min(99, Math.round(actual + width / 2));
      return scoutRangeRow(meta.label, low, high, meta.description);
    })
    .join("");
  return `
    <div class="attribute-group">
      <h3>${GROUP_LABELS[group]}</h3>
      ${rows}
    </div>`;
}

// Mirrors the attribute-reveal gating: unscouted prospects have no price shown at all,
// scouted ones get a range (narrower with recruiter precision), and only a deep scout
// reveals the exact figure.
function priceLabel(state, driver) {
  if (!driver.scouted) return "Prix inconnu";
  if (driver.scoutReveal?.priceKnown) return `${signCost(state, driver).toLocaleString("fr-FR")}€`;
  const { low, high } = signCostRange(state, driver);
  return `${low.toLocaleString("fr-FR")}–${high.toLocaleString("fr-FR")}€`;
}

// Recruiting an academy-affiliated prospect already costs more (baked into signCost) — this
// badge is just the player-facing "why", shown wherever a prospect card/row appears.
function academyBadge(state, driver) {
  if (!driver.academyId) return "";
  const academy = academyById(state, driver.academyId);
  if (!academy) return "";
  return `<span class="pill accent" title="Affilié à ${academy.name} — objectif : ${academyFlagshipLabel(academy)} (${academy.teamName}). Le recruter coûte plus cher tant que la relation avec cette académie reste basse.">🎓 ${academy.name}</span>`;
}

// Rare driver rating required for at least one seat per car in MLMC/ELMS PRO/AM & GT3 classes
// (data.js requiresBronze) — shown unconditionally like isPro, not gated behind scouting.
function bronzeBadge(driver) {
  if (!driver.isBronze) return "";
  return `<span class="pill" title="Pilote Bronze — éligible aux sièges PRO/AM des classes qui exigent un équipage mixte (MLMC/ELMS).">🥉 Bronze</span>`;
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
  const team = findTeamById(state, teamId);
  // Classes like WEC (hypercar/GT3) store standings under a "categoryId:subClass" key — using
  // the bare categoryId here would always miss those teams' live standings.
  const key = team?.subClass ? `${categoryId}:${team.subClass}` : categoryId;
  const standings = state.standings[key];
  if (standings && teamId in standings.teamPoints) {
    const ranked = Object.entries(standings.teamPoints).sort((a, b) => b[1] - a[1]);
    const position = ranked.findIndex(([id]) => Number(id) === teamId) + 1;
    return `${position}e au championnat`;
  }
  if (team?.lastSeasonRank) return `${team.lastSeasonRank}e la saison dernière`;
  return "Pas encore classée";
}

// Only surfaced once it has moved from the neutral default — most teams the agency has never
// dealt with stay at baseline and don't need a callout on every single offer row.
function agencyRelationSuffix(state, teamId) {
  const value = agencyTeamRelationship(state, teamId);
  if (value === AGENCY_TEAM_RELATIONSHIP_DEFAULT) return "";
  return ` · Relation agence : ${Math.round(value)}`;
}

// championshipStanding (driverStats.js) only looks at driver.categoryId (the main
// championship) — this variant takes an explicit categoryId so it also works for a driver's
// secondary-championship seats, which live outside driver.categoryId.
// Classes like WEC (hypercar/GT3) store standings under a "categoryId:subClass" key — using
// the bare categoryId here would always miss a driver's secondary-seat standing in one (same
// bug class as teamRankingLabel's WEC fix, just for the driver-points side).
function secondaryStanding(state, categoryId, teamId, driverId) {
  const team = findTeamById(state, teamId);
  const key = team?.subClass ? `${categoryId}:${team.subClass}` : categoryId;
  const standings = state.standings[key];
  if (!standings || !(driverId in standings.driverPoints)) return { position: null, points: 0 };
  const ranked = Object.entries(standings.driverPoints).sort((a, b) => b[1] - a[1]);
  const position = ranked.findIndex(([id]) => Number(id) === driverId) + 1;
  return { position, points: standings.driverPoints[driverId] };
}

function offersSection(state, driver) {
  const outOfWindow = driver.teamId != null && !isMercatoWindow(weekInSeason(state.week));
  const windowNotice = outOfWindow
    ? `<p class="warn">Hors fenêtre de transferts — chances réduites (attends la silly season ou le mercato hivernal).</p>`
    : "";

  if (driver.pendingOffers.length > 0) {
    // Grouped by category (canonical CATEGORIES order), then prestige — same principle as
    // secondaryChampionshipSection's category grouping, instead of a flat prestige-only sort.
    const sortedOffers = [...driver.pendingOffers].sort((a, b) => {
      const catA = CATEGORIES.findIndex((c) => c.id === a.categoryId);
      const catB = CATEGORIES.findIndex((c) => c.id === b.categoryId);
      if (catA !== catB) return catA - catB;
      return b.prestige - a.prestige;
    });
    // Tabs only for categories actually represented, plus "Toutes" — same filter-tab pattern as
    // Monde ▸ Championnats' categoryTabs, but scoped to this driver's own offer batch instead of
    // every category in the game.
    const offeredCategoryIds = [...new Set(sortedOffers.map((o) => o.categoryId))];
    const filterId = state.ui.offersFilterCategoryId;
    const filterTabs =
      offeredCategoryIds.length > 1
        ? `<div class="tabs">
            <button class="tab ${!filterId ? "active" : ""}" data-action="filter-offers-category" data-id="all">Toutes</button>
            ${CATEGORIES.filter((c) => offeredCategoryIds.includes(c.id))
              .map((c) => `<button class="tab ${filterId === c.id ? "active" : ""}" data-action="filter-offers-category" data-id="${c.id}">${c.name}</button>`)
              .join("")}
          </div>`
        : "";
    const visibleOffers = filterId ? sortedOffers.filter((o) => o.categoryId === filterId) : sortedOffers;
    const rows = visibleOffers
      .map(
        (o) => `
        <div class="offer-row">
          <div>
            <strong>${o.teamName}</strong>
            ${o.isSkip ? `<span class="pill" title="Saut de palier exceptionnel">⚡ Saut de catégorie</span>` : ""}
            <span class="muted">${o.categoryName} · Prestige ${prestigeStars(o.prestige)} (${o.prestige}) · ${teamRankingLabel(state, o.teamId, o.categoryId)}${agencyRelationSuffix(state, o.teamId)}</span>
          </div>
          <button data-action="join-team" data-id="${driver.id}" data-team-id="${o.teamId}">Rejoindre (${o.cost.toLocaleString("fr-FR")}€)</button>
        </div>`
      )
      .join("");
    return `
      <div class="propose-box">
        <h3>Propositions reçues</h3>
        ${windowNotice}
        ${filterTabs}
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
  const patience = Math.round(driver.negotiationPatience ?? 100);

  // Set on a refused offer (negotiateContract, state.js) so the player has a concrete target
  // instead of guessing blind — cleared once a contract is actually signed.
  const counter = driver.negotiationCounterOffer;
  const counterOfferHtml = counter
    ? `
      <div class="counter-offer">
        <p><b>${driver.name} propose :</b> ${
          driver.isPro
            ? `Commission ${Math.round(counter.commissionRate * 100)}%`
            : `Salaire ${counter.weeklyWage.toLocaleString("fr-FR")}€/sem, indemnité ${counter.transferFee.toLocaleString("fr-FR")}€`
        }</p>
        <button data-action="prefill-counter-offer" data-id="${driver.id}" class="secondary small"
          ${driver.isPro ? `data-commission="${Math.round(counter.commissionRate * 100)}"` : `data-wage="${counter.weeklyWage}" data-fee="${counter.transferFee}"`}>
          Reprendre cette proposition
        </button>
      </div>`
    : "";

  const proFields = driver.isPro
    ? `
      <label class="invest-line" title="Commission : part des gains de course que l'agence conserve à chaque course, en tant qu'agent du pilote (plus de salaire versé directement). Plus elle est basse, plus l'offre paraît généreuse au pilote — il garde plus de ses gains — mais moins l'agence encaisse.">
        Commission
        <input type="number" min="1" max="90" step="1" data-role="negotiate-commission" value="${Math.round(baseline.commissionRate * 100)}" />
        %
      </label>
      <p class="muted hint">Fourchette indicative : ${Math.round(baseline.commissionWindow.min * 100)}–${Math.round(baseline.commissionWindow.max * 100)}%.</p>`
    : `
      <label class="invest-line" title="Salaire hebdomadaire : pour un pilote AMATEUR, c'est lui qui verse ce montant à l'agence en frais de gestion chaque semaine. Plus il est élevé, moins l'offre paraît généreuse à ses yeux (mais plus l'agence encaisse).">
        Salaire hebdomadaire
        <input type="number" min="0" step="50" data-role="negotiate-salary" value="${baseline.weeklyWage}" />
        €
      </label>
      <p class="muted hint">Fourchette indicative : ${baseline.weeklyWageWindow.min.toLocaleString("fr-FR")}–${baseline.weeklyWageWindow.max.toLocaleString("fr-FR")}€/sem.</p>
      <label class="invest-line" title="Indemnité de transfert : somme versée par l'agence au pilote à la signature du contrat, prélevée sur ta trésorerie. Plus elle est haute, plus l'offre paraît généreuse au pilote. Peut être étalée sur plusieurs semaines ci-dessous plutôt que débitée d'un coup.">
        Indemnité de transfert
        <input type="number" min="0" step="500" data-role="negotiate-fee" value="${baseline.transferFee}" />
        €
      </label>
      <label class="invest-line" title="Étale le paiement de l'indemnité de transfert sur plusieurs semaines au lieu de la débiter en une fois — seul le premier versement est prélevé à la signature. Le pilote juge l'offre sur le montant total, pas sur l'étalement.">
        Étaler sur
        <input type="number" min="1" max="6" step="1" data-role="negotiate-installments" value="1" />
        versement(s)
      </label>`;

  return `
    <div class="propose-box negotiate-box">
      <h3>Négociation de contrat</h3>
      <p class="muted" title="Ce contrat lie le pilote à ton AGENCE (rémunération, durée) — il est distinct du baquet écurie, qui expire à la fin de saison avec une chance de renouvellement automatique.">Ce contrat lie le pilote à ton agence (pas à une écurie) : il fixe sa rémunération et sa fidélité envers toi. Le baquet en écurie est une affaire séparée, gérée plus bas.</p>
      <p class="muted">Une offre trop éloignée de ses attentes peut être refusée — et use sa patience, le rendant plus dur à convaincre pour un temps (elle se régénère lentement).</p>
      <p class="muted">Patience actuelle : <b>${patience}/100</b></p>
      ${counterOfferHtml}
      ${proFields}
      <label class="invest-line" title="Durée d'engagement en saisons pleines après la fin de la saison en cours. Un engagement plus long rend le pilote plus enclin à accepter.">
        Durée (saisons)
        <input type="number" min="1" max="5" step="1" data-role="negotiate-seasons" value="1" />
      </label>
      <p class="muted hint">Trésorerie disponible : ${state.agency.money.toLocaleString("fr-FR")}€${driver.isPro ? "" : " — seul le premier versement de l'indemnité est débité à l'acceptation, le reste suit chaque semaine si tu l'as étalée."}</p>
      <div class="card-actions">
        <button data-action="negotiate-contract" data-id="${driver.id}">Proposer le contrat</button>
      </div>
    </div>`;
}

// A one-off substitute offer (tickSubstituteOffers, team.js) is separate from a season-long
// second championship — a single team reaching out for exactly one upcoming round, not a
// standing engagement. Shown as its own card so it isn't confused with the season-long flow.
function substituteOfferSection(state, driver) {
  const offer = driver.pendingSubstituteOffer;
  if (!offer) return "";
  return `
    <div class="propose-box">
      <h3>Offre de remplacement — une course</h3>
      <div class="offer-row">
        <div>
          <strong>${offer.teamName}</strong>
          <span class="muted">${offer.categoryName} · course de la semaine ${offer.roundWeek} · ${offer.cost.toLocaleString("fr-FR")}€</span>
        </div>
        <button data-action="accept-substitute" data-id="${driver.id}">Accepter (${offer.cost.toLocaleString("fr-FR")}€)</button>
      </div>
    </div>`;
}

// Opened by the "transfer-offer" dilemma's "Ouvrir les négociations" branch (events.js) —
// negotiating the fee happens here instead of the dilemma imposing one, mirroring the
// input+fourchette shape of contractNegotiationSection below without sharing its logic (this
// negotiates with a THIRD-PARTY TEAM, not the driver).
function transferNegotiationSection(state, driver) {
  const offer = driver.pendingTransferOffer;
  if (!offer) return "";
  const window = transferNegotiationWindow(driver);
  return `
    <div class="propose-box negotiate-box">
      <h3>Négociation de transfert — ${offer.teamName}</h3>
      <p class="muted">${offer.teamName} souhaite recruter ${driver.name}. Plus l'indemnité demandée est élevée, moins l'écurie a de chances d'accepter.</p>
      <p class="muted">Expire semaine ${offer.expiresAtWeek} sans accord.</p>
      <label class="invest-line" title="Indemnité totale demandée à l'écurie acheteuse — ta commission (Bureau) en dépend directement.">
        Indemnité demandée
        <input type="number" min="0" step="1000" data-role="negotiate-transfer-fee" value="${window.baselineFee}" />
        €
      </label>
      <p class="muted hint">Fourchette indicative : ${window.minFee.toLocaleString("fr-FR")}–${window.maxFee.toLocaleString("fr-FR")}€.</p>
      <div class="card-actions">
        <button data-action="negotiate-transfer" data-id="${driver.id}">Proposer l'indemnité</button>
      </div>
    </div>`;
}

// Season-long second championship now requires an explicit proposal (proposeSecondaryChampionship,
// team.js) instead of always listing every eligible team — mirrors offersSection's pattern for
// the primary championship. The category list itself is already tier-gated (listSecondaryJoinableTeams),
// which is what fixes a karting-only driver ever being offered something like WEC.
function secondaryChampionshipSection(state, driver) {
  if (!driver.teamId) return "";
  const used = totalWorkload(driver);

  const currentRows = driver.secondarySeats
    .map((s) => {
      const t = findTeamById(state, s.teamId);
      const category = CATEGORY_BY_ID[s.categoryId];
      const standing = secondaryStanding(state, s.categoryId, s.teamId, driver.id);
      const standingLabel = standing.position ? `P${standing.position} · ${standing.points} pts` : "Pas encore classé";
      const oneOffTag = s.oneOff ? " · remplacement ponctuel" : "";
      return `<div class="muted">${t?.name ?? "?"} — ${category?.name ?? s.categoryId} (${teamRankingLabel(state, s.teamId, s.categoryId)} · ${standingLabel}${oneOffTag})</div>`;
    })
    .join("");

  if (driver.pendingSecondaryOffers.length > 0) {
    const sortedOffers = [...driver.pendingSecondaryOffers].sort((a, b) => {
      const catA = CATEGORIES.findIndex((c) => c.id === a.categoryId);
      const catB = CATEGORIES.findIndex((c) => c.id === b.categoryId);
      return catA !== catB ? catA - catB : b.prestige - a.prestige;
    });
    const rows = sortedOffers
      .map(
        (o) => `
      <div class="offer-row">
        <div><strong>${o.teamName}</strong><span class="muted">${o.categoryName} · Prestige ${prestigeStars(o.prestige)} (${o.prestige}) · ${teamRankingLabel(state, o.teamId, o.categoryId)}${agencyRelationSuffix(state, o.teamId)}</span></div>
        <button data-action="join-secondary" data-id="${driver.id}" data-team-id="${o.teamId}">Rejoindre (${o.cost.toLocaleString("fr-FR")}€)</button>
      </div>`
      )
      .join("");
    return `
      <div class="propose-box">
        <h3>Second championnat (charge ${used}/${MAX_DRIVER_WORKLOAD})</h3>
        ${currentRows}
        ${rows}
      </div>`;
  }

  const noOffersMessage =
    driver.secondaryProposedAt != null
      ? `<p class="warn">Aucune écurie n'a répondu favorablement pour un second championnat.</p>`
      : `<p class="muted">Propose ce pilote pour un second championnat — aucune écurie ne le fera spontanément.</p>`;

  return `
    <div class="propose-box">
      <h3>Second championnat (charge ${used}/${MAX_DRIVER_WORKLOAD})</h3>
      ${currentRows}
      ${noOffersMessage}
      <button data-action="propose-secondary" data-id="${driver.id}" class="secondary">Proposer pour un second championnat</button>
    </div>`;
}

function logEntry(entry) {
  switch (entry.type) {
    case "player-result": {
      const { driver, category, result } = entry;
      const outcome = result.dnf
        ? "abandon"
        : `P${result.position}/${result.gridSize ?? category.gridSize}, +${result.prize.toLocaleString("fr-FR")}€`;
      const styleTag = result.styleLabel ? ` <span class="muted">(${result.styleLabel})</span>` : "";
      const stageTag = result.stageBonus ? ` <span class="good">(+${result.stageBonus} pts Super-Spéciale)</span>` : "";
      return `<li><b>${driver.name}</b> <span class="id-tag">[#${driver.id}]</span> — ${category.name}${styleTag} : ${outcome}${stageTag}</li>`;
    }
    case "rival-scout-sign":
      return `<li class="muted">${entry.agencyName} signe ${entry.driverName} avant toi.</li>`;
    case "rival-poach":
      return `<li class="warn-text">${entry.agencyName} débauche ${entry.driverName}, resté sans contrat trop longtemps.</li>`;
    case "season-champion-driver":
      return `<li class="highlight-line">Titre pilote : ${entry.driverName} est champion de ${entry.category.name} (saison ${entry.seasonNumber})${entry.isPlayer ? " — un de tes pilotes !" : ""}</li>`;
    case "recruit-established":
      return `<li class="highlight-line">${entry.driverName} (${entry.category.name}) rejoint ton agence${entry.wasRivalManaged ? `, débauché à ${entry.previousAgencyName}` : ""}.</li>`;
    case "random-event":
      return `<li class="${entry.tone === "good" ? "good" : entry.tone === "bad" ? "warn-text" : "muted"}"><b>${entry.title}</b> — ${entry.text}</li>`;
    case "season-champion-team":
      return `<li class="highlight-line">Titre écurie : ${entry.teamName} est champion de ${entry.category.name} (saison ${entry.seasonNumber}).</li>`;
    case "sponsor-contract-ended":
      return `<li class="muted">Le contrat avec ${entry.sponsorName} arrive à échéance.</li>`;
    case "academy-graduation":
      return `<li class="muted">${entry.driverName} rejoint le programme phare de l'${entry.academyName} (${entry.flagshipLabel}) — plus disponible au recrutement.</li>`;
    case "driver-trait-acquired": {
      const trait = DRIVER_TRAITS[entry.traitId];
      const replaced = entry.replacedTraitId ? DRIVER_TRAITS[entry.replacedTraitId] : null;
      const replacedText = replaced ? ` (remplace ${replaced.label})` : "";
      return `<li class="highlight-line">${entry.driverName} développe un nouveau trait : <b>${trait.label}</b>${replacedText} (saison ${entry.seasonNumber}).</li>`;
    }
    default:
      return "";
  }
}

// Appends each secondary-championship seat's term (category name, team name, standing...) in
// parentheses behind the primary-championship value in the same table cell.
function withSecondaryTerms(driver, getter) {
  if (!driver.secondarySeats?.length) return "";
  return ` (${driver.secondarySeats.map(getter).join(", ")})`;
}

// Fixed-width, icon-only strip pinned at the very left of "Mes pilotes" — a glance-only status
// summary (blessé, leader du championnat, sans contrat d'agence, sans écurie) that must NOT
// reshuffle the table as icons come and go per driver, same fixed-header-width trick already
// used for .col-talent-action (Talents).
function driverStatusIcons(driver, team, position) {
  const icons = [];
  if ((driver.injuryWeeksRemaining ?? 0) > 0) {
    icons.push(`<span title="Blessé — ${driver.injuryWeeksRemaining} semaine(s) restante(s)">🤕</span>`);
  }
  if (driver.categoryId && position === 1) {
    icons.push(`<span title="Leader du championnat">🥇</span>`);
  }
  if (!driver.contract) {
    icons.push(`<span title="Sans contrat d'agence — risque de départ">✍️</span>`);
  }
  if (!team) {
    icons.push(`<span title="Sans écurie — ne court pas">🪑</span>`);
  }
  if (driver.pendingSubstituteOffer) {
    const o = driver.pendingSubstituteOffer;
    icons.push(`<span title="Offre exceptionnelle — ${o.teamName} (${o.categoryName})">🌟</span>`);
  }
  const lastResult = driver.careerResults?.[driver.careerResults.length - 1];
  if (lastResult && !lastResult.dnf && lastResult.position <= 3) {
    icons.push(`<span title="Podium à la dernière course (P${lastResult.position})">🏆</span>`);
  }
  if (driver.contract && driver.contract.weeksRemaining <= 4) {
    icons.push(`<span title="Fin de contrat d'agence proche — ${driver.contract.weeksRemaining} semaine(s) restante(s)">⏳</span>`);
  }
  // Same threshold as the persistent poachRiskLine banner (layout.js) — no new game logic, just
  // surfacing the same signal directly on the row instead of only in the top banner's name list.
  if ((driver.agencyRelationship ?? 0) < POACH_WARNING_THRESHOLD) {
    icons.push(`<span title="Relation critique — risque de débauchage">⚠️</span>`);
  }
  const form = driver.form ?? 50;
  if (form > 80) {
    icons.push(`<span title="Forme exceptionnelle (${Math.round(form)}/100)">😃</span>`);
  } else if (form <= 20) {
    icons.push(`<span title="Mauvaise forme (${Math.round(form)}/100)">😞</span>`);
  }
  if (driver.categoryId && (driver.seasonHistory?.length ?? 0) === 0) {
    icons.push(`<span title="Recrue — première saison en piste">🌱</span>`);
  }
  return icons.join(" ");
}

// The most recent COMPLETED season's final classification — mid-season stint rows
// (recordSeasonStint, team.js) always carry championshipPosition: null, only the season-end
// summary row (standings.js rollover) fills it in, so filtering those out and taking the last
// one gives the last season the driver actually finished, regardless of mid-season team changes.
function previousSeasonPosition(driver) {
  const completed = (driver.seasonHistory ?? []).filter((h) => h.championshipPosition != null);
  return completed.length > 0 ? completed[completed.length - 1] : null;
}

function driverTableRow(state, driver) {
  const rating = Math.round(overallRating(driver));
  const { races, wins, podiums } = seasonResultsFor(state, driver);
  const { position, points } = championshipStanding(state, driver);
  const value = driverMarketValue(driver);
  const salary = driver.contract
    ? driver.isPro
      ? `${Math.round(driver.contract.commissionRate * 100)}% commission`
      : `+${driver.contract.weeklyWage.toLocaleString("fr-FR")}€/sem`
    : "—";
  const category = CATEGORY_BY_ID[driver.categoryId];
  const categoryName =
    (driver.categoryId ? categoryLabel(driver.categoryId) : "—") +
    withSecondaryTerms(driver, (s) => categoryLabel(s.categoryId));
  const team = driver.teamId ? findTeamById(state, driver.teamId) : null;
  const teamLabel = (team ? team.name : "—") + withSecondaryTerms(driver, (s) => findTeamById(state, s.teamId)?.name ?? "?");
  const positionLabel =
    (position ?? "—") +
    withSecondaryTerms(driver, (s) => {
      const st = secondaryStanding(state, s.categoryId, s.teamId, driver.id);
      return st.position ? `P${st.position}` : "—";
    });
  const pointsLabel = points + withSecondaryTerms(driver, (s) => secondaryStanding(state, s.categoryId, s.teamId, driver.id).points);
  // References the ÉCURIE seat's expiry (end of season, with an automatic renewal roll at
  // rollover — standings.js), not the agency contract's — a separate, weeks-based duration
  // shown instead in the driver detail view's contract line.
  const contractEnd = team ? `Dans ${racesUntilSeasonEnd(state, driver.categoryId)} course(s) (fin de saison)` : "—";
  const prevSeason = previousSeasonPosition(driver);
  const prevPositionCell = prevSeason
    ? `<td class="${positionColorClass(prevSeason.championshipPosition, pointsTableFor(CATEGORY_BY_ID[prevSeason.categoryId], prevSeason.classId))}">P${prevSeason.championshipPosition}</td>`
    : `<td class="muted">—</td>`;

  return `
    <tr data-action="view-driver" data-id="${driver.id}" class="clickable-row">
      <td class="col-status-icons">${driverStatusIcons(driver, team, position)}</td>
      <td>${driver.name} ${driverIdTag(driver)}</td>
      <td>${driver.sex}, ${driver.age}</td>
      <td>${driverStatusLabel(driver, category)}</td>
      <td>${categoryName}</td>
      <td>${teamLabel}</td>
      <td>${rating}</td>
      <td>${races}</td>
      <td>${wins}</td>
      <td>${podiums}</td>
      <td>${positionLabel}</td>
      ${prevPositionCell}
      <td>${pointsLabel}</td>
      <td>${value.toLocaleString("fr-FR")}€</td>
      <td>${salary}</td>
      <td>${contractEnd}</td>
      <td class="${relationColorClass(driver.agencyRelationship)}">${Math.round(driver.agencyRelationship)}</td>
      <td class="${relationColorClass(driver.teamRelationship)}">${Math.round(driver.teamRelationship)}</td>
    </tr>`;
}

const TUTORIAL_STEPS = [
  { key: "scouted", label: "Scouter un pilote (Talents)" },
  { key: "signed", label: "Signer un pilote" },
  { key: "proposed", label: "Le proposer à des écuries" },
  { key: "simulated", label: "Simuler une semaine" },
];

// Dismissible onboarding checklist — shown on the Agency home screen until every step is done
// AND the player chooses to hide it, or they dismiss it early. Each flag is set from main.js
// (the only layer that sees every action's result across game.js/team.js), never here.
function tutorialCard(state) {
  const tutorial = state.tutorial;
  if (!tutorial || tutorial.dismissed) return "";
  const allDone = TUTORIAL_STEPS.every((s) => tutorial[s.key]);
  const items = TUTORIAL_STEPS.map(
    (s) => `<li class="${tutorial[s.key] ? "tutorial-step-done" : ""}">${tutorial[s.key] ? "✅" : "☐"} ${s.label}</li>`
  ).join("");
  return `
    <div class="card tutorial-card">
      <div class="card-head">
        <strong>Premiers pas</strong>
        <button data-action="dismiss-tutorial" class="secondary small">Masquer</button>
      </div>
      <ul class="tutorial-steps">${items}</ul>
      ${allDone ? `<p class="muted">Tout est fait — tu peux masquer ce guide.</p>` : ""}
    </div>`;
}

export function renderMyDrivers(state) {
  const rows = state.drivers.map((d) => driverTableRow(state, d)).join("");
  return `
    <h2>Mes pilotes</h2>
    ${tutorialCard(state)}
    <p class="muted">${state.drivers.length} / ${rosterCapacity(state)} pilotes</p>
    ${compareBar("compare-drivers", "clear-compare-drivers", state.ui.compareDriverIds ?? [], "pilote(s)")}
    <div class="table-scroll">
      <table class="table wide">
        <thead>
          <tr>
            <th class="col-status-icons"></th>
            <th>Nom</th><th>Sexe, Âge</th><th>Statut</th><th>Catégorie</th><th>Écurie</th><th>Niveau</th><th>Courses</th><th>Victoires</th><th>Podiums</th>
            <th>Pos. champ.</th><th title="Classement final de la dernière saison terminée">Classement préc.</th><th>Points</th><th>Valeur</th><th>Salaire</th><th>Fin contrat</th>
            <th>Rel. agence</th><th>Rel. équipe</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td class="muted" colspan="18">Aucun pilote signé pour l'instant.</td></tr>`}</tbody>
      </table>
    </div>`;
}

function driverSeasonRoundCell(rounds, roundIndex, driverId) {
  const round = rounds[roundIndex];
  if (!round) return `<td class="muted">—</td>`;
  const entry = round.find((e) => e.driverIds.includes(driverId));
  if (!entry) return `<td class="muted">—</td>`;
  if (entry.dnf) return `<td class="warn">Ret</td>`;
  return `<td>${round.indexOf(entry) + 1}</td>`;
}

// Round-by-round detail for ONE driver, opened by clicking a row in their own "Historique"
// table (current or past season) — reuses resolveSeasonView (standings.js) so live and
// archived seasons resolve exactly the same way as the "Monde ▸ Championnats" season selector.
function driverSeasonDetail(state, driver) {
  const sel = state.ui.viewingDriverSeason;
  if (!sel) return "";
  const category = CATEGORY_BY_ID[sel.categoryId];
  if (!category) return "";
  const label = sel.classId
    ? `${category.name} — ${category.classes?.find((c) => c.id === sel.classId)?.label ?? sel.classId}`
    : category.name;
  const heading = `<h3 class="class-heading">Détail manche par manche — Saison ${sel.seasonNumber} (${label})</h3>`;
  const view = resolveSeasonView(state, sel.categoryId, sel.classId, sel.seasonNumber);
  if (!view) {
    return `${heading}<p class="muted">Détail non disponible pour cette saison (antérieure à l'introduction de ce suivi).</p>`;
  }
  const rounds = view.rounds ?? [];
  const roundCount = category.roundCount ?? rounds.length;
  let headerCells = "";
  let resultCells = "";
  for (let i = 0; i < roundCount; i++) {
    const styleId = category.roundStyles?.[i];
    const styleLabel = styleId ? TRACK_STYLES[styleId]?.label : null;
    headerCells += `<th${styleLabel ? ` title="${styleLabel}"` : ""}>R${i + 1}</th>`;
    resultCells += driverSeasonRoundCell(rounds, i, driver.id);
  }
  return `
    ${heading}
    <div class="table-scroll">
      <table class="table wide">
        <thead><tr>${headerCells}</tr></thead>
        <tbody><tr>${resultCells}</tr></tbody>
      </table>
    </div>`;
}

function seasonHistoryRow(entry) {
  return `
    <tr class="clickable-row" data-action="view-driver-season" data-id="${entry.seasonNumber}" data-category-id="${entry.categoryId}" data-class-id="${entry.classId ?? ""}">
      <td>${entry.seasonNumber}</td>
      <td>${categoryLabel(entry.categoryId)}</td>
      <td>${entry.teamName}</td>
      <td>${entry.rating}</td>
      <td>${entry.value.toLocaleString("fr-FR")}€</td>
      <td>${entry.races}</td>
      <td>${entry.wins}</td>
      <td>${entry.podiums}</td>
      <td>${entry.championshipPosition ?? "—"}</td>
    </tr>`;
}

function prospectDetail(state, driver) {
  const potential = driver.scoutReveal?.potentialKnown ? `${driver.potential}` : "?";
  return `
    <button data-action="back-to-roster" class="btn-red btn-large">← Retour</button>
    <h2>${driver.name} ${driverIdTag(driver)}</h2>
    <div class="card">
      <div class="card-head">
        <strong>${driver.name}</strong>
        <span class="pill">${driver.sex} · ${driver.age} ans</span>
        ${academyBadge(state, driver)}
        ${bronzeBadge(driver)}
      </div>
      <div class="muted">Talent non signé — pas encore sous contrat d'agence.</div>
      <div class="potential">Potentiel : <b>${potential}</b></div>
      ${!driver.scouted ? `<p class="unscouted">Statistiques inconnues — fais scouter ce pilote.</p>` : ""}
      <div class="card-actions">
        ${!driver.scouted ? `<button data-action="scout" data-id="${driver.id}">Scouter (${scoutCost(state).toLocaleString("fr-FR")}€)</button>` : ""}
        ${driver.scouted && !driver.scoutReveal?.potentialKnown ? `<button data-action="deep-scout" data-id="${driver.id}" class="secondary">Scouting approfondi (${deepScoutCost(state).toLocaleString("fr-FR")}€)</button>` : ""}
        <button data-action="sign" data-id="${driver.id}" ${driver.scouted ? "" : "class=\"secondary\""}>Signer (${priceLabel(state, driver)})</button>
        ${compareToggleButton("toggle-compare-driver", driver.id, state.ui.compareDriverIds ?? [], "compare-push-right")}
      </div>
    </div>
    ${superStatSection(driver, driver.scouted ? "range" : false)}
    <h3>Attributs</h3>
    <div class="card attributes-card">
      ${ATTRIBUTE_GROUPS.map((g) => prospectAttributeSection(driver, g)).join("")}
    </div>
    <h3>Traits</h3>
    ${traitsSection(driver, driver.scoutReveal?.traitsKnown)}`;
}

// Read-only fiche for a driver outside the player's agency (rival-managed or independent AI),
// reached by clicking a row in Monde ▸ Pilotes or in a Championnats standings table — no
// negotiation/proposition/release actions, since those only make sense for the player's own
// roster. Race/win/podium counts are omitted: careerResults is only ever populated for player
// drivers (simulate.js), so it would always read 0 here even for an AI driver who's actually
// raced and scored. Scouting/deep-scouting/approaching a driver only ever happens from here —
// deliberately not surfaced as extra columns in the standings tables themselves.
function readOnlyDriverDetail(state, driver) {
  const category = CATEGORY_BY_ID[driver.categoryId];
  const team = driver.teamId ? findTeamById(state, driver.teamId) : null;
  // Same masking convention as a scout-pool prospect (talentsRow/prospectDetail) — an AI/rival
  // driver's stats stay hidden until the player pays to scout them (scoutRivalDriver, state.js).
  // A driver on the player's own roster (isAI false) is never masked here.
  const revealed = !driver.isAI || driver.scouted;
  const rating = revealed ? Math.round(overallRating(driver)) : "?";
  const { position, points } = championshipStanding(state, driver);
  const seatLabel = team ? `${team.name} · Prestige ${prestigeStars(team.prestige)} (${team.prestige})` : `<span class="warn">Sans écurie</span>`;
  const agency = driver.agencyId ? state.rivalAgencies.find((a) => a.id === driver.agencyId) : null;
  const managedLabel = agency ? `Géré par ${agency.name}` : "Pilote indépendant";

  const scoutBtn = !driver.scouted
    ? `<button data-action="scout-rival" data-id="${driver.id}">Scouter (${scoutCost(state).toLocaleString("fr-FR")}€)</button>`
    : "";
  const deepScoutBtn = driver.scouted && !driver.scoutReveal?.traitsKnown
    ? `<button data-action="deep-scout-rival" data-id="${driver.id}">Scouting approfondi (${deepScoutCost(state).toLocaleString("fr-FR")}€)</button>`
    : "";
  const approachBtn = approachCell(state, driver);
  const actionsHtml = scoutBtn || deepScoutBtn || approachBtn
    ? `<div class="card-actions">${scoutBtn}${deepScoutBtn}${approachBtn}</div>`
    : "";

  return `
    <button data-action="back-to-roster" class="btn-red btn-large">← Retour</button>
    <h2>${driver.name} ${driverIdTag(driver)}</h2>
    <div class="card">
      <div class="card-head"><strong>${driver.name}</strong> ${bronzeBadge(driver)}</div>
      <div class="identity-line">${driver.sex} · ${driver.age} ans · OVR ${rating} · ${driverStatusLabel(driver, category)}</div>
      <div class="muted">${seatLabel} · ${driver.categoryId ? categoryLabel(driver.categoryId) : "Non affecté"} · ${managedLabel}</div>
      <div class="muted">Cette saison : ${points} pts · ${position ? `P${position}` : "—"} au championnat</div>
      ${!revealed ? `<p class="unscouted">Statistiques inconnues — fais scouter ce pilote.</p>` : ""}
      ${actionsHtml}
    </div>
    ${revealed ? superStatSection(driver, "range") : ""}
    <h3>Attributs</h3>
    <div class="card attributes-card">
      ${ATTRIBUTE_GROUPS.map((g) => (revealed ? attributeSection(driver, g) : prospectAttributeSection(driver, g))).join("")}
    </div>
    <h3>Traits</h3>
    ${traitsSection(driver, driver.scoutReveal?.traitsKnown)}`;
}

export function renderDriverDetail(state) {
  const driver = state.drivers.find((d) => d.id === state.ui.viewingDriverId);
  if (!driver) {
    const prospect = state.scoutPool.find((d) => d.id === state.ui.viewingDriverId);
    if (prospect) return prospectDetail(state, prospect);
    const other = getDriverById(state, state.ui.viewingDriverId);
    if (other) return readOnlyDriverDetail(state, other);
    return `
      <button data-action="back-to-roster" class="btn-red btn-large">← Retour</button>
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
    ? `${driver.contract.weeksRemaining} semaine(s) restante(s) · ${
        driver.isPro
          ? `Commission : ${Math.round(driver.contract.commissionRate * 100)}%`
          : `Frais de gestion perçus : ${driver.contract.weeklyWage.toLocaleString("fr-FR")}€/sem`
      }${
        driver.pendingContractInstallment
          ? ` · Versements restants sur l'indemnité : ${driver.pendingContractInstallment.remaining.toLocaleString("fr-FR")}€ (${driver.pendingContractInstallment.weeklyPayment.toLocaleString("fr-FR")}€/sem)`
          : ""
      }`
    : team
      ? `<span class="warn">Sans contrat d'agence — en piste chez ${team.name}, risque de débauchage</span>`
      : `<span class="warn">Sans contrat — risque de débauchage</span>`;
  const seatLabel = team ? `${team.name} · Prestige ${prestigeStars(team.prestige)} (${team.prestige})` : `<span class="warn">Sans écurie — ne court pas</span>`;

  // Classes like WEC (hypercar/GT3) store standings under a "categoryId:subClass" key — using
  // the bare categoryId here would always miss the driver's live season number/round data (same
  // bug class fixed earlier for teamRankingLabel/secondaryStanding).
  const currentClassId = team?.subClass ?? null;
  const currentStandingsKey = currentClassId ? `${driver.categoryId}:${currentClassId}` : driver.categoryId;
  const currentSeasonNumber = state.standings[currentStandingsKey]?.seasonNumber ?? 1;
  const currentSeasonRow = driver.categoryId
    ? `
      <tr class="highlight-row clickable-row" data-action="view-driver-season" data-id="${currentSeasonNumber}" data-category-id="${driver.categoryId}" data-class-id="${currentClassId ?? ""}">
        <td>${currentSeasonNumber} (en cours)</td>
        <td>${categoryLabel(driver.categoryId)}</td>
        <td>${team ? team.name : "Sans écurie"}</td>
        <td>${rating}</td>
        <td>${value.toLocaleString("fr-FR")}€</td>
        <td>${races}</td>
        <td>${wins}</td>
        <td>${podiums}</td>
        <td>${position ?? "—"}</td>
      </tr>`
    : "";
  // Newest first: the in-progress season/stint is the most recent, then closed
  // seasons/stints in reverse-chronological order (they're pushed oldest-first).
  const historyRows = currentSeasonRow + [...driver.seasonHistory].reverse().map(seasonHistoryRow).join("");

  return `
    <button data-action="back-to-roster" class="btn-red btn-large">← Retour</button>
    <h2>${driver.name} ${driverIdTag(driver)}</h2>
    <div class="card">
      <div class="card-head">
        <strong>${driver.name}</strong>
        ${bronzeBadge(driver)}
      </div>
      <div class="identity-line">${driver.sex} · ${driver.age} ans · OVR ${rating} · ${driverStatusLabel(driver, category)}</div>
      <div class="muted">${seatLabel} · ${driver.categoryId ? categoryLabel(driver.categoryId) : "Non affecté"} · Peak à ${peakAge(driver)} ans</div>
      <div class="contract-line">${contractLabel}</div>
      <div class="muted">Valeur estimée : <b>${value.toLocaleString("fr-FR")}€</b></div>
      <div class="muted">Cette saison : ${races} course(s) · ${wins} victoire(s) · ${podiums} podium(s) · ${points} pts · ${position ? `P${position}` : "—"} au championnat</div>
      ${relationGauge("Relation agence", driver.agencyRelationship)}
      ${relationGauge("Relation équipe", driver.teamRelationship)}
      <div class="muted">Forme : ${formEmote(driver.form ?? 50)} (${Math.round(driver.form ?? 50)}/100)</div>
      <div class="invest-line-row">
        <label class="invest-line" title="Budget course : mise que tu places AVANT chaque course pour booster la performance de ce pilote ce week-end-là. Débitée automatiquement CHAQUE semaine où il court (pas une seule fois), tant que l'agence a les moyens de payer — sinon la mise est ignorée sans frais cette semaine-là. Ne s'applique que si le pilote a un baquet en écurie. Distinct du budget de recrutement, payé une fois pour convaincre une écurie de le prendre.">
          Budget course
          <input type="number" min="0" step="500" data-action="invest" data-id="${driver.id}" value="${state.investments[driver.id] ?? 0}" />
          €
        </label>
        ${compareToggleButton("toggle-compare-driver", driver.id, state.ui.compareDriverIds ?? [], "compare-push-right")}
      </div>
      <div class="card-actions">
        <button data-action="release-driver" data-id="${driver.id}" class="btn-red">Licencier</button>
      </div>
    </div>
    ${!driver.contract ? contractNegotiationSection(state, driver) : ""}
    ${offersSection(state, driver)}
    ${substituteOfferSection(state, driver)}
    ${transferNegotiationSection(state, driver)}
    ${secondaryChampionshipSection(state, driver)}
    ${superStatSection(driver, "exact")}
    <h3>Attributs</h3>
    <div class="card attributes-card">
      ${ATTRIBUTE_GROUPS.map((g) => attributeSection(driver, g)).join("")}
    </div>
    <h3>Traits</h3>
    ${traitsSection(driver, true)}
    <h3>Historique</h3>
    <div class="table-scroll">
      <table class="table">
        <thead><tr><th>Saison</th><th>Catégorie</th><th>Écurie</th><th>Niveau</th><th>Valeur</th><th>Courses</th><th>Victoires</th><th>Podiums</th><th>Pos.</th></tr></thead>
        <tbody>${historyRows || `<tr><td class="muted" colspan="9">Pas encore d'historique.</td></tr>`}</tbody>
      </table>
    </div>
    ${driverSeasonDetail(state, driver)}`;
}

function talentsRow(state, driver) {
  const potential = driver.scoutReveal?.potentialKnown ? driver.potential : "?";
  const statCells = SUPER_STAT_KEYS.map((key) => {
    const display = driver.scouted ? superStatDisplay(driver, key, "range") : "?";
    return `<td title="${superStatTooltip(key)}">${display}</td>`;
  }).join("");
  return `
    <tr data-action="view-driver" data-id="${driver.id}" class="clickable-row">
      <td>${driver.name} ${driverIdTag(driver)} ${academyBadge(state, driver)} ${bronzeBadge(driver)}</td>
      <td>${driver.sex}</td>
      <td>${driver.age}</td>
      <td>${potential}</td>
      ${statCells}
      <td class="row-actions">
        ${!driver.scouted ? `<button data-action="scout" data-id="${driver.id}" class="small">Scouter (${scoutCost(state).toLocaleString("fr-FR")}€)</button>` : ""}
        ${driver.scouted && !driver.scoutReveal?.potentialKnown ? `<button data-action="deep-scout" data-id="${driver.id}" class="secondary small">Scouting approfondi (${deepScoutCost(state).toLocaleString("fr-FR")}€)</button>` : ""}
        <button data-action="sign" data-id="${driver.id}" class="${driver.scouted ? "" : "secondary "}small">Signer (${priceLabel(state, driver)})</button>
      </td>
    </tr>`;
}

function scoutSearchesSection(state) {
  const searches = state.scoutSearches ?? [];
  const rows = searches
    .map((s) => `<li>Recherche en cours — disponible dans ${s.resolvesAtWeek - state.week} semaine(s)</li>`)
    .join("");
  const cost = scoutSearchCost(state);
  const canAfford = state.agency.money >= cost;
  return `
    <div class="card">
      <div class="card-head"><strong>Recherches en cours</strong></div>
      ${rows ? `<ul class="muted">${rows}</ul>` : `<div class="muted">Aucune recherche en cours.</div>`}
      <div class="card-actions">
        <button data-action="request-scout-search" class="${canAfford ? "" : "secondary"}" ${canAfford ? "" : "disabled"}>Commander une recherche (${cost.toLocaleString("fr-FR")}€)</button>
      </div>
    </div>`;
}

export function renderTalents(state) {
  // Free agents only — exclude anyone already signed to this agency or managed by a rival.
  const freeAgents = state.scoutPool.filter(
    (d) => !d.agencyId && !state.drivers.some((owned) => owned.id === d.id)
  );
  const rows = freeAgents.map((d) => talentsRow(state, d)).join("");
  return `
    <h2>Talents</h2>
    ${scoutSearchesSection(state)}
    ${compareBar("compare-drivers", "clear-compare-drivers", state.ui.compareDriverIds ?? [], "pilote(s)")}
    <div class="table-scroll">
      <table class="table wide">
        <thead>
          <tr><th>Nom</th><th>Sexe</th><th>Âge</th><th>Potentiel</th>${SUPER_STAT_KEYS.map((key) => `<th title="${superStatTooltip(key)}">${SUPER_STATS[key].label}</th>`).join("")}<th class="col-talent-action">Action</th></tr>
        </thead>
        <tbody>${rows || `<tr><td class="muted" colspan="9">Aucun talent disponible pour l'instant.</td></tr>`}</tbody>
      </table>
    </div>`;
}

function findAnyDriver(state, id) {
  return state.drivers.find((d) => d.id === id) ?? state.scoutPool.find((d) => d.id === id) ?? null;
}

function compareDriverColumn(state, driver) {
  const signed = state.drivers.some((d) => d.id === driver.id);
  const rating = Math.round(overallRating(driver));
  const category = CATEGORY_BY_ID[driver.categoryId];
  const headerLine = signed
    ? `${driver.sex} · ${driver.age} ans · OVR ${rating} · ${driverStatusLabel(driver, category)}`
    : `${driver.sex} · ${driver.age} ans · Talent non signé`;
  // Potentiel/super stats mirror the same reveal gating as everywhere else a prospect's
  // stats show up — a signed driver's potential/attributes are never hidden, a prospect's
  // are gated by scouting.
  const potential = signed || driver.scoutReveal?.potentialKnown ? driver.potential : "?";
  const attributesHtml = signed
    ? ATTRIBUTE_GROUPS.map((g) => attributeSection(driver, g)).join("")
    : ATTRIBUTE_GROUPS.map((g) => prospectAttributeSection(driver, g)).join("");
  return `
    <div class="compare-column">
      <div class="card">
        <div class="card-head">
          <strong>${driver.name} ${driverIdTag(driver)}</strong>
          <span class="pill">${headerLine}</span>
        </div>
        <div class="muted">Potentiel : <b>${potential}</b> · ${superStatsLine(driver, signed ? "exact" : driver.scouted ? "range" : false)}</div>
        <div class="card-actions">${compareToggleButton("toggle-compare-driver", driver.id, state.ui.compareDriverIds ?? [])}</div>
      </div>
      <div class="card attributes-card">${attributesHtml}</div>
      <div class="card-actions">${traitsSection(driver, signed || driver.scoutReveal?.traitsKnown)}</div>
    </div>`;
}

export function renderCompareDrivers(state) {
  const ids = state.ui.compareDriverIds ?? [];
  const drivers = ids.map((id) => findAnyDriver(state, id)).filter(Boolean);
  const backAction = `<button data-action="nav" data-id="${state.ui.compareOrigin ?? "mes-pilotes"}" class="secondary small">← Retour</button>`;
  if (drivers.length < 2) {
    return `
      ${backAction}
      <h2>Comparaison de pilotes</h2>
      <p class="muted">Sélectionne 2 à ${COMPARE_MAX} pilotes (depuis "Mes pilotes", "Talents", ou leur fiche détaillée) pour les comparer.</p>`;
  }
  return `
    ${backAction}
    <h2>Comparaison de pilotes</h2>
    <div class="compare-grid count-${drivers.length}">
      ${drivers.map((d) => compareDriverColumn(state, d)).join("")}
    </div>`;
}

function staffTraitsLine(member) {
  return (member.traits ?? [])
    .map((id) => `<span class="pill" title="${staffTraitTooltip(id)}">${STAFF_TRAITS[id].label}</span>`)
    .join(" ");
}

// A hired member is always fully known (they work for you); a pool candidate is gated by the
// same scouted/scoutReveal fog-of-war convention as the driver scoutPool (scoutReveal.js).
function staffStatsSection(member, visible) {
  if (!visible) {
    return [
      scoutUnknownRow("Compétence principale", null),
      scoutUnknownRow("Compétence secondaire", null),
      scoutUnknownRow("Communication", null),
      scoutUnknownRow("Expérience", null),
    ].join("");
  }
  const role = ROLES[member.role];
  if (member.scoutReveal) {
    const rangeRow = (label, key) => {
      const actual = member.skills[key];
      const width = member.scoutReveal.attributeWidths[key];
      const low = Math.max(0, Math.round(actual - width / 2));
      const high = Math.min(99, Math.round(actual + width / 2));
      return scoutRangeRow(label, low, high, null);
    };
    return [
      rangeRow(role.skillLabel, "primary"),
      rangeRow(role.secondaryLabel, "secondary"),
      rangeRow("Communication", "communication"),
      rangeRow("Expérience", "experience"),
    ].join("");
  }
  return [
    statBar(role.skillLabel, member.skills.primary),
    statBar(role.secondaryLabel, member.skills.secondary),
    `<div class="muted">Communication ${member.skills.communication} · Expérience ${member.skills.experience}</div>`,
  ].join("");
}

function staffCard(state, member, hired) {
  const role = ROLES[member.role];
  const compareIds = state.ui.compareStaffIds ?? [];
  const visible = hired || member.scouted;
  const traitsRevealed = hired || member.scoutReveal?.traitsKnown;
  const specialtyBadge =
    member.role === "recruiter" && member.specialty
      ? `<span class="pill" title="Trouve plus facilement des profils ${ROLES[member.specialty].name}">Spécialité : ${ROLES[member.specialty].name}</span>`
      : "";
  const eliteBadge = member.elite
    ? `<span class="pill accent" title="Profil trouvé via le réseau de contacts">⭐ Élite</span>`
    : "";
  return `
    <div class="card">
      <div class="card-head">
        <strong>${member.name}</strong>
        <span class="pill" title="${role.description}">${role.name}</span>
        ${specialtyBadge}
        ${eliteBadge}
      </div>
      ${staffStatsSection(member, visible)}
      ${traitsRevealed ? (member.traits?.length ? `<div>${staffTraitsLine(member)}</div>` : "") : `<p class="muted">Traits inconnus — nécessite un scouting approfondi.</p>`}
      <div class="muted">Salaire ${member.weeklyWage.toLocaleString("fr-FR")}€/sem</div>
      <div class="card-actions">
        ${
          hired
            ? `<button data-action="fire-staff" data-id="${member.id}" class="secondary">Licencier</button>`
            : `
              ${!member.scouted ? `<button data-action="scout-staff" data-id="${member.id}" class="secondary">Scouter (${staffScoutCost(state).toLocaleString("fr-FR")}€)</button>` : ""}
              ${member.scouted && !member.scoutReveal?.traitsKnown ? `<button data-action="deep-scout-staff" data-id="${member.id}" class="secondary">Scouting approfondi (${staffDeepScoutCost(state).toLocaleString("fr-FR")}€)</button>` : ""}
              <button data-action="hire-staff" data-id="${member.id}">Engager (${member.hireCost.toLocaleString("fr-FR")}€)</button>
            `
        }
        ${compareToggleButton("toggle-compare-staff", member.id, compareIds, "compare-push-right")}
      </div>
    </div>`;
}

// Search by role instead of dumping the whole staffPool at once — it can hold up to ~240
// candidates after seedWorldStaff (state.js), which used to render unfiltered as cards.
function staffPoolRoleTabs(state) {
  const active = state.ui.staffFilter?.role ?? "all";
  const tabs = [{ id: "all", label: "Tous les rôles" }, ...Object.entries(ROLES).map(([id, r]) => ({ id, label: r.name }))];
  return tabs
    .map((t) => `<button class="tab ${t.id === active ? "active" : ""}" data-action="filter-staff-pool" data-id="${t.id}">${t.label}</button>`)
    .join("");
}

function staffPoolAttributeFilterRow(state) {
  const filter = state.ui.staffFilter ?? {};
  return `
    <div class="filter-row">
      <label>Compétence principale min. <input type="number" min="0" max="99" data-action="filter-staff-pool-min-primary" value="${filter.minPrimary ?? 0}" /></label>
      <label>Salaire max. <input type="number" min="0" step="50" data-action="filter-staff-pool-max-wage" value="${filter.maxWage ?? 0}" placeholder="Aucun plafond" /> €/sem</label>
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
        <h3 title="${ROLES[role].description}">${ROLES[role].name}</h3>
        <div class="card-grid">${members.map((m) => staffCard(state, m, true)).join("")}</div>`
    )
    .join("");

  const filter = state.ui.staffFilter ?? {};
  const activeRole = filter.role ?? "all";
  const minPrimary = filter.minPrimary ?? 0;
  const maxWage = filter.maxWage ?? 0;
  const pool = state.staffPool.filter((m) => {
    if (activeRole !== "all" && m.role !== activeRole) return false;
    if (minPrimary > 0 && m.skills.primary < minPrimary) return false;
    if (maxWage > 0 && m.weeklyWage > maxWage) return false;
    return true;
  });

  return `
    <h2>Staff</h2>
    ${compareBar("compare-staff", "clear-compare-staff", state.ui.compareStaffIds ?? [], "membre(s) de staff")}
    ${state.staff.length ? groupsHtml : `<p class="muted">Aucun membre du staff engagé.</p>`}
    <h3>Candidats disponibles (${pool.length}/${state.staffPool.length})</h3>
    <div class="tabs">${staffPoolRoleTabs(state)}</div>
    ${staffPoolAttributeFilterRow(state)}
    <div class="card-grid">
      ${pool.length ? pool.map((r) => staffCard(state, r, false)).join("") : `<p class="muted">Aucun candidat pour ces filtres.</p>`}
    </div>`;
}

function findAnyStaff(state, id) {
  const hired = state.staff.find((m) => m.id === id);
  if (hired) return { member: hired, hired: true, owner: null };
  const pooled = state.staffPool.find((m) => m.id === id);
  if (pooled) return { member: pooled, hired: false, owner: null };
  for (const agency of state.rivalAgencies) {
    const found = (agency.staff ?? []).find((m) => m.id === id);
    if (found) return { member: found, hired: false, owner: agency };
  }
  return null;
}

function compareStaffColumn(state, entry) {
  const { member, hired, owner } = entry;
  const role = ROLES[member.role];
  const statusLabel = hired ? state.agency.name : owner ? owner.name : "Disponible";
  return `
    <div class="compare-column">
      <div class="card">
        <div class="card-head">
          <strong>${member.name}</strong>
          <span class="pill" title="${role.description}">${role.name}</span>
        </div>
        <div class="muted">${statusLabel}</div>
        ${statBar(role.skillLabel, member.skills.primary)}
        ${statBar(role.secondaryLabel, member.skills.secondary)}
        ${statBar("Communication", member.skills.communication)}
        ${statBar("Expérience", member.skills.experience)}
        <div class="muted">Salaire ${member.weeklyWage.toLocaleString("fr-FR")}€/sem</div>
        <div class="card-actions">${compareToggleButton("toggle-compare-staff", member.id, state.ui.compareStaffIds ?? [])}</div>
      </div>
    </div>`;
}

export function renderCompareStaff(state) {
  const ids = state.ui.compareStaffIds ?? [];
  const entries = ids.map((id) => findAnyStaff(state, id)).filter(Boolean);
  const backAction = `<button data-action="nav" data-id="${state.ui.compareOrigin ?? "staff"}" class="secondary small">← Retour</button>`;
  if (entries.length < 2) {
    return `
      ${backAction}
      <h2>Comparaison de staff</h2>
      <p class="muted">Sélectionne 2 à ${COMPARE_MAX} membres du staff (depuis "Staff", "Monde ▸ Staff", ou leur fiche) pour les comparer.</p>`;
  }
  return `
    ${backAction}
    <h2>Comparaison de staff</h2>
    <div class="compare-grid count-${entries.length}">
      ${entries.map((e) => compareStaffColumn(state, e)).join("")}
    </div>`;
}

function describeFacilityEffect(facilityId, levelData) {
  if (facilityId === "offices") {
    return `Capacité : ${levelData.capacity} pilotes · Commission ${Math.round(levelData.commissionRate * 100)}% · Transfert ${Math.round(levelData.transferFeeRate * 100)}% · Patience +${levelData.patienceBonus}/sem`;
  }
  if (facilityId === "training") return `Progression ×${levelData.growthMultiplier.toFixed(2)}`;
  if (facilityId === "prestige") return `Attrait +${levelData.appealBonus} · Débauchage ×${levelData.poachFactor.toFixed(2)}`;
  if (facilityId === "recruiterQuality") {
    return `Vivier : ${levelData.poolSize} pilotes/mercato · Découverte +${levelData.discoveryBonus} · Précision +${levelData.precisionBonus} · Niveau de base +${levelData.qualityFloorBonus}`;
  }
  if (facilityId === "contactNetwork") {
    return `Chance de profil élite : ${Math.round(levelData.eliteChance * 100)}%`;
  }
  return "";
}

function facilityLevelStars(level, max) {
  return "★".repeat(level) + "☆".repeat(max - level);
}

function facilityCard(state, facilityId) {
  const meta = FACILITIES[facilityId];
  const level = state.infrastructure[facilityId];
  const maxLevel = facilityMaxLevel(facilityId);
  const current = getFacilityLevelData(state, facilityId);
  const next = nextFacilityLevelData(state, facilityId);
  const repOk = !next || state.agency.reputation >= next.reputationRequired;

  const nextPreview = next
    ? `<div class="muted">Prochain palier : ${describeFacilityEffect(facilityId, next)} · Entretien ${next.upkeep.toLocaleString("fr-FR")}€/sem · Réputation requise : ${next.reputationRequired}</div>`
    : "";

  const actionButton = !next
    ? `<span class="pill">Niveau maximum</span>`
    : repOk
      ? `<button data-action="upgrade-facility" data-id="${facilityId}" class="btn-green">Améliorer (${next.upgradeCost.toLocaleString("fr-FR")}€)</button>`
      : `<button class="secondary" disabled>Réputation insuffisante (${next.reputationRequired})</button>`;

  return `
    <div class="card">
      <div class="card-head">
        <strong>${meta.name}</strong>
        <span class="pill" title="Niveau ${level}/${maxLevel}">${facilityLevelStars(level, maxLevel)}</span>
      </div>
      <div class="muted">${meta.description}</div>
      <div class="finance-figure">Actuel : ${describeFacilityEffect(facilityId, current)}</div>
      <div class="muted">Entretien ${current.upkeep.toLocaleString("fr-FR")}€/sem</div>
      ${nextPreview}
      <div class="card-actions">${actionButton}</div>
    </div>`;
}

function shopCard(state, item) {
  const owned = item.type === "multiplier" && state.purchasedUpgrades.includes(item.id);
  const cooldown = item.cooldownWeeks ? shopCooldownRemaining(state, item.id) : 0;
  const effect =
    item.type === "flat" ? `Réputation +${item.reputationBonus}` : `Réputation gagnée ×${item.reputationMultiplier}`;
  let actionHtml;
  if (owned) {
    actionHtml = `<span class="pill">Déjà acheté</span>`;
  } else if (cooldown > 0) {
    actionHtml = `<button class="secondary" disabled>Disponible dans ${cooldown} sem.</button>`;
  } else {
    actionHtml = `<button data-action="buy-shop-item" data-id="${item.id}">Acheter</button>`;
  }
  return `
    <div class="card">
      <div class="card-head">
        <strong>${item.name}</strong>
        <span class="pill">${item.cost.toLocaleString("fr-FR")}€</span>
      </div>
      <div class="muted">${item.description}</div>
      <div class="finance-figure">${effect}</div>
      <div class="card-actions">${actionHtml}</div>
    </div>`;
}

function breakdownRows(list, windowLabel) {
  return list.length
    ? list.map((e) => `<tr><td>${e.label}</td><td>${e.total.toLocaleString("fr-FR")}€</td></tr>`).join("")
    : `<tr><td class="muted" colspan="2">Rien sur ${windowLabel}.</td></tr>`;
}

const FINANCE_WINDOWS = {
  "10": { label: "10 semaines", weeks: 10 },
  season: { label: "1 saison", weeks: SEASON_WEEKS },
  all: { label: "Tout", weeks: null },
};

// Controls how many weeks each bar-chart column groups together — independent from
// FINANCE_WINDOWS, which only controls how far back the window looks.
const FINANCE_GRANULARITIES = {
  week: { label: "Semaine", weeks: 1 },
  month: { label: "Mois", weeks: 4 },
  season: { label: "Saison", weeks: SEASON_WEEKS },
};

function financeWindowToggle(state) {
  const current = state.ui.financeWindow ?? "10";
  return `<div class="tabs">${Object.entries(FINANCE_WINDOWS)
    .map(([key, w]) => `<button class="tab ${current === key ? "active" : ""}" data-action="finance-window" data-id="${key}">${w.label}</button>`)
    .join("")}</div>`;
}

function financeGranularityToggle(state) {
  const current = state.ui.financeGranularity ?? "week";
  return `<div class="tabs">${Object.entries(FINANCE_GRANULARITIES)
    .map(([key, g]) => `<button class="tab ${current === key ? "active" : ""}" data-action="finance-granularity" data-id="${key}">${g.label}</button>`)
    .join("")}</div>`;
}

function tooltipLine(label, amt) {
  return `<div class="chart-tooltip-line"><span>${label}</span><span>${amt >= 0 ? "+" : ""}${Math.round(amt).toLocaleString("fr-FR")}€</span></div>`;
}

// "Saison" buckets align with the topbar's own "An X" year counter (Math.ceil(week /
// SEASON_WEEKS)) rather than any single category's championship year, since finance tracking
// is agency-wide and categories roll over their seasons independently of each other.
function bucketTitleLabel(bucket, granularityKey) {
  if (granularityKey === "season") {
    const yearStart = Math.ceil(bucket.startWeek / SEASON_WEEKS);
    const yearEnd = Math.ceil(bucket.endWeek / SEASON_WEEKS);
    return yearStart === yearEnd ? `An ${yearStart}` : `An ${yearStart} à ${yearEnd}`;
  }
  return bucket.startWeek === bucket.endWeek ? `Semaine ${bucket.startWeek}` : `Semaines ${bucket.startWeek} à ${bucket.endWeek}`;
}

function bucketAxisLabel(bucket, granularityKey) {
  if (granularityKey === "season") return `An ${Math.ceil(bucket.startWeek / SEASON_WEEKS)}`;
  return bucket.startWeek === bucket.endWeek ? `S${bucket.startWeek}` : `S${bucket.startWeek}-${bucket.endWeek}`;
}

function bucketBreakdownTooltip(state, bucket, titleLabel) {
  const income = {};
  const expenses = {};
  for (const tx of state.transactions) {
    if (tx.week < bucket.startWeek || tx.week > bucket.endWeek) continue;
    const label = TRANSACTION_LABELS[tx.type] ?? tx.type;
    const target = tx.amount >= 0 ? income : expenses;
    target[label] = (target[label] ?? 0) + tx.amount;
  }
  const incomeLines = Object.entries(income).map(([label, amt]) => tooltipLine(label, amt));
  const expenseLines = Object.entries(expenses).map(([label, amt]) => tooltipLine(label, amt));
  return `
    <div class="chart-tooltip-title">${titleLabel}</div>
    <div class="chart-tooltip-section"><b>Recettes</b>${incomeLines.join("") || `<div class="muted">Aucune</div>`}</div>
    <div class="chart-tooltip-section"><b>Dépenses</b>${expenseLines.join("") || `<div class="muted">Aucune</div>`}</div>`;
}

function loanSection(state) {
  const loan = state.agency.loan;
  if (loan) {
    return `
      <div class="propose-box">
        <h3>Prêt en cours</h3>
        <p class="muted">Restant dû : <b>${loan.totalOwed.toLocaleString("fr-FR")}€</b> · Remboursement : <b>${loan.weeklyPayment.toLocaleString("fr-FR")}€/semaine</b> (prélevé automatiquement).</p>
      </div>`;
  }
  if (state.agency.money >= LOAN_ELIGIBLE_THRESHOLD) {
    return `
      <div class="propose-box">
        <h3>Prêt</h3>
        <p class="muted">Disponible uniquement en cas de trésorerie critique (sous ${LOAN_ELIGIBLE_THRESHOLD.toLocaleString("fr-FR")}€).</p>
      </div>`;
  }
  const monthOptions = LOAN_DURATION_MONTHS_OPTIONS.map(
    (m) => `<option value="${m}" ${m === 12 ? "selected" : ""}>${m} mois (${loanWeeksForMonths(m)} sem.)</option>`
  ).join("");
  return `
    <div class="propose-box">
      <h3>Emprunter</h3>
      <p class="muted" title="Le prêt est remboursé automatiquement chaque semaine jusqu'à extinction. Un seul prêt actif à la fois.">Trésorerie critique — un prêt est possible pour éviter le blocage. Total à rembourser : montant × 1,25, étalé sur la durée choisie.</p>
      <label class="invest-line" title="Montant emprunté, versé immédiatement. Plafonné pour éviter d'en faire un outil de croissance plutôt qu'une bouée de secours (plafond relevé quand l'effectif est à 0, pour financer une vraie reconstruction).">
        Montant
        <input type="number" min="0" max="${loanMaxAmount(state)}" step="500" data-role="loan-amount" value="${loanMaxAmount(state)}" />
        €
      </label>
      <label class="invest-line" title="Durée de remboursement — plus elle est courte, plus la mensualité prélevée chaque semaine est élevée.">
        Durée
        <select data-role="loan-months">${monthOptions}</select>
      </label>
      <button data-action="take-loan" class="secondary">Emprunter</button>
    </div>`;
}

export function renderFinances(state) {
  const windowKey = state.ui.financeWindow ?? "10";
  const windowLabel = (FINANCE_WINDOWS[windowKey] ?? FINANCE_WINDOWS["10"]).label;
  const weeks = (FINANCE_WINDOWS[windowKey] ?? FINANCE_WINDOWS["10"]).weeks ?? state.week;

  const granularityKey = state.ui.financeGranularity ?? "week";
  const granularity = FINANCE_GRANULARITIES[granularityKey] ?? FINANCE_GRANULARITIES.week;

  // The summary cards always show the single most recent week, independent of the bar
  // chart's chosen granularity (a "Saison" chart shouldn't change what "cette semaine" means).
  const weeklyBuckets = aggregatedTotals(state, weeks, 1);
  const lastWeekTotals = weeklyBuckets[weeklyBuckets.length - 1] ?? { income: 0, expenses: 0 };
  const { income, expenses } = breakdownByType(state, weeks);

  const buckets = aggregatedTotals(state, weeks, granularity.weeks);
  const balancePoints = state.financeHistory.map((h) => ({ value: h.balance, label: `S${h.week}` }));
  const barSeries = buckets.map((bucket) => ({
    label: bucketAxisLabel(bucket, granularityKey),
    income: bucket.income,
    expenses: bucket.expenses,
    tooltip: bucketBreakdownTooltip(state, bucket, bucketTitleLabel(bucket, granularityKey)),
  }));
  const netTrend = buckets.map((bucket) => ({ value: bucket.income - bucket.expenses }));

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

    ${loanSection(state)}

    <h3>Trésorerie dans le temps</h3>
    <div class="chart-card">${lineChart(balancePoints)}</div>

    <h3>Recettes vs dépenses (${windowLabel} · par ${granularity.label.toLowerCase()})</h3>
    ${financeWindowToggle(state)}
    ${financeGranularityToggle(state)}
    <div class="chart-card">
      ${barChart(barSeries, { trend: netTrend })}
      <div class="chart-legend"><span class="legend-swatch good"></span>Recettes<span class="legend-swatch danger"></span>Dépenses<span class="legend-swatch accent"></span>Tendance nette</div>
    </div>

    <h3>Ventilation (${windowLabel})</h3>
    <div class="standings-grid">
      <div>
        <h3>Recettes</h3>
        <table class="table"><tbody>${breakdownRows(income, windowLabel)}</tbody></table>
      </div>
      <div>
        <h3>Dépenses</h3>
        <table class="table"><tbody>${breakdownRows(expenses, windowLabel)}</tbody></table>
      </div>
    </div>`;
}

// Simpler than facilityCard — no reputation gate at all, purely money-gated (see lifestyle.js).
// No upkeep either : each purchase is a one-time cost that also grants +1 réputation.
function lifestyleCard(state, id) {
  const meta = LIFESTYLE[id];
  const level = state.lifestyle[id];
  const maxLevel = lifestyleMaxLevel(id);
  const current = getLifestyleLevelData(state, id);
  const next = nextLifestyleLevelData(state, id);
  const canAfford = !next || state.agency.money >= next.upgradeCost;

  const nextPreview = next
    ? `<div class="muted">Prochain palier : ${next.label} · Réputation +1</div>`
    : "";

  const actionButton = !next
    ? `<span class="pill">Niveau maximum</span>`
    : `<button data-action="upgrade-lifestyle" data-id="${id}" class="${canAfford ? "btn-green" : "secondary"}" ${canAfford ? "" : "disabled"}>Améliorer (${next.upgradeCost.toLocaleString("fr-FR")}€)</button>`;

  return `
    <div class="card">
      <div class="card-head">
        <strong>${meta.name}</strong>
        <span class="pill" title="Niveau ${level}/${maxLevel}">${facilityLevelStars(level, maxLevel)}</span>
      </div>
      <div class="muted">${meta.description}</div>
      <div class="finance-figure">Actuel : ${current.label}</div>
      ${nextPreview}
      <div class="card-actions">${actionButton}</div>
    </div>`;
}

function sponsorOfferCard(offer) {
  const tier = SPONSOR_TIERS.find((t) => t.id === offer.tierId);
  return `
    <div class="card">
      <div class="card-head"><strong>${offer.name}</strong><span class="pill">${tier.label}</span></div>
      <div class="finance-figure">${offer.weeklyIncome.toLocaleString("fr-FR")}€/sem</div>
      <div class="muted">Prime victoire ${offer.winBonus.toLocaleString("fr-FR")}€ · podium ${offer.podiumBonus.toLocaleString("fr-FR")}€</div>
      <div class="muted">Durée ${offer.durationWeeks} semaines</div>
      <div class="card-actions">
        <button data-action="sign-sponsor" data-id="${offer.id}" class="btn-green">Signer</button>
      </div>
    </div>`;
}

function activeSponsorCard(state) {
  const s = state.activeSponsor;
  if (!s) return `<p class="muted">Aucun sponsor sous contrat — choisis une offre ci-dessous.</p>`;
  const tier = SPONSOR_TIERS.find((t) => t.id === s.tierId);
  return `
    <div class="card">
      <div class="card-head"><strong>${s.name}</strong><span class="pill accent">${tier.label}</span></div>
      <div class="finance-figure">${s.weeklyIncome.toLocaleString("fr-FR")}€/sem</div>
      <div class="muted">Prime victoire ${s.winBonus.toLocaleString("fr-FR")}€ · podium ${s.podiumBonus.toLocaleString("fr-FR")}€</div>
      <div class="muted">${s.weeksRemaining} semaine(s) restante(s)</div>
      <div class="card-actions">
        <button data-action="terminate-sponsor" class="secondary">Résilier</button>
      </div>
    </div>`;
}

function sponsorsSection(state) {
  return `
    <h3>Sponsoring</h3>
    <div class="card-grid">${activeSponsorCard(state)}</div>
    ${
      !state.activeSponsor
        ? `<div class="card-grid">${state.sponsorPool.map((o) => sponsorOfferCard(o)).join("")}</div>`
        : ""
    }`;
}

// End-game — every team.ownedByPlayer across every category, flattened. Mirrors facilityCard's
// shape (stars, current effect, next-palier preview, gated upgrade button) since it's the same
// "discrete tiers with upkeep" pattern, just per-team instead of per-facility.
function teamOwnershipCard(state, team) {
  const category = CATEGORY_BY_ID[team.categoryId];
  const level = team.developmentLevel ?? 1;
  const revenue = teamWeeklyRevenue(team, category);
  const upkeep = teamDevelopmentUpkeep(team, category);
  const atMax = level >= MAX_TEAM_DEVELOPMENT_LEVEL;
  const nextCost = atMax ? null : teamDevelopmentUpgradeCost(team, category);
  const actionButton = atMax
    ? `<span class="pill">Niveau maximum</span>`
    : `<button data-action="upgrade-team-development" data-id="${team.id}" class="btn-green">Développer (${nextCost.toLocaleString("fr-FR")}€)</button>`;
  return `
    <div class="card">
      <div class="card-head">
        <strong>${team.name}</strong>
        <span class="pill" title="Niveau ${level}/${MAX_TEAM_DEVELOPMENT_LEVEL}">${facilityLevelStars(level, MAX_TEAM_DEVELOPMENT_LEVEL)}</span>
      </div>
      <div class="muted">${category.name}${team.subClass ? ` — ${category.classes?.find((c) => c.id === team.subClass)?.label ?? team.subClass}` : ""}</div>
      <div class="finance-figure">+${revenue.toLocaleString("fr-FR")}€/sem − ${upkeep.toLocaleString("fr-FR")}€/sem d'entretien</div>
      <div class="muted">Bonus de performance pour tous les pilotes de l'écurie : +${teamDevelopmentScoreBonus(team)}</div>
      <div class="card-actions">${actionButton}</div>
    </div>`;
}

function ownedTeams(state) {
  return Object.values(state.teams).flat().filter((t) => t.ownedByPlayer);
}

function teamOwnershipSection(state) {
  const owned = ownedTeams(state);
  if (owned.length === 0) return "";
  return `
    <h3>Mes écuries</h3>
    <div class="card-grid">${owned.map((t) => teamOwnershipCard(state, t)).join("")}</div>`;
}

export function renderInvestments(state) {
  return `
    <h2>Investissement</h2>
    <h3>Infrastructures</h3>
    <div class="card-grid">
      ${Object.keys(FACILITIES).map((id) => facilityCard(state, id)).join("")}
    </div>

    ${teamOwnershipSection(state)}

    <h3>Boutique de l'agence</h3>
    <div class="card-grid">
      ${SHOP_ITEMS.map((item) => shopCard(state, item)).join("")}
    </div>

    ${sponsorsSection(state)}

    <h3>Vie personnelle</h3>
    <div class="card-grid">
      ${Object.keys(LIFESTYLE).map((id) => lifestyleCard(state, id)).join("")}
    </div>`;
}

const NEWS_TYPES = new Set(["rival-scout-sign", "rival-poach", "recruit-established", "random-event", "sponsor-contract-ended", "academy-graduation"]);
// random-event is shared with NEWS_TYPES on purpose — an event outcome is real gameplay news
// AND a result worth detailing (per feedback: "Résultats" only ever showed race results,
// dropping every dilemma/event outcome even though those affect money/reputation/relations too).
const RESULT_TYPES = new Set(["player-result", "season-champion-driver", "season-champion-team", "random-event", "driver-trait-acquired"]);

export function renderNews(state) {
  const entries = state.log.filter((e) => NEWS_TYPES.has(e.type));
  return `
    <h2>Nouveautés</h2>
    <ul class="log">
      ${entries.length ? entries.slice(-40).reverse().map(logEntry).join("") : `<li class="muted">Pas encore d'actualité.</li>`}
    </ul>`;
}

export function renderResults(state) {
  const entries = state.log.filter((e) => RESULT_TYPES.has(e.type));
  return `
    <h2>Résultats</h2>
    <ul class="log">
      ${entries.length ? entries.slice(-60).reverse().map(logEntry).join("") : `<li class="muted">Pas encore de résultat.</li>`}
    </ul>`;
}
