export function renderDev(state) {
  const rows = state.scoutPool
    .map(
      (d) => `
      <tr>
        <td>${d.name} <span class="id-tag">[#${d.id}]</span></td>
        <td>${d.sex}</td>
        <td>${d.age}</td>
        <td><button data-action="dev-force-sign" data-id="${d.id}" class="small">Signer gratuitement</button></td>
      </tr>`
    )
    .join("");

  const unseatedRows = state.drivers
    .filter((d) => !d.teamId)
    .map(
      (d) => `
      <tr>
        <td>${d.name} <span class="id-tag">[#${d.id}]</span></td>
        <td>${d.sex}</td>
        <td>${d.age}</td>
        <td><button data-action="dev-force-team-contract" data-id="${d.id}" class="small">Forcer un contrat</button></td>
      </tr>`
    )
    .join("");

  const uncontractedRows = state.drivers
    .filter((d) => !d.contract)
    .map(
      (d) => `
      <tr>
        <td>${d.name} <span class="id-tag">[#${d.id}]</span></td>
        <td>${d.sex}</td>
        <td>${d.age}</td>
        <td><button data-action="dev-force-agency-contract" data-id="${d.id}" class="small">Forcer un contrat</button></td>
      </tr>`
    )
    .join("");

  return `
    <h2>Développeur</h2>
    <p class="warn">Outils de test — ignorent budget, effectif et scouting. Désactivable via le
    bouton "Mode développeur" en bas de la barre latérale.</p>

    <h3>Trésorerie</h3>
    <div class="card">
      <div class="muted">Trésorerie actuelle : <b>${state.agency.money.toLocaleString("fr-FR")}€</b></div>
      <div class="card-actions">
        <button data-action="dev-add-money" data-id="10000" class="small">+10 000€</button>
        <button data-action="dev-add-money" data-id="100000" class="small">+100 000€</button>
        <button data-action="dev-add-money" data-id="1000000" class="small">+1 000 000€</button>
      </div>
    </div>

    <h3>Réputation</h3>
    <div class="card">
      <div class="muted">Réputation actuelle : <b>${state.agency.reputation}</b></div>
      <div class="card-actions">
        <button data-action="dev-add-reputation" data-id="10" class="small">+10</button>
        <button data-action="dev-add-reputation" data-id="50" class="small">+50</button>
      </div>
    </div>

    <h3>Forcer la signature d'un talent</h3>
    <div class="table-scroll">
      <table class="table">
        <thead><tr><th>Nom</th><th>Sexe</th><th>Âge</th><th>Action</th></tr></thead>
        <tbody>${rows || `<tr><td class="muted" colspan="4">Aucun talent disponible dans le vivier.</td></tr>`}</tbody>
      </table>
    </div>

    <h3>Forcer un contrat d'écurie</h3>
    <div class="table-scroll">
      <table class="table">
        <thead><tr><th>Nom</th><th>Sexe</th><th>Âge</th><th>Action</th></tr></thead>
        <tbody>${unseatedRows || `<tr><td class="muted" colspan="4">Tous les pilotes de l'agence ont déjà un contrat d'écurie.</td></tr>`}</tbody>
      </table>
    </div>

    <h3>Forcer un contrat d'agence</h3>
    <div class="table-scroll">
      <table class="table">
        <thead><tr><th>Nom</th><th>Sexe</th><th>Âge</th><th>Action</th></tr></thead>
        <tbody>${uncontractedRows || `<tr><td class="muted" colspan="4">Tous les pilotes de l'agence ont déjà un contrat.</td></tr>`}</tbody>
      </table>
    </div>`;
}
