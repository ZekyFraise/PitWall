import { CATEGORIES, SEASON_WEEKS, weekInSeason, SILLY_SEASON_WEEKS, WINTER_MERCATO_WEEKS, TRACK_STYLES } from "../game/data.js";
import { POACH_WARNING_THRESHOLD } from "../game/rivals.js";
import { championshipStanding } from "../game/driverStats.js";

export const NAV = [
  { id: "mes-pilotes", label: "Mes pilotes" },
  { id: "talents", label: "Talents" },
  { id: "staff", label: "Staff" },
  { id: "finances", label: "Finances" },
  { id: "investissement", label: "Investissement" },
  { id: "nouveautes", label: "Nouveautés" },
  { id: "resultats", label: "Résultats" },
  { id: "palmares", label: "Palmarès" },
  {
    id: "monde",
    label: "Monde",
    children: [
      { id: "monde-pilotes", label: "Pilotes" },
      { id: "monde-championnats", label: "Championnats" },
      { id: "monde-ecuries", label: "Écuries" },
      { id: "monde-staff", label: "Staff" },
      { id: "monde-academies", label: "Académies" },
    ],
  },
];

export const LOGO_SVG = `
  <svg class="logo-mark" width="30" height="30" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--panel)" stroke="var(--border)"/>
    <path d="M6 22 L16 8 L26 22" stroke="url(#pwGrad)" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <defs>
      <linearGradient id="pwGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffb020"/>
        <stop offset="1" stop-color="#ff3b30"/>
      </linearGradient>
    </defs>
  </svg>`;

function isMondeActive(state) {
  return state.ui.activeMenu.startsWith("monde-");
}

function navItems(state) {
  return state.ui.devMode ? [...NAV, { id: "dev", label: "Développeur" }] : NAV;
}

function renderNav(state) {
  return navItems(state).map((item) => {
    if (item.children) {
      const expanded = state.ui.mondeExpanded || isMondeActive(state);
      const childrenHtml = item.children
        .map(
          (c) =>
            `<button class="nav-item nav-child ${state.ui.activeMenu === c.id ? "active" : ""}" data-action="nav" data-id="${c.id}">${c.label}</button>`
        )
        .join("");
      return `
        <button class="nav-item nav-parent ${expanded ? "expanded" : ""}" data-action="nav" data-id="${item.id}">${item.label}</button>
        <div class="nav-children" style="${expanded ? "" : "display:none"}">${childrenHtml}</div>`;
    }
    const active =
      state.ui.activeMenu === item.id || (item.id === "mes-pilotes" && state.ui.activeMenu === "driver-detail");
    return `<button class="nav-item ${active ? "active" : ""}" data-action="nav" data-id="${item.id}">${item.label}</button>`;
  }).join("");
}

function weekPhaseLabel(weekNum) {
  if (WINTER_MERCATO_WEEKS.includes(weekNum)) return "Mercato hivernal";
  if (SILLY_SEASON_WEEKS.includes(weekNum)) return "Silly season";
  const racing = CATEGORIES.filter((c) => c.calendar.includes(weekNum)).map((c) => {
    const roundIndex = c.calendar.indexOf(weekNum);
    const styleLabel = TRACK_STYLES[c.roundStyles?.[roundIndex]]?.label;
    return styleLabel ? `${c.name} (${styleLabel})` : c.name;
  });
  return racing.length ? `Courses cette semaine : ${racing.join(", ")}` : "Semaine calme — aucune course";
}

// Calendar is fixed per category (category.calendar), so upcoming races are already knowable
// ahead of time — no need to wait for them to trigger. Looks 4 weeks ahead (current week
// included), never wraps into next season.
function upcomingRacesLine(currentWeek) {
  const parts = [];
  for (let offset = 0; offset < 4; offset++) {
    const w = currentWeek + offset;
    if (w > SEASON_WEEKS) break;
    const racing = CATEGORIES.filter((c) => c.calendar.includes(w)).map((c) => {
      const roundIndex = c.calendar.indexOf(w);
      const styleLabel = TRACK_STYLES[c.roundStyles?.[roundIndex]]?.label;
      return styleLabel ? `${c.name} (${styleLabel})` : c.name;
    });
    if (racing.length) parts.push(`S${w} : ${racing.join(", ")}`);
  }
  return parts.join("   •   ") || "Aucune course programmée dans les prochaines semaines.";
}

