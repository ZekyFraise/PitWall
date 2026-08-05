# TODO.md — Backlog issu de « Choses à modifier.docx » + demandes en chat

> Tout ce qui provient du journal de conception de l'utilisateur (`Choses à modifier.docx`)
> vit ici, pas dans `CLAUDE.md`/`CONTEXT.md`. Ce fichier est la vue « actionnable » de ce
> journal ; le `.docx` reste la source brute si un doute existe sur le libellé ou la date
> exacte d'une demande. Les items venus du chat (pas du docx) ou d'un retour externe (ami,
> `BITWALL.txt`) sont annotés comme tels.
>
> Statut par item : ✅ fait (gardé pour trace/contexte), ⏳ pas encore fait, 🔄 fait
> différemment de la demande d'origine (design qui a évolué), 🐛 bug signalé.
>
> **Organisé par catégorie** (réorganisation du 2026-07-18, remplace l'ancien classement par
> statut/source). Dans chaque catégorie, les items sont dans un ordre approximativement
> chronologique de demande.

## Pilotes & Contrats

- ✅ **Corrections issues du beta-test 5 saisons (3 runs)** *(chat, 2026-08-05)* : 3 simulations
  headless de 260 semaines (`BETA_TEST_REPORT.md`/`_2.md`/`_3.md`), politique disciplinée mais
  non triviale, ont convergé sur les mêmes schémas récurrents malgré des graines/pilotes
  totalement différents (potentiel 46 à 88) : renouvellement de contrat qui échoue presque
  toujours (2/14, 0/49, 0/31 sur les 3 runs), perte du pilote unique suivie de 45 à 155 semaines
  sans aucun pilote (jusqu'à 60% d'un run), cycle prêt d'urgence/quasi-faillite répété.
  - **Renouvellement de contrat** (`negotiateContract`, state.js) : la générosité d'un amateur
    passe d'une moyenne 50/50 salaire/indemnité à une pondération 75% salaire / 25% indemnité —
    un salaire correct pèse désormais plus qu'une grosse indemnité cash ponctuelle pour faire
    accepter un renouvellement. Nouveau paramètre `installments` (1-6, défaut 1 = comportement
    inchangé) : au-delà de 1, seul le premier versement (`transferFee/installments`, arrondi au
    supérieur) est débité/vérifié à la signature, le reste posé sur
    `driver.pendingContractInstallment` et prélevé chaque semaine par la nouvelle
    `payDriverInstallments` (même pattern que `repayLoan`, appelée juste à côté dans
    `runWeekBody`). La générosité perçue par le pilote reste basée sur le montant TOTAL, pas sur
    l'étalement — un lissage de trésorerie côté agence, pas un levier de négociation. Champ UI
    "Étaler sur X versement(s)" ajouté dans `contractNegotiationSection` (agency.js), câblé dans
    `main.js`. Solde restant affiché sur la fiche pilote (`contractLabel`).
  - **Reconstruction après effectif à 0** : `signCost` (state.js) applique une remise ×0.5
    supplémentaire quand `state.drivers.length === 0` — rend n'importe quel prospect scouté
    nettement plus abordable pour reconstruire, sans créer de pool/candidat spécial.
    `loanMaxAmount(state)` (state.js, remplace la constante `LOAN_MAX_AMOUNT` utilisée
    directement dans l'UI) double le plafond d'emprunt (30 000€→60 000€) dans la même situation
    — même structure de prêt, juste un plafond relevé pour financer une vraie reconstruction. Le
    dilemme "Tentative de débauchage" (`poaching-attempt`, events.js) réduit sa chance de départ
    immédiat de 20% à 5% quand c'est le SEUL pilote de l'agence (`state.drivers.length === 1`),
    en gardant la même part relative (60%) pour la branche "relation en baisse".
  - **Mise en sommeil du staff** : le débit hebdomadaire des salaires de staff (`runWeekBody`,
    simulate.js) est réduit de 50% tant que `state.drivers.length === 0` — le staff reste engagé
    (pas de licenciement forcé) mais coûte deux fois moins cher le temps de reconstruire.
  - **Bannière proactive** : nouvelle `noDriverBanner` (layout.js), même famille que la bannière
    de faillite existante (`renderShell`), affichée dès que l'effectif est vide — explique la
    situation et les deux leviers de reconstruction ci-dessus. Réutilise `.banner-danger`
    (aucune variante "warning" n'existait dans `style.css`, pas ajoutée pour un seul cas d'usage).
  - **Piste explorée mais NON retenue** : plafonner plus bas le multiplicateur ×1.6 de la
    contre-offre de renouvellement (`counterOfferDemandFactor`, state.js) — gardée en mémoire
    pour un futur ajustement si le reweight 75/25 + l'étalement ne suffisent pas.
  - **Correction au passage** : la réputation gagnée en fin de saison selon le classement final
    du championnat (`seasonReputationBonus`/`rolloverIfNeeded`, standings.js, +10/+6/+4/+2/+1
    selon la position, hors courbe de rendement décroissant) était déjà implémentée avant cette
    session — n'apparaissait simplement presque jamais dans les 3 runs car les pilotes étaient
    rarement seated pour une saison complète. Aucune action nécessaire ici.
  - Vérifié par 2 scripts Node isolés (remise ×0.5 confirmée, `loanMaxAmount` 30k/60k selon
    effectif, versement initial + `pendingContractInstallment` posé correctement, tick
    hebdomadaire qui solde l'indemnité sur 3 semaines simulées, taux empirique de départ
    poaching-attempt 4.85%/20.31% sur 20 000 tirages pour 5%/20% attendus), par
    `simulate_season.js` (104 semaines, aucun crash, aucun nouvel avertissement), par une
    ré-exécution courte (130 semaines) de la politique du run 2 sur SA PROPRE graine — 0/49
    renouvellements devenus 1/1, semaines sans pilote ramenées à 23% de la fenêtre contre plus de
    60% avant — et en navigateur (bannière affichée sur partie fraîche à effectif 0, champ
    "Étaler sur" fonctionnel avec débit du premier versement seul et solde qui diminue semaine
    après semaine sur la fiche pilote, aucune erreur console).
- ✅ **Négociation à la signature d'un pilote, en fenêtre superposée** *(chat, 2026-08-04)* :
  "lors du recrutement engager une phase de négociation avec le pilote" + "chaque phase de
  négociation sera dans une fenêtre qui se met en superposition du jeu". Direction validée :
  même moteur que la renégociation de contrat (`negotiateContract`). Nouvelle
  `negotiateSigning` (state.js) — l'ancien prix fixe (`signCost`) devient une simple offre de
  départ ; probabilité d'acceptation déterministe selon le ratio offre/`signCost`
  (`generosity`, formule `0.75 + (generosity-1)*1.2`, clamp 5-97%) via `makeRng(state)`, pas de
  `negotiationPatience` (pas de relation préexistante avec un pur prospect). Un refus renvoie
  une contre-offre chiffrée que le joueur peut reprendre directement. `signDriver` (instantané,
  coût fixe) conservé tel quel mais réservé au mode dev (`dev-force-sign`) — toute signature
  normale passe désormais par la négociation. `finalizeSigning` factorise la logique commune
  (contrat/scoutPool/roster) entre les deux chemins. Nouvelle `showNegotiationModal`
  (dialogs.js) — fenêtre modale superposée (pas un panneau inline comme le reste des écrans),
  reste ouverte sur un refus en affichant le message + la contre-offre pré-remplie pour
  réessayer sans fermer/rouvrir. Câblée sur l'action `"sign"` existante (main.js) — les 3 points
  d'entrée UI (Talents, fiche prospect, vivier d'académie) en bénéficient sans changement
  supplémentaire. Mode dev (`force`) court-circuite entièrement la négociation, comme toutes
  les autres actions. Vérifié par script Node isolé (offre à 30% du prix quasi toujours
  refusée avec contre-offre cohérente, offre à 150% acceptée, offre au prix exact ~75% de
  réussite sur 100 essais, mode force gratuit et instantané) et en navigateur (fenêtre ouverte
  au clic sur "Signer", refus réel avec contre-offre affichée et pré-remplie, acceptation reelle
  avec pilote ajouté au roster et trésorerie débitée, aucune erreur console).
