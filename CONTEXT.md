# CONTEXT.md — État d'avancement de Pit Wall

> Ce fichier bouge vite. Le relire en entier en début de session, le mettre à jour à la fin
> de chaque session (nouvelle fonctionnalité, bug corrigé, décision prise). Voir `CLAUDE.md`
> pour l'archi/conventions stables, et `TODO.md` pour le backlog issu du journal de
> conception de l'utilisateur (`Choses à modifier.docx`) — ce contenu-là ne vit pas ici.

**`SCHEMA_VERSION` actuel : 22.** Toute sauvegarde antérieure est rejetée proprement (pas
de migration — politique assumée).

## Ce qui est implémenté (vue d'ensemble)

- **Génération du monde** : 7 catégories (Karting, F4, F3, F2, F1, WEC, WRC) avec structures
  d'équipe réalistes (fixe/variable/explicite), calendriers déterministes sur 40/52 semaines
  (mercato hivernal sem 1-6, silly season 26-31), tiers de progression sans retour arrière.
- **WEC** : un seul championnat avec deux sous-classes (`subClass: "hypercar"|"gt3"` sur
  l'équipe), classement par voiture, co-pilotes partageant les mêmes points. Hypercar = 9
  équipes / 9 marques strictement uniques (1-à-1). GT3 = 18 équipes, les 14 marques du pool
  garanties présentes au moins une fois (min-occurrence), le reste réparti aléatoirement.
  F1 et WRC : assignation de marque 1-à-1 stricte également. Karting : min-occurrence.
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

## Décision de design (non issue du journal, à retenir)

- **Frais de gestion amateurs** : passés de `coût/20` à `coût/40` par semaine pour fermer un
  exploit de "planche à billets" (négociation de contrat avec salaire élevé traité comme
  généreux même pour un amateur qui *paie* l'agence — corrigé en inversant la logique de
  générosité pour les amateurs + plafond dur à 2× la base).

## Questions d'équilibrage ouvertes (pas des bugs, à trancher par l'utilisateur)

- Le nerf des frais amateurs à `/40` rend un 2ᵉ pilote difficilement finançable sur fonds
  propres avant la semaine ~20 en simulation (voir `sim_output.txt` le plus récent). Options
  si jugé trop punitif : remonter à `/30`, ou augmenter les primes de course karting
  (actuellement 100-230€, négligeables face à un budget course de 500€/semaine).
- Les 22 nouveaux dilemmes touchent tous à l'argent/relation/overall — aucun n'a encore été
  passé au crible d'un audit d'équilibrage dédié (contrairement aux 5 événements plus anciens
  audités explicitement). À surveiller si des patterns d'exploit apparaissent à l'usage.

## Historique récent (sessions condensées, plus anciennes en bas)

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