// The whole app re-renders (fresh innerHTML) on every action, which would normally restart
// the CSS scroll animation from zero each time — jarring on every click. Basing the delay on
// wall-clock time instead of element lifetime means a freshly-recreated track element still
// picks up the animation at the point it "should" be at right now, so it reads as continuous.
const TICKER_DURATION_S = 32;
function tickerAnimationDelay() {
  const elapsedS = (Date.now() / 1000) % TICKER_DURATION_S;
  return -elapsedS;
}

// A one-off substitute race offer (tickSubstituteOffers, team.js) is unprompted and time-boxed
// to a single upcoming round — worth calling out in the banner since it's easy to miss and
// expires if ignored, unlike a season-long offer the player explicitly asked for.
function exceptionalOfferLines(state) {
  return state.drivers
    .filter((d) => d.pendingSubstituteOffer)
    .map((d) => `🌟 Offre exceptionnelle pour ${d.name} — ${d.pendingSubstituteOffer.teamName} (${d.pendingSubstituteOffer.categoryName})`);
}

// A handful of at-a-glance highlights pulled from state that don't already have a persistent
// banner of their own (poachRiskLine already covers relation risk) — kept short, one line per
// condition, only shown when actually relevant.
function usefulInfoLines(state) {
  const lines = [];

  if (state.newTalentsThisWeek > 0) {
    const n = state.newTalentsThisWeek;
    lines.push(`🔍 ${n} nouveau${n > 1 ? "x" : ""} talent${n > 1 ? "s" : ""} repéré${n > 1 ? "s" : ""} cette semaine`);
  }

  const injured = state.drivers.filter((d) => (d.injuryWeeksRemaining ?? 0) > 0);
  if (injured.length > 0) lines.push(`🤕 Blessé(s) : ${injured.map((d) => d.name).join(", ")}`);

  const leaders = state.drivers.filter((d) => d.categoryId && championshipStanding(state, d).position === 1);
  if (leaders.length > 0) lines.push(`🏆 En tête du championnat : ${leaders.map((d) => d.name).join(", ")}`);

  const expiringSoon = state.drivers.filter((d) => d.contract && d.contract.weeksRemaining <= 3);
  if (expiringSoon.length > 0) lines.push(`📝 Fin de contrat proche : ${expiringSoon.map((d) => d.name).join(", ")}`);

  if (state.agency.loan) {
    lines.push(
      `🏦 Prêt en cours : ${state.agency.loan.totalOwed.toLocaleString("fr-FR")}€ restants (${state.agency.loan.weeklyPayment.toLocaleString("fr-FR")}€/sem)`
    );
  }

  return lines;
}

// Purely cosmetic flavor text — one line, picked deterministically from the seed+week so it
// doesn't change on every click, just settles into a new one each week like the rest of the
// banner. No gameplay effect whatsoever.
const EASTER_EGGS = [
  "🏁 Le drapeau à damier ne ment jamais... sauf quand il est en retard.",
  "🔧 Un ingénieur a juré que le moteur tiendrait. On le croit sur parole.",
  "🐢 Quelque part, une écurie de fin de grille rêve encore de podium.",
  "☕ Au stand, les paris amicaux sur qui cassera en premier vont bon train.",
  "📻 « Box, box, box » reste la phrase la plus stressante du paddock.",
  "🍀 Un trèfle à quatre feuilles a été aperçu près du garage n°13.",
  "🛞 Les pneus froids détestent les fausses promesses de température.",
  "📈 Quelque part, un comptable d'écurie recompte le budget carburant.",
  "🌙 Certains jurent avoir vu la Safety Car sourire cette nuit-là.",
  "🎙️ Le commentateur a encore prononcé un nom de pilote de travers.",
];

