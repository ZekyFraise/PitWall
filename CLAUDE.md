# CLAUDE.md — Pit Wall

> **À relire en début de toute session touchant ce projet**, avant de faire quoi que ce soit.
> Lire aussi `CONTEXT.md` (état d'avancement, décisions récentes) et `TODO.md` (backlog issu
> du journal de conception de l'utilisateur) — ce fichier-ci est la référence stable (archi,
> conventions, instructions permanentes) ; les deux autres bougent vite.
> **Mets ces trois fichiers à jour** dès qu'une fonctionnalité est terminée, qu'une décision
> de design est prise, ou que l'utilisateur donne une instruction destinée à durer. Tout ce
> qui provient du journal `Choses à modifier.docx` va dans `TODO.md`, jamais ici ni dans
> `CONTEXT.md`.

## Le projet

**Pit Wall** est un jeu de gestion/agent de pilotes de sport automobile, navigateur, solo,
inspiré de Football Manager / Soccer Agent transposé au monde de la course automobile.
Le joueur dirige une **agence** qui recrute, scoute, signe et place des pilotes dans des
écuries à travers plusieurs championnats (Karting, F4, F3, F2, F1, WEC, WRC), gère son
staff, sa trésorerie et sa réputation, semaine après semaine sur des saisons de 52 semaines.

Pas de framework, pas de build lourd, priorité à l'équilibrage et aux mécaniques profondes
plutôt qu'au visuel.

## Direction future (à garder en tête, pas encore en cours)

L'utilisateur prévoit qu'à terme le jeu soit **hébergé sur un serveur, en multijoueur**, avec
**gestion de compte et sauvegarde par compte**. Aucun travail n'a démarré dans ce sens — le jeu
reste aujourd'hui solo, 100% client, persistance `localStorage` uniquement. Mais cette direction
doit influencer les choix d'architecture à venir : éviter d'ajouter des dépendances fortes et
non nécessaires à un modèle strictement local/single-player (ex. logique qui suppose un seul
joueur implicite, état global non isolable par compte) quand une alternative tout aussi simple
n'a pas ce défaut. Ne pas anticiper ou construire l'infra serveur/compte tant que ce n'est pas
explicitement demandé — juste ne pas fermer la porte inutilement.

## Stack technique

- **Vite + JavaScript vanilla**, aucun framework (pas de React/Vue/etc.)
- Rendu = **string templating** : chaque vue exporte une fonction `render*(state) -> string`
  qui retourne du HTML, injecté via `app.innerHTML = ...` dans `src/main.js`
- Interactions = **délégation d'événements** via attributs `data-action`/`data-id` sur les
  éléments, un seul `addEventListener("click", ...)` global dans `main.js` qui dispatch sur
  `target.dataset.action`
- Persistance : `localStorage` (une clé par sauvegarde, `pit-wall-save-<slotId>`)
- RNG déterministe : `mulberry32`, dérivé de `(state.seed + state.week * 7919)` via `makeRng(state)`
- `npm run dev` pour lancer le serveur local (port 5173)

## Architecture

Deux dossiers strictement séparés :

