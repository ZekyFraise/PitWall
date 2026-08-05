# CONTEXT.md — État d'avancement de Pit Wall

> Ce fichier bouge vite. Le relire en entier en début de session, le mettre à jour à la fin
> de chaque session (nouvelle fonctionnalité, bug corrigé, décision prise). Voir `CLAUDE.md`
> pour l'archi/conventions stables, et `TODO.md` pour le backlog issu du journal de
> conception de l'utilisateur (`Choses à modifier.docx`) — ce contenu-là ne vit pas ici.

**`SCHEMA_VERSION` actuel : 30.** Toute sauvegarde antérieure est rejetée proprement (pas
de migration — politique assumée). Principales étapes depuis 22 : 24→25 (refonte
Investissement/recrutement staff), 26 (Vie personnelle), 27→28 (marché des transferts,
sponsoring), 28→29 (académies de pilote), 29→30 (checklist "Premiers pas"). Les champs
purement additifs (traits acquis, contre-offre, spécialité de fondation, etc.) n'ont
volontairement PAS bumpé le schéma — seuls les changements de forme significatifs de premier
niveau le font.

## Ce qui est implémenté (vue d'ensemble)

- **Génération du monde** : 12 catégories (Karting Senior/KZ1/KZ2, F4, F3, F2, F1, WEC, MLMC,
  ELMS, WRC, WRC2) avec structures d'équipe réalistes (fixe/variable/explicite), calendriers
  déterministes sur 40/52 semaines (mercato hivernal sem 1-6, silly season 26-31), tiers de
  progression sans retour arrière. MLMC/ELMS (tier 2, sous WEC) et WRC2 (tier 2, sous WRC) sont
  des feeder series construites sur le même système générique `classes`/`driversPerCar` que
  WEC — voir entrée dédiée ci-dessous et historique récent.