function easterEggLine(state) {
  const index = Math.abs((state.seed ^ state.week) % EASTER_EGGS.length);
  return EASTER_EGGS[index];
}

function tickerLine(state, currentWeek) {
  const segments = [upcomingRacesLine(currentWeek), ...exceptionalOfferLines(state), ...usefulInfoLines(state), easterEggLine(state)];
  return segments.join("   •   ");
}

// Persistent warning — the poach-dilemma event only fires once, then goes on cooldown, so
// without this the player has no visible signal that a driver is still at risk in between.
// Same threshold the dilemma itself uses (rivals.js), no new game logic.
function poachRiskLine(state) {
  const atRisk = state.drivers.filter((d) => (d.agencyRelationship ?? 0) < POACH_WARNING_THRESHOLD);
  if (atRisk.length === 0) return "";
  return `<div class="poach-risk-banner">⚠️ Risque de débauchage : ${atRisk.map((d) => d.name).join(", ")}</div>`;
}

// An empty roster earns nothing (no race prize, no amateur fee) while staff wages/loan payments
// keep running — proactively surfacing the two recovery levers (signCost's reconstruction
// discount, loanMaxAmount's raised ceiling, both state.js) rather than leaving the player to
// discover the situation only once the treasury has already gone deeply negative.
function noDriverBanner(state) {
  if (state.drivers.length > 0) return "";
  return `<div class="banner-danger">Aucun pilote sous contrat — l'agence ne génère plus aucun revenu de course. Les prix de signature sont réduits et le plafond d'emprunt est relevé tant que l'effectif est vide.</div>`;
}

function renderTopbar(state) {
  const year = Math.ceil(state.week / SEASON_WEEKS);
  const currentWeek = weekInSeason(state.week);
  return `
    <div class="topbar">
      <div class="brand">
        ${LOGO_SVG}
        <span class="brand-text"><span class="brand-pit">PIT</span><span class="brand-wall">WALL</span></span>
      </div>
      <div class="topbar-stats">
        <div><span class="muted">Trésorerie</span><br/><b class="${state.agency.money < 0 ? "warn" : ""}">${state.agency.money.toLocaleString("fr-FR")}€</b></div>
        <div><span class="muted">Semaine</span><br/><b>${currentWeek}/${SEASON_WEEKS} · An ${year}</b></div>
        <div><span class="muted">Réputation</span><br/><b>${Math.round(state.agency.reputation)}</b></div>
      </div>
      <button data-action="simulate" class="btn-green">Continuer →</button>
    </div>
    <div class="topbar-phase muted">${weekPhaseLabel(currentWeek)}</div>
    <div class="upcoming-ticker"><div class="upcoming-ticker-track" style="animation-delay: ${tickerAnimationDelay()}s">${tickerLine(state, currentWeek)}</div></div>
    ${poachRiskLine(state)}`;
}

function renderSidebar(state) {
  return `
    <nav class="sidebar">
      <div class="nav-list">${renderNav(state)}</div>
      <div class="sidebar-utility">
        <button data-action="save" class="secondary small">Sauvegarder</button>
        <button data-action="main-menu" class="secondary small">Menu principal</button>
        <button data-action="toggle-dev-mode" class="secondary small">Mode dev : ${state.ui.devMode ? "ON" : "OFF"}</button>
      </div>
    </nav>`;
}

export function renderShell(state, contentHtml) {
  const bankrupt = state.agency.money < -20000;
  return `
    ${renderTopbar(state)}
    <div class="shell-body">
      ${renderSidebar(state)}
      <main class="content">
        ${bankrupt ? `<div class="banner-danger">Trésorerie très négative — l'agence est en faillite. Lance une nouvelle partie ou renfloue les caisses.</div>` : noDriverBanner(state)}
        ${contentHtml}
      </main>
    </div>`;
}