- ✅ **Historique de carrière cohérent pour les recrues déjà expérimentées** *(chat,
  2026-08-04)* : "pilotes recrutés dans Talents n'est pas forcément leur première saison
  all time" — un pilote généré au-delà de l'âge de début (16-19 ans, la branche "vétéran
  libre" 20-33 ans de `refillScoutPool`) démarrait avec `highestTierReached: 0` et
  `seasonHistory: []` comme n'importe quel débutant. Précision demandée en cours de
  clarification : cohérence totale, ex. "s'il a roulé chez Nordwind en Karting deux saisons
  avant son recrutement, il doit apparaître chez Nordwind en Karting deux saisons avant dans
  les classements". Nouvelle `fabricatePriorCareer` (state.js, câblée dans
  `pushScoutedProspect`) — pour tout prospect `age > 19` : parcours simplifié
  karting→F4→F3 (plafonné à F3/tier 2 — un agent libre disponible n'a plausiblement jamais
  percé au niveau pro), 1-3 saisons fabriquées avec une **vraie équipe existante** tirée de
  `state.teams` à chaque étape (jamais un nom inventé), niveau/valeur passés cohérents avec
  leurs stats actuelles (formule inspirée de `driverMarketValue`, projetée en arrière avec une
  décroissance par année). `highestTierReached` mis à jour en conséquence, donc le pilote est
  immédiatement proposable au bon palier après signature au lieu de repartir de zéro.
  **Portée volontairement limitée** (arbitrage coût/valeur assumé, communiqué à l'utilisateur) :
  seul `driver.seasonHistory` (sa propre fiche) est peuplé — rien n'est injecté dans
  `state.seasonArchive`, donc ces saisons fabriquées n'apparaissent PAS si on consulte
  l'archive de classement de cette équipe/catégorie directement dans Monde ▸ Championnats
  (fabriquer une grille entière d'adversaires plausibles aurait été un chantier disproportionné
  pour ce qui reste un habillage de fiche). Le clic sur une ligne d'historique fabriquée
  affiche le message déjà existant "Détail non disponible pour cette saison" (pas de crash, pas
  de changement nécessaire — ce fallback existait déjà pour les saisons antérieures au suivi
  manche par manche). Vérifié par script Node isolé (toutes les équipes citées existent
  réellement dans `state.teams`, seuls les >19 ans ont un historique, saisons en ordre
  chronologique croissant) et en navigateur (pilote de 22 ans signé en mode dev, table
  "Historique" affichant 2 saisons Karting cohérentes avec de vraies écuries, colonne
  "Classement préc." de "Mes pilotes" correctement alimentée par la dernière saison fabriquée),
  aucune erreur console.
- ✅ **Le scouting révèle souvent les mêmes super stats** *(chat, 2026-08-04)* : direction
  validée = garantir la couverture plutôt qu'ajouter de la variance par recruteur.
  `generateScoutReveal` (scoutReveal.js) réserve désormais un attribut tiré aléatoirement dans
  CHACUN des 5 groupes `SUPER_STATS` avant de compléter le reste du budget de révélation au
  hasard parmi les attributs restants — un recruteur faible ne laisse plus un super stat
  entièrement "?" la plupart du temps. `SCOUT_MIN_REVEAL` remonté de 4 à 5 (cohérence avec les
  5 super stats à couvrir au minimum). Vérifié par script Node isolé (0 super stat totalement
  vide sur 500 pilotes avec le recruteur le plus faible possible, contre une majorité de super
  stats vides avant ce fix).
- ✅ **Académies de pilote** *(chat, 2026-08-03)* : nouveau fichier `src/game/academies.js` —
  6 académies générées à la création de partie (`generateAcademies`), 2 par programme phare
  (F1, WEC Hypercar, WRC — les 3 catégories "marquee" précisées par l'utilisateur), chacune
  liée à UNE équipe existante distincte tirée aléatoirement (`Académie ${team.name}`). ~15% des
  jeunes prospects (`age <= 19`) générés en vivier reçoivent un `driver.academyId`
  (`maybeTagAcademyProspect`, câblé dans `pushScoutedProspect`, `state.js`). Relation
  agence↔académie (`state.academyRelationships`, défaut 50, clamp 0-200) — même pattern que
  `agencyTeamRelationship` (team.js) : recruter un prospect affilié coûte un surcoût
  (`academySignSurchargeFactor`, ×1.0 à ×1.6 selon la relation, branché dans `signCost`,
  state.js) et fait baisser la relation de -10 à la signature (`onAcademyProspectSigned`) — un
  vrai débauchage de leur pipeline. Nouvelle action "Financer le programme jeunes" (6 000€,
  +15 relation, cooldown 6 sem. — leçon tirée de l'exploit "Campagne PR" déjà documenté plus
  bas, jamais de bonus de relation ré-achetable sans limite). **Objectif de placement** (précisé
  par l'utilisateur : "leur objectif est de placer leurs jeunes dans leurs programmes phares") :
  simplifié volontairement pour cette première passe — pas de simulation complète d'un pipeline
  multi-saisons, juste un tick hebdomadaire (`tickAcademyGraduation`, 1.5%/semaine/prospect
  affilié non signé) qui retire le prospect du vivier avec un log flavor ("rejoint le programme
  phare de l'Académie X") s'il n'a pas été recruté à temps — crée la tension "agis avant qu'ils
  partent" sans construire une vraie mécanique de placement progressif (jugé hors scope pour v1).
  UI : nouvel onglet "Monde ▸ Académies" (`renderWorldAcademies`, world.js, calqué sur
  `renderWorldTeams`) listant les 6 académies avec pastille de relation, leurs prospects
  affiliés et le bouton de financement ; badge 🎓 avec tooltip sur toute carte/ligne de
  prospect affilié dans Talents (`academyBadge`, agency.js). `SCHEMA_VERSION` 28→29
  (`state.academies`/`academyRelationships`/`academyFundCooldowns`, nouvel état de premier
  niveau). Vérifié par script Node isolé (6 académies sur 6 équipes distinctes, ~15.5% de
  prospects tagués sur 200 tirages, surcoût qui baisse après financement forcé, relation -10
  exacte à la signature, cooldown qui bloque un second financement, graduation confirmée sur
  vivier gonflé) et en navigateur (partie fraîche, onglet Académies affiché, jeune affilié
  scouté puis signé avec prix majoré affiché, relation qui tombe de 50 à 40 après signature,
  aucune erreur console).
  - ✅ **Garde-fou talent/âge sur le tag académie** *(chat, 2026-08-04)* : "il n'y a que des
    jeunes talentueux, un mauvais/vieux pilote ne peut pas être dans une académie ou alors il a
    beaucoup d'argent". `maybeTagAcademyProspect` ajoute un seuil `potentiel >= 70` en plus de
    `age <= 19` (chance ~15% inchangée) pour le tag normal, plus une exception rare (~1.5%,
    `PAY_DRIVER_CHANCE`) qui s'applique à N'IMPORTE QUEL profil (vieux, faible potentiel) —
    flavor "pilote payant"/famille fortunée, sans modéliser de vraie économie de richesse
    pilote. Vérifié par script Node isolé sur 20 000 tirages (15.0% chez les jeunes talentueux,
    1.48% chez les autres, conformes aux taux attendus).
- ✅ **Super statistiques — remodelage de l'indice de performance** *(chat)* : refonte
  mécanique complète (choisie explicitement par le joueur, pas juste un habillage
  d'affichage). Les 32 attributs bruts (`ATTRIBUTE_META`) restent la couche de génération/
  progression/scouting (préserve la profondeur du scouting par attribut et la dérive
  individuelle voulue dans `generateDriver`), mais 5 nouvelles super stats
  (`SUPER_STATS`/`superStat`, `driver.js`) — Rythme, Régularité, Résistance, Adaptabilité,
  Instinct, chacune une moyenne de 5-6 attributs bruts — deviennent les vrais inputs :
  `overallRating`/`reliability` gardent leur nom/signature mais sont entièrement recalculées
  à partir des super stats au lieu de l'ancienne moyenne technique/mental/physique/discipline,
  ce qui propage le changement à TOUT ce qui les consomme (score de course, valeur marchande,
  coût de baquet, négociation, débauchage, progression) sans toucher ces fichiers. Pondération
  par catégorie (circuit/endurance/rallye) conservée, juste redistribuée sur les nouvelles
  stats (`OVERALL_WEIGHTS_BY_PROFILE`). `simulate.js` : réduction de DNF en endurance basée
  sur la nouvelle stat Résistance au lieu du seul attribut brut isolé. UI (`agency.js`) : les
  5 super stats affichées avec tooltip listant leurs attributs composants (Talents, fiche
  pilote non signée, comparaison), même gating scouté/non-scouté que l'existant. Aucun bump
  de schéma (seules les fonctions de calcul changent, pas la forme des données). Vérifié par
  16 tests Node isolés (profil "pointu" vs équilibré, différenciation par catégorie, simulation
  sans erreur) et en jeu (Talents, fiche pilote signée/attributs, Mes pilotes).
  - ✅ **"Mes pilotes" — afficher les super stats sur la fiche détaillée d'un pilote signé**
    *(chat)* : `renderDriverDetail` (agency.js) branche désormais un encart dédié pour les
    super stats — mêmes fiches concernées : signée (`renderDriverDetail`) et non signée
    (`prospectDetail`). Passe finale demandée en chat : nouveau `superStatSection` remplace
    l'affichage en ligne (`superStatsLine`) par des barres de statistique identiques aux
    attributs classiques (`statBar`), regroupées dans un encart séparé ("Super statistiques")
    placé juste au-dessus de la carte "Attributs" — titre `<h3>` sorti de l'encart (même
    convention que "Attributs"/"Traits"/"Historique", ce qui crée aussi l'écart visuel demandé
    au-dessus, ex. avec "Chercher une écurie"), et les 5 stats réparties sur 2 colonnes en
    réutilisant la grille 2 colonnes existante de `.attributes-card`. Gating scouté/signé
    inchangé (barres vides + "?" tant que non scouté). Vérifié en jeu (1280px, fiche non
    signée et fiche signée) : titre au-dessus de l'encart, écart net avec la section
    précédente, 5 barres sur 2 colonnes (3 + 2), aucune erreur console.
- ✅ **Circuits et styles de piste influant sur la performance** *(chat)* : chaque manche a
  désormais un style (`TRACK_STYLES` dans `data.js` — Rapide, Technique, Pluvieux, Usant en
  pneus, Bagarre ; cycle fixe par index de manche, `category.roundStyles`, même logique que le
  calendrier lui-même — statique, pas semé par partie). Un bonus/malus (`styleBonus`,
  `simulate.js`) est ajouté au score de course, calculé à partir des attributs propres au
  style RELATIVEMENT au niveau technique général du pilote (donc un profil "pointu" est
  vraiment avantagé/pénalisé, un profil plat ne bouge presque pas). N'a pas attendu le
  remodelage des super statistiques — implémenté directement sur les attributs individuels
  existants. Le style de chaque manche est visible dans le libellé "Courses cette semaine"
  (topbar) et dans le journal "Résultats" pour les courses du joueur. Vérifié : un pilote
  fabriqué avec Pluie/Évitement très hauts (reste à 40) obtient une meilleure position moyenne
  qu'un pilote symétriquement faible en Pluie, spécifiquement sur les manches "Pluvieux"
  (7.8 vs 12.0 sur 4 échantillons) ; vérification formule directe : écart de ~17 points de
  score en faveur du spécialiste sur une manche pluvieuse.
- ✅ **Traits** *(chat)* : nouveau fichier `src/game/traits.js` — 14 traits pilote
  (`DRIVER_TRAITS`, 2 par super stat : un bonus, un malus, plus quelques traits mixtes
  stats+dilemme ou dilemme seul, ex. Casse-cou/+Instinct, Pilote de pluie/+Adaptabilité,
  Charismatique/+15% sur les dilemmes médias-sponsors) et 10 traits staff (`STAFF_TRAITS`,
  bonus/malus de -5 à +7 sur la compétence principale ; 4 d'entre eux — Mentor, Vétéran, Beau
  parleur, Bon communicant — biaisent aussi certains dilemmes). Fixés à la génération
  (`assignDriverTraits`/`assignStaffTraits`, dernier champ consommant du rng pour ne pas
  décaler la séquence existante) : 0-2 traits pour un pilote (~20/65/15%), 0-1 pour le staff.
  Cachés pour un pilote non signé jusqu'au scouting approfondi (`scoutReveal.traitsKnown`,
  même convention que `potentialKnown`), visibles sans condition pour un pilote signé et pour
  tout le staff (qui n'a aucun système de scouting). `superStat` (`driver.js`) applique le
  bonus de stat avec clamp [0,99] — `overallRating`/`reliability` en héritent automatiquement.
  `bestSkill` (`staff.js`) applique le bonus de compétence avec le même clamp. `resolveEventChoice`
  (`events.js`) décale `option.successChance` de la somme du biais du pilote concerné ET de
  TOUT le staff engagé (un dilemme ne cible jamais un membre du staff, qui agit donc comme un
  soutien global plutôt que l'acteur direct) — les deux sources s'additionnent. UI : 3 sites
  remplacent le stub "Aucun trait pour l'instant" (`prospectDetail`, `renderDriverDetail`,
  `compareDriverColumn`, avec le même gating que le potentiel dans chacun), `staffCard`
  (agence) et `renderWorldStaff` (Monde ▸ Staff, nouvelle colonne) affichent les traits de
  staff sans condition. Aucun bump de `SCHEMA_VERSION` (champs additifs `traits`/`traitsKnown`,
  backfillés par `?? []`/optional chaining, même convention que `seasonArchive`/
  `championsHistory`). Vérifié par ~6000 assertions Node isolées (distribution des traits,
  bonus de super stat clampé, bonus de compétence clampé, biais pilote sur `resolveEventChoice`,
  biais staff global + cumul des deux) et en jeu (fiche non signée avant/après scouting
  approfondi, fiche signée, comparaison, carte Staff, Monde ▸ Staff), aucune erreur console.
  - ✅ **Tooltip détaillé (stat + montant)** *(chat)* : le tooltip de chaque trait affiche
    désormais explicitement l'effet mécanique en plus de la description — `driverTraitTooltip`/
    `staffTraitTooltip` (`traits.js`) ajoutent "Rythme +4", "Compétence principale +5", ou
    "Dilemme « Négociation salariale » +10%" selon `statEffects`/`skillBonus`/`eventBias`.
    Bug trouvé et corrigé au passage : les noms de dilemme étaient entourés de guillemets
    droits (`"..."`) alors que le tooltip est injecté dans un attribut HTML `title="..."` —
    un guillemet droit fermait prématurément l'attribut et tronquait/corrompait le tooltip
    (repéré sur "Mentor" en jeu). Remplacé par des guillemets français (« »). Vérifié en jeu :
    tooltip complet et bien formé sur une pilule de trait pilote et une pilule de trait staff,
    aucune erreur console.
  - ✅ **Traits acquis dynamiquement en cours de carrière** *(chat)* : 6 des 15 traits pilote
    marqués `acquirable: true` (`traits.js`) — comportementaux, façonnés par l'expérience
    (`leader`, `steelNerves`, `cautious`, `hotHead`, `timid`, `charismatic`) — les 9 autres
    restent générés-uniquement ("irremplaçables", talent physique/style de pilotage). Nouveau
    `driver.acquiredTraitIds` trace lesquels des `driver.traits` ont été obtenus dynamiquement
    (additif). `checkSeasonTraitMilestone` (traits.js), branché dans `rolloverIfNeeded`
    (standings.js) juste après le calcul déjà existant de `wins`/`podiums`/`races`/`position` par
    saison — au plus un trait par pilote joueur par saison, seuil atteint en premier qui tente
    son jet : ≥3 victoires → `leader` (40%) ; saison quasi-parfaite (podiums≥5, races-podiums≤1)
    → `steelNerves`/`cautious` en alternance (35%) ; saison ratée (0 podium, position dans le
    dernier tiers) → `hotHead` (agressivité haute) ou `timid` (agressivité basse) (35%) ;
    `agencyRelationship`≥160 → `charismatic` (25%). `races<6` exclut les saisons trop courtes.
    `grantAcquiredTrait` (traits.js) plafonne à 2 traits comme la génération — si complet, évince
    le plus ANCIEN trait ACQUIS (jamais un trait inné, qui reste irremplaçable ; si les 2 slots
    sont innés, aucune place, rien n'est évincé). Scope volontairement limité à `state.drivers`
    (pilotes joueur) — `rolloverIfNeeded` ne calcule ces stats que pour eux aujourd'hui, étendre
    aux pilotes IA aurait été un scope nouveau non demandé. UI (`agency.js`) : nouvelle entrée de
    log `driver-trait-acquired` ("X développe un nouveau trait : Y (remplace Z)") suivant le même
    chemin que les annonces de champion de saison ; `traitsSection` marque un trait acquis d'un
    préfixe 🌱 + précision dans le tooltip pour le distinguer d'un trait inné. Pas de bump
    `SCHEMA_VERSION` (champ additif). Vérifié par 20 tests Node isolés (octroi/éviction FIFO,
    chaque seuil de milestone, intégration `rolloverIfNeeded` sur pilote joueur dominant vs
    pilote IA ignoré) et en jeu (entrée de log correcte y compris le cas remplacement, pilule 🌱
    + tooltip sur la fiche pilote, trait inné jamais marqué/évincé), aucune erreur console.
- ✅ **Équilibrer la progression de stats** *(chat)* : `growDriver` (`driver.js`) combine
  désormais 3 facteurs au lieu de la seule marge `growthCeiling - rating` : la marge restante
  (inchangée), un `ageFactor` (proximité de l'âge de peak — la progression est la plus rapide
  tôt en carrière et se réduit progressivement à l'approche du peak, plafonné à 1.3x à 10 ans+
  du peak, plancher à 0.3x juste avant, au lieu d'un rythme plat jusqu'à la coupure), et un
  `potentialFactor` (un pilote à fort potentiel apprend un peu plus vite en plus d'avoir un
  plafond plus haut, ~0.97x à ~1.15x selon le potentiel). Le déclin après le peak (`age >
  peak + 3`) reste inchangé (la demande portait sur "la montée en niveau", pas le déclin).
  Vérifié par 4 tests Node isolés (jeune pilote progresse plus vite qu'un pilote proche du
  peak à marge égale, fort potentiel progresse plus vite à marge/âge égaux, progression
  toujours nulle pile à l'âge de peak, valeurs bornées [0,99] sur 200 semaines) et par une
  simulation de 300 semaines sans erreur (des centaines de pilotes IA/joueur).
  - ✅ **Refaire l'équilibrage de la progression des pilotes** *(chat)* : portée clarifiée en
    chat — deux griefs précis : progression trop rapide dans l'ensemble, et écart trop important
    entre pilotes IA et pilotes de l'agence. Deux causes distinctes trouvées et corrigées :
    (1) le taux de base de `growDriver` (`driver.js`) était calibré pour qu'un jeune pilote à
    fort potentiel atteigne quasiment son plafond en une seule saison (confirmé par calcul : la
    croissance étant proportionnelle à la marge restante à chaque course, ~20 manches/saison
    suffisaient à consommer plus de 98% de la marge même au taux d'origine) — taux de base
    divisé par deux (0.06-0.12 → 0.035-0.07 de la marge par course) pour restaurer un vrai arc de
    progression sur plusieurs saisons ; (2) le multiplicateur cumulé entretraînement/expérience
    staff/coach (`trainingGrowthMultiplier` + `coachBonus`, infrastructure.js/simulate.js)
    pouvait atteindre ×2.39 pour une agence à fond investie contre ×1 pour l'IA — plafond du
    Centre d'entraînement réduit (1.6→1.32 au niveau max), bonus d'expérience (0.15→0.08) et
    bonus de coach (0.3→0.15) réduits de moitié chacun, ramenant l'écart maximum à ×1.64 :
    l'investissement reste payant sans donner l'impression que l'IA et le joueur ne jouent plus
    aux mêmes règles. Vérifié par tests Node isolés (plafond combiné 1.639 contre ~2.39 avant ;
    sur un pilote karting jeune/fort potentiel, après une saison réaliste de 20 manches : IA ≈80
    de niveau contre ≈88 pour une agence à fond investie, au lieu d'atteindre quasi le plafond
    dans les deux cas ; taux de base confirmé divisé par ~1.7 sur un tirage aléatoire identique)
    et par simulation complète de 300 semaines en jeu réel (28.5 → 55.1 de niveau sur ~6 saisons,
    aucune erreur). Vérifié en jeu que l'écran Investissement affiche bien les nouvelles valeurs
    (Centre d'entraînement : ×1.08 au palier suivant), aucune erreur console.
    - ✅ **Suite *(chat)* — le potentiel peut ne pas être atteint + composante aléatoire
      invisible** : `growthCeiling` (déjà un plafond réel séparé du "potentiel" affiché, jamais
      montré au joueur) élargi de 80-100% à **70-100%** du potentiel — un prospect à fort
      potentiel affiché peut désormais plafonner nettement en dessous, pas juste 0-20% en
      dessous. Nouveau champ `driver.growthLuck` (0.75-1.25, tiré une fois à la génération, dans
      `generateDriver`) : multiplicateur de rythme de progression totalement indépendant du
      plafond — deux pilotes aux stats affichées identiques peuvent progresser à des vitesses
      différentes sans qu'aucun scouting, même approfondi, ne le révèle jamais (aucune référence
      dans `src/ui`, vérifié par recherche). S'applique aux pilotes du joueur ET aux pilotes IA
      (`generateAIDriver`, team.js, hérite le champ via son appel interne à `generateDriver`).
      Vérifié par tests Node isolés (plage `growthLuck` et ratio `growthCeiling`/potentiel
      confirmés sur 500 tirages, y compris côté IA ; deux pilotes identiques sauf `growthLuck`
      divergent nettement après 2 saisons — 78.9 vs 86.7 de niveau ; un pilote "bust" simulé
      avec potentiel 90/plafond 63 plafonne à 64.6 après 10 saisons, très en dessous du potentiel
      affiché) et en jeu (écran Investissement et Talents inchangés visuellement, plusieurs
      semaines simulées sans erreur console).
      - ✅ **Suite *(chat)* — stagnation trop punitive, wonderkids, recrues plus âgées** :
        retour que le plafond 70-100% rendait un manque à gagner important (ex. 90→63) trop
        fréquent plutôt qu'exceptionnel. Distribution de `growthCeiling` refaite en deux cas au
        lieu d'un intervalle uniforme : ~92% des pilotes plafonnent maintenant à 92-100% de leur
        potentiel affiché (quasiment jamais de manque à gagner notable), ~8% seulement tombent
        dans un vrai cas "bust" (60-85%) — le manque à gagner sévère redevient l'exception, pas
        la norme. Wonderkids : nouveau jet rare (3% des pilotes ≤ 19 ans) qui débloque un
        potentiel 92-99 ; le tirage normal est plafonné à 88 pour que ce palier élite reste
        réellement rare (sans ce plafond, le tirage uniforme 40-99 atteignait déjà 92+ dans
        ~13% des cas, rendant le "wonderkid" banal). Même refonte appliquée à `generateAIDriver`
        (team.js) pour la cohérence IA/joueur. Recrues plus âgées : `refillScoutPool` (state.js)
        tire maintenant occasionnellement (25%) un profil 20-33 ans plutôt que systématiquement
        16-19 ans ; `generateDriver` réduit l'écart entre le niveau actuel et le potentiel en
        fonction de l'âge (un pilote plus âgé démarre bien plus proche de ce qu'il va réellement
        devenir, comme un agent libre expérimenté plutôt qu'un talent brut). Vérifié par tests
        Node isolés (taux de wonderkid 3.1% mesuré pour 3% attendu ; plafond ordinaire confirmé
        à 88 sur 20 000 tirages ; taux de bust ~7-8.6% côté joueur ET IA ; écart potentiel-niveau
        actuel réduit de 26.3 à 18.4 entre jeunes et pilotes expérimentés) et par simulation
        complète de 400 semaines sans erreur ; vérifié en jeu que le pool de recrutement affiche
        bien des âges variés (16, 17, 20, 22 observés simultanément), aucune erreur console.
        - ✅ **Suite *(chat)* — sous-estimation possible, échelle 93/94 précisée** : ajout du
          cas symétrique au "bust" — un pilote peut rarement (5%) avoir été SOUS-estimé, son
          vrai plafond dépassant alors le potentiel affiché (jusqu'à +8%, toujours borné à 99).
          Logique regroupée dans une fonction partagée `rollGrowthCeiling(potential, rng)`
          (driver.js, utilisée par `generateDriver` ET `generateAIDriver`) : ~87% normal
          (92-100% du potentiel), ~8% bust (60-85%), ~5% sous-estimé (100-108%, plafonné à 99).
          Échelle de potentiel reprécisée selon les seuils donnés : 94-99 = "extraordinaire"
          (réservé au tirage wonderkid, était 92-99), 93 = meilleure note "excellente" possible
          par tirage ordinaire (était plafonné à 88) — l'événement "Programme d'entraînement
          intensif" (`events.js`, +2 au plafond réel affiché comme "potentiel +2" au joueur)
          respecte maintenant la même frontière : plafonné à 93 pour un pilote ordinaire, jusqu'à
          99 si déjà extraordinaire à la base. Vérifié par tests Node isolés (taux wonderkid
          3.1% pour 3% attendu, plafond ordinaire confirmé à 93 sur 8000 tirages, distribution
          87/8/5% confirmée sur 20 000 tirages, sur-estimation jamais au-delà de 99 sur 5000
          tirages à potentiel 97, même distribution vérifiée côté IA) et par simulation complète
          de 300 semaines sans erreur, aucune erreur console en jeu.
- ✅ **Contre-offre + patience lors de la revalorisation du contrat agence** *(chat)* : le
  pilote a désormais une fenêtre d'exigences indicative (`contractBaseline`) et un champ
  `negotiationPatience` (0-100, régénère +3/sem) qui baisse plus vite plus l'offre s'éloigne
  de la fenêtre, gate l'acceptation, et se remet à 100 à la signature (`negotiateContract`,
  `state.js`). Primes au-delà de la fenêtre de base : toujours non implémenté (explicitement
  différé "à terme" par le TODO d'origine).
- ✅ **Négociation de contrat agence pluriannuelle** *(chat)* : `negotiateContract` prend un
  paramètre `seasons` (1-5), converti en semaines (`weeksRemaining`, reste de la saison + saisons
  supplémentaires × `SEASON_WEEKS`) au lieu d'un nombre de courses figé à la fin de saison. Un
  engagement plus long ajoute un bonus d'acceptation ; la relation agence influençait déjà le
  seuil (inchangé). Renouvellement proactif d'écurie avant fin de saison : implémenté comme un
  jet de renouvellement basé sur `teamRelationship` à chaque rollover (`standings.js`) — le
  baquet est reconduit par défaut plutôt que systématiquement résilié. Blessure : le contrat
  agence décompte désormais en semaines, de façon inconditionnelle chaque semaine (y compris
  blessé/benché) — same effet que "réduire du nombre de courses manquées" avec une unité plus
  robuste.
- ✅ **Pilote Pro — l'agence négocie pour lui, pas contre lui** *(chat)* : un pro ne reçoit
  plus de salaire hebdomadaire de l'agence (`driver-wage` supprimé) ; l'agence prend une
  commission négociée (`contract.commissionRate`) sur les gains de course à la place d'un taux
  fixe. La conversion amateur→pro en cours de contrat (passage de tier) reconvertit
  automatiquement le contrat en mode commission (`assignSeat`/`joinSecondaryChampionship`,
  `team.js`).
- ✅ **"Mes pilotes" — Fin de contrat doit référencer le contrat ÉCURIE, pas agence** *(chat)* :
  la colonne "Fin contrat" affiche désormais l'échéance du baquet (fin de saison), le contrat
  d'agence (durée en semaines/rémunération) reste sur la fiche détaillée. Le contrat d'agence
  et le baquet écurie sont désormais des cycles de vie indépendants (le contrat agence n'expire
  plus le baquet). Catégorie "—" pour un pilote sans baquet : `benchDriver` (`team.js`) nullifie
  `teamId` ET `categoryId` ensemble à chaque libération de baquet (rollover non-renouvelé).
  Bouton "Licencier" : `releaseDriver` (`state.js`), coût = 15% de la valeur marchande, -1
  réputation, confirmation obligatoire.
- ✅ **"Proposer aux équipes" — positions non actualisées** *(chat)* : `teamRankingLabel`
  dérive maintenant la bonne clé de standings via le `subClass` de l'écurie (corrige le bug
  WEC hypercar/GT3) ; `lastSeasonRank` est remis à `null` pour les écuries n'ayant marqué aucun
  point à la fin de saison (`rolloverIfNeeded`, `standings.js`) au lieu de garder un rang
  arbitrairement ancien. Tri par catégorie ajouté sur "Propositions reçues"
  (`offersSection`, `agency.js`). Écrasement de l'ancien baquet lors d'un changement d'écurie :
  confirmé sans bug après analyse détaillée de `assignSeat`/`releaseSeatAndBackfill` — aucun
  changement nécessaire.
- ✅ **Logique d'attribution des noms et du sexe** *(chat)* : `randomName` (data.js) tirait un
  prénom dans un seul pool mixte, indépendamment du `sex` du personnage (déterminé après coup
  dans `generateDriver`) — un pilote "F" pouvait s'appeler "Lucas". `FIRST_NAMES` séparé en
  `FIRST_NAMES_M`/`FIRST_NAMES_F` ; `generateDriver` calcule `sex` en premier puis appelle
  `randomName(rng, sex)`. Le staff n'a pas de champ `sex` affiché nulle part, donc
  `randomName(rng)` sans argument reste inchangé pour lui (pool combiné). Vérifié : 0 incohérence
  sur 308 pilotes générés (agence + vivier + IA).
- ✅ **Agrandir la base de prénoms/noms de famille/noms d'équipe/noms d'agence** *(chat)* :
  `FIRST_NAMES_M`/`FIRST_NAMES_F` passés de 30 (mixte) à 40+40, `LAST_NAMES` de 24 à 50,
  `NAME_PREFIXES`/`NAME_SUFFIXES` (noms d'écurie, `team.js`) de 20×9=180 à 35×13=455
  combinaisons (`data.js`/`team.js`). Noms d'agence (`RIVAL_AGENCIES`) laissés tels quels — ce
  sont 4 identités fixes et distinctes, pas un pool combinatoire à diversifier de la même façon.
- ✅ **F3 doit être Semi-Pro, pas Pro** *(chat)* : `PRO_TIER_THRESHOLD` passé de 2 à 3 (`data.js`)
  — F3 fonctionne désormais économiquement comme l'Amateur (frais de gestion, pas de commission
  sur les gains). Nouveau helper `driverStatusLabel(driver, category)` (`driver.js`) affiche
  "Semi-Pro" spécifiquement pour F3 plutôt que de la confondre avec Karting/F4 ("Amateur").
- ✅ **Second championnat — afficher position d'équipe et prix, termes entre parenthèses**
  *(chat)* : bloc "Second championnat" (fiche pilote) affiche maintenant classement d'écurie
  (`teamRankingLabel`) et prix (nouveau `secondarySeatCost` dans `team.js`, aperçu garanti
  identique au montant réellement débité) pour chaque écurie proposable, ainsi que le classement
  pilote du 2e championnat pour les engagements déjà en cours. Tableau "Mes pilotes" : colonnes
  Catégorie/Écurie/Pos. champ./Points affichent désormais les termes du 2e championnat entre
  parenthèses (`withSecondaryTerms` dans `agency.js`).
  - 🐛 ✅ *Corrigé (audit suite au fix classement WEC)* — `secondaryStanding` (agency.js) lisait
    `state.standings[categoryId]` avec la catégorie brute ; pour un 2e championnat en WEC
    (hypercar/GT3), la clé réelle est `categoryId:subClass`, donc la position/points du pilote
    restaient bloqués sur "Pas encore classé" indéfiniment. Même classe de bug que
    `teamRankingLabel`, corrigée pareil (résolution de la classe via l'écurie du 2e baquet).
    Audit du reste du code (`.class` vs `.subClass`, autres clés composites dans
    `driverStats.js`/`team.js`/`world.js`) : aucune autre occurrence trouvée. Vérifié en
    forçant un 2e baquet GT3 avec des points : "Pos. champ."/Points affichent bien P2/43 pts
    au lieu de —/0.
- ✅ **Afficher l'ID pilote sur toutes les pages où un pilote apparaît** *(chat)* : `[#id]` était
  un tag debug limité à Mes pilotes ; devenu une fonctionnalité permanente (`.debug-id` renommé
  `.id-tag`) et étendu à Talents, fiche pilote, comparaison, Monde ▸ Pilotes/Championnats/Écuries,
  menu développeur, et le journal "Nouveautés" (résultat de course).
- 🔄 **Contrat agence vs départ automatique** : une note du 11/07 disait « sans contrat, le
  pilote part de l'agence ». Comportement **explicitement inversé** ensuite suite à un bug
  report de l'utilisateur : l'expiration du contrat de courses libère seulement le baquet
  écurie, le pilote reste sous l'aile de l'agence jusqu'à un vrai débauchage ou un refus
  répété de renégociation. **Le comportement actuel du code fait foi** (`simulate.js`).
- 🔄 **Contrat, durée choisie par le joueur** : demandé initialement, puis explicitement
  simplifié par l'utilisateur (« Pour le moment mettre contrat jusque fin de saison ») — la
  durée n'est pas un champ éditable, en attendant le remodelage pluriannuel ci-dessus.
- ✅ Compétences pilote étendues (technique/mental/physique/discipline, 25 attributs).
- ✅ Colonnes détaillées « Mes pilotes » (âge, niveau, courses, victoires, podiums, position,
  points, valeur, salaire, fin de contrat, relations) + colonne Catégorie/Championnat actuel
  + colonne nom d'équipe + compteur effectif/capacité max.
- ✅ Vue détaillée d'un pilote au clic (stats, historique par saison), tooltips complets sur
  les attributs au survol.
- ✅ Flux proposition aux équipes (attendre les réponses favorables avant de choisir),
  classement de l'équipe affiché lors d'une proposition.
- ✅ Degré d'occupation / workload multi-championnat.
- ✅ Renouvellement périodique du vivier de scouting, potentiel caché révélé selon le niveau
  du recruteur, scouting à deux compétences séparées (fourchette vs nombre de caractéristiques
  révélées, remodelé plusieurs fois — voir historique de session pour le détail des formules).
- ✅ Tiers de progression sans retour en arrière.
- ✅ Loyauté haute/basse influençant l'acceptation d'offres rivales / le risque de départ ;
  pilote sans écurie mais sous contrat agence, relation qui diminue, dilemme de débauchage
  prioritaire dans le moteur d'événements.
- ✅ Négociation de contrat par le joueur (salaire, indemnité de transfert), avec clarification
  du fonctionnement (tooltips) et distinction Pro (salaire versé) / Amateur (frais perçus,
  formule de générosité inversée pour éviter l'exploit).
- ✅ Relation min 0 / max 200.
- ✅ Écran de comparaison entre pilotes (jusqu'à 4) : bouton "Ajouter/Retirer de la
  comparaison" sur la fiche détaillée d'un pilote (signé ou prospect) ; 2 pilotes → 2 colonnes
  (inchangé) ; 3 ou 4 pilotes → une colonne par pilote (3 ou 4 colonnes), catégories
  Technique/Mental/Physique/Discipline empilées verticalement dans chaque colonne ; en-tête
  de colonne avec Potentiel/Rythme/Régularité (mêmes règles de révélation par scouting que
  Talents) (`renderCompareDrivers` dans `agency.js`).
- 🐛 ✅ *Corrigé* — bug pilote déjà recruté encore visible dans Talents (filtre free-agents only).
- ✅ **Ajouter le classement de fin de saison précédente dans "Mes pilotes"** *(chat)* :
  nouvelle colonne "Classement préc." dans `renderMyDrivers` (agency.js), entre "Pos. champ." et
  "Points", colorée avec `positionColorClass` (exporté depuis world.js, réutilisé tel quel plutôt
  que dupliqué). Source : `previousSeasonPosition(driver)`, nouvelle fonction qui filtre
  `driver.seasonHistory` sur `championshipPosition != null` et prend la dernière — les lignes de
  changement d'écurie en cours de saison (`recordSeasonStint`, team.js) ont toujours
  `championshipPosition: null`, seule la ligne de fin de saison (rollover, standings.js) le
  renseigne, donc filtrer était nécessaire pour ne pas retomber sur une ligne intermédiaire.
  Affiche "—" si aucune saison terminée. Vérifié en jeu (3 pilotes de test : P1 doré, P3 bronze
  correctement retrouvé malgré une ligne de mi-saison sans classement, "—" pour un pilote sans
  historique), aucune erreur console.
- 🔍 **Investigué — "contrat écurie qui persiste" en fin de saison karting** *(chat)* : ce n'est
  PAS un bug — `rolloverIfNeeded` (`standings.js`) renouvelle chaque baquet SILENCIEUSEMENT par
  un jet de probabilité basé sur `teamRelationship/200` (design intentionnel déjà en place,
  cf. commentaire "Team seats now expire at season rollover..."). En karting (20 courses/saison,
  le plus long calendrier), `teamRelationship` grimpe suffisamment sur la saison pour rendre le
  renouvellement probable pour tous les pilotes d'une même écurie à la fois — d'où l'impression
  de bug ("même écurie, pour 20 courses") alors qu'il s'agit d'un renouvellement automatique
  réussi. Rien changé ; à clarifier si le joueur veut un signal UI explicite de "renouvelé" au
  lieu du silence actuel.
- 🐛 ✅ *Corrigé* — **pas d'offres d'écuries de niveau égal/supérieur après une saison de F4**
  *(chat)* : `benchDriver` (`team.js`) met `driver.categoryId = null`, et `listJoinableTeams`
  traitait TOUT `categoryId` nul comme "pilote jamais monté en piste" (`nextCategories(null)` =
  karting uniquement), sans distinction avec un pilote qui a déjà couru et perdu son baquet.
  Fix : `categoriesForFreeAgent` utilise désormais `driver.highestTierReached` pour retrouver le
  bon palier (tier + tier au-dessus) quand `categoryId` est nul. Ajouté aussi le repli explicite
  demandé : `proposeToTeams` ne tente une catégorie inférieure (`categoriesOneTierBelow`,
  `allowDowngrade`) que si AUCUNE offre de niveau égal ou supérieur n'a été obtenue ; l'ancien
  garde-fou anti-descente (`assignSeat`) reste actif pour tout le reste, il est juste
  explicitement contourné (`allowDowngrade`) pour cette offre de dernier recours précise
  (`joinTeam` le détecte via `pendingOffers`, jamais un contournement général). Vérifié par tests
  Node isolés (palier retrouvé après mise au chômage technique, repli déterministe si réputation
  trop basse pour le palier d'origine, seat de repli accepté sans erreur, `highestTierReached`
  toujours monotone) et en navigateur (pilote F4 mis au chômage technique injecté en jeu réel →
  "Propositions reçues" affiche Formule 3/Formule 4, plus de repli karting tant qu'une offre de
  niveau suffisant existe ; aucune erreur console).
- ✅ **Fiche détaillée cliquable depuis Monde ▸ Pilotes et Classement, avec gating scouting**
  *(chat)* : décision prise en chat — nouveau bouton "Scouter" sur la fiche read-only plutôt que
  masquage passif sans recours. `generateAIDriver` (team.js) ne force plus `scouted = true` à la
  génération (hérite du défaut `false`/`scoutReveal: null` de `generateDriver`) — un pilote IA/
  rival démarre donc non scouté, comme un prospect. Nouvelle fonction `scoutRivalDriver`
  (state.js), même mécanique que `scoutDriver` (coût `scoutCost`, `generateScoutReveal`) mais
  ciblant `state.aiDrivers` au lieu de `state.scoutPool` ; câblée via l'action `scout-rival`
  (main.js). `readOnlyDriverDetail` (agency.js) masque désormais OVR/super stats/attributs/
  traits tant que `!driver.scouted` (même convention que `prospectDetail` — traits restent
  masqués même après un scout basique, pas de "scouting approfondi" pour les rivaux dans cette
  passe). Lignes cliquables ajoutées dans le tableau Classement (`classificationBlock`, world.js
  — pas cliquable auparavant) ; OVR masqué (`?`) dans le tableau Monde ▸ Pilotes pour les IA non
  scoutées (`renderWorldDrivers`). Un pilote de l'agence du joueur (`isAI: false`) n'est jamais
  masqué. Vérifié par tests Node isolés (scout réussi/déjà scouté/pilote introuvable/budget
  insuffisant) et en jeu (fiche masquée depuis Monde▸Pilotes ET Classement, clic "Scouter" révèle
  stats et débite 400€, traits restent "inconnus" après scout basique, aucune erreur console).
  Pas fait dans cette passe : historique de saisons pour les pilotes IA (jamais enregistré,
  `driver.seasonHistory` reste vide pour eux — nécessiterait un changement plus large de
  `rolloverIfNeeded`/`recordSeasonStint` qui n'enregistrent aujourd'hui que les pilotes du joueur).
- ✅ **Réduire la facilité de trouver une écurie** *(chat)* : `proposeToTeams` (team.js)
  acceptait beaucoup trop de candidatures par proposition (jusqu'à 30+ offres en une fois) —
  formule resserrée : base 0.5→0.25, diviseur 55→50 (l'écart niveau/prestige compte davantage),
  plancher 0.05→0.03, plafond 0.95→0.85 (plus jamais un "accepté garanti"). Un pilote nettement
  au-dessus du prestige d'une écurie continue de décrocher un baquet de façon fiable ; un pilote
  moyen se retrouve avec une poignée d'offres au lieu d'une liste écrasante. Vérifié par test
  Node isolé (15 essais/profil : pilote moyen ~5 offres en moyenne contre ~35 avant, pilote fort
  ~20, pilote faible ~3, jamais zéro) et en jeu (pilote frais ~10 offres contre des dizaines
  avant, aucune erreur console).
- ✅ **Filtre + expiration automatique des propositions reçues** *(chat)* : `offersSection`
  (agency.js) gagne des tabs "Toutes" + une par catégorie effectivement proposée (même principe
  que `categoryTabs` de Monde ▸ Championnats, mais scopé au lot d'offres du pilote plutôt qu'à
  toutes les catégories du jeu) — état dans `state.ui.offersFilterCategoryId`, action
  `filter-offers-category` (main.js), réinitialisé en entrant/sortant d'une fiche pilote. Nouveau
  champ `driver.offersExpireAt` (driver.js, additif) posé par `proposeToTeams` (team.js) à
  `state.week + 1 + rng()*4` arrondi (1 à 4 semaines) quand des offres existent ; vidé par
  `joinTeam` si le pilote accepte un baquet ; sinon vérifié chaque semaine dans le tick pilote de
  `runWeekBody` (simulate.js), qui vide `pendingOffers`/`proposedAt`/`offersExpireAt` une fois
  échu. Vérifié par tests Node isolés (génération d'un lot de 23 offres, expiration confirmée
  après avoir simulé jusqu'à la semaine d'échéance) et en jeu (tabs Karting/Formule 4 filtrant
  correctement 35→22 lignes, lot expiré après simulation → section repasse sur "Chercher une
  écurie", aucune erreur console).
- ✅ **Prêts : montant et durée configurables** *(chat)* : `takeLoan` (state.js) prend
  désormais un paramètre `months` en plus du montant — `LOAN_DURATION_MONTHS_OPTIONS`
  (6/12/18/24/30/36), converti en semaines via `loanWeeksForMonths` (52/12 par mois, pas une
  approximation à 4 semaines fixes) pour calculer `weeklyPayment`. Nouveau `<select>` dans
  `loanSection` (agency.js) affichant "X mois (Y sem.)" pour chaque option, câblé dans
  `main.js`'s `take-loan`. Vérifié par test Node isolé (conversions mois→semaines, prêt refusé
  si durée hors liste, mensualité correcte pour une durée de 6 mois) et en jeu (emprunt de
  10 000€ sur 6 mois → 12 500€ dus, 481€/semaine, cohérent avec 12500/26).
- 🐛 ✅ *Corrigé* — **pilote karting proposé pour un baquet WEC en second championnat** *(chat)* :
  diagnostiqué — `secondaryChampionshipSection` (agency.js) listait TOUTES les catégories dont
  le `repRequired` était couvert par la réputation de l'AGENCE, sans aucune contrainte de tier
  par rapport au pilote lui-même ; `joinSecondaryChampionship` ne bloquait que la descente
  (`category.tier < highestTierReached`), jamais une montée arbitrairement grande. Fix à la
  source : nouveau `anchorTier(driver)` (team.js, max du tier de la catégorie primaire et de
  `highestTierReached`) + garde-fou symétrique `category.tier > anchorTier(driver) + 1` dans
  `joinSecondaryChampionship`, et `listSecondaryJoinableTeams` (nouvelle fonction) n'inclut que
  les catégories au tier courant ou +1 — un pilote karting (tier 0) ne peut plus jamais voir F2/
  F1/WEC (tier 3+), seulement karting/F4.
  - ✅ **Refonte du second championnat : offres uniques de remplaçant + proposition active
    obligatoire** *(chat)* : le second championnat n'affiche plus une liste statique
    "toujours ouverte" — `proposeSecondaryChampionship` (team.js) exige désormais une action
    explicite ("Proposer pour un second championnat"), même formule d'acceptation resserrée que
    `proposeToTeams`, même expiration 1-4 semaines (`pendingSecondaryOffers`/
    `secondaryOffersExpireAt`). Séparément, `tickSubstituteOffers` (appelé chaque semaine depuis
    `runWeekBody`) génère occasionnellement (4%/semaine/pilote) une offre PONCTUELLE de
    remplaçant pour une seule manche à venir dans une catégorie tier-compatible
    (`pendingSubstituteOffer`, carte dédiée "Offre de remplacement — une course", action
    `accept-substitute`) — coût réduit (15% d'un baquet saisonnier), n'affecte pas
    `highestTierReached` (un remplacement ponctuel n'est pas une vraie promotion), et le baquet
    (`secondarySeats` avec `oneOff: true`) est automatiquement retiré par `runWeekBody` juste
    après la manche concernée (`removeOneOffSecondarySeat`, team.js), qu'elle ait été courue ou
    perdue à un chevauchement de calendrier. Vérifié par tests Node isolés (liste tier-gated
    exclut WEC/F2/F1 pour un pilote karting, `joinSecondaryChampionship` rejette une tentative
    directe même avec réputation suffisante, proposition forcée respecte quand même le tier,
    offre de remplacement acceptée puis retirée automatiquement après sa manche, offre non
    acceptée expire sans toucher `highestTierReached`) et en jeu (section "Second championnat"
    ne montre plus que le bouton "Proposer", offres reçues limitées à F3 pour un pilote F4,
    carte de remplacement ponctuel affichée et acceptée correctement, aucune erreur console).
- ✅ **Relation agence-écurie** *(chat)* : nouvelle relation par écurie, distincte de
  `driver.teamRelationship` (personnelle à un pilote) — `state.agencyTeamRelationships[teamId]`
  (stockage paresseux, défaut 60 via `agencyTeamRelationship`/`AGENCY_TEAM_RELATIONSHIP_DEFAULT`,
  team.js), pas besoin de pré-remplir les centaines d'écuries du jeu. Alimentée par les résultats
  de course : chaque fois qu'un pilote du joueur court pour une écurie, `simulate.js` applique
  désormais aussi une fraction (moitié) du delta de `teamRelationship` du pilote à la relation
  agence-écurie (`adjustAgencyTeamRelationship`) — s'accumule sur tous les pilotes jamais engagés
  chez cette écurie, pas juste un seul baquet. Effet : `proposeToTeams` et
  `proposeSecondaryChampionship` (team.js) ajoutent un bonus/malus `(relation - 60) / 10` à la
  chance d'acceptation par écurie — une relation à 200 ajoute +14, une relation à 0 retire -6,
  sans dominer l'écart niveau/prestige déjà présent dans la formule. Affichage : pastille
  "Relation agence : X" (colorée comme les autres jauges 0-200) sur les cartes d'écurie
  (Monde ▸ Écuries, `agencyRelationPill`) et en suffixe sur chaque ligne d'offre reçue
  (`agencyRelationSuffix`, agency.js) — n'apparaît que si la relation a bougé du défaut neutre,
  pour ne pas polluer les écuries jamais fréquentées. Vérifié par tests Node isolés (défaut à 60,
  clamp 0-200, 20 essais à relation=0 → 60 offres cumulées contre 123 à relation=200 sur le même
  pool d'écuries, relation passée de 60 à 128 après 100 semaines simulées avec un pilote fort)
  et en jeu (pastille visible sur une seule carte après ajustement manuel, suffixe visible sur la
  bonne ligne d'offre parmi 8, aucune erreur console).
- ✅ **Revoir la méthode de scouting sur les super stats** *(chat)* : nouvelle fonction
  `superStatRange(driver, key)` (driver.js) — pour chaque attribut composant un super stat,
  utilise sa fenêtre déjà connue (`scoutReveal.attributeWidths`) si elle existe, sinon fait
  contribuer la plage complète [0, 99] à la moyenne (un composant non scouté élargit la
  fourchette au lieu d'être ignoré). Bonus de trait ajouté seulement si `traitsKnown` (deep
  scout) — sinon omis plutôt que deviné. `superStatSection`/`superStatsLine` (agency.js)
  prennent désormais un `mode` ("exact" | "range" | false) au lieu d'un booléen : "exact" pour un
  pilote possédé (Mes pilotes, jamais caché, inchangé), "range" pour un prospect scouté ou un
  pilote IA/rival scouté (`scout`/`scout-rival`), `false`/absent → "?". `talentsRow` (cellules
  compactes de "Talents") mise à jour de la même façon via `superStatDisplay`. Les 4 sites
  d'affichage (prospect, fiche pilote IA/rival, fiche pilote possédé, comparaison) mis à jour.
  Vérifié par tests Node isolés (aucune fenêtre → fourchette [0,99] complète, fourchette contient
  toujours la vraie valeur, un recruteur plus fort révèle plus d'attributs → fourchette plus
  souvent renseignée, fourchette valide même pleinement fenêtrée) et en jeu (Talents affiche "?"
  avant scouting puis une fourchette cohérente avec `superStatRange` après scouting basique,
  fiche pilote IA/rival idem après `scout-rival`, pilote possédé toujours en valeurs exactes,
  aucune erreur console).
- ✅ **Un pilote de karting ne devrait pas pouvoir rivaliser avec un pilote de F1** *(chat)* :
  courbe d'adaptation retenue (raw skill karting ne se transfère pas 1:1 en F1). Nouveau champ
  `driver.adaptationWeeksRemaining`, déclenché par `assignSeat`/`joinSecondaryChampionship`
  (team.js) uniquement lors d'une VRAIE montée de tier (`category.tier > highestTierReached`
  AVANT la mise à jour) — jamais pour un déplacement latéral, un retour à un tier déjà atteint,
  ni pour une offre ponctuelle de remplacement (`acceptSubstituteOffer`, déjà exempté de
  `highestTierReached` aussi). `tierAdaptationFactor(driver)` (driver.js) : pénalité de 25% au
  moment de la promotion, se réduisant linéairement sur 12 semaines (`TIER_ADAPTATION_WEEKS`)
  jusqu'à disparaître. Appliquée UNIQUEMENT dans le calcul de score de course
  (`simulateClassRace`, simulate.js — `overallRating(d) * tierAdaptationFactor(d)`), jamais sur
  `overallRating` lui-même : la fiche du pilote affiche exactement les mêmes stats qu'avant la
  promotion, seuls les résultats en piste en pâtissent tant qu'il s'adapte. Vérifié par tests
  Node isolés (facteur exact à 0.75/0.875/1.0 selon les semaines restantes, `overallRating`
  strictement inchangé par l'état d'adaptation, déclenchement confirmé sur F4→F1 mais pas sur un
  déplacement latéral F1→F1, non-déclenchement confirmé sur une offre ponctuelle) et par
  comparaison de simulation (même pilote/même seed, avec vs sans la pénalité : position moyenne
  sur les 10 premières courses 6.5 contre 5.7, les dernières courses convergent exactement une
  fois les 12 semaines écoulées) ; vérifié en jeu que la fiche pilote affiche un niveau inchangé
  malgré `adaptationWeeksRemaining = 12` en interne, aucune erreur console.
- ✅ **Saut de catégorie conditionnel** *(chat, clarifié plus tôt : ce n'était pas un bug)* :
  sauter un palier (ex. Karting → F3, en sautant F4) reste possible, mais uniquement si (a) un
  budget de recrutement très élevé est engagé, OU (b) le pilote est wonderkid-tier (potentiel
  ≥94, seuil déjà défini dans `driver.js`). Le garde-fou "un palier à la fois" était entièrement
  en amont (`listJoinableTeams`/`categoriesForFreeAgent`, `team.js`) — `assignSeat` lui-même n'a
  jamais eu de garde-fou anti-saut vers le haut, donc rien à y changer. Nouvelle
  `tierSkipEligible(driver, category, budget)` (`team.js`) : `driver.potential >= 94` OU
  `budget >= category.seatCost × 15` (ex. Karting→F3 : 900 000€). `listJoinableTeams` calcule
  désormais une liste de catégories "saut" (tier+2) séparément, filtrée par cette éligibilité,
  UNE SEULE FOIS pour les deux chemins (pilote avec `categoryId` actif ou pilote banché via
  `categoriesForFreeAgent`) plutôt que dupliquée dans les deux — chaque option gagne un flag
  `isSkip`. `proposeToTeams` transmet le budget saisi au premier appel et propage `isSkip` dans
  chaque offre. Le garde-fou de réputation existant continue de s'appliquer tel quel à une
  catégorie de saut (aucun contournement). UI (`agency.js`) : badge "⚡ Saut de catégorie" à côté
  d'une offre marquée `isSkip`, pas de nouveau contrôle de saisie — le joueur découvre la
  possibilité en voyant l'offre apparaître. Hors scope explicite : le deuxième championnat
  (`listSecondaryJoinableTeams`) duplique la même règle tier/tier+1 mais n'est pas touché ici.
  Vérifié par tests Node isolés (pilote normal + budget modeste : aucune offre F3 ; même pilote +
  budget ≥ seuil : offres F3 marquées `isSkip` ; wonderkid + budget 0 : idem ; réputation
  insuffisante bloque le saut même avec budget énorme ET wonderkid ; une offre F4 normale n'est
  jamais marquée `isSkip`) et en jeu (pilote karting wonderkid, offres F3 avec le badge affichées
  parmi les offres Karting/F4 sans badge, "Rejoindre" fonctionne et fait bien passer le pilote en
  F3 directement), aucune erreur console.

## Staff

- ✅ **Refonte du recrutement de staff** *(chat)* : `renderWorldStaff` (world.js) avait déjà un
  filtre par rôle/catégorie/disponibilité/compétence/salaire + pagination 50/page — rien à
  faire là. Le vrai problème était `renderStaff` (agency.js), l'écran de recrutement propre
  de l'agence, qui affichait sans aucun filtre les ~240 candidats de `state.staffPool`
  (`seedWorldStaff`, `staff.js`, distribue 600 membres au total dont 360 aux agences rivales).
  Ajout de tabs de filtre par rôle (`staffPoolRoleTabs`, même pattern que
  `staffRoleFilterTabs` déjà existant dans world.js), nouveau `state.ui.staffFilter.role` +
  `case "filter-staff-pool"` (main.js). Vérifié en jeu : 240/240 → 46/240 en filtrant sur
  "Recruteur".
  - ✅ **Filtre complet pour "Candidats disponibles" (`renderStaff`, agency.js)** *(chat)* :
    ajout de `staffPoolAttributeFilterRow` (compétence principale min. + salaire max.,
    même présentation que `staffAttributeFilterRow` de world.js), filtrage combiné avec le
    rôle sur `state.ui.staffFilter` (`minPrimary`/`maxWage`), nouvelles actions
    `filter-staff-pool-min-primary`/`filter-staff-pool-max-wage` (main.js, listener `"change"`).
    Vérifié en jeu : 240/240 → 99/240 (compétence ≥ 70) → 0/240 (salaire max 400€, message
    "Aucun candidat pour ces filtres"), aucune erreur console.
- ✅ **Tooltip sur le rôle d'un membre du staff** *(chat)* : `ROLES` (`staff.js`) a maintenant un
  champ `description` par rôle, expliquant son effet mécanique réel (ex. Recruteur → scouting,
  Avocat → réduit le débauchage) ; affiché en `title` sur le pill/en-tête de rôle partout où il
  apparaît (Staff, comparaison, Monde ▸ Staff).
- ✅ Filtre multi-critère, au-delà du filtre par rôle déjà en place *(retour d'un ami,
  `BITWALL.txt`)* : Monde ▸ Staff a maintenant un filtre par type (Sportif/Business), par
  disponibilité (Disponible/Chez toi/Agences rivales), un seuil minimum de compétence
  principale, et un plafond de salaire — tous combinables entre eux et avec le filtre de rôle
  existant.
- ✅ Staff multi-rôles (négociateur, préparateurs, coach, DAF, avocat) + plusieurs compétences
  par membre (primaire/secondaire/communication/expérience).
- ✅ Génération massive de staff IA (600, même volume/logique que les pilotes), réparti entre
  les agences rivales et le pool de recrutement mondial ; filtre par rôle + pagination (50/page)
  sur Monde ▸ Staff.
- ✅ Monde ▸ Staff : sous-menu créé, même principe que Pilotes.
- ✅ **Refonte du recrutement de staff inspirée de Football Manager** *(chat)* : les 3 pistes
  proposées ont été retenues et implémentées ensemble. (1) **Spécialités de recruteur** —
  chaque recruteur reçoit une `specialty` (un rôle de staff) qui biaise `pickWeightedRole`
  (staff.js) vers ce rôle dans le vivier suivant. (2) **Rapports progressifs** — `staffPool` a
  maintenant le même fog-of-war que les pilotes (`scouted`/`scoutReveal`, `generateStaffScoutReveal`
  dans scoutReveal.js) : stats masquées (`?`) jusqu'au scouting (`scoutStaff`, 300+), fourchettes
  resserrées et traits révélés au scouting approfondi (`deepScoutStaff`, 1200+, partage le
  cooldown recruteur `deepScoutCooldownWeeks` avec le scouting pilote). Staff rival (flavor,
  jamais recrutable) reste pré-scouté pour ne pas régresser Monde ▸ Staff. (3) **Réseau de
  contacts** — nouvelle infra `contactNetwork` (8 paliers, Investissement) donnant une chance par
  refill qu'un candidat "élite" (plancher de stats 65+, pré-scouté) apparaisse dans le vivier,
  plafonné à un seul élite en même temps. SCHEMA_VERSION 26→27.

## Championnats & Résultats

- ✅ **Nouveaux championnats : MLMC, ELMS, WRC2, Karting KZ1/KZ2** *(chat, 2026-08-03, plan
  approuvé)* : 5 nouvelles catégories, feeder series sous WEC/WRC/Karting.
  - **MLMC** (Michelin Le Mans Cup, tier 2, `driversPerCar: 2`) : classes LMP3 (22 équipes),
    LMP3 Pro/Am (12, `requiresBronze`), GT3 (10, `requiresBronze`).
  - **ELMS** (European Le Mans Series, tier 2, `driversPerCar: 3`) : classes LMP2 (12), LMP2
    Pro/Am (12, `requiresBronze`), LMP3 (8, `requiresBronze`), GT3 (10, `requiresBronze`).
  - **WRC2** (tier 2) : structure identique à WRC (teamSizes, brands, Power Stage).
  - **Karting KZ1 + KZ2** (tier 0) : structure identique au Karting Senior existant, en
    parallèle (pas un palier supplémentaire).
  - **Notion de pilote Bronze** : `driver.isBronze`, tiré aléatoirement à la génération comme
    `isPro` (~8%, rare par design). Les classes `requiresBronze` (Pro/Am, GT3 de MLMC/ELMS)
    garantissent au moins un pilote bronze par voiture, forcé sur le dernier siège de la
    voiture si aucun des sièges précédents n'en a produit un naturellement
    (`generateAllTeams`, team.js) — **appliqué uniquement à la génération initiale**, pas aux
    remplacements IA ultérieurs (retraite fin de saison, backfill de baquet) ni côté joueur
    (`assignSeat` ne cible jamais une voiture précise, contrainte jugée hors scope — voir
    plan). Badge "🥉 Bronze" sur la fiche pilote (signée, prospect, lecture-seule) et Talents.
  - **Généralisation architecturale** : le système WEC (`classes`/`driversPerCar`/
    `carClassification`) était déjà entièrement générique (team.js/simulate.js/standings.js/
    world.js) — seuls 3 hardcodes `category.id === "wec"/"rally"` ont dû être remplacés par un
    nouveau champ déclaratif `category.profile` ("endurance"/"rallye"/défaut "circuit"),
    utilisé par `disciplineKeyFor`/`overallWeightsFor` (driver.js) et `isEndurance`
    (simulate.js). `GT3_BRANDS` factorisé (partagé WEC/MLMC/ELMS, était dupliqué inline).
  - Aucun bump `SCHEMA_VERSION` — `CATEGORIES` est une donnée statique, pas de l'état
    sauvegardé (même précédent que l'ajout des classes hypercar/gt3 de WEC).
  - Vérifié par script Node isolé (effectifs par classe conformes aux chiffres demandés,
    invariant "≥1 bronze par voiture" vérifié sur toutes les voitures MLMC/ELMS
    `requiresBronze`, 3 profils de pondération résolus sans erreur, F3/MLMC/ELMS/WRC2 bien
    offerts ensemble comme options tier 2 à un pilote promu), par `simulate_season.js`
    (2 saisons/104 semaines, aucun crash, 0 avertissement) et en navigateur (12 catégories
    dans les onglets Championnats/Écuries, grille ELMS à 3 pilotes/voiture affichée
    correctement, badge Bronze visible sur un pilote IA forcé, aucune erreur console).
- ✅ **Revoir le barème de points par catégorie** *(chat)* : barèmes réalistes par discipline.
  Karting/F4/F3/F2/F1 gardent la base FIA (25-18-15-12-10-8-6-4-2-1, `STANDARD_POINTS_TABLE`,
  `data.js`) sauf karting qui a un barème réduit (top 8, échelon amateur). WEC a désormais un
  barème PAR CLASSE (`pointsTableFor(category, classId)`) : Hypercar (grille ~18 voitures) en
  top 8, GT3 (grille ~36) garde le top 10 standard. WRC garde le barème standard + son bonus
  "Super-Spéciale" (Power Stage) emblématique — `applyPowerStageBonus` (standings.js) attribue
  5-4-3-2-1 points aux 5 premiers hors-abandon d'un classement dérivé du même score de course
  avec un bruit indépendant (pas de nouvelle sous-épreuve simulée). Le bonus est mentionné dans
  le log "Résultats" du joueur ("+X pts Super-Spéciale"). `applyPoints` (standings.js) prend
  désormais `pointsTable` en paramètre au lieu d'une constante globale ; `positionColorClass`/
  `teamRoundCell` (world.js) suivent. Aucune migration de sauvegarde nécessaire (donnée statique,
  forme de `state.standings` inchangée) — pas de bump `SCHEMA_VERSION`.
- ✅ **Fiche pilote lecture-seule — scouting approfondi + approcher/débaucher** *(chat)* :
  `readOnlyDriverDetail` (agency.js, la fiche ouverte en cliquant sur un pilote — Monde ▸ Pilotes
  OU une table de Monde ▸ Championnats) propose maintenant, en plus du "Scouter" déjà existant,
  un bouton "Scouting approfondi" (nouvelle fonction `deepScoutRivalDriver` dans state.js, miroir
  de `deepScoutDriver` mais sur `state.aiDrivers` — comme `scoutRivalDriver` le fait déjà pour le
  scouting simple, même cooldown recruteur partagé) et le bouton "Approcher"/"Débaucher"
  (`approachCell`, exporté depuis world.js et réutilisé tel quel — même règles d'éligibilité
  qu'en Monde ▸ Pilotes). Essayé d'abord comme une colonne "Action" directement dans les tableaux
  de classement — retiré sur demande : ces actions ne doivent être accessibles qu'en cliquant sur
  le pilote pour ouvrir sa fiche, pas depuis le tableau lui-même.
- ✅ **Monde ▸ Pilotes — clic sur un pilote pour voir sa fiche** *(chat)* : lignes de
  `renderWorldDrivers` (world.js) ont maintenant `data-action="view-driver"`. `renderDriverDetail`
  (agency.js) retombe désormais sur une nouvelle variante lecture seule
  (`readOnlyDriverDetail`) pour tout pilote trouvable via `getDriverById` mais absent de
  `state.drivers`/`state.scoutPool` (IA ou géré par une agence rivale) : identité, baquet,
  catégorie, agence gérante, classement actuel, attributs — sans négociation/proposition/
  licenciement, qui ne concernent que le roster du joueur. Limite connue : pas de courses/
  victoires/podiums affichés, `careerResults` n'étant peuplé que pour les pilotes du joueur
  (`simulate.js`), ces compteurs resteraient à 0 même pour un pilote IA ayant déjà couru.
- ✅ **Fenêtre "Résultats" — signaler un champion issu de l'agence** *(chat)* : bug trouvé —
  `logEntry` (agency.js, cas `season-champion-driver`) affichait « un de tes pilotes ! »
  **inconditionnellement**, y compris pour un champion IA/rival, alors que le champ
  `entry.isPlayer` existait déjà et n'était simplement jamais lu à cet endroit. Rendu maintenant
  conditionnel à `entry.isPlayer`. Vérifié : un champion IA n'affiche plus la mention, un
  champion du joueur l'affiche toujours.
  - ✅ **Refonte de l'affichage : tableau par championnat/année façon Wikipédia F1 2025**
    *(chat)* : "Monde ▸ Championnats" affiche désormais une vraie grille manche par manche
    (une colonne par manche — position, ou "Ret" en cas d'abandon — plus une colonne Pts
    cumulés), pour le classement Pilotes ET Écuries/Voitures. Résultat de chaque manche capturé
    pour TOUS les engagés (pas seulement le joueur, à la différence de `driver.careerResults`)
    via `recordRoundResult` (`standings.js`), appelé juste après `applyPoints` dans
    `simulateClassRace` en réutilisant le tableau déjà trié `scored` — aucune double logique de
    jeu. Noms de pilote/écurie dupliqués dans chaque entrée de manche (pas seulement l'ID) pour
    rester lisibles même après la suppression/retraite d'un pilote IA. Nouvelle archive durable
    `state.seasonArchive` (même clé que `state.standings` — `categoryId` ou
    `categoryId:subClass`), peuplée à chaque `rolloverIfNeeded` avec un instantané
    `{seasonNumber, driverPoints, teamPoints, carPoints, rounds}` — même forme que la saison en
    cours, donc une seule fonction de rendu consomme les deux sans branche spéciale. Nouveau
    sélecteur `<select>` "Saison" (premier `<select>` du projet — le style existait déjà,
    inutilisé) permet de consulter n'importe quelle saison déjà simulée, pas seulement celle en
    cours ; le choix de catégorie reste géré par les onglets déjà en place. Écuries (F1,
    karting...) : cellule de manche = points gagnés ce jour-là (somme plafonnée par
    `constructorsTopN`, même règle que `applyPoints`) ; Voitures (WEC) : cellule = position/Ret
    directe, comme les pilotes. Aucun bump de `SCHEMA_VERSION` (champs additifs, backfillés
    comme `carPoints` déjà). Limite connue et acceptée : une saison déjà en cours au moment de
    la mise à jour n'a de détail manche par manche qu'à partir des manches disputées après la
    mise à jour ; le volume de données (~4000-4500 lignes/saison toutes catégories confondues)
    est conservé indéfiniment pour TOUTES les saisons passées (demande explicite), sans
    compression/plafond ajouté — seul le mécanisme existant de purge des sauvegardes obsolètes
    en cas de quota `localStorage` plein reste le filet de sécurité. Vérifié par 20 tests Node
    isolés (capture par manche, archivage + reset au rollover, plafond `constructorsTopN`) et en
    jeu (F1 : grille 24 manches progressive + classement écuries par points/manche ; WEC :
    grille Hypercar/GT3 8 manches, position/voiture, rollover déclenché avec sélecteur "Saison 1"
    figé et cohérent ; Karting : grille 20 manches sur 60 pilotes), aucune erreur console.
- ✅ **Menu Palmarès** *(chat)* : nouvel écran (`renderPalmares`, `palmares.js`), accessible
  depuis la sidebar juste après "Résultats". Liste les champions pilote + écurie par saison et
  par catégorie (nouveau `state.championsHistory`, peuplé à chaque `rolloverIfNeeded` —
  distinct de `state.log`, qui n'affiche jamais que les 40-60 dernières entrées et aurait donc
  fini par perdre les champions des premières saisons d'une longue partie). Une distinction
  simple ajoutée par saison : "Pilote de l'agence de la saison N" (meilleure position au
  championnat parmi les pilotes actuellement signés, toutes catégories confondues, via
  `driver.seasonHistory` déjà existant). Portée volontairement limitée à cette première passe :
  pas d'autres distinctions ("Pilote de l'année", "Dépassement de l'année"...) ni de bonus de
  gameplay associés — la liste exacte des distinctions restait à préciser et les bonus étaient
  explicitement prévus "plus tard" dans la demande d'origine. Limite connue : comme le tableau
  Historique de la fiche pilote, la distinction ne voit que les pilotes encore sous contrat
  (un pilote licencié/débauché disparaît de `state.drivers`, donc de ce calcul) — la liste des
  champions eux-mêmes (`championsHistory`) n'a pas cette limite, elle est durable.
- ✅ **Classement à 0 point — trier par meilleur résultat** *(chat)* : nouveau champ léger
  `bestPositionThisSeason` (pilote ET écurie, remis à `null` à chaque rollover) mis à jour pour
  CHAQUE participant d'une course dans `simulate.js` (pas seulement ceux du joueur, à la
  différence de `careerResults` — juste un entier, sans coût mémoire significatif même pour les
  centaines de pilotes/écuries IA). Sert de tiebreak dans `classificationBlock` (world.js)
  quand les points sont égaux, cas le plus fréquent étant "personne n'a encore marqué".
  Vérifié : ordre du classement 0-point conforme au tri attendu (points desc, puis meilleure
  position asc) après plusieurs semaines de simulation.
- ✅ **Résultats course par course + archive consultable depuis la fiche pilote** *(chat)* :
  la refonte du classement (ci-dessus) capturait déjà le résultat de chaque manche pour
  chaque pilote (`state.standings[...].rounds` + `state.seasonArchive`), mais uniquement
  consultable depuis Monde ▸ Championnats. Chaque ligne du tableau "Historique" d'une fiche
  pilote (saison en cours ET saisons passées) est désormais cliquable
  (`data-action="view-driver-season"`) et ouvre un détail manche par manche (position/Ret par
  manche) juste en dessous, en réutilisant `resolveSeasonView` (nouvel export de
  `standings.js`, factorisé pour être partagé avec le sélecteur de saison de Monde ▸
  Championnats — même résolution live/archivée). Un second clic sur la même ligne referme le
  détail. `driver.seasonHistory` gagne un champ `classId` (WEC hypercar/GT3) aux deux points
  d'écriture (`standings.js` fin de saison, `team.js` `recordSeasonStint` mi-saison) pour
  résoudre la bonne clé de classement composite — au passage, la ligne "saison en cours" de la
  fiche pilote lisait `state.standings[driver.categoryId]` sans le subClass (même classe de bug
  WEC que `teamRankingLabel`/`secondaryStanding`, corrigée pareil). Aucun bump de schéma
  (`classId` additif, backfillé `?? null`). Vérifié par 9 tests Node isolés (résolution live/
  archivée/inexistante, capture du `classId` sur un pilote WEC réellement signé et simulé) et
  en jeu (clic sur une ligne d'historique WEC → grille 8 manches affichée, second clic la
  referme), aucune erreur console.
  - ✅ Onglet Résultats à détailler aussi pour les résultats d'events (pas seulement les
    courses) *(retour d'un ami)* : "Résultats" (`RESULT_TYPES`, agency.js) ne montrait que
    `player-result`/`season-champion-driver`/`season-champion-team` — chaque dilemme/event
    résolu (`type: "random-event"`, déjà poussé dans `state.log` par `resolveEventChoice`/
    `triggerRandomEvent`) n'apparaissait que dans "Nouveautés", jamais dans "Résultats", alors
    qu'un event affecte souvent argent/réputation/relation au même titre qu'une course.
    `"random-event"` ajouté à `RESULT_TYPES` (partagé avec `NEWS_TYPES`, un event reste aussi une
    actualité). Au passage, `logEntry` cas `random-event` n'affichait que `entry.text`, jamais
    `entry.title` (toujours présent sur ces entrées) — les deux sont maintenant affichés
    ensemble, ce qui profite aussi à "Nouveautés". Vérifié en jeu (partie fraîche, simulation de
    40 semaines : les events déclenchés apparaissent bien dans "Résultats" avec titre + texte,
    coloration good/bad conservée, "Nouveautés" inchangé à part le titre en plus), aucune erreur
    console.
  - ✅ *Résolu comme effet de bord* — Second championnat : afficher le prix pour le rejoindre
    avant de confirmer *(retour d'un ami)* : la refonte du second championnat (offres actives,
    voir "Pilotes & Contrats") affiche déjà le prix directement sur le bouton "Rejoindre" pour
    chaque offre, avant tout clic — vérifié en jeu (`Rejoindre (35 991€)` etc. visible sur les 12
    offres générées dans un test forcé).
- ✅ **Classement WEC cassé** *(chat)* : cause trouvée — `classificationBlock` (`world.js`)
  filtrait les écuries d'une classe via `t.class`, un champ qui n'existe pas ; le vrai champ
  est `t.subClass` (déjà utilisé partout ailleurs — `standings.js`, `agency.js`). Résultat :
  `classTeams` était toujours vide pour Hypercar/GT3, donc pilotes/écuries/voitures
  n'affichaient jamais rien, même avec des points déjà marqués. La clé de standings composite
  `categoryId:classId` elle-même était correcte. Vérifié en simulant jusqu'à la manche 2/8 :
  classements Hypercar et GT3 tous les deux peuplés (pilotes, écuries, voitures).
- ✅ Saison sur 52 semaines, avancement hebdomadaire, calendriers différenciés par catégorie ;
  différenciation des marques de voitures en championnats multi-marques.
- ✅ Classement équipe avant le début de saison : `teamRankingLabel` retombe sur
  `team.lastSeasonRank` si la saison en cours n'a pas encore de points.
- ✅ Nouveautés séparé en deux onglets : « Résultats » (résultats de course + titres de
  champion pilote/équipe) et « Nouveautés » (événements d'agence uniquement).

## Investissement & Infrastructures

- ✅ **Remodelage complet de l'Investissement** *(chat, réf. capture d'écran Soccer Agent)* :
  coût ET entretien croissants par palier — en fait déjà le cas dans les données actuelles
  (`FACILITIES`, `infrastructure.js` : ex. bureaux 0→250→600→1200→2200€/sem d'entretien,
  0→15k→40k→90k→180k€ de coût), la note du TODO décrivant un entretien "plat" était obsolète.
  Ce qui manquait réellement — un palier de réputation minimum par niveau — ajouté
  (`reputationRequired` par niveau, vérifié dans `upgradeFacility`) ; `upgradeFacility` renvoie
  désormais `{ok, error}` comme le reste des actions du jeu (au lieu d'un booléen silencieux) et
  `main.js` affiche un toast d'erreur en cas de réputation insuffisante. Vérifié en jeu :
  bouton "Réputation insuffisante (X)" désactivé sous le seuil, achat réel réussi une fois le
  seuil atteint, seuil suivant recalculé et re-verrouillé après l'achat.
- 🔄 Logos pour écuries, championnats, agences, et postes d'investissement ; réputation
  requise et niveau actuel affichés en échelle d'étoiles ; afficher le gain ET l'effet du
  **prochain** palier avant de l'acheter (pas seulement le niveau actuel) *(retour d'un ami)*.
  Fait pour la partie code : niveau actuel en étoiles (`facilityLevelStars`, agency.js),
  réputation requise affichée en clair, et prévisualisation complète (effet + entretien +
  réputation) du prochain palier avant achat (`facilityCard`). Logos : **non fait** — nécessite
  de vraies ressources graphiques (pas de pipeline d'assets dans ce projet), hors de portée
  d'un changement de code seul.
- ✅ Achats personnels de réputation (boutique agence), déplacée avec les infrastructures dans
  un onglet "Investissement" dédié (`renderInvestments` dans `agency.js`).
- ✅ **Refonte des infrastructures** *(chat, réf. captures Soccer Agent, plan approuvé)* :
  - **Bureau** (`FACILITIES.offices`) : allongé de 5 à 8 paliers (difficulté accélérée sur les 3
    derniers — écarts de réputation requise 10/15/20/25/30/40/50 au lieu de continuer +5 partout).
    Chaque palier ajoute désormais `commissionRate` (remplace la constante `PRO_COMMISSION_RATE`
    — supprimée de `data.js`, remplacée par `officeCommissionRate(state)`, branchée aux 6 sites
    qui la lisaient : `simulate.js` prize, `state.js` `contractBaseline`/signature initiale,
    `recruit.js`, `team.js`×2), `transferFeeRate` (alimente le nouveau marché des transferts,
    voir ci-dessous) et `patienceBonus` (branché sur le tick hebdo déjà existant de
    `driver.negotiationPatience` dans `runWeekBody`, +3/sem de base +bonus par palier — plus
    mesurable qu'un multiplicateur abstrait sur `agencyRelationship`).
  - **Marché des transferts** *(clarifié en chat — "nouveau marché", pas une réutilisation de
    l'indemnité de débauchage existante)* : nouveau dilemme `transfer-offer` (`events.js`, même
    famille que `poaching-attempt`) — une écurie tierce de la même catégorie propose une
    indemnité (`driverMarketValue` × palier de tier) pour un pilote pro déjà en baquet ;
    accepter déplace le pilote via `assignSeat(force:true)` (aucun coût agence, c'est la
    nouvelle écurie qui "paie") et crédite l'agence de sa commission (`officeTransferFeeRate`).
  - **Qualité des recruteurs** : nouvelle infra à 8 paliers (même progression accélérée que le
    Bureau) — `poolSize`/`discoveryBonus`/`precisionBonus`/`qualityFloorBonus`. Remplace le
    staff comme moteur principal du vivier : `scoutPoolCapacity`/`effectiveScoutSkills` déplacées
    dans `infrastructure.js` (évite un cycle d'import avec `staff.js`, qui reste importé PAR
    infrastructure.js) ; le staff recruteur (`averageScoutSkill`/`averagePrecisionSkill`) devient
    un modificateur à ×0.5 par-dessus le plancher d'infra, branché partout où une révélation est
    générée (`scoutDriver`, `scoutRivalDriver`, `deepScoutDriver` inchangé dans son rôle,
    `autoRevealCandidates` déplacé de `staff.js` vers `state.js` pour la même raison de cycle,
    `scouting-tip`).
  - **Refonte du scouting** : `refillScoutPool` ne se déclenche plus que pendant les fenêtres de
    mercato (`isMercatoWindow`) au lieu de chaque semaine. Nouvelle recherche à la demande
    (`requestScoutSearch`/`resolveScoutSearches`, `state.scoutSearches`) : coût `8000 +
    niveau×4000`, résolution après 3 semaines, exemptée du plafond `scoutPoolCapacity` (action
    payante ciblée). *Précisé en chat* : chaque nouveau pilote (mercato ou recherche) a une
    chance (`rollPotentialAlreadyKnown`, fonction du niveau d'infra + `averageScoutSkill`)
    d'arriver avec son potentiel déjà connu sans scouting approfondi — celui-ci garde son rôle
    exact par ailleurs. UI : section "Recherches en cours" + bouton "Commander une recherche"
    dans l'onglet Talents (`agency.js`), toast dédié à la résolution (`main.js`, même famille que
    rival-poach/rival-scout-sign, factorisé dans `showSimulationLogToasts` pour couvrir aussi le
    chemin `continueWeekAfterChoice`).
  - *Précisé en chat* : la bannière défilante signale désormais les nouveaux talents de la
    semaine (`state.newTalentsThisWeek`, remis à 0 en tête de `runWeekBody`, incrémenté par le
    remplissage mercato et les recherches résolues) — ajouté à `usefulInfoLines` (`layout.js`),
    pas une ligne séparée.
  - `MAX_FACILITY_LEVEL` (constante globale) remplacé par `facilityMaxLevel(facilityId)` — Bureau
    et Qualité des recruteurs ont maintenant plus de paliers que Centre d'entraînement/Bureau de
    standing (8 contre 5), les étoiles d'affichage (`facilityCard`, agency.js) suivent par
    facility.
  - **Non fait, explicitement écarté du scope de cette passe** : déclassement d'infrastructure
    (revente/retour en arrière d'un palier) ; profil ciblé pour une recherche, limite de
    recherches simultanées par niveau — restent des idées pour une passe ultérieure si demandées.
  - `SCHEMA_VERSION` 24→25 (`scoutSearches`, `newTalentsThisWeek`,
    `infrastructure.recruiterQuality`). Vérifié par tests Node isolés (24 checks : progression
    des 3 nouveaux champs du Bureau, plafonnement à 8 paliers, mercato-gating, cycle complet
    requête→résolution d'une recherche, fréquence de `rollPotentialAlreadyKnown`, déclenchement
    et acceptation réelle de `transfer-offer` sur simulation longue) et en jeu (4 cartes
    d'infrastructure affichées avec le bon nombre d'étoiles, recherche commandée/résolue avec
    toast et pilote ajouté au vivier avec potentiel déjà visible, dilemme de transfert déclenché
    et accepté avec changement d'écurie confirmé), aucune erreur console.
- ✅ **Marché des transferts : négociation au lieu d'accepter/refuser** *(chat)* : le dilemme
  `transfer-offer` (`events.js`) proposait 2 choix figés (indemnité déjà calculée, transfert
  immédiat). Réécrit pour ouvrir une vraie négociation : accepter le contact pose un
  `driver.pendingTransferOffer` (teamId/teamName/baselineFee figé au moment de l'offre/expiresAtWeek)
  — pattern calqué sur `pendingSubstituteOffer` (team.js), pas sur `negotiateContract` lui-même
  (celui-ci sert de référence de FORME uniquement). Nouvelle section dédiée sur la fiche du pilote
  (`transferNegotiationSection`, agency.js) où le joueur fixe l'indemnité demandée ; `negotiateTransfer`
  (team.js) calcule une `acceptChance` inversement proportionnelle au ratio indemnité/`baselineFee`
  (plus le joueur est gourmand envers l'écurie acheteuse, moins elle accepte), prend `rng` en
  paramètre explicite (jamais `makeRng` en interne — `team.js` ne peut pas importer `state.js`,
  cycle avec `driverStats.js`). Expiration silencieuse dans `runWeekBody` (simulate.js) si non
  résolue avant `expiresAtWeek`. **Ajout demandé en cours de plan-review** : pendant la négociation
  de CONTRAT AGENCE (`negotiateContract`, state.js — fonctionnalité séparée, préexistante), un
  refus génère désormais une contre-offre chiffrée du pilote (`buildCounterOffer` +
  `counterOfferDemandFactor`, basé sur `agencyRelationship`/`negotiationPatience` : mauvaise
  relation/patience → contre-offre plus dure ; bonne relation/patience → plus douce), persistée
  sur `driver.negotiationCounterOffer` (survit aux re-renders), affichée sur la fiche avec un
  bouton "Reprendre cette proposition" (`prefill-counter-offer`, main.js — se termine par `return;`
  pour ne pas déclencher le `render()` commun qui écraserait le préremplissage). Vérifié en
  navigateur : négociation de transfert réussie (changement d'écurie, commission perçue, panneau
  disparu), indemnité extrême échouant la plupart du temps (taux de succès faible mais non nul,
  conforme à la formule), expiration silencieuse confirmée, contre-offre affichée/reprise/soumise
  avec un taux de succès nettement supérieur à l'offre initiale refusée, aucune erreur console.
- ✅ **Vie personnelle de l'agent** *(chat, réf. captures Soccer Agent)* : nouveau fichier
  `src/game/lifestyle.js`, système entièrement distinct de l'agence (`FACILITIES`) — 3 catégories
  (Logement/Véhicule/Formation personnelle) à **10 paliers chacune** (demande explicite : "beaucoup
  de paliers qui coûte de plus en plus cher"), coût environ ×2 par palier jusqu'à 7,5-15M€ au
  sommet, aucun verrou de réputation (`reputationRequired` absent), uniquement gated par l'argent
  (`upgradeCost`). **Conception revue en cours de route** : la première passe suivait Soccer
  Agent à l'envers (aucun effet réputation, entretien hebdomadaire croissant façon Bureau/Qualité
  des recruteurs) — **corrigé ensuite** : "la catégorie vie personnelle ne coûte rien à la
  semaine, elle ramène uniquement +1 de réputation contre le coût de l'achat". Champ `upkeep`
  retiré des paliers, `totalLifestyleUpkeep`/déduction hebdo dans `runWeekBody` supprimés ;
  `upgradeLifestyle` appelle désormais `applyReputationGain(state, 1)` (même courbe à rendements
  décroissants que toute autre source de réputation — pas un canal à part qui la contournerait).
  UI : 3e section "Vie personnelle" dans l'onglet Investissement (`lifestyleCard`, réutilise
  `facilityLevelStars` sans la logique de blocage réputation de `facilityCard`, affiche
  "Réputation +1" au lieu d'un entretien). Libellé Finances `"Vie personnelle"` conservé
  (`"lifestyle-upkeep"` retiré, devenu inutile) ; au passage un oubli du chantier précédent
  corrigé (`"scout-search"` manquait de libellé). `SCHEMA_VERSION` 25→26 (`state.lifestyle`).
  Explicitement écarté : automatisation, simulation rapide multi-semaines, monétisation — non
  pertinents pour Pit Wall.
  Vérifié par tests Node isolés (progression indépendante des 3 catégories, coûts déduits,
  plafond à 10 paliers, aucun champ `upkeep` résiduel, chaque achat augmente bien la réputation
  via la courbe partagée) et en jeu (3e section affichée avec paliers/coûts cohérents, achat réel
  déduisant la trésorerie ET incrémentant la réputation affichée, aucune déduction hebdomadaire
  après simulation d'une semaine), aucune erreur console.

## Finances

- ✅ **Fenêtre temporelle par semaine/mois/saison** *(chat)* : nouveau toggle "Semaine/Mois/
  Saison" dans Finances (indépendant du toggle fenêtre "10 semaines/1 saison/Tout" déjà
  existant) — chaque colonne du graphique Recettes/Dépenses regroupe désormais 1, 4, ou 52
  semaines (`aggregatedTotals` dans `finance.js`), avec info-bulle au survol récapitulant les
  transactions du groupe. Les libellés de bucket ("S12", "S9-12", "An 2"...) et l'axe des
  abscisses du graphique de trésorerie dans le temps sont un ajout dans `charts.js`
  (`lineChart`/`barChart` échantillonnent jusqu'à 6-8 repères pour rester lisibles même avec
  jusqu'à 52 points).
  - Trésorerie dans le temps : détail sur l'axe des abscisses ajouté (repères "S35", "S44"...).
- ✅ Détail Finances + graphiques (Recette/Dépense, trésorerie dans le temps), popup au survol
  d'une barre expliquant les sources, courbe de tendance sur 10 semaines.
- ✅ Choix d'échelle des abscisses sur les graphs Finance : toggle 10 semaines / 1 saison / Tout.
- ✅ Diversification des revenus de l'agence (commissions, frais amateurs, % gains) ;
  commission agence en % du salaire pro ; buyout de débauchage payé par l'agence adverse.
- ✅ Classement des équipes toujours sur 10 dernières semaines avec autoscale (finance).

## Économie & Réputation

- ✅ **Réputation gagnée au classement final, pas à chaque course** *(chat)* : la réputation ne
  bouge plus par course (`resultReputationDelta` retiré du bloc joueur dans `simulate.js`) —
  elle bouge une seule fois par saison, à `rolloverIfNeeded` (`standings.js`), scalée par la
  position finale du pilote (`seasonReputationBonus` : P1 +10, P2 +6, P3 +4, top 6 +2, top 10
  +1). Vérifié par test Node isolé (3 pilotes classés 1/2/3 → +10+6+4 = +20 exact) et en jeu
  (réputation figée sur ~9 courses, puis saut net au changement de saison).
  - Relation agence/équipe reste par course, mais désormais **proportionnelle au nombre de
    pilotes engagés** (`raceRelationshipDelta` dans `simulate.js`, percentile de la position
    dans la grille, DNF = dernière place) au lieu des seuils fixes précédents.
- ✅ **Prêt pour éviter le blocage/game over** *(chat, retour aussi via un ami)* : carte "Prêt"
  dans Finances, disponible uniquement si trésorerie < 10 000€. Montant choisi jusqu'à 30 000€,
  remboursé à 125% du montant emprunté, prélevé automatiquement chaque semaine
  (`takeLoan`/`repayLoan` dans `state.js`, appelé depuis `runWeekBody`). Un seul prêt actif à la
  fois. Durée de remboursement désormais configurable (6 à 36 mois) — voir l'entrée dédiée dans
  "Pilotes & Contrats".
- ✅ Réduire le gain de réputation en cas de victoire, revoir plus largement le barème
  gains/pertes *(retour d'un ami — partiellement recoupé par l'ajustement `REP.s`/`REP.m` déjà
  fait dans `events.js`)* : entièrement résolu par le point ci-dessus — l'ancien barème
  (+5 à chaque victoire individuelle, potentiellement des dizaines de fois par saison) a disparu,
  remplacé par un gain unique et plafonné en fin de saison.
- ✅ Relation agence/équipe, réputation : bornes clarifiées (relation 0-200), barème des
  dilemmes recalibré (`REP.s`/`REP.m` réduits sur demande explicite), valeurs numériques
  affichées au lieu des symboles +/++/---.
- ✅ **La réputation reste toujours trop facile à obtenir** *(chat)* : première passe incomplète
  — "Campagne PR" (boutique agence, `infrastructure.js`) était un achat "flat" (+5 réputation
  pour 5000€) sans AUCUNE limite de rachat, permettant de convertir de la trésorerie en
  réputation illimitée ; fix initial = `cooldownWeeks: 8` sur cet item (`purchaseShopItem`,
  `state.shopCooldowns[itemId]` décompté dans `runWeekBody`, bouton "Disponible dans X sem."
  dans `shopCard`). **Corrigé par le joueur** : ce n'était qu'une fuite parmi d'autres — "Sans
  acheter l'infrastructure, je gagne de la réputation trop vite". Re-diagnostic par simulation
  Node isolée (`beginWeek`/`continueWeekAfterChoice` sur 260 semaines) : la vraie source
  dominante est `seasonReputationBonus` (`standings.js`, rolloverIfNeeded) accordé **par pilote**
  au classement final — une escouade passive de 6 pilotes qui ne touche ni aux dilemmes ni à la
  boutique atteignait quand même ~45 réputation en 5 saisons (au-delà du seuil F2 à 45) sur
  simple addition brute, juste en empilant les bonus de fin de saison de chaque pilote. Fix
  systémique : `applyReputationGain(state, rawDelta)` (nouvelle fonction partagée, `data.js`) —
  courbe à rendements décroissants (`scale = max(0.25, 1 - reputation/40)`) appliquée à TOUT gain
  positif de réputation, quelle que soit la source (bonus de fin de saison, dilemmes/événements,
  achat boutique) ; les pénalités négatives ne sont jamais adoucies. Palier plancher (0.25) atteint
  vers réputation 30, juste sous le seuil F2. Toutes les mutations directes de
  `state.agency.reputation` (positives) routées vers ce helper : `addReputation`/`media-buzz`/
  `media-invitation`/perte de sponsor (`events.js`), bonus de saison (`standings.js`), achat
  "Campagne PR" (`infrastructure.js`). Affichage réputation arrondi à l'écran (`layout.js`,
  `dev.js`) puisque la valeur interne est désormais un flottant. Vérifié par simulation Node
  (escouade de 6 pilotes, 5 saisons, choix toujours passifs : 45 → ~20 réputation avec le fix ;
  farming actif des dilemmes plafonne désormais autour du même ordre de grandeur que le jeu
  passif au lieu de s'envoler) et en jeu (mêmes scénarios rejoués via le débogueur de rendu,
  réputation affichée arrondie proprement, aucune erreur console).
- ✅ **Réputation encore trop facile après le fix ci-dessus** *(chat)* : "20/saison est trop
  haut" — la courbe à rendements décroissants atténuait mais ne corrigeait pas la vraie cause :
  `seasonReputationBonus` s'appliquait **par pilote ET par catégorie**, donc une agence avec
  plusieurs pilotes et/ou plusieurs championnats actifs en simultané empilait un bonus par
  écurie/tête au lieu d'un seul par saison. Cible donnée : ~80 de réputation en 10 saisons via
  la course seule (sans achats personnels), une stratégie de farming des dilemmes pouvant monter
  plus haut. Refonte dans `rolloverIfNeeded` (`standings.js`) : un seul MEILLEUR résultat compte
  pour toute l'agence par saison (plus de somme par pilote ni par catégorie) — `rolloverIfNeeded`
  se déclenche une fois par catégorie/classe dès que CETTE série atteint sa dernière manche, donc
  plusieurs appels peuvent tomber sur le même indice de saison à des semaines différentes ;
  `state.seasonRepBonusApplied[seasonIndex]` retient ce qui a déjà été crédité pour cette saison
  et ne complète que la différence si un appel ultérieur fait mieux, sans jamais redescendre ni
  additionner deux fois. Volontairement NON scalé par `applyReputationGain` — cette courbe reste
  réservée au canal farmable (dilemmes/boutique), le canal course est déjà auto-limité à +10/
  saison maximum (position 1). Calibration empirique (simulation Node avec contrat/relation/
  baquet maintenus à jour pour isoler le canal, sans le biais d'un pilote livré à l'abandon) :
  un pilote qui ne domine pas systématiquement une grille de 60 (karting) plafonne plutôt autour
  de 6-15 en 10 saisons, loin des 80 visés — **validé tel quel par le joueur** ("on laisse comme
  ça c'est très ok") plutôt que de regonfler le barème ou réautoriser le cumul, donc 80/10 saisons
  reste un maximum de champion plutôt qu'un rythme garanti. `SCHEMA_VERSION` 23→24
  (`seasonRepBonusApplied` ajouté à l'état). Vérifié par simulation Node (pilote dominant :
  exactement +10/saison capté dans `seasonRepBonusApplied`, aucun double comptage) et en jeu via
  le débogueur de rendu, aucune erreur console.

## Interface & Expérience utilisateur

- ✅ **Trier les catégories dans "Championnats" par type de course** *(chat, 2026-08-03)* :
  onglets de catégorie (`categoryTabs`, world.js — partagé par Monde ▸ Championnats ET Monde ▸
  Écuries) regroupés en 4 familles dans l'ordre Karting → Monoplace → Endurance → Rallye
  (nouveau `CATEGORY_FAMILIES`, world.js — display-only, ne touche pas `data.js`/la logique de
  jeu). Karting tranché en groupe à part plutôt que rattaché à Monoplace (choix utilisateur).
  **Ajustement demandé ensuite** : chaque famille sur sa propre ligne, jamais mélangée avec la
  suivante si les boutons wrappent (`.tab-row` dédié par famille, label + son propre `.tabs`,
  style.css) — remplace le premier jet où tout tenait dans un seul conteneur flex-wrap global.
  Vérifié en navigateur (4 lignes distinctes confirmées par `getBoundingClientRect().top` sur
  les 2 écrans concernés, aucune erreur console) et par `simulate_season.js` (aucun crash).
- ✅ **4 corrections rapides (bannière, dilemmes, Talents, classement)** *(chat)* : bannière
  défilante des courses à venir corrigée en 2 points — sens gauche→droite (nouveau
  `@keyframes ticker-scroll`, `translateX(-100%)` → `translateX(100vw)`, `style.css`) et
  continuité du défilement d'un rendu à l'autre (`tickerAnimationDelay()`, `layout.js` — calcule
  un `animation-delay` négatif basé sur l'heure réelle plutôt que sur le cycle de vie de
  l'élément, qui est recréé à chaque clic vu que toute l'app se re-rend en `innerHTML` ; ainsi
  un élément fraîchement recréé reprend l'animation exactement là où elle devrait être, sans
  saut visible). Boutons de dilemme : retiré la coloration par position (vert/gris inférée,
  jamais garantie fiable sur les 26 dilemmes) — tous les boutons utilisent désormais la même
  classe neutre `secondary` (`showEventModal`, `dialogs.js`). Talents : la colonne "Action" a
  maintenant une largeur fixe ancrée sur l'en-tête (`.col-talent-action`, `style.css`) au lieu
  de se redimensionner selon les boutons présents (Scouter/Scouting approfondi/Signer changent
  de nombre et de largeur selon l'état de scouting, ce qui faisait bouger toute la table).
  Classement (Monde ▸ Championnats) : la position est désormais colorée — 1er = or, 2e =
  argent, 3e = bronze, dans les points (jusqu'à `POINTS_TABLE.length`, soit le top 10) = blanc,
  hors des points = gris (`positionColorClass`, `world.js`, appliqué aux 3 tableaux pilotes/
  écuries/voitures). Vérifié en jeu : largeur de colonne Talents identique aux 3 étapes de
  scouting (217.27px avant/après scout/après scouting approfondi), sens et continuité de la
  bannière confirmés (`transform` positif, décalage d'animation qui suit l'horloge réelle),
  boutons de dilemme tous neutres, classement F1 coloré conforme (1-3 or/argent/bronze, 4-10
  blanc, 11+ gris), aucune erreur console.
  - ✅ **Icônes de statut dans "Mes pilotes"** *(chat)* : nouvelle colonne fine `.col-status-icons`
    (largeur fixe 70px, même principe que `.col-talent-action`) tout à gauche du tableau, avant
    "Nom" — `driverStatusIcons` (agency.js) affiche 🤕 blessé (`injuryWeeksRemaining > 0`,
    tooltip avec le nombre de semaines restantes), 🥇 leader du championnat (`championshipStanding`
    position 1, uniquement si le pilote court actuellement), ✍️ sans contrat d'agence
    (`driver.contract == null`), 🪑 sans écurie (`team == null`) — combinables sur une même ligne.
    Pas d'emoji "1 entouré de laurier or" natif disponible ; approximé avec la médaille d'or 🥇
    (à revoir en CSS si le rendu littéral est important). Vérifié en jeu (4 pilotes de test
    couvrant chaque état + une combinaison blessé+sans écurie, tooltips corrects, largeur de
    colonne identique à 52.4px avec 0 à 2 icônes, aucune erreur console).
    - ✅ **Icônes de statut supplémentaires** *(chat)* : les 5 idées suggérées, toutes ajoutées à
      `driverStatusIcons` (agency.js), dérivées de champs déjà existants — aucune nouvelle logique
      de jeu. 🏆 podium à la dernière course (`careerResults` dernière entrée, non-DNF,
      position≤3). ⏳ fin de contrat d'agence proche (`contract.weeksRemaining ≤ 4` — seuil choisi
      arbitrairement, distinct du cas "pas de contrat du tout" déjà couvert par ✍️). ⚠️ risque de
      débauchage actif — réutilise exactement `POACH_WARNING_THRESHOLD` (rivals.js) déjà utilisé
      par la bannière persistante (`poachRiskLine`, layout.js), même seuil, juste affiché aussi
      directement sur la ligne. 😃/😞 forme extrême — réutilise `formEmote`/`driver.form`, mais
      seulement à ses deux extrémités (>80 ou ≤20) pour ne pas alourdir chaque ligne avec les 3
      états intermédiaires. 🌱 recrue (`categoryId` actif + `seasonHistory.length === 0`) — pas
      d'icône "vétéran" symétrique ajoutée (aurait marqué la quasi-totalité du roster, peu utile).
      Vérifié en navigateur (pilote de test avec toutes les conditions actives simultanément :
      les 5 icônes + tooltips corrects ; puis conditions désactivées une à une : les icônes
      disparaissent bien individuellement, aucun faux positif), aucune erreur console.
  - ✅ **Remettre le défilement de la bannière dans l'autre sens** *(chat)* : revirement — le
    sens gauche→droite avait été explicitement demandé plus tôt dans la session, remis dans
    l'autre sens (droite→gauche) : `@keyframes ticker-scroll` (`style.css`) inversé
    (`from: translateX(100vw)` → `to: translateX(-100%)`). Bug latent trouvé et corrigé au
    passage : la durée CSS était restée à 22s alors que `TICKER_DURATION_S` (layout.js) avait
    été montée à 32s pour la bannière enrichie — les deux doivent rester synchronisées sinon le
    délai calculé en JS (`tickerAnimationDelay`) dérive progressivement par rapport au cycle CSS
    réel. Durée CSS remise à 32s. Vérifié en jeu (`animationDuration` confirmé à 32s, transform
    avec décalage X positif confirmant le sens droite→gauche), aucune erreur console.

- ✅ **Barre espace pour avancer d'une semaine** *(chat)* : raccourci clavier équivalent au
  bouton "Continuer" (`main.js`), désactivé quand un champ de saisie a le focus ou qu'une modale
  (dilemme, confirmation) est ouverte.
- ✅ **Menu de sauvegarde amélioré** *(chat)* : nouveau champ `state.saveName` (distinct du nom
  d'agence, purement additif, pas de bump de schéma) — champ texte éditable sur chaque ligne de
  l'écran "Charger une sauvegarde", bouton "Renommer" à côté de Charger/Supprimer
  (`renameSave` dans `state.js`, patch direct du JSON en `localStorage` sans charger toute la
  partie). Popup de confirmation dédié à la sauvegarde : `showSaveBanner` (`dialogs.js`) —
  plus grand, centré en haut de l'écran, distinct du toast standard (coin bas-droit, réservé
  aux sauvegardes automatiques silencieuses) ; branché sur le bouton "Sauvegarder" explicite
  uniquement. Vérifié en jeu : renommage persiste après aller-retour au menu principal, banner
  visible en haut au centre avec bordure verte/rouge selon succès/échec.
- ✅ Personnalisation d'équipe à la création de partie : au-delà du nom + couleur actuels,
  d'autres options de personnalisation non précisées. Résolu en "spécialité de fondation" —
  6 options (`AGENCY_SPECIALTIES`, data.js) sur l'écran "Nouvelle agence", 5 mappées chacune sur
  UNE facility existante (`infrastructure.js`) portée gratuitement à son 2e palier dès la
  création (Ancien pilote→Centre d'entraînement, Gestionnaire chevronné→Bureaux, Bien
  introduit→Bureau de standing, Chasseur de talents→Qualité des recruteurs, Réseau
  solide→Réseau de contacts), + "Aucune spécialité" qui préserve le départ classique (toutes
  facilities niveau 1). Aucun nouveau calcul : un palier 2 gratuit équivaut exactement à un
  achat immédiat de ce palier (même bonus, même entretien hebdomadaire récurrent dès la semaine
  1) — vrai compromis (bonus contre charge), pas un simple habillage. UI : liste verticale
  sélectionnable (`titleScreen.js`, nouvelles classes `.specialty-list`/`.specialty-option`).
  `agency.specialtyId` stocké (champ additif, pas de bump `SCHEMA_VERSION`). Vérifié par 19 tests
  Node isolés (chaque spécialité bump la bonne facility et UNIQUEMENT celle-là, "aucune
  spécialité"/id omis/id inconnu préservent le départ classique) et en jeu (6 options affichées
  avec description, sélection visuelle, facility correctement à 2 étoiles avec le bon entretien
  après création, "Aucune spécialité" laissant bien tout à 1 étoile), aucune erreur console.
- ✅ *(retour d'un ami, `BITWALL.txt`)* — boutons/couleurs : Retour (`.btn-red.btn-large`),
  Continuer (`.btn-green`), Améliorer investissements (`.btn-green`). Dilemmes : la donnée
  d'événement ne porte pas de tag accept/refuse par option, donc le ton est **inféré par
  position** (1ère option verte, dernière grise/secondary, milieu neutre) — cohérent avec la
  convention observée dans `events.js` mais pas garanti à 100% sur tous les événements ; à
  corriger avec un vrai champ `tone` par option si un cas incohérent est repéré en jouant.
  Ligne d'identité pilote (`.identity-line`, plus grande, non tronquée). Relation agence/équipe
  : jauge dégradée rouge→vert sur la fiche pilote (`relationGauge`), nombre coloré rouge/ambre/
  vert dans le tableau "Mes pilotes" (`relationColorClass`, une jauge pleine ne tenait pas dans
  la cellule). Forme en emote par tranche de 20 (😞😕😐🙂😃). Icône par catégorie
  (`CATEGORY_EMOJI` dans `data.js`) affichée partout où une catégorie apparaît (tableaux, fiche
  pilote, historique). Prestige des écuries en étoiles partout où il est affiché (offres
  reçues, fiche pilote, Monde ▸ Écuries), barème exact respecté et vérifié (51 → ★★★).
  Historique par écurie : un changement d'écurie en cours de saison clôture désormais une ligne
  distincte pour l'ancienne écurie (`recordSeasonStint` dans `team.js`, appelé depuis
  `assignSeat` et l'expiration de contrat dans `simulate.js`) au lieu de tout attribuer à la
  dernière écurie en fin de saison — vérifié par test isolé (2 courses écurie A + 3 courses
  écurie B = 5 au total, pas 10, aucun double comptage) ; tableau affiché du plus récent au
  plus ancien.
- ✅ **Tutoriel/parcours guidé en début de partie** *(retour d'un ami, format validé en chat
  2026-08-03)* : checklist dismissible "Premiers pas" (`tutorialCard`, agency.js) sur l'écran
  Mes pilotes — 4 étapes (scouter, signer, proposer aux écuries, simuler une semaine) qui se
  cochent automatiquement au fur et à mesure. Nouveau `state.tutorial` (`{scouted, signed,
  proposed, simulated, dismissed}`) mis à jour depuis main.js exclusivement (seule couche qui
  voit le résultat de chaque action à travers state.js/team.js) — jamais depuis les fonctions
  de jeu elles-mêmes. Bouton "Masquer" (`dismiss-tutorial`) disponible à tout moment, pas besoin
  d'avoir tout complété ; message "Tout est fait" une fois les 4 étapes cochées.
  `SCHEMA_VERSION` 29→30 (nouvel état de premier niveau). Vérifié en navigateur (partie
  fraîche, les 4 étapes cochées une à une dans l'ordre normal de jeu — scout réel, signature
  via la négociation, proposition aux écuries, semaine simulée — message final affiché,
  masquage confirmé), aucune erreur console.
- ✅ **La dernière sauvegarde n'a pas fonctionné** *(chat)* : cause trouvée — `saveGame()`
  retourne déjà `true`/`false` selon le succès (avec retry après purge des sauvegardes
  obsolètes en cas de quota plein), mais **4 des 5 sites d'appel dans `main.js` ignoraient ce
  retour** : sauvegarde auto de fin de semaine (×2, y compris après un choix de dilemme),
  sauvegarde après recrutement d'un pilote établi, et surtout le bouton "Sauvegarder" lui-même
  et le retour au menu principal — un échec passait uniquement en `console.error`, invisible
  pour le joueur. Corrigé : chaque site vérifie maintenant le retour et affiche un toast
  d'erreur explicite en cas d'échec ; le bouton "Sauvegarder" affiche aussi une confirmation de
  succès ; "Retour au menu principal" **bloque désormais la navigation** en cas d'échec (au
  lieu de vider l'état en mémoire et perdre la partie) — le texte trompeur "La partie est déjà
  sauvegardée" dans la popup de confirmation a aussi été retiré (le save a lieu après
  confirmation, pas avant). Vérifié en simulant un échec `localStorage.setItem` : toast
  d'erreur affiché, navigation bloquée, partie conservée ; puis vérifié le chemin normal
  (succès) après restauration.
- ✅ Menu de gauche (sidebar) + barre du haut fixes au défilement (`#app` en `height:100vh`
  + `overflow-y:auto`, `.content` seule scrolle).
- ✅ Menu principal (nouvelle partie / continuer / charger), personnalisation basique à la
  création de partie (nom + couleur).
- ✅ Menu Talents au-dessus de Staff ; Monde → Pilotes en liste unique non classée par
  catégorie + colonne catégorie.
- ✅ Scrollbar HUD discrète (pas de fond blanc) ; affichage du nom d'agence à la place de
  « Toi » dans les vues monde/championnats.
- ✅ ID unique de debug affiché à côté du nom du pilote (Mes pilotes).
- ✅ Toasts auto-dismiss en bas à droite pour les résultats de dilemmes ; modale de dilemme
  recentrée (remodelage suite à confusion initiale sur ce qui devait bouger).
- 🐛 ✅ *Corrigé* — bug nom d'agence qui s'efface si aucune couleur sélectionnée.

## Événements & Alertes

- ✅ **Retour au petit popup bas-droite pour les résultats de dilemmes/événements** *(chat,
  2026-08-04)* : revirement sur la passe précédente ("Popup résultat centrée pour events" —
  voir plus bas) — le grand modal centré restait réservé aux résultats de COURSE marquants
  (victoire/podium/abandon, inchangé), mais un résultat de dilemme/événement aléatoire est jugé
  trop fréquent pour mériter une interruption centrale. Nouvelle `showResultToast` (dialogs.js)
  réutilise le système de toast existant (coin bas-droit, auto-dismiss) au lieu de
  `showResultModal` — branché sur le callback de `showEventModal` (résolution d'un choix) et
  sur les events auto-résolus (`kind: "info"`, `main.js`). `.toast-info` (déjà existant dans
  style.css) sert de style neutre pour les tons "neutral". Vérifié en navigateur (dilemme forcé
  via hook temporaire, popup centré disparu, toast bas-droite confirmé par
  `getBoundingClientRect`), aucune erreur console.
- ✅ **Icônes pour les 5 nouvelles catégories** *(chat, 2026-08-04)* : `CATEGORY_EMOJI`
  (data.js) complété (🥐 MLMC, 🇪🇺 ELMS, 🌳 WRC2, 🏎️ Karting KZ1/KZ2, même icône que Karting
  Senior). Aucun autre changement nécessaire — affiché partout où `categoryLabel`/
  `CATEGORY_EMOJI` sont déjà consommés. Vérifié en navigateur sur les 5 nouvelles catégories.
- ✅ **Bannière des courses à venir + alertes dédiées (débauchage/recrutement rival)**
  *(chat, retour d'un ami)* : deux des 5 demandes de cette ligne. Nouvelle bannière défilante
  (`upcomingRacesLine`, `layout.js`) sous `.topbar-phase` — liste les courses des 4 prochaines
  semaines (calendrier déjà connu à l'avance via `category.calendar`, aucune nouvelle donnée),
  animation CSS `@keyframes ticker-scroll` (droite→gauche, 22s). Indicateur persistant
  "risque de débauchage" (`poachRiskLine`) : bandeau ambre affiché tant qu'au moins un pilote
  signé a `agencyRelationship < POACH_WARNING_THRESHOLD` (même seuil que le dilemme prioritaire
  `poach-dilemma` déjà existant, aucune nouvelle logique de jeu) — comble le trou entre deux
  déclenchements du dilemme (cooldown de 4 semaines) où le joueur n'avait aucun signal visible.
  Toasts ambre dédiés (`showToast(..., "warning")`, nouvelle classe `.toast-warning`) déclenchés
  au moment exact où `rival-poach`/`rival-scout-sign` se produisent (`handleSimulate`, `main.js`)
  — ces entrées existaient déjà dans "Nouveautés" comme simples `<li>` discrets, désormais aussi
  remontées immédiatement. Non-objectif explicite : "pilote à l'essai ailleurs" ne correspond à
  aucune mécanique existante (pas de concept d'essai/prêt dans le code) — nécessiterait
  d'inventer une mécanique entière, pas juste une alerte ; laissé de côté. Vérifié par 5 tests
  Node isolés (filtre de seuil, entrées rival-scout-sign obtenues en simulation réelle) et en
  jeu (bannière défilante visible avec le bon calendrier, bandeau ambre apparaît/disparaît selon
  le seuil, toast ambre `rgb(255,176,32)` confirmé au déclenchement réel via le bouton
  "Continuer"), aucune erreur console.
  - ✅ **Popup résultat centrée pour events + résultats de course marquants** *(chat)* :
    nouvelle `showResultModal(title, text, tone, icon)` (`dialogs.js`) — grand format centré,
    icône selon la tonalité (🎉/⚠️/ℹ️ par défaut, ou icône explicite comme 🏆/🏁), bordure colorée
    vert/rouge/gris (`--good`/`--danger`/`--border`). File d'attente interne (une popup visible à
    la fois, fermeture au clic ou après 5s, puis la suivante s'affiche) pour éviter l'empilement
    si plusieurs résultats notables tombent la même semaine. `showEventModal` l'utilise désormais
    au lieu du petit toast en coin pour l'issue d'un dilemme à choix. Les events auto-résolus
    (`kind: "info"`, sans choix) déclenchent maintenant AUSSI cette popup — ils n'avaient
    strictement aucun retour immédiat avant (visibles seulement plus tard dans "Nouveautés"/
    "Résultats"). Résultats de course : popup uniquement pour victoire/podium/abandon d'un pilote
    du joueur (pas chaque position, pour ne pas spammer une semaine à plusieurs pilotes engagés).
    Point technique : `more[0]` (résolution du dilemme dans `continueWeekAfterChoice`) est
    désormais exclu (`more.slice(1)`) du passage générique dans `showSimulationLogToasts` —
    sinon il aurait déclenché deux popups pour le même événement (une fois via le retour de
    `showEventModal`, une fois via le nouveau branchement `random-event`). Hors scope explicite :
    pas de vraie illustration/artwork par dilemme (emoji générique par tonalité uniquement) ;
    pas de popup pour un résultat de course hors podium/DNF. Vérifié en navigateur (partie
    fraîche, simulation de plusieurs semaines via clics "Continuer" réels : popup après un choix
    de dilemme, popup immédiate pour un event auto-résolu, file d'attente confirmée sans
    empilement même avec plusieurs popups déclenchées rapidement), aucune erreur console.
  - ✅ **Plus de lore/humour dans les textes d'événements** *(chat, 2026-08-04)* : passe
    d'écriture pure sur les 35 événements (`events.js` — 9 info + 26 dilemmes), sans toucher à
    un seul chiffre/effet. Scénarios (`text`) et résultats narratifs (`onSuccess`/`onFailure`)
    enrichis d'un détail concret ou d'une touche d'humour (ex. "Un avocat en costume sombre te
    propose une enveloppe généreuse..." pour `driver-lawsuit`, "Un investisseur en costume trop
    cintré veut entrer dans l'aventure" pour `investor-interest`). `tradeoff`/valeurs numériques
    strictement inchangés. Exception délibérée : `severe-injury` et `private-crisis` gardent un
    ton sobre (blessure/deuil), pas de trait d'humour forcé sur un sujet grave.
    Vérifié : `node -e "import(...)"` confirme l'absence d'erreur de syntaxe, diff limité aux
    lignes `text`/`title`/retours narratifs (vérifié par grep dédié), `simulate_season.js`
    identique bit pour bit sur la trajectoire économique (aucun changement de valeur), et en
    navigateur (4 dilemmes forcés via `Continuer`, nouveaux textes affichés, aucune erreur
    console).
- ✅ **Icône + bannière pour les offres exceptionnelles, bannière enrichie (infos + easter-eggs)**
  *(chat)* : "offre exceptionnelle" = l'offre ponctuelle de remplacement (`pendingSubstituteOffer`,
  voir plus haut) — nouvelle icône 🌟 dans la colonne de statut de "Mes pilotes"
  (`driverStatusIcons`, agency.js) + ligne dédiée dans la bannière défilante
  (`exceptionalOfferLines`, layout.js) tant que l'offre est active. Bannière élargie avec
  `usefulInfoLines` (layout.js) : pilotes blessés, leader(s) du championnat, fin de contrat
  d'agence proche (≤ 3 semaines), prêt en cours (montant restant + mensualité) — chaque ligne
  n'apparaît que si pertinente. Ajout d'un easter-egg cosmétique (`easterEggLine`, 10 phrases
  courtes sur le paddock/l'écurie, aucun effet de jeu) choisi de façon déterministe via
  `seed ^ week` (stable sur la semaine, pas à chaque clic). Durée de l'animation du ticker
  passée de 22s à 32s pour laisser le temps de lire le contenu plus long. Vérifié par test Node
  isolé (les 4 nouvelles lignes apparaissent bien dans le HTML rendu quand les conditions sont
  réunies) et en jeu (icône 🌟 + tooltip corrects dans Mes pilotes, bannière affichant blessure/
  offre exceptionnelle/fin de contrat/prêt/easter-egg simultanément, capture d'écran confirmée),
  aucune erreur console.
- ✅ Compagnies de sponsoring/publicité avec contrats dédiés ; récompenses/distinctions (prix
  décernés par journaux/magazines) — recoupait en partie le menu Palmarès (déjà existant, pas
  "futur") *(retour d'un ami)*. **Sponsoring** : nouveau fichier `src/game/sponsors.js`, un seul
  contrat sponsor actif à la fois (décision explicite avec l'utilisateur, pas de multi-slots) —
  pattern calqué sur `staffPool`/`refillStaffPool`/`hireStaff` (staff.js) : `sponsorPool` (3
  offres, rechargé chaque semaine dans `runWeekBody`), `signSponsor` (déplace l'offre vers
  `state.activeSponsor`), `terminateSponsor` (perte de réputation scalée par palier — 1 à 4 selon
  Bronze/Argent/Or/Platine — pas de frais en argent, pour rester lisible). 4 paliers gatés par
  réputation (`repRequired` 0/25/55/85, même échelle que les seuils de catégorie). Revenu
  hebdomadaire crédité dans `runWeekBody` (simulate.js), prime victoire/podium branchée dans le
  bloc pilote joueur existant de `simulateCategoryRace` (juste après le calcul de `race-prize`).
  UI : nouvelle section "Sponsoring" dans l'onglet Investissement (`agency.js`), bouton "Résilier"
  avec confirmation (`showConfirm`, même pattern que `release-driver`). `SCHEMA_VERSION` 27→28
  (nouvel état de premier niveau, sauvegarde d'un ancien schéma de toute façon invalidée).
  **Récompenses de presse** : nouvelle distinction "🌟 Révélation de l'agence" dans
  `palmares.js`, calquée EXACTEMENT sur la distinction existante "🏅 Pilote de l'agence de la
  saison" (`bestAgencyFinish`) — `bestRookieFinish` est elle aussi purement dérivée à l'affichage
  (aucune mutation d'état, aucun bonus de réputation mécanique), un pilote est "révélation" si la
  saison affichée est la plus ancienne de son `seasonHistory`. Les dilemmes sponsor ponctuels
  déjà existants (`sponsor-bonus`, `solo-sponsorship`, `sponsor-conditions`, `controversial-
  sponsor`) restent inchangés, mécanique complémentaire non remplacée. Vérifié par 21 tests Node
  isolés (gating par réputation, cycle signer/résilier, intégration hebdomadaire via
  `beginWeek`/`continueWeekAfterChoice`, `bestRookieFinish` sur historique mixte rookie/vétéran)
  et en jeu (pool affiché et gaté par réputation, signature/carte active/résiliation avec
  confirmation et perte de réputation, revenu hebdomadaire visible dans Finances, prime de
  victoire ET de podium créditées lors de courses réelles d'un pilote joueur, ligne Révélation
  affichée dans Palmarès), aucune erreur console.
- ✅ Événements aléatoires avec %, argent, réputation, relations, niveau, blessures, popup,
  choix (30 événements : 8 info + 22 dilemmes), façon Soccer Agent.
- ✅ Dilemmes — UX multi-lignes : chaque effet d'un `tradeoff` sur sa propre ligne, fourchette
  de probabilité attachée au premier effet de sa branche ; valeurs numériques au lieu des
  symboles +/++/---.
- ✅ Modale de dilemme sans étape de confirmation intermédiaire, résultat via toast.

## Fin de partie / Contenu end-game

- ✅ **Racheter une écurie et devenir manager d'équipe** *(chat, 2026-08-03/04, plan approuvé
  via EnterPlanMode)* : direction scopée en 3 questions de cadrage (déclencheur, mécaniques,
  portée), puis implémentée.
  - **Déclencheur** : réputation ET trésorerie combinées. `teamOwnershipRepRequired(category)`
    = `category.repRequired + 30` (bonus FLAT, pas un multiplicateur — un multiplicateur ×2.5
    testé d'abord donnait 200 de réputation requise pour F1, hors de portée vu la courbe à
    rendements décroissants déjà calibrée pour la réputation ; corrigé avant de livrer).
    `teamPurchasePrice(team, category)` = `category.seatCost × (5 + prestige/10)` — un karting
    modeste coûte ~20 000€, un top F1 plusieurs millions.
  - **3 mécaniques retenues, toutes implémentées** :
    1. Budget écurie séparé — `team.developmentLevel` (1-5, `MAX_TEAM_DEVELOPMENT_LEVEL`),
       `upgradeTeamDevelopment` (team.js, même schéma que `upgradeFacility`). Le bonus
       (`teamDevelopmentScoreBonus`, +3/niveau au-delà du niveau 1) est injecté dans
       `participantScore` (simulate.js) à côté de `carScore`/`investmentBonus` — s'applique à
       TOUT pilote de cette écurie, joueur ou IA, exactement comme `team.prestige` le fait déjà.
    2. Revenus d'écurie — nouveau tick hebdomadaire dans `runWeekBody` (simulate.js), parcourt
       `state.teams` à plat, une seule transaction `"team-revenue"` par semaine (revenu -
       entretien net) pour toutes les écuries possédées. `teamWeeklyRevenue` dérivé de
       `category.prizeScale` (l'unité déjà utilisée pour "combien d'argent circule par course
       dans cette catégorie") plutôt qu'une échelle inventée.
    3. Placement gratuit — `teamSeatCost(team, occupant)` retourne `0` immédiatement si
       `team.ownedByPlayer`, un seul point de sortie qui couvre automatiquement les 3 sites de
       facturation existants (`assignSeat`/`joinSecondaryChampionship`/`acceptSubstituteOffer`)
       et l'aperçu `secondarySeatCost` sans les toucher individuellement.
  - **Portée** : plusieurs écuries rachetables, aucun plafond dur (le prix croissant avec le
    prestige/tier est déjà un frein économique naturel).
  - **Aucun bump `SCHEMA_VERSION`** : `ownedByPlayer`/`developmentLevel` vivent directement sur
    l'objet `team` (déjà dans `state.teams`, déjà persisté intégralement) — même précédent que
    `team.lastSeasonRank`/`bestPositionThisSeason`, ajoutés après coup sans bump.
  - UI : bouton "Racheter (X€)" sur chaque carte d'écurie non possédée dans Monde ▸ Écuries
    (gaté par réputation, même convention que `facilityCard`), badge "Ton écurie" sur celles
    déjà possédées ; nouvelle section "Mes écuries" dans Investissement (`teamOwnershipCard`,
    calquée sur `facilityCard` — étoiles, revenu/entretien actuels, bouton "Développer").
  - Vérifié par script Node isolé (prix/réputation cohérents par tier, `buyTeam` refuse sous
    les deux seuils et réussit au-dessus, `teamSeatCost` à 0 pour une écurie possédée, bonus de
    développement qui progresse avec le niveau) et en navigateur (achat réel via le menu
    Développeur pour débloquer réputation/argent, badge confirmé, section Mes écuries affichée,
    amélioration réussie niveau 1→2, un pilote signé rejoint l'écurie possédée à "Rejoindre
    (0€)" avec trésorerie inchangée avant/après, tick hebdomadaire confirmé — transaction
    `team-revenue` de 69€ - 40€ = 29€ exactement conforme au calcul attendu), aucune erreur
    console. `simulate_season.js` (2 saisons/104 semaines) : aucun crash, trajectoire
    identique (aucune écurie possédée dans ce scénario, comme attendu).

## Outils développeur

- ✅ **Menu développeur (activable/désactivable)** *(chat)* : ajouter de l'argent, forcer la
  signature d'un pilote, etc. — un mode "tous les droits" pour tester rapidement. Toggle "Mode dev"
  en bas de la sidebar, entrée "Développeur" conditionnelle dans le menu, page dédiée
  (ajout trésorerie +10k/+100k/+1M, réputation +10/+50, signature gratuite d'un talent du vivier,
  contrat d'écurie forcé et contrat d'agence forcé pour un pilote de l'agence qui en manque).
  En plus de la page dédiée : quand le mode dev est ON, TOUTES les actions du jeu (scouter,
  signer, négocier, proposer aux écuries, rejoindre une écurie, 2e championnat, recruter/acheter
  staff-infrastructure-boutique, approcher un pilote établi) réussissent à 100% sans débiter la
  trésorerie — chaque fonction de `game/*.js` concernée accepte désormais un flag `{ force }`
  que `main.js` passe automatiquement dès que `state.ui.devMode` est actif.

