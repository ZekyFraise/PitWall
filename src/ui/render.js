import { renderShell } from "./layout.js";
import {
  renderMyDrivers,
  renderDriverDetail,
  renderStaff,
  renderTalents,
  renderFinances,
  renderInvestments,
  renderNews,
  renderResults,
  renderCompareDrivers,
  renderCompareStaff,
} from "./views/agency.js";
import { renderWorldDrivers, renderWorldChampionships, renderWorldTeams, renderWorldStaff } from "./views/world.js";
import { renderPalmares } from "./views/palmares.js";
import { renderDev } from "./views/dev.js";

const VIEWS = {
  "mes-pilotes": renderMyDrivers,
  "driver-detail": renderDriverDetail,
  staff: renderStaff,
  talents: renderTalents,
  finances: renderFinances,
  investissement: renderInvestments,
  nouveautes: renderNews,
  resultats: renderResults,
  palmares: renderPalmares,
  "compare-drivers": renderCompareDrivers,
  "compare-staff": renderCompareStaff,
  "monde-pilotes": renderWorldDrivers,
  "monde-championnats": renderWorldChampionships,
  "monde-ecuries": renderWorldTeams,
  "monde-staff": renderWorldStaff,
  dev: renderDev,
};

export function renderApp(state) {
  const view = VIEWS[state.ui.activeMenu] ?? renderMyDrivers;
  return renderShell(state, view(state));
}
