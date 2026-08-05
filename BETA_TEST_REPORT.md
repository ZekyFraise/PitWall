# Rapport de beta-test — 5 saisons (260 semaines)

Simulation headless jouée comme un "beta testeur" cherchant à construire une agence prospère,
en essayant d'utiliser toutes les fonctionnalités du jeu dans la limite de ce que réputation et
trésorerie permettaient à chaque instant. Graine: `20260804`. Script: `beta_test_5_seasons.js`
(supprimé après génération de ce rapport, conformément à la convention du projet pour les
scripts de vérification ad-hoc).

## Méthodologie (politique de jeu appliquée)

Cette section décrit la politique du run final (après 3 itérations de calibrage du script pour
éliminer des comportements clairement irréalistes — voir "Limites de la méthode" ci-dessous).

- **Scouting/signature**: scoute un prospect non révélé tous les 3 semaines (toutes les
  semaines si l'effectif est à 0 — reconstruction prioritaire), scout approfondi dès qu'un
  profil semble prometteur (potentiel ≥ 62) si la trésorerie le permet. Signe le meilleur
  prospect scouté **affordable** (potentiel ≥ 48, marge de sécurité ×1.1 sur le prix, seuils
  assouplis à potentiel ≥ 40 et marge ×1.02 si l'effectif est à 0) via négociation à ~105% du
  prix de base, relance avec la contre-offre en cas de refus. **Croissance d'effectif calée sur
  la cible saisonnière du design** : 1 pilote visé en saison 1, 2 en S2, 3 en S3, 5 en S4, 8 en
  S5 (pas de nouvelle signature au-delà tant que la trésorerie n'est pas très confortable
  >100 000€) — pour ne pas dépenser tout le budget de départ sur plusieurs pilotes d'un coup.
- **Baquets**: propose systématiquement les pilotes sans écurie (budget ~8% de la trésorerie),
  accepte la meilleure offre reçue (prestige, puis coût), négocie les offres de transfert à
  110% de l'indemnité de référence, tente un 2e championnat pour les pilotes installés,
  accepte les remplacements ponctuels abordables.
- **Contrats**: renouvelle systématiquement un contrat d'agence expirant, avec une offre
  généreuse (salaire ×0.8, indemnité ×1.15 pour un amateur ; commission ×0.95 pour un pro) ;
  réutilise la contre-offre du pilote en cas de refus précédent plutôt que de rejouer la même
  offre (évite une spirale patience/relation qui, dans les runs de calibrage, ramenait le taux
  de succès à 2/15).
- **Staff**: engage un membre de chaque rôle dès que possible (recruteur en priorité), un 2e
  recruteur après la semaine 150. **Licenciement d'urgence** : si l'effectif de pilotes est à 0
  et la trésorerie sous 3 000€, licencie le membre du staff le plus cher pour limiter la
  saignée hebdomadaire.
- **Infrastructures**: priorité Qualité des recruteurs > Bureaux > Entraînement > Standing >
  Réseau de contacts, améliore dès qu'un palier coûte moins du tiers de la trésorerie courante.
- **Académies**: finance une académie disponible tous les ~10 semaines si la trésorerie le
  permet ; ne filtre pas les prospects liés à une académie lors des signatures (teste le
  surcoût).
- **Sponsoring**: signe toujours le meilleur sponsor disponible quand aucun n'est actif ;
  résiliation volontaire testée une fois (semaine 90) pour vérifier le coût de réputation.
- **Style de vie / boutique**: achète le palier suivant le moins cher (parmi logement/véhicule/
  formation) quand son coût est couvert 3 fois par la trésorerie ; campagne PR régulière ;
  achats uniques (média training, espace VIP) une fois la trésorerie très confortable.
- **Prêt**: réservé aux urgences réelles (trésorerie sous 3 000€, bien en dessous du seuil
  d'éligibilité de 10 000€) plutôt que déclenché à chaque passage sous ce seuil — un emprunt à
  25% d'intérêt à chaque dip de trésorerie routinier n'est pas une gestion prospère.
- **Rachat d'écurie**: dès que réputation ET trésorerie le permettent (prix ≤ 35% de la
  trésorerie), rachète l'écurie éligible la moins chère ; développe ensuite les écuries
  possédées.
- **Dilemmes aléatoires**: le dilemme de débauchage rassure systématiquement le pilote sauf
  1 occurrence sur 5 (laissée filer, pour observer le débauchage réel) ; les autres dilemmes
  choisissent l'option la plus prudente (dernière de la liste) si la trésorerie est sous
  6 000€, sinon font tourner cycliquement toutes les options disponibles au fil des occurrences
  successives du même événement, pour couvrir un maximum de branches sur 5 saisons.

### Limites de la méthode

Le script a été recalibré 3 fois avant ce run final : la 1ʳᵉ version signait 2 pilotes dès la
semaine 3 (épuisant le capital de départ) et poursuivait toujours le prospect au potentiel le
plus élevé même hors de prix, ce qui a produit un run test totalement bloqué à 0 pilote pendant
230 semaines après une perte de pilote précoce — corrigé en filtrant sur l'affordabilité réelle
et en payant la reconstruction en priorité. Cela signifie que les difficultés décrites plus bas
reflètent une politique disciplinée et non un bot délibérément imprudent — mais aussi qu'un
joueur humain avec un jugement plus fin (timing des dilemmes, lecture fine des probabilités
d'acceptation, arbitrages au cas par cas plutôt que des règles fixes) pourrait obtenir un
résultat sensiblement meilleur. Les constats ci-dessous sont donc à lire comme "une politique
prudente et non-gaspilleuse peut se retrouver dans cette situation", pas comme "toute partie
finit ainsi".

## Constats clés (analyse)

Cette partie a été jouée de façon délibérément disciplinée (pas de dépense au-delà des moyens,
recrutement calé sur la cible saisonnière du design — 1 pilote en S1, 2 en S2, 3 en S3, 5 en S4,
8 en S5 — prêt réservé aux urgences réelles) : les problèmes ci-dessous ne viennent pas d'une
politique volontairement risquée, ils sont apparus malgré une gestion prudente.

1. **L'économie à un seul pilote de Karting Senior est très fragile.** Le revenu passif
   (sponsor Bronze ~200-400€/sem, seul palier accessible tant que la réputation reste sous 25)
   couvre à peine les salaires de staff + l'entretien + le remboursement de prêt. La trésorerie
   n'a quasiment jamais dépassé ~15-20 000€ sur toute la partie, même en évitant tout gaspillage
   — un seul aléa négatif (dilemme coûteux, échec de négociation, débauchage) suffit à repasser
   dans le rouge.
2. **Pas de mécanisme de rebond une fois effectif ET trésorerie à zéro simultanément.**
   `negotiateSigning` exige `trésorerie >= offre` sans exception — une agence sans pilote qui
   passe aussi sous zéro n'a plus AUCUN levier de recrutement tant qu'elle n'est pas repassée en
   positif, et ne peut compter que sur le revenu sponsor (lui-même souvent absorbé par les
   traites de prêt). Dans ce run, l'agence est restée sans pilote ET en dette de la semaine 215
   à la semaine 260 (45 semaines, ~1/6e de la partie entière) sans aucun moyen d'agir dessus à
   part attendre. Une vraie roue de secours (ex. un pilote "de dernier recours" gratuit ou
   quasi-gratuit accessible sous un certain seuil de détresse, symétrique au prêt d'urgence déjà
   présent) manque à l'appel.
3. **Spirale de renégociation de contrat.** Une offre de renouvellement refusée dégrade la
   patience/relation du pilote ET génère une contre-offre plus chère (`buildCounterOffer`) —
   or c'est précisément quand la trésorerie est tendue que ces refus arrivent. Sur ce run, 14
   tentatives de renouvellement pour 2 succès seulement ; 11 des 12 échecs sont dus à une
   indemnité de contre-offre devenue supérieure à la trésorerie disponible. La contre-offre
   résout l'acceptabilité mais peut aggraver l'accessibilité — les deux devraient converger, pas
   diverger, pour un pilote qu'on essaie sincèrement de garder.
4. **Aucun podium ni victoire en 80 courses disputées** par l'unique pilote (note ~46 à sa
   signature, montée à ~42-56 selon les runs testés) sur toute la partie. À vérifier si c'est
   attendu (un pilote de niveau moyen ne doit statistiquement jamais monter sur le podium face à
   une grille IA calibrée plus haut) ou si le poids de `carScore`/`prestige` d'équipe écrase
   trop largement l'apport individuel du pilote dans `participantScore` pour une écurie modeste
   — 80 courses sans un seul top 3 est un échantillon assez large pour que ce ne soit
   probablement pas la seule malchance.
5. **Rachat d'écurie hors de portée sur tout l'horizon testé, dans les 3 variantes de politique
   essayées.** La réputation finale n'a dépassé 11 dans aucun des runs (seuil karting ownership
   = `repRequired + 30`, soit ~30 pour les catégories tier 0). Avec le plafond de rendement
   décroissant déjà en place sur la réputation, une agence qui ne s'appuie que sur 1-3 pilotes
   modestes ne semble pas en mesure d'atteindre ce seuil en 5 saisons même en écoulant
   régulièrement des campagnes PR et en résolvant favorablement les dilemmes à impact
   réputation — ce contenu de fin de partie récemment ajouté risque de rester inaccessible à la
   plupart des parties normales, pas seulement aux parties malchanceuses.
6. **Couverture fonctionnelle atteinte malgré la contrainte budgétaire** (ce qui A bien pu être
   testé sur ce run) : scouting normal/approfondi, signature négociée avec contre-offre,
   proposition de baquet et acceptation, remplacement ponctuel, renouvellement de contrat,
   licenciement d'urgence (`fireStaff`), prêt d'urgence, sponsoring (22 signatures, 1
   résiliation volontaire), campagne PR, ~38 combinaisons dilemme/option distinctes, dilemme de
   débauchage. **Jamais atteint faute de trésorerie/réputation suffisante** sur ce run : 2e
   championnat, transfert négocié, approche d'un pilote établi (`recruit.js`), financement
   d'académie, achat boutique (média training/VIP), amélioration d'infrastructure, amélioration
   de style de vie, rachat/développement d'écurie. Une partie plus chanceuse ou plus longue
   serait nécessaire pour les exercer ; leurs mécaniques elles-mêmes n'ont pas pu être validées
   en conditions réelles par ce run.

## Suivi 5 semaines par 5 semaines

### Semaine 5 (Saison 1, S5)
- **Trésorerie**: 12 150€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (11 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 25.9, 19 ans
- **Faits marquants**:
  - S1W1: Scouting normal — Aria Herrera
  - S1W1: Signé Aria Herrera (potentiel 46, 22 470€) [reconstruction après effectif à 0]
  - S1W1: Sponsor signé — Kryon Boissons (Bronze, 365€/sem)
  - S1W2: Baquet — Aria Herrera chez Tempest Speedworks (Karting Senior, 15 770€)

### Semaine 10 (Saison 1, S10)
- **Trésorerie**: 8 596€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (6 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 27.3, 19 ans
- **Faits marquants**:
  - S1W6: Dilemme "Paparazzi au bar" -> option 1/2 -> Les clichés ne sortiront jamais.
  - S1W7: Dilemme "Post polémique sur les réseaux" -> option 1/2 -> La crise est désamorcée avec brio.
  - S1W10: Dilemme "Cours de langue" -> option 1/2 -> Aria Herrera s'ouvre à l'international.

### Semaine 15 (Saison 1, S15)
- **Trésorerie**: 9 941€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (1 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 28.0, 19 ans
- **Faits marquants**:
  - S1W13: Dilemme "Troubles psychologiques" -> option 1/2 -> Quelques séances plus tard, Aria Herrera retrouve sa sérénité et sa concentration.
  - S1W14: Dilemme "Post polémique sur les réseaux" -> option 2/2 -> Aria Herrera se sent lâché par l'agence.
  - S1W15: Dilemme "Cours de langue" -> option 2/2 -> Aria Herrera se sent bridé dans sa carrière.

### Semaine 20 (Saison 1, S20)
- **Trésorerie**: 11 510€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Aurora Télécom (12 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 29.6, 19 ans
- **Faits marquants**:
  - S1W16: Dilemme "Programme d'entraînement intensif" -> option 1/2 -> Aria Herrera en ressort méthodiquement plus solide, presque une nouvelle version de lui-même.
  - S1W16: Sponsor signé — Aurora Télécom (Bronze, 331€/sem)
  - S1W17: Dilemme "Stage d'équipe spécial" -> option 1/2 -> Aria Herrera revient affûté et soudé à l'écurie.

### Semaine 25 (Saison 1, S25)
- **Trésorerie**: 14 446€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Aurora Télécom (7 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 30.6, 19 ans

### Semaine 30 (Saison 1, S30)
- **Trésorerie**: 16 476€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Aurora Télécom (2 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 29.6, 19 ans
- **Faits marquants**:
  - S1W27: Dilemme "Demande de prêt" -> option 1/2 -> Aria Herrera te remercie chaleureusement.
  - S1W30: Dilemme "Retard à l'entraînement" -> option 1/2 -> Aria Herrera se braque et se relâche.

### Semaine 35 (Saison 1, S35)
- **Trésorerie**: 13 608€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 1 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (7 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 30.2, 19 ans
- **Faits marquants**:
  - S1W30: Staff engagé — Louis Fischer (recruiter, 6 800€)
  - S1W31: Dilemme "Tentative de débauchage" -> option 1/2 -> Aria Herrera est touché par le geste et reste.
  - S1W32: Sponsor signé — Vantage Pneus (Bronze, 310€/sem)
  - S1W35: Dilemme "Procès d'un pilote célèbre" -> option 1/2 -> L'enveloppe change de mains dans un parking désert — mais la rumeur finit par courir : réputation -1.

### Semaine 40 (Saison 1, S40)
- **Trésorerie**: 12 098€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 1 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (2 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 30.8, 19 ans
- **Faits marquants**:
  - S1W37: Dilemme "Invitation média exclusive" -> option 1/3 -> Entre les petits-fours et les mondanités qui s'éternisent, Aria Herrera revient sur les rotules — indisponible 1 semaine.

### Semaine 45 (Saison 1, S45)
- **Trésorerie**: 13 243€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 1 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (5 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 31.8, 19 ans
- **Faits marquants**:
  - S1W42: Sponsor signé — Vantage Pneus (Bronze, 310€/sem)

### Semaine 50 (Saison 1, S50)
- **Trésorerie**: 14 698€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 1 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: aucun
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 32.3, 19 ans

### Semaine 55 (Saison 2, S3)
- **Trésorerie**: 5 200€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 1 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (7 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 32.8, 20 ans
- **Faits marquants**:
  - S1W50: Sponsor signé — Cobalt Assurance (Bronze, 307€/sem)
  - S1W52: Contrat renouvelé — Aria Herrera
  - S2W1: Dilemme "Stage d'équipe spécial" -> option 2/2 -> L'écurie prend mal ce refus.
  - S2W2: Scouting normal — Milo Esposito

### Semaine 60 (Saison 2, S8)
- **Trésorerie**: 6 805€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 1 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (2 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 32.8, 20 ans
- **Faits marquants**:
  - S2W5: Dilemme "Programme d'entraînement intensif" -> option 2/2 -> Aria Herrera continue sagement son programme habituel — moins spectaculaire, mais personne ne se casse rien.

### Semaine 65 (Saison 2, S13)
- **Trésorerie**: 7 638€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 1 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (8 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 35.4, 20 ans
- **Faits marquants**:
  - S2W10: Sponsor signé — Vantage Pneus (Bronze, 280€/sem)
  - S2W11: Dilemme "Optimisation fiscale douteuse" -> option 1/2 -> Les caisses se remplissent... à tes risques.
  - S2W12: Dilemme "Préparateur personnel" -> option 1/2 -> Programme sur-mesure, résultats immédiats : Aria Herrera progresse nettement.
  - S2W13: Dilemme "Procès d'un pilote célèbre" -> option 2/2 -> Ton intégrité est remarquée : réputation en hausse.

### Semaine 70 (Saison 2, S18)
- **Trésorerie**: 8 701€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 1 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (3 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 35.8, 20 ans
- **Faits marquants**:
  - S2W18: Dilemme "Programme d'entraînement intensif" -> option 2/2 -> Aria Herrera continue sagement son programme habituel — moins spectaculaire, mais personne ne se casse rien.

### Semaine 75 (Saison 2, S23)
- **Trésorerie**: 8 051€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 1 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Solstice Media (9 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 36.4, 20 ans
- **Faits marquants**:
  - S2W20: Dilemme "Tuyau d'investissement" -> option 1/2 -> Le tuyau était crevé : perte sèche.
  - S2W21: Sponsor signé — Solstice Media (Bronze, 329€/sem)

### Semaine 80 (Saison 2, S28)
- **Trésorerie**: 7 722€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Solstice Media (4 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 36.5, 20 ans
- **Faits marquants**:
  - S2W24: Dilemme "Retard à l'entraînement" -> option 2/2 -> L'écurie voit d'un mauvais œil ce laisser-aller.
  - S2W26: Staff engagé — Nathan Watanabe (negotiator, 6 650€)
  - S2W26: Scouting normal — Yanis Bianchi
  - S2W27: Dilemme "Paparazzi au bar" -> option 2/2 -> Aria Herrera se sent abandonné dans la tempête médiatique.

### Semaine 85 (Saison 2, S33)
- **Trésorerie**: 11 053€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (12 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 36.6, 20 ans
- **Faits marquants**:
  - S2W29: Scouting normal — Noah Watanabe
  - S2W30: Dilemme "Sponsor controversé" -> option 1/2 -> Le chèque est confortable, l'image en pâtit un peu.
  - S2W31: Dilemme "Demande de prêt" -> option 2/2 -> Aria Herrera encaisse mal le refus.
  - S2W32: Sponsor signé — Meridian Bank (Bronze, 268€/sem)

### Semaine 90 (Saison 2, S38)
- **Trésorerie**: 4 764€ · **Réputation**: 3 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (7 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 36.9, 20 ans
- **Faits marquants**:
  - S2W35: Dilemme "Post polémique sur les réseaux" -> option 1/2 -> La crise est désamorcée avec brio.
  - S2W36: Remplacement ponctuel accepté — Aria Herrera

### Semaine 95 (Saison 2, S43)
- **Trésorerie**: 11 018€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (6 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 37.4, 20 ans
- **Faits marquants**:
  - S2W38: Sponsor résilié volontairement (test du mécanisme)
  - S2W39: Sponsor signé — Kryon Boissons (Bronze, 331€/sem)
  - S2W42: Dilemme "Offre de documentaire" -> option 2/2 -> Le studio hausse les épaules et va filmer une agence rivale à la place.

### Semaine 100 (Saison 2, S48)
- **Trésorerie**: 6 580€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (1 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 37.7, 20 ans
- **Faits marquants**:
  - S2W45: Dilemme "Stage d'équipe spécial" -> option 2/2 -> L'écurie prend mal ce refus.
  - S2W46: Dilemme "Tentative de débauchage" -> option 2/2 -> Aria Herrera est vexé de ne pas être retenu : relation en forte baisse.
  - S2W48: Dilemme "Négociation salariale" -> option 1/3 -> Aria Herrera repart avec le sourire : relation agence +8, -4 000€.

### Semaine 105 (Saison 3, S1)
- **Trésorerie**: 5 622€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (12 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 38.1, 20 ans
- **Faits marquants**:
  - S2W49: Sponsor signé — Nébuleuse Streaming (Bronze, 296€/sem)

### Semaine 110 (Saison 3, S6)
- **Trésorerie**: 3 152€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (7 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 38.1, 21 ans
- **Faits marquants**:
  - S3W1: Scouting normal — Stella Torres
  - S3W6: Dilemme "Demande d'une fondation caritative" -> option 2/2 -> Tu déclines poliment.

### Semaine 115 (Saison 3, S11)
- **Trésorerie**: 13 698€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (2 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 39.3, 21 ans
- **Faits marquants**:
  - S3W7: Prêt contracté — 30 000€ sur 18 mois
  - S3W9: Contrat renouvelé — Aria Herrera
  - S3W10: Dilemme "Stage d'équipe spécial" -> option 1/2 -> Aria Herrera revient affûté et soudé à l'écurie.
  - S3W10: Staff engagé — Camille Torres (physio, 6 500€)
  - S3W10: Scouting approfondi — Ryo Martin (potentiel réel: 64)

### Semaine 120 (Saison 3, S16)
- **Trésorerie**: 12 692€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (7 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 39.5, 21 ans
- **Faits marquants**:
  - S3W12: Dilemme "Procès d'un pilote célèbre" -> option 1/2 -> L'enveloppe change de mains dans un parking désert — mais la rumeur finit par courir : réputation -1.
  - S3W13: Sponsor signé — Titan Constructions (Bronze, 338€/sem)
  - S3W14: Dilemme "Paparazzi au bar" -> option 1/2 -> Les clichés ne sortiront jamais.
  - S3W15: Dilemme "Méforme" -> option 1/2 -> Aria Herrera prend la remarque de travers : relation agence en baisse.

### Semaine 125 (Saison 3, S21)
- **Trésorerie**: 9 105€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (2 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 39.7, 21 ans

### Semaine 130 (Saison 3, S26)
- **Trésorerie**: 5 557€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (11 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 40.9, 21 ans
- **Faits marquants**:
  - S3W23: Sponsor signé — Cascade Horlogerie (Bronze, 251€/sem)
  - S3W26: Dilemme "Demande de dopage" -> option 1/2 -> Les gains sont réels... pour l'instant.

### Semaine 135 (Saison 3, S31)
- **Trésorerie**: 2 322€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (6 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 40.9, 21 ans
- **Faits marquants**:
  - S3W31: Dilemme "Offre de documentaire" -> option 2/2 -> Ton refus discret séduit le milieu : réputation +1.

### Semaine 140 (Saison 3, S36)
- **Trésorerie**: -757€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (1 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 41.1, 21 ans
- **Faits marquants**:
  - S3W33: Dilemme "Invitation média exclusive" -> option 3/3 -> Tu déclines poliment — dormir avant la course, c'est aussi ça, le métier.

### Semaine 145 (Saison 3, S41)
- **Trésorerie**: -2 520€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (6 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 41.2, 21 ans
- **Faits marquants**:
  - S3W37: Sponsor signé — Vantage Pneus (Bronze, 395€/sem)
  - S3W39: Dilemme "Tuyau d'investissement" -> option 2/2 -> Tu passes ton tour — l'amitié a ses limites.
  - S3W41: Dilemme "Tentative de débauchage" -> option 2/2 -> Aria Herrera reste finalement, sans rancune notable.

### Semaine 150 (Saison 3, S46)
- **Trésorerie**: -1 739€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (1 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 41.4, 21 ans
- **Faits marquants**:
  - S3W42: Dilemme "Cours de langue" -> option 2/2 -> Aria Herrera se sent bridé dans sa carrière.

### Semaine 155 (Saison 3, S51)
- **Trésorerie**: 575€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (11 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 41.5, 21 ans
- **Faits marquants**:
  - S3W47: Sponsor signé — Kryon Boissons (Bronze, 336€/sem)
  - S3W48: Dilemme "Retard à l'entraînement" -> option 2/2 -> L'écurie voit d'un mauvais œil ce laisser-aller.

### Semaine 160 (Saison 4, S4)
- **Trésorerie**: -1 957€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (6 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 41.6, 22 ans
- **Faits marquants**:
  - S4W3: Dilemme "Crise personnelle" -> option 2/2 -> Aria Herrera se sent seul face à l'agence.
  - S4W4: Dilemme "Demande de prêt" -> option 2/2 -> Aria Herrera encaisse mal le refus.

### Semaine 165 (Saison 4, S9)
- **Trésorerie**: -4 615€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (1 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 41.6, 22 ans

### Semaine 170 (Saison 4, S14)
- **Trésorerie**: -7 401€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (4 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 41.7, 22 ans
- **Faits marquants**:
  - S4W10: Sponsor signé — Vantage Pneus (Bronze, 213€/sem)
  - S4W11: Dilemme "Négociation salariale" -> option 3/3 -> Aria Herrera claque presque la porte en sortant : relation agence -6.

### Semaine 175 (Saison 4, S19)
- **Trésorerie**: -9 901€ · **Réputation**: 1 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (9 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 41.8, 22 ans
- **Faits marquants**:
  - S4W18: Dilemme "Tentative de débauchage" -> option 2/2 -> Aria Herrera est vexé de ne pas être retenu : relation en forte baisse.
  - S4W18: Sponsor signé — Cascade Horlogerie (Bronze, 394€/sem)

### Semaine 180 (Saison 4, S24)
- **Trésorerie**: -13 865€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (4 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 43.0, 22 ans
- **Faits marquants**:
  - S4W20: Dilemme "Crise personnelle" -> option 2/2 -> Aria Herrera se sent seul face à l'agence.

### Semaine 185 (Saison 4, S29)
- **Trésorerie**: -16 295€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nordic Air (14 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 43.0, 22 ans
- **Faits marquants**:
  - S4W26: Dilemme "Invitation média exclusive" -> option 3/3 -> Tu déclines poliment — dormir avant la course, c'est aussi ça, le métier.
  - S4W28: Sponsor signé — Nordic Air (Bronze, 243€/sem)

### Semaine 190 (Saison 4, S34)
- **Trésorerie**: 10 639€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nordic Air (9 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 43.1, 22 ans
- **Faits marquants**:
  - S4W33: Dilemme "Demande de dopage" -> option 2/2 -> Aria Herrera prend mal ce recadrage, mais ton intégrité est reconnue : relation -12, réputation +1.
  - S4W33: Prêt contracté — 30 000€ sur 18 mois
  - S4W34: Dilemme "Préparateur personnel" -> option 2/2 -> Aria Herrera est déçu du manque d'investissement.

### Semaine 195 (Saison 4, S39)
- **Trésorerie**: -307€ · **Réputation**: 3 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nordic Air (4 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 43.1, 22 ans
- **Faits marquants**:
  - S4W39: Dilemme "Optimisation fiscale douteuse" -> option 2/2 -> Tu régularises : coûteux mais sain.

### Semaine 200 (Saison 4, S44)
- **Trésorerie**: -3 130€ · **Réputation**: 3 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (9 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 43.2, 22 ans
- **Faits marquants**:
  - S4W41: Dilemme "Demande de prêt" -> option 2/2 -> Aria Herrera encaisse mal le refus.
  - S4W42: Dilemme "Blessure légère, veut courir" -> option 2/2 -> L'écurie regrette son absence.
  - S4W43: Sponsor signé — Cobalt Assurance (Bronze, 365€/sem)

### Semaine 205 (Saison 4, S49)
- **Trésorerie**: -804€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (4 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — Karting Senior, note 43.2, 22 ans
- **Faits marquants**:
  - S4W45: Dilemme "Crise personnelle" -> option 2/2 -> Aria Herrera se sent seul face à l'agence.

### Semaine 210 (Saison 5, S2)
- **Trésorerie**: -6 289€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (14 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Aria Herrera — sans catégorie [SANS BAQUET], note 43.3, 23 ans
- **Faits marquants**:
  - S4W52: Dilemme "Tuyau d'investissement" -> option 2/2 -> Tu passes ton tour — l'amitié a ses limites.
  - S5W1: Sponsor signé — Cobalt Assurance (Bronze, 260€/sem)
  - S5W2: Dilemme "Dilemme : approche d'une agence rivale" -> option 1/2 -> Un café, une vraie conversation, et Aria Herrera se sent enfin écouté — reste fidèle à l'agence.

### Semaine 215 (Saison 5, S7)
- **Trésorerie**: -4 791€ · **Réputation**: 0 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (9 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W3: Débauché par une agence rivale — Aria Herrera
  - S5W3: Dilemme "Tentative de débauchage" -> option 2/2 -> Aria Herrera est vexé de ne pas être retenu : relation en forte baisse.
  - S5W3: Staff licencié en urgence — Louis Fischer (342€/sem économisés) [effectif à 0, trésorerie critique]
  - S5W4: Staff licencié en urgence — Nathan Watanabe (336€/sem économisés) [effectif à 0, trésorerie critique]
  - S5W5: Staff licencié en urgence — Camille Torres (330€/sem économisés) [effectif à 0, trésorerie critique]
  - S5W7: Dilemme "Sponsor controversé" -> option 2/2 -> La marque se venge dans la presse : réputation -1.

### Semaine 220 (Saison 5, S12)
- **Trésorerie**: -2 779€ · **Réputation**: 0 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (4 sem. restantes)
- **Écuries possédées**: aucune

### Semaine 225 (Saison 5, S17)
- **Trésorerie**: -8 228€ · **Réputation**: 0 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (11 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W16: Sponsor signé — Nébuleuse Streaming (Bronze, 271€/sem)

### Semaine 230 (Saison 5, S22)
- **Trésorerie**: -12 591€ · **Réputation**: 0 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (6 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W18: Dilemme "Tuyau d'investissement" -> option 2/2 -> Tu passes ton tour — l'amitié a ses limites.

### Semaine 235 (Saison 5, S27)
- **Trésorerie**: -13 641€ · **Réputation**: 0 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (1 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W25: Dilemme "Offre de documentaire" -> option 2/2 -> Le studio hausse les épaules et va filmer une agence rivale à la place.
  - S5W27: Dilemme "Demande d'une fondation caritative" -> option 2/2 -> Tu déclines poliment.

### Semaine 240 (Saison 5, S32)
- **Trésorerie**: -18 943€ · **Réputation**: 1 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Ravel Cosmétiques (9 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W28: Sponsor signé — Ravel Cosmétiques (Bronze, 208€/sem)
  - S5W29: Dilemme "Optimisation fiscale douteuse" -> option 2/2 -> Tu régularises : coûteux mais sain.

### Semaine 245 (Saison 5, S37)
- **Trésorerie**: -24 308€ · **Réputation**: 0 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Ravel Cosmétiques (4 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W35: Dilemme "Optimisation fiscale douteuse" -> option 2/2 -> Tu régularises : coûteux mais sain.

### Semaine 250 (Saison 5, S42)
- **Trésorerie**: -27 308€ · **Réputation**: 0 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (11 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W41: Dilemme "Demande d'une fondation caritative" -> option 2/2 -> Tu déclines poliment.
  - S5W41: Sponsor signé — Meridian Bank (Bronze, 255€/sem)

### Semaine 255 (Saison 5, S47)
- **Trésorerie**: -30 210€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (6 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W43: Dilemme "Procès d'un pilote célèbre" -> option 2/2 -> Ton intégrité est remarquée : réputation en hausse.

### Semaine 260 (Saison 5, S52)
- **Trésorerie**: -31 340€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (1 sem. restantes)
- **Écuries possédées**: aucune

## Résumé agrégé

- **Durée effective**: 260/260 semaines, aucun crash
- **Trésorerie finale**: -29 341€ · **minimum atteint**: -31 340€ · **semaines en négatif à la fin**: 59
- **Réputation finale**: 3
- **Effectif final**: 0 pilote(s), 0 membre(s) de staff
- **Signatures**: 1 réussies / 1 tentées (échecs: 0)
- **Approches de pilotes établis**: 0 réussies / 0 tentées
- **Baquets obtenus**: 1 (sur 3 propositions), **2e championnats**: 0, **remplacements**: 1, **transferts négociés**: 0
- **Renouvellements de contrat**: 2 réussis / 14 tentés
- **Résiliations**: 0 · **Débauchages subis**: 1
- **Courses disputées**: 80 (victoires: 0, podiums: 0, abandons: 8) · **Titres remportés**: 0
- **Traits acquis**: 0 · **Graduations d'académie manquées**: 0
- **Staff engagé**: recruiter: 1, negotiator: 1, physio: 1
- **Infrastructures améliorées**: aucune
- **Style de vie amélioré**: aucun
- **Achats boutique**: 0
- **Académies financées**: 0 · **Prospects d'académie signés**: 0
- **Sponsors signés**: 22 · **Résiliés**: 1
- **Prêts contractés**: 2
- **Licenciements d'urgence (effectif à 0)**: 3
- **Écuries rachetées** (0):
  (aucune)
- **Améliorations de développement d'écurie**: 0

### Répartition des choix de dilemmes (eventId#optionIndex)
- poaching-attempt#1 — 4 fois
- driver-loan#1 — 3 fois
- documentary-offer#1 — 3 fois
- charity-request#1 — 3 fois
- investment-tip#1 — 3 fois
- private-crisis#1 — 3 fois
- tax-evasion#1 — 3 fois
- paparazzi-bar#0 — 2 fois
- social-media-post#0 — 2 fois
- language-course#1 — 2 fois
- team-camp#0 — 2 fois
- driver-lawsuit#0 — 2 fois
- team-camp#1 — 2 fois
- push-driver#1 — 2 fois
- driver-lawsuit#1 — 2 fois
- late-training#1 — 2 fois
- media-invitation#2 — 2 fois
- language-course#0 — 1 fois
- psychological-issues#0 — 1 fois
- social-media-post#1 — 1 fois
- push-driver#0 — 1 fois
- driver-loan#0 — 1 fois
- late-training#0 — 1 fois
- poaching-attempt#0 — 1 fois
- media-invitation#0 — 1 fois
- tax-evasion#0 — 1 fois
- personal-trainer#0 — 1 fois
- investment-tip#0 — 1 fois
- paparazzi-bar#1 — 1 fois
- controversial-sponsor#0 — 1 fois
- salary-negotiation#0 — 1 fois
- bad-form#0 — 1 fois
- doping-request#0 — 1 fois
- salary-negotiation#2 — 1 fois
- doping-request#1 — 1 fois
- personal-trainer#1 — 1 fois
- light-injury-race#1 — 1 fois
- poach-dilemma#0 — 1 fois
- controversial-sponsor#1 — 1 fois

### Échecs d'actions les plus fréquents
- negotiateContract: budget insuffisant pour l'indemnité de renouvellement — 11 fois
- negotiateContract: Aria Herrera juge cette offre insuffisante — revois tes conditions. — 1 fois

## Avertissements d'équilibrage relevés (10)
- **S3W7 (semaine 111)** — Trésorerie passée sous le seuil de prêt (10 000€) — prêt d'urgence contracté.
- **S3W38 (semaine 142)** — Trésorerie négative depuis 4+ semaines consécutives (min atteint: -1 606€) — signal de quasi-faillite.
- **S4W4 (semaine 160)** — Trésorerie négative depuis 4+ semaines consécutives (min atteint: -5 001€) — signal de quasi-faillite.
- **S4W33 (semaine 189)** — Trésorerie passée sous le seuil de prêt (10 000€) — prêt d'urgence contracté.
- **S4W42 (semaine 198)** — Trésorerie négative depuis 4+ semaines consécutives (min atteint: -18 706€) — signal de quasi-faillite.
- **S4W50 (semaine 206)** — Trésorerie négative depuis 4+ semaines consécutives (min atteint: -18 706€) — signal de quasi-faillite.
- **S6W1 (semaine 261)** — Aucune écurie rachetée en 5 saisons malgré une politique d'achat active dès que réputation+budget le permettaient — le rachat d'écurie reste hors de portée en pratique sur cet horizon.
- **S6W1 (semaine 261)** — Trésorerie négative rencontrée (dernier épisode: 59 semaine(s) consécutives avant la fin du run).
- **S6W1 (semaine 261)** — 2 prêts contractés au total — la trésorerie a replongé de manière répétée sous le seuil critique.
- **S6W1 (semaine 261)** — 3 licenciement(s) d'urgence pour limiter la casse pendant une période sans pilote — signale un vrai risque de spirale (staff/prêt continuent de coûter sans aucun revenu de course tant que l'effectif est à 0).
