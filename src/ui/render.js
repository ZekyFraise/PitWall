import { renderShell } from "./layout.js";
import { renderMyDrivers, renderDriverDetail, renderStaff, renderTalents, renderFinances, renderNews } from "./views/agency.js";
import { renderWorldDrivers, renderWorldChampionships, renderWorldTeams, renderWorldStaff } from "./views/world.js";

const VIEWS = {
  "mes-pilotes": renderMyDrivers,
  "driver-detail": renderDriverDetail,
  staff: renderStaff,
  talents: renderTalents,
  finances: renderFinances,
  nouveautes: renderNews,
  "monde-pilotes": renderWorldDrivers,
  "monde-championnats": renderWorldChampionships,
  "monde-ecuries": renderWorldTeams,
  "monde-staff": renderWorldStaff,
};

export function renderApp(state) {
  const view = VIEWS[state.ui.activeMenu] ?? renderMyDrivers;
  return renderShell(state, view(state));
}