- **WEC** : un seul championnat avec deux sous-classes (`subClass: "hypercar"|"gt3"` sur
  l'équipe), classement par voiture, co-pilotes partageant les mêmes points. Hypercar = 9
  équipes / 9 marques strictement uniques (1-à-1). GT3 = 18 équipes, les 14 marques du pool
  garanties présentes au moins une fois (min-occurrence), le reste réparti aléatoirement.
  F1 et WRC : assignation de marque 1-à-1 stricte également. Karting : min-occurrence.
- **MLMC/ELMS** (endurance, sous WEC) : mêmes mécaniques génériques que WEC (`classes`,
  `driversPerCar` 2 et 3 respectivement, min-occurrence de marque par classe). Certaines
  classes (LMP3/LMP2 Pro/Am, GT3) exigent au moins un pilote **Bronze** par voiture
  (`driver.isBronze`, tiré rare ~8% à la génération comme `isPro`) — garanti à la génération
  initiale des équipes IA (`generateAllTeams`), pas re-vérifié sur les remplacements
  ultérieurs ni imposé au joueur (contrainte volontairement cosmétique, pas une règle dure).
  WRC2 : structure identique à WRC, un cran en dessous (tier 2).
- **Scouting** : potentiel caché par défaut, scouting normal révèle un sous-ensemble de
  groupes d'attributs avec une fourchette (`discoverySkill`/`precisionSkill` du recruteur),
  Scouting approfondi (2 500€) révèle le potentiel exact et suspend la révélation auto
  pendant 2 semaines.
- **Contrats** : distinction stricte contrat AGENCE (salaire/durée, lie le pilote à
  l'agence) vs baquet ÉCURIE (assignation de seat, sans lien contractuel propre). À
  l'expiration du contrat de courses (fin de saison), le baquet est libéré (pilote devient
  "benché") mais le pilote **reste** dans l'agence — c'est une correction volontaire d'un
  comportement antérieur (voir `TODO.md`, section « fait différemment de la demande
  d'origine »).
- **Loyauté & débauchage** : décadence hebdomadaire de la relation agence pour tout pilote
  benché, dilemme de débauchage prioritaire dès relation < 40 (`POACH_WARNING_THRESHOLD`),
  débauchage silencieux possible sous 25 (`POACH_RISK_THRESHOLD`), indemnité de débauchage
  = 10-30% de la valeur marché selon le tier (nerfée pour ne plus être un exploit).
- **Budgets** : Budget course (investissement per-driver, boost de performance) vs Budget de
  recrutement (pot-de-vin agence → écurie, réellement débité à l'acceptation d'une offre).
- **Événements aléatoires** : moteur avec pool info (8) + choix (26, dont les 22 dilemmes
  "vie de pilote" les plus récents), cooldown de 4 semaines par événement, dilemme de
  débauchage prioritaire. Résolution immédiate au clic (pas d'étape de confirmation), retour
  d'issue via toast auto-disparaissant (haut-droite, 4s).
- **Staff** : 7 rôles (recruteur, négociateur, préparateur physique/mental, coach pilotage,
  directeur financier, avocat), génération IA massive (30 au lancement, 60% répartis sur les
  agences rivales, le reste dans le pool de recrutement du joueur, taille de pool 8).
- **Stats pilote** : `agencyRelationship`/`teamRelationship` (0-200), `form` (0-100, neutre
  50, influence légèrement le rythme en course), `Rythme`/`Régularité`/`Potentiel` affichés
  dans Talents.
- **Finances** : trésorerie, graphique ligne + barres recettes/dépenses 10 dernières
  semaines, **popup au survol** d'une barre détaillant les sources (recettes/dépenses par
  catégorie), boutique agence (réputation), infrastructure (bureaux/entraînement/standing).
- **UI Monde** : Pilotes en liste plate (toutes catégories mélangées, colonne Catégorie),
  Staff en liste plate similaire (colonnes Catégorie/Rôle), Championnats et Écuries par
  onglet de catégorie.
- **Debug** : ID unique affiché à côté du nom de chaque pilote dans "Mes pilotes" (marqué
  `<!-- DEBUG -->`, à retirer avant une éventuelle release).
- **Robustesse** : `saveGame` gère `QuotaExceededError` (purge des sauvegardes orphelines de
  schéma obsolète puis retry), `createNewGame` wrappé en try/catch avec toast d'erreur,
  `pickRaceNumber` a un fallback déterministe borné (plus de boucle infinie possible),
  génération de marques avec pool de secours si tableau vide.
- **Super statistiques** : 5 stats dérivées (Rythme/Régularité/Résistance/Adaptabilité/Instinct,
  chacune moyenne de 5-6 attributs bruts) sont les vrais inputs d'`overallRating`/`reliability`
  et de la simulation de course — les 32 attributs bruts restent la couche génération/scouting.
- **Traits** : 15 traits pilote + 10 traits staff fixés à la génération (bonus de stat/biais de
  dilemme), révélés par scouting approfondi. 6 traits pilote sont en plus **acquérables
  dynamiquement** en fin de saison selon la performance (victoires, régularité, relation
  agence) — plafond de 2 traits inchangé, seul un trait déjà ACQUIS peut être remplacé (jamais
  un trait inné). Marqués 🌱 sur la fiche pilote, annoncés dans le log Résultats.
- **Marché des transferts** : le dilemme "offre de transfert" ouvre une vraie négociation
  (indemnité proposée par le joueur, acceptée ou non selon son écart à la valeur marché) au lieu
  d'un accepter/refuser figé. Côté contrat AGENCE, un refus déclenche une contre-offre chiffrée
  du pilote (selon relation/patience) reprenable en un clic.
- **Sponsoring** : un contrat sponsor unique à la fois (4 paliers gatés par réputation), revenu
  hebdomadaire + primes de victoire/podium, résiliable avec perte de réputation scalée par
  palier. Distinct des dilemmes sponsor ponctuels existants (inchangés).
- **Vie personnelle de l'agent** (`lifestyle.js`) : 3 catégories (Logement/Véhicule/Formation),
  pur confort sans effet mécanique sur l'agence sauf +1 réputation à chaque achat.
- **Spécialité de fondation** : à la création de partie, 5 perks optionnels (+ "aucune") qui
  portent gratuitement UNE infrastructure à son 2ᵉ palier dès le départ (même bonus, même
  entretien hebdomadaire que si elle avait été achetée).
- **Palmarès** : écran dédié listant les champions par saison/catégorie, plus deux distinctions
  d'ambiance dérivées à l'affichage ("Pilote de l'agence de la saison", "Révélation de l'agence").
- **Infrastructure/staff (refonte)** : Bureaux, Qualité des recruteurs et Réseau de contacts
  vont jusqu'à 8 paliers ; le recrutement staff a un fog-of-war (scout/deep-scout) et des
  profils elite/spécialités, alimentés par `contactNetwork`.
- **Barèmes de points réalistes** par catégorie/classe (`pointsTableFor`) + bonus Power Stage
  WRC, au lieu d'un barème F1 unique appliqué partout.
- **Saut de catégorie conditionnel** : un pilote peut sauter un tier si ses stats le
  justifient largement (`tierSkipEligible`), signalé par un badge "⚡" dans l'UI.
- **Académies de pilote** (`academies.js`) : 6 académies (2 par programme phare F1/WEC
  Hypercar/WRC), chacune liée à une équipe existante distincte, parrainant ~15% des jeunes
  prospects du vivier. Relation dédiée (défaut 50) qui renchérit ou adoucit le coût de
  recrutement d'un de leurs jeunes, financement payant avec cooldown, retrait définitif du
  vivier si le prospect n'est pas recruté à temps (`tickAcademyGraduation`). Écran dédié
  "Monde ▸ Académies".
- **Rachat d'écurie (end-game)** : `team.ownedByPlayer`/`team.developmentLevel` (1-5) posés
  directement sur l'objet équipe existant — aucun bump de schéma. Développement de l'écurie
  (`teamDevelopmentScoreBonus`) profite à TOUS ses pilotes (joueur et IA), revenu hebdomadaire
  net (`teamWeeklyRevenue - teamDevelopmentUpkeep`) crédité une fois par semaine, placement des
  pilotes du joueur toujours gratuit (`teamSeatCost` court-circuité). Achat gaté par réputation
  ET trésorerie (`teamOwnershipRepRequired`/`teamPurchasePrice`, dérivés de `category.seatCost`/
  `repRequired`/`prizeScale` — pas de nouvelle échelle inventée). UI : bouton "Racheter" sur les
  cartes d'écurie (Monde ▸ Écuries), section "Mes écuries" dans Investissement.

## Décision de design (non issue du journal, à retenir)

- **Frais de gestion amateurs** : passés de `coût/20` à `coût/40` par semaine pour fermer un
  exploit de "planche à billets" (négociation de contrat avec salaire élevé traité comme
  généreux même pour un amateur qui *paie* l'agence — corrigé en inversant la logique de
  générosité pour les amateurs + plafond dur à 2× la base).

## Questions d'équilibrage ouvertes (pas des bugs, à trancher par l'utilisateur)

- 🔄 **Revirement dans la même session** — frais de gestion amateurs. Décision initiale ("un
  2ᵉ pilote finançable dès la deuxième saison me semble ok", `/40` déjà suffisant à la semaine
  28) **explicitement corrigée ensuite** par l'utilisateur : cible resserrée à "financable en
  deuxième OU troisième saison" (donc plus tard que la semaine 28 mesurée), dans le cadre d'une
  demande plus large de rendre le jeu globalement plus corsé. `/40` → **`/60`** (`signDriver`,
  `state.js`). Calibré par simulation Node isolée sur 8 seeds (scénario 1 pilote, mêmes
  conditions que ci-dessus) : la seule variable "frais hebdo" ne pilote pas tout — les primes
  de course et les dilemmes à argent (`documentary-offer`, `sponsor-conditions`...) pèsent
  souvent plus lourd qu'elle sur les seeds "chanceux", d'où une distribution étalée même à
  diviseur fixe (semaines observées à `/60` : 154/47/132/64/37/103/40/29, soit saisons
  1 à 3 selon la seed) plutôt qu'un seuil net. `/60` déplace la MÉDIANE en saison 2 sans jamais
  rendre le 2ᵉ pilote injouable sur les 8 seeds testées (contrairement à `/70`+, qui produisait
  un cas "jamais finançable avant semaine 250"). Vérifié en navigateur (signature réelle,
  salaire hebdo affiché "+508€/sem" cohérent avec `cost/60`), aucune erreur console.
- ✅ **Tranché cette session** — "difficulté globale un peu plus corsée, la saison 10 devient
  relativement facile". L'utilisateur a précisé deux symptômes concrets : pilotes en F1 dès
  18 ans (devrait rester rare, pas la norme) + trop d'argent. Un premier script diagnostic
  "agence naïve" n'avait montré aucune trajectoire facile — le vrai diagnostic est venu de deux
  causes distinctes trouvées par simulation ciblée :
  - **Vieillissement quasi nul** (cause du problème d'âge) : `driver.age` n'avançait que via un
    tirage 2%/course (~0.4 an/saison réel) alors que toute la courbe de progression
    (`peakAge`/`ageFactor` sur 10 ans, `driver.js`) suppose ~1 an/saison, cohérent avec le
    libellé UI "52 semaines = 1 an". Un pilote grimpait donc plusieurs tiers en restant
    quasiment au même âge, ET gardait un `ageFactor` élevé (croissance rapide) bien plus
    longtemps que prévu puisque l'âge n'avançait jamais vers le pic. Remplacé par un tick fiable
    +1 an au début de chaque saison de 52 semaines (`runWeekBody`, `simulate.js`), appliqué à
    `state.drivers` ET `state.aiDrivers` (le tirage 2%/course par ligne supprimé). Vérifié par
    script isolé (17→18→19→20→21 exactement à chaque frontière de saison sur 5 saisons) et en
    navigateur (hook temporaire, semaine forcée à 51 puis "Continuer" cliqué réellement : 23→24
    pile au passage semaine52→53, aucune erreur console).
  - **Argent des dilemmes dominant l'économie** (cause du problème d'argent) : simulation
    10 saisons avec politique de jeu raisonnable (signature seulement avec réserve ×2, pas
    d'achat compulsif) — le revenu `random-event` dominait 5-10× les primes de course presque
    chaque saison (ex. saison 7 : 87 462€ de dilemmes contre 8 336€ de primes), la course
    elle-même ne pesait presque rien dans l'économie. Détail par libellé : `Sponsor
    controversé` (`controversial-sponsor`, events.js) ressortait seul à 110 000€ sur 10 saisons,
    2,5× la 2ᵉ source — seul dilemme "argent" du lot à utiliser le palier `MONEY.l` pour un coût
    quasi nul (réputation -1, comme les autres). Deux corrections : (1) `MONEY` (events.js)
    divisé par deux (3000/8000/20000 → 1500/4000/10000) — impacte symétriquement les dilemmes
    coût ET gain, donc resserre le volume global sans changer l'équilibre relatif entre eux ;
    (2) `controversial-sponsor` ramené du palier `l` au palier `m` (`MONEY.m` au lieu de
    `MONEY.l`), aligné sur ses pairs thématiques (`documentary-offer`, `tax-evasion`,
    `driver-lawsuit`). Re-simulé : plus aucune source individuelle ne domine outrageusement
    (48 000€ pour `Sponsor controversé` sur 10 saisons, comparable aux autres), trajectoire de
    trésorerie nettement plus tendue (négative certaines saisons, roster qui rétrécit) — cohérent
    avec l'objectif "plus corsé". Vérifié en navigateur (dilemme "Demande de prêt" affichant
    bien `-1 500€`, dilemme "Procès d'un pilote célèbre" résolu sans erreur), aucun crash sur
    `simulate_season.js` (2 saisons/104 semaines) après les deux passes de changement.
  - Non touché dans cette passe : le saut de catégorie par budget (`tierSkipEligible`,
    `team.js`, seuil `budget >= seatCost × 15`) reste identique — l'hypothèse initiale que ce
    levier expliquait "F1 à 18 ans" s'est avérée secondaire une fois l'âge corrigé (climber les
    tiers vite ne pose plus de problème si l'âge suit realistically). À surveiller si le
    symptôme persiste malgré le fix d'âge.
- ✅ *Traité cette session* — audit d'équilibrage des 22 dilemmes récents (voir historique
  ci-dessous). Reste à surveiller à l'usage si d'autres patterns d'exploit apparaissent
  ailleurs dans le pool (pas de re-passage exhaustif prévu sauf signal en jeu).

## Historique récent (sessions condensées, plus anciennes en bas)

0. **Audit d'équilibrage des 22 dilemmes récents** (question ouverte depuis la session
   précédente) : relecture complète d'`events.js`, 4 trouvailles corrigées.
   - **Contournement du plafond `growthCeiling`** (trouvaille principale) : `adjustOverall`
     (utilisée par 7 des 22 dilemmes — `psychological-issues`, `personal-trainer`,
     `late-training`, `team-camp`, `language-course`, `doping-request`, `severe-injury`,
     `great-performance`) modifiait les attributs bruts en les clampant seulement `[0,99]`,
     sans jamais consulter `driver.growthCeiling` — contournant entièrement le système de
     plafond de progression retravaillé sur plusieurs sessions (bust/wonderkid/`growthLuck`).
     Corrigé : un delta positif est désormais borné par la marge restante avant
     `growthCeiling` (même logique que `growDriver`) ; un delta négatif (pénalité) s'applique
     toujours librement. Vérifié par script isolé (pilote "bust" plafonné à 65 : sans le fix,
     10 déclenchements de +2 suffisaient à passer de 49.1 à 69.1 — largement au-delà du
     plafond ; avec le fix, 20 déclenchements de +2 s'arrêtent pile à 65.0) et en navigateur
     (hook de debug temporaire, les 4 événements forcés via `triggerRandomEvent`/
     `resolveEventChoice` importés dynamiquement, effets réels et textes vérifiés).
   - **`driver-lawsuit`/`documentary-offer` sans aucun coût** : les deux seules options
     "argent facile" du lot sans contrepartie (contrairement à `tax-evasion`/
     `controversial-sponsor`, qui payent toutes deux en réputation) — ajouté réputation -1 aux
     deux, aligné sur le pattern existant.
   - **`great-performance` : choix factice** — "Le féliciter" dominait strictement "Ne rien
     dire" (aucun risque, gain garanti). Redessiné en vrai choix risque/sécurité : "Féliciter
     publiquement" (70% niveau+1/relation+12, 30% niveau-1 — trop sûr de lui) vs
     "Reconnaissance discrète" (relation+6 garanti, sans risque).
   - **`doping-request` : option responsable punie sans contrepartie** — "Le sermonner
     fermement" coûtait relation -22 (palier `RELATION.l`, le plus élevé du barème) sans aucun
     bénéfice, rendant le choix "correct" strictement pire que le pari du dopage. Réduit à
     -12 (`RELATION.m`) + réputation +1 en compensation.
   Vérifié par simulation headless (`simulate_season.js`, 2 saisons/104 semaines, aucun crash,
   0 avertissement) et en navigateur (hook `window.__pwState`/`__pwRender` temporaire dans
   `main.js`, retiré avant de conclure — les 4 événements forcés via import dynamique du
   module, textes de tradeoff et effets réels vérifiés, aucune erreur console). Nouveau
   `.claude/launch.json` créé au passage (absent du projet) pour permettre la vérification
   navigateur via `preview_start` à l'avenir.
   - **Frais de gestion amateurs `/40` → `/60`** : voir "Questions d'équilibrage" ci-dessus —
     revirement en cours de session sur la cible (saison 1 jugé trop facile après coup, cible
     resserrée à saison 2-3).
   - **TODO.md** : ajout d'une piste end-game (rachat d'écurie / mode manager d'équipe),
     idée seulement, non scopée.
   - **Vieillissement quasi nul + argent des dilemmes dominant** : voir "Questions
     d'équilibrage" ci-dessus — tranché et corrigé (tick d'âge +1/saison, `MONEY` divisé par
     deux, `controversial-sponsor` recalibré).
   - **Académies de pilote** (voir aussi "Ce qui est implémenté") : nouveau `academies.js`,
     6 académies liées chacune à une équipe existante (2 par programme phare F1/WEC
     Hypercar/WRC), ~15% des jeunes prospects affiliés, relation dédiée qui module le coût de
     recrutement (surcoût ×1.0-1.6) et baisse de -10 à la signature, financement payant avec
     cooldown, retrait définitif du vivier si non recruté à temps (`tickAcademyGraduation`,
     tick hebdo léger — pas de simulation complète du pipeline de placement, jugé hors scope
     v1). Écran "Monde ▸ Académies" + badge 🎓 dans Talents. `SCHEMA_VERSION` 28→29.
   - **Nouveaux championnats (MLMC, ELMS, WRC2, Karting KZ1/KZ2)** *(plan approuvé via
     EnterPlanMode avant implémentation, vu la taille comparable à la refonte WEC initiale)* :
     voir détail dans TODO.md/"Ce qui est implémenté". Point notable : le système WEC
     (`classes`/`driversPerCar`/`carClassification`) s'est révélé déjà entièrement générique
     dans team.js/simulate.js/standings.js/world.js — seuls 3 hardcodes `id==="wec"/"rally"`
     ont dû être généralisés (nouveau champ `category.profile`). Nouvelle notion de pilote
     **Bronze** (`driver.isBronze`, rare, garanti ≥1/voiture dans les classes Pro/Am à la
     génération IA initiale seulement). Aucun bump `SCHEMA_VERSION` (donnée statique).
   - **Petits ajustements de suivi** (icônes des 5 nouvelles catégories, garde-fou talent/âge
     sur le tag académie, popups de dilemme/événement repassés en petit toast bas-droite au
     lieu du grand modal centré — voir TODO.md pour le détail de chacun).
   - **Négociation à la signature d'un pilote** (nouvelle `negotiateSigning`, même moteur
     déterministe que `negotiateContract` — pas un jet indépendant) dans une vraie fenêtre
     modale superposée (`showNegotiationModal`, dialogs.js) qui reste ouverte sur un refus avec
     contre-offre pré-remplie. `signDriver` (prix fixe instantané) réservé au mode dev.
   - **Historique de carrière fabriqué pour les recrues >19 ans** (`fabricatePriorCareer`,
     state.js) : 1-3 saisons plausibles (karting→F4→F3, vraies équipes existantes) peuplent
     `driver.seasonHistory`/`highestTierReached` — scope limité à la fiche du pilote,
     `state.seasonArchive` non touché (voir TODO.md pour le détail de l'arbitrage).
   - **Scouting** : `generateScoutReveal` garantit désormais 1 attribut révélé par super stat
     (au lieu d'un tirage pur sur les ~32 attributs), pour qu'aucun super stat ne reste
     quasi-systématiquement vide chez un recruteur faible.
   - **Tutoriel "Premiers pas"** : checklist dismissible sur Mes pilotes (4 étapes : scouter/
     signer/proposer/simuler), état mis à jour uniquement depuis main.js. `SCHEMA_VERSION`
     29→30.
   - **Lore/humour dans les 35 événements** (`events.js`) : passe d'écriture pure, aucun
     chiffre/effet touché — `severe-injury`/`private-crisis` gardent volontairement un ton
     sobre.
   - **CLAUDE.md remis à jour** : 7→12 catégories, carte des fichiers (`academies.js` manquant,
     nouvelles fonctions state.js/dialogs.js), 2 nouvelles conventions (`category.profile`
     déclaratif, invariant `adjustOverall`/`growthCeiling`).
   - **Rachat d'écurie / mode manager** (plan approuvé via EnterPlanMode, cadrage en 3
     questions avant implémentation) : voir "Ce qui est implémenté" pour le détail mécanique.
     Point notable trouvé pendant la vérification : la première formule de seuil de réputation
     (×2.5 sur `repRequired`) donnait 200 pour F1, hors de portée de la courbe à rendements
     décroissants déjà calibrée cette session pour la réputation — corrigée en `+30` (bonus
     flat) avant de livrer.
   - **Beta-test 5 saisons ×3 + corrections d'équilibrage** : 3 simulations headless de
     260 semaines jouées avec une politique "beta testeur" disciplinée (`BETA_TEST_REPORT.md`/
     `_2.md`/`_3.md`, ad-hoc, gardés comme artefacts d'analyse — pas des outils permanents comme
     `simulate_season.js`), sur 3 graines et pilotes différents (potentiel 46 à 88). Schémas
     récurrents identifiés : renouvellement de contrat qui échoue presque toujours (2/14, 0/49,
     0/31 sur les 3 runs), perte du pilote unique suivie de 45 à 155 semaines sans aucun pilote,
     cycle prêt d'urgence/quasi-faillite répété. Plan approuvé via `EnterPlanMode` (voir
     TODO.md pour le détail complet) : reweight générosité renouvellement (75/25 salaire/
     indemnité au lieu de 50/50), indemnité de renouvellement étalable en plusieurs versements
     (`negotiateContract`/`payDriverInstallments`, state.js), remise ×0.5 sur `signCost` et
     plafond d'emprunt doublé (`loanMaxAmount`) quand l'effectif est à 0, risque de départ
     immédiat du dilemme "Tentative de débauchage" réduit de 20% à 5% quand c'est le seul
     pilote, salaires de staff réduits de moitié tant que l'effectif est vide, nouvelle bannière
     proactive (`noDriverBanner`, layout.js). Point notable trouvé en cours de route : la
     réputation par classement final de saison (`seasonReputationBonus`/`rolloverIfNeeded`,
     standings.js) existait déjà avant cette session — n'apparaissait presque jamais dans les
     runs car les pilotes étaient rarement seated une saison complète, pas un manque à combler.
     Aucun bump `SCHEMA_VERSION` (champs additifs sur des objets déjà persistés). Vérifié par
     2 scripts Node isolés + `simulate_season.js` + une ré-exécution ciblée de 130 semaines sur
     la graine du run le plus touché (0/49 renouvellements → 1/1, semaines sans pilote de plus
     de 60% à 23% de la fenêtre) + navigateur (bannière, champ d'étalement, solde qui décroît
     semaine après semaine), aucune erreur console.
1. Session longue, 4 features majeures livrées via le cycle plan→implémente→teste→vérifie
   navigateur→documente TODO.md, dans l'ordre :
   - **Marché des transferts en négociation** : le dilemme "offre de transfert" ouvre une
     négociation (`negotiateTransfer`, team.js) au lieu d'accepter/refuser un montant imposé,
     + **contre-offre du pilote** pendant la négociation de contrat AGENCE (`buildCounterOffer`,
     state.js) sur refus, reprenable en un clic sans perdre l'affichage.
   - **Traits acquis dynamiquement** : 6 des 15 traits pilote marqués `acquirable`, gagnés/
     remplacés en fin de saison selon la performance (`checkSeasonTraitMilestone`, traits.js),
     branché dans `rolloverIfNeeded` (standings.js). Cap de 2 traits inchangé, un trait inné
     n'est jamais évincé.
   - **Sponsoring + récompenses de presse** : nouveau `sponsors.js` (contrat unique, 4 paliers,
     revenu hebdo + primes victoire/podium), + nouvelle distinction "Révélation de l'agence"
     dans le Palmarès existant. `SCHEMA_VERSION` 27→28.
   - **Spécialité de fondation** : 5 perks (+ "aucune") à la création de partie, chacun porte
     gratuitement une infrastructure existante à son 2ᵉ palier (`AGENCY_SPECIALTIES`, data.js).
   Pattern de vérification systématique établi/réutilisé : hook de debug temporaire
   (`window.__pwState`/`__pwRender` dans `main.js`, retiré avant de conclure), avancement de
   semaine manuel pour contourner le déterminisme de `makeRng(state)` par semaine, et
   `makeControlledRng` pour forcer un jet précis sans casser les tirages avals (assignSeat).
1. 7 features/fixes en une passe : pool de staff mondial ×4 (30→120, même volume/logique
   que la génération de pilotes), Talents cliquable (modale de détail des stats découvertes
   via `showInfoModal`), classement d'équipe avec fallback sur `team.lastSeasonRank` (calculé
   au rollover de saison dans `standings.js`), toggle d'échelle Finances (10 sem / 1 saison /
   Tout, `state.ui.financeWindow`), tradeoffs de dilemme éclatés en une ligne par effet
   (`formatTradeoffLines` dans `dialogs.js`), clarification "Sans contrat (en piste)" pour un
   pilote seated sans contrat d'agence (état atteignable via `offersSection` qui ne bloque pas
   sur le statut du contrat), onglet Nouveautés scindé en Nouveautés/Résultats. Pas de bump
   `SCHEMA_VERSION` — tous les nouveaux champs sont additifs avec fallback `??`/`?.`.
2. UI/UX dilemmes : suppression de l'étape de confirmation, toasts auto-disparaissants
   (haut-droite, 4s, succès/erreur) remplaçant le second écran de modale.
3. Ajout de 22 dilemmes/événements aléatoires (issus de `Randoms events.docx`), mapping
   complet Money/AgencyRelation/Overall/TeamRelation/Reputation/Form, nouveau champ
   `driver.form`, cooldown générique réutilisé, `poachDriverAway` factorisé dans `rivals.js`.
   `SCHEMA_VERSION` 21→22.
3. Audit d'équilibrage complet (5 fixes) suite à simulation 2 saisons : seuil dilemme (40)
   séparé du seuil débauchage silencieux (25) + dilemme rendu prioritaire, budget de
   recrutement réellement débité, indemnité de débauchage nerfée (valeur marché × tier),
   cooldown anti-spam d'événements (4 sem), inversion de la générosité amateur +
   plafonnement des frais de gestion. `SCHEMA_VERSION` 20→21.
4. Script `simulate_season.js` créé et itéré plusieurs fois : simulation headless 2 saisons
   (104 semaines) exerçant tous les systèmes, format de log `[Season X - Week Y] Action |
   Game Reaction | Feedback/Balance Warning`, utilisé comme outil de non-régression permanent.
5. Corrections de bugs signalés : nom d'agence effacé au clic sur une couleur (input non
   contrôlé), `saveGame` face à `QuotaExceededError` (purge + retry), robustesse de la
   génération du monde (pools de marques vides, staff rival vide).
6. Refonte WEC : d'abord split en deux catégories top-level (`wec-hypercar`/`wec-gt3`), puis
   **revert** vers un seul championnat `wec` avec sous-classes (`team.subClass`) suite à
   clarification de l'utilisateur — d'où le bug `driverStats.js` lisant encore `team.class`
   (corrigé au passage, trouvé pendant la construction du premier script de simulation).
   `SCHEMA_VERSION` 18→19→20 sur ces changements de catégories/staff IA.
7. Renommage Rally→WRC, assignation de marques 1-à-1 stricte (F1/WRC/WEC Hypercar) et
   minimum-occurrence (Karting/WEC GT3) avec `shuffleArray` déterministe.
8. UI : "My Drivers" (debug ID, colonne Écurie, tooltips Budget course/recrutement,
   clarification contrat agence≠écurie), "Talents" (filtre free-agents only, stats
   Rythme/Régularité), popup Finance au survol des barres recettes/dépenses.
9. Système de scouting à deux compétences (`discoverySkill`/`precisionSkill`), Scouting
   approfondi, `carBrand` par catégorie multi-marques, buyout de débauchage, contrats forcés
   fin de saison (simplification temporaire assumée).
10. Fondations initiales : moteur de simulation hebdomadaire complet, 25 attributs pilote,
    système de staff à 7 rôles, workload multi-championnat, moteur d'événements aléatoires
    (premiers 5 dilemmes + 8 info), finances avec graphiques SVG, sauvegarde/chargement.