- **`src/game/`** — logique pure, aucune dépendance au DOM. Toutes les fonctions prennent
  `state` (et souvent `rng`) en paramètre et le mutent directement (pas d'immutabilité stricte).
- **`src/ui/`** — rendu HTML pur (fonctions `render*`) + `dialogs.js` (modales/toasts, seul
  endroit qui touche le DOM en dehors de `main.js`).
- **`src/main.js`** — orchestrateur : état module-level (`state`, `view`, `titleUi`), boucle
  de rendu, dispatch des actions.

**Discipline de graphe d'imports unidirectionnel** maintenue rigoureusement : `team.js`
n'importe jamais `state.js`/`standings.js`/`simulate.js`/`events.js`. Toujours vérifier le
sens des imports avant d'en ajouter un nouveau pour éviter les cycles.

### Carte des fichiers (`src/game/`)

| Fichier | Responsabilité |
|---|---|
| `data.js` | `CATEGORIES` (source de vérité unique : tier, calendrier, structure d'équipe, marques), constantes saison (52 sem), noms aléatoires, agences rivales |
| `driver.js` | Génération de pilote, 25 attributs (technique/mental/physique/discipline), `overallRating`, `reliability`, `growDriver`, `pickRaceNumber` |
| `driverStats.js` | Valeur marché, résultats de saison, classement d'un pilote |
| `team.js` | Génération des écuries (grilles, marques), `assignSeat`, `proposeToTeams`/`joinTeam`, workload multi-championnat |
| `standings.js` | Points, classements, rollover de saison |
| `simulate.js` | Simulation hebdomadaire complète (`beginWeek`/`continueWeekAfterChoice`), résultats de course, croissance, salaires |
| `rivals.js` | Agences IA, débauchage (`tickFreeAgentPoaching`, `tickBenchedDriverDecay`), `poachCompensation` |
| `events.js` | Moteur d'événements aléatoires hebdomadaires (info + choix), cooldowns, dilemme de débauchage prioritaire |
| `staff.js` | 7 rôles de staff, pool de recrutement, génération IA massive + attribution aux rivales |
| `infrastructure.js` | Bureaux/entraînement/standing, boutique agence |
| `recruit.js` | Approche de pilotes déjà établis (rivaux ou indépendants) |
| `finance.js` | Transactions, historique, plafonds (200 tx / 52 semaines) |
| `state.js` | `createNewGame`, save/load, `SCHEMA_VERSION`, scouting, signature, négociation de contrat |
| `rng.js` | `mulberry32` |

### Carte des fichiers (`src/ui/`)

| Fichier | Responsabilité |
|---|---|
| `titleScreen.js` | Écran titre, création de partie (nom + couleur) |
| `layout.js` | Coquille (topbar, sidebar, nav) |
| `render.js` | Table de dispatch `activeMenu -> render function` |
| `views/agency.js` | Mes pilotes, Talents, Staff, Finances, Nouveautés, fiche pilote |
| `views/world.js` | Monde → Pilotes (liste plate) / Championnats / Écuries / Staff |
| `charts.js` | Graphiques SVG (ligne trésorerie, barres recettes/dépenses + popup au survol) |
| `dialogs.js` | `showToast`, `showConfirm`, `showEventModal` (modale de dilemme, sans étape de confirmation) |

## Conventions à respecter

- **Français** pour tous les libellés UI ; noms de variables/fonctions en anglais (convention JS).
- **Pas de commentaires** sauf pour une contrainte non-évidente (workaround, invariant caché).
- **Bump `SCHEMA_VERSION`** (dans `state.js`) à chaque changement de forme de `state` persisté.
  Politique délibérée : **aucune migration**, les anciennes sauvegardes sont rejetées proprement
  par `loadGame`/`listSaves`. Ne jamais ajouter de shim de compatibilité.
- Les stats de relation (`agencyRelationship`, `teamRelationship`) sont clampées **0–200**
  (pas 0–100).
- `Reputation` (`state.agency.reputation`) existe depuis le début — ne pas la recréer.
- Tout nouvel événement aléatoire doit passer par le moteur de cooldown existant dans
  `events.js` (`EVENT_COOLDOWN_WEEKS = 4`) pour éviter le spam d'un même événement.
- Le dilemme de débauchage (`poach-dilemma`) est **prioritaire** dans `triggerRandomEvent` —
  il court-circuite la loterie pondérée dès qu'il est éligible, pour garantir une fenêtre de
  réaction au joueur avant un débauchage silencieux.

## Instructions permanentes de l'utilisateur

- **Vérifier systématiquement en navigateur** (Claude Browser pane) après toute modification
  UI observable : créer une partie, naviguer, vérifier console sans erreur, capture d'écran
  si pertinent.
- **Vérifier les changements d'équilibrage/logique de jeu via simulation headless** : le
  script `simulate_season.js` (racine du projet, Node pur, aucune dépendance DOM/localStorage)
  fait tourner 1-2 saisons complètes en exerçant scouting/contrats/loyauté/progression/finances
  et logue au format `[Season X - Week Y] Action: ... | Game Reaction: ... | Feedback/Balance
  Warning: ...`. Le relancer après tout changement touchant l'économie ou les événements pour
  confirmer l'absence de régression. Nettoyer les scripts de vérification ad-hoc après usage
  (garder `simulate_season.js` comme outil permanent, mais pas les scripts de test jetables).
- Sur les demandes explicitement marquées **"output raw code changes only" / "output code
  only"** : réponse minimale, pas de récapitulatif verbeux, aller droit aux diffs. Sur les
  demandes d'analyse/rapport/explication (ex. audits, simulations, "explique-moi X"), une
  réponse détaillée est attendue et appréciée — ne pas sur-compresser dans ce cas.
- Historique : au tout début du projet, l'utilisateur avait imposé des règles d'économie de
  tokens strictes (pas d'exploration non sollicitée, pas de lecture de fichier sans nom exact
  donné, jamais de réécriture complète de fichier, zéro bavardage). Ces règles n'ont jamais été
  explicitement révoquées mais l'usage réel depuis a évolué vers des demandes détaillées avec
  contexte complet et des rapports approfondis attendus en retour (simulations, audits). Rester
  généralement concis et éviter l'exploration superflue reste la bonne lecture par défaut,
  mais ne pas refuser d'explorer/expliquer quand la tâche le demande clairement.
- Toute nouvelle instruction permanente donnée à l'avenir doit être **ajoutée à cette section**
  (pas seulement retenue en mémoire de conversation), pour survivre aux redémarrages de session.

## Où trouver le reste

- **`CONTEXT.md`** — état d'avancement détaillé, historique des décisions récentes, questions
  d'équilibrage ouvertes.
- **`TODO.md`** — backlog complet issu du journal de conception de l'utilisateur (items pas
  encore faits, items faits différemment de la demande d'origine, trace des items déjà faits).
- **`Choses à modifier.docx`** — journal de conception brut de l'utilisateur (source de vérité
  historique des demandes, daté par session). `TODO.md` en est la vue actionnable ; consulter
  le `.docx` seulement si un doute existe sur le libellé ou la date exacte d'une demande.
- **`Randoms events.docx`** — spécification source des 22 dilemmes/événements aléatoires
  (déjà tous implémentés dans `events.js`).
