import { CATEGORIES, SEASON_WEEKS, weekInSeason, SILLY_SEASON_WEEKS, WINTER_MERCATO_WEEKS } from "../game/data.js";

export const NAV = [
  { id: "mes-pilotes", label: "Mes pilotes" },
  { id: "talents", label: "Talents" },
  { id: "staff", label: "Staff" },
  { id: "finances", label: "Finances" },
  { id: "nouveautes", label: "Nouveautés" },
  {
    id: "monde",
    label: "Monde",
    children: [
      { id: "monde-pilotes", label: "Pilotes" },
      { id: "monde-championnats", label: "Championnats" },
      { id: "monde-ecuries", label: "Écuries" },
      { id: "monde-staff", label: "Staff" },
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

function renderNav(state) {
  return NAV.map((item) => {
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
  const racing = CATEGORIES.filter((c) => c.calendar.includes(weekNum)).map((c) => c.name);
  return racing.length ? `Courses cette semaine : ${racing.join(", ")}` : "Semaine calme — aucune course";
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
        <div><span class="muted">Réputation</span><br/><b>${state.agency.reputation}</b></div>
      </div>
      <button data-action="simulate" class="primary">Continuer →</button>
    </div>
    <div class="topbar-phase muted">${weekPhaseLabel(currentWeek)}</div>`;
}

function renderSidebar(state) {
  return `
    <nav class="sidebar">
      <div class="nav-list">${renderNav(state)}</div>
      <div class="sidebar-utility">
        <button data-action="save" class="secondary small">Sauvegarder</button>
        <button data-action="main-menu" class="secondary small">Menu principal</button>
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
        ${bankrupt ? `<div class="banner-danger">Trésorerie très négative — l'agence est en faillite. Lance une nouvelle partie ou renfloue les caisses.</div>` : ""}
        ${contentHtml}
      </main>
    </div>`;
}
