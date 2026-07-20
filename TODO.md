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

- ⏳ **Académies de pilote** : relation avec une académie, mécanique de formation dédiée —
  fonctionnalité entièrement nouvelle, jamais commencée.
- ⏳ **Super statistiques — remodelage de l'indice de performance** *(chat)* : regrouper les
  attributs actuels en « super statistiques » (type Rythme/Régularité déjà affichées dans
  Talents) qui détermineraient l'Overall du pilote et ses résultats, plutôt que la moyenne
  pondérée actuelle (`overallRating`/`reliability` dans `driver.js`). Portée et liste exacte
  des super stats pas encore précisées.
- ⏳ **Circuits et styles de piste influant sur la performance** *(chat)* : attribuer à chaque
  circuit/manche un style (rapide, technique, pluvieux, usant en pneus...) qui ferait varier
  la performance d'un pilote selon SES attributs (ex. fort en Pluie → avantagé sur un circuit
  pluvieux), au lieu du bruit aléatoire uniforme actuel (`simulate.js` `participantScore`).
  Dépend probablement du remodelage des super statistiques ci-dessus.
- ⏳ **Équilibrer la progression de stats** *(chat)* : la montée en niveau doit être répartie
  entre le niveau actuel du pilote, son potentiel, et l'âge prévu de son peak — revoir
  `growDriver` (`driver.js`) qui n'utilise aujourd'hui qu'une marge (`growthCeiling - rating`)
  et l'âge de peak séparément.
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
- ⏳ **Logique d'attribution des noms et du sexe** *(chat)* : Attribuer des prénoms masculins/féminins
  a des personnages masculins/féminins. Ne pas mélanger
- ⏳ **Agrandir la base de prénoms/noms de famille/noms d'équipe/noms d'agence** *(chat)* :
  plus de diversité, les mêmes noms reviennent trop souvent avec des centaines de pilotes/staff
  générés (`FIRST_NAMES`/`LAST_NAMES` dans `data.js`).
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

## Staff

- ⏳ **Refonte du recrutement de staff** *(chat)* : rechercher par rôle plutôt que d'afficher
  tout le pool d'un coup (`renderWorldStaff`/`renderStaff` montrent tout, même à 600 membres).
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

## Championnats & Résultats

- ⏳ **Revoir le barème de points par catégorie** : `POINTS_TABLE` est unique et générique pour
  toutes les catégories (25-18-15-...), jamais différencié par discipline/tier.
- ⏳ **Monde ▸ Pilotes — clic sur un pilote pour voir sa fiche** *(chat)* : contrairement à Mes
  pilotes/Talents, les lignes de `renderWorldDrivers` (world.js) n'ont pas de
  `data-action="view-driver"`. À noter pour l'implémentation : `renderDriverDetail` ne cherche
  aujourd'hui que dans `state.drivers` puis `state.scoutPool` — un pilote IA/rival pur n'y est
  pas trouvable, il faudra étendre la recherche (ou une variante lecture seule).
- ⏳ **Fenêtre "Résultats" — signaler un champion issu de l'agence** *(chat)* : indiquer quel
  pilote a été sacré champion avec la mention « un de tes pilotes ! » quand il appartient à
  l'agence du joueur, pour le distinguer des champions extérieurs à l'agence.
  - Refonte de l'affichage : un tableau par championnat/année façon [Wikipédia F1
    2025](https://fr.wikipedia.org/wiki/Championnat_du_monde_de_Formule_1_2025#Classements_saison_2025),
    pour le classement pilotes ET écuries.
- ⏳ **Menu Palmarès** *(chat)* : nouvel écran listant les champions par année et par
  catégorie, ainsi que des distinctions personnelles (« Pilote du championnat », « Pilote de
  l'année », « Dépassement de l'année »...). Ces distinctions donneront des bonus plus tard,
  tout comme le fait d'avoir gagné un championnat.
- ⏳ **Classement à 0 point — trier par meilleur résultat** *(chat)* : quand aucun pilote/équipe
  n'a encore marqué, classer par meilleure position obtenue plutôt que dans un ordre arbitraire.
- ⏳ Afficher les résultats de courses course par course, avec archive des classements et
  résultats de championnats consultable depuis les onglets Pilote et Championnats ; onglet
  Résultats à détailler aussi pour les résultats d'events (pas seulement les courses) ; second
  championnat : afficher le prix pour le rejoindre avant de confirmer *(retour d'un ami)*.
- 🐛 **Classement WEC cassé** *(chat)* : rien ne s'affiche dans le classement WEC même si le
  championnat a déjà commencé — à investiguer (probablement lié à la clé composite
  `categoryId:classId` utilisée pour Hypercar/GT3 dans `standings.js`).
- ✅ Saison sur 52 semaines, avancement hebdomadaire, calendriers différenciés par catégorie ;
  différenciation des marques de voitures en championnats multi-marques.
- ✅ Classement équipe avant le début de saison : `teamRankingLabel` retombe sur
  `team.lastSeasonRank` si la saison en cours n'a pas encore de points.
- ✅ Nouveautés séparé en deux onglets : « Résultats » (résultats de course + titres de
  champion pilote/équipe) et « Nouveautés » (événements d'agence uniquement).

## Investissement & Infrastructures

- ⏳ **Remodelage complet de l'Investissement** *(chat, réf. capture d'écran Soccer Agent)* :
  plus on investit dans une infrastructure, plus le palier suivant coûte cher à l'achat ET à
  l'entretien (l'entretien actuel est plat, `getFacilityLevelData` dans `infrastructure.js`) ;
  ajouter un palier de réputation minimum requis pour pouvoir acheter chaque niveau, en plus
  du coût.
- ⏳ Logos pour écuries, championnats, agences, et postes d'investissement ; réputation
  requise et niveau actuel affichés en échelle d'étoiles ; afficher le gain ET l'effet du
  **prochain** palier avant de l'acheter (pas seulement le niveau actuel) *(retour d'un ami)*.
- ✅ Achats personnels de réputation (boutique agence), déplacée avec les infrastructures dans
  un onglet "Investissement" dédié (`renderInvestments` dans `agency.js`).

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
  remboursé à 125% du montant emprunté, étalé sur 15 semaines, prélevé automatiquement chaque
  semaine (`takeLoan`/`repayLoan` dans `state.js`, appelé depuis `runWeekBody`). Un seul prêt
  actif à la fois. Vérifié en jeu (emprunt 30 000€ → +30 000€ trésorerie, 37 500€ dus, 2 500€/sem
  ; une semaine simulée → trésorerie et solde dû baissent chacun de 2 500€, transaction
  "Remboursement de prêt" visible en dépense).
- ✅ Réduire le gain de réputation en cas de victoire, revoir plus largement le barème
  gains/pertes *(retour d'un ami — partiellement recoupé par l'ajustement `REP.s`/`REP.m` déjà
  fait dans `events.js`)* : entièrement résolu par le point ci-dessus — l'ancien barème
  (+5 à chaque victoire individuelle, potentiellement des dizaines de fois par saison) a disparu,
  remplacé par un gain unique et plafonné en fin de saison.
- ✅ Relation agence/équipe, réputation : bornes clarifiées (relation 0-200), barème des
  dilemmes recalibré (`REP.s`/`REP.m` réduits sur demande explicite), valeurs numériques
  affichées au lieu des symboles +/++/---.

## Interface & Expérience utilisateur

- ✅ **Barre espace pour avancer d'une semaine** *(chat)* : raccourci clavier équivalent au
  bouton "Continuer" (`main.js`), désactivé quand un champ de saisie a le focus ou qu'une modale
  (dilemme, confirmation) est ouverte.
- ⏳ **Menu de sauvegarde amélioré** *(chat)* : permettre de nommer la sauvegarde, et afficher
  un popup de confirmation en haut au milieu de l'écran, assez grand, lors de la sauvegarde.
- ⏳ Personnalisation d'équipe à la création de partie : au-delà du nom + couleur actuels,
  d'autres options de personnalisation non précisées.
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
- ⏳ Tutoriel/parcours guidé en début de partie pour les premières actions (scouting,
  recrutement, écurie, etc.) *(retour d'un ami)*.
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

- ⏳ Popup résultat d'event centré, grand format, avec illustration de l'issue et code couleur
  (vert positif / gris neutre / rouge négatif) ; popup dédiée pour les résultats de course
  (victoire, podium, blessure...) ; bannière des événements à venir, défilante et en gros ;
  messages d'alerte dédiés (risque de débauchage, pilote à l'essai ailleurs, pilote recruté
  ailleurs) ; plus de lore/humour dans les textes d'événements *(retour d'un ami)*.
- ⏳ Compagnies de sponsoring/publicité avec contrats dédiés ; récompenses/distinctions (prix
  décernés par journaux/magazines) — recoupe en partie le futur menu Palmarès *(retour d'un ami)*.
- ✅ Événements aléatoires avec %, argent, réputation, relations, niveau, blessures, popup,
  choix (30 événements : 8 info + 22 dilemmes), façon Soccer Agent.
- ✅ Dilemmes — UX multi-lignes : chaque effet d'un `tradeoff` sur sa propre ligne, fourchette
  de probabilité attachée au premier effet de sa branche ; valeurs numériques au lieu des
  symboles +/++/---.
- ✅ Modale de dilemme sans étape de confirmation intermédiaire, résultat via toast.

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

