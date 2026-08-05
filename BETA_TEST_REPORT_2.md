# Rapport de beta-test — 5 saisons (260 semaines) — RUN 2

Deuxième simulation headless, même politique de jeu disciplinée que le premier rapport
(`BETA_TEST_REPORT.md`), avec une graine différente — objectif : vérifier si la fragilité
observée dans le run 1 (agence mono-pilote finissant en dette) était une malchance de graine ou
un schéma systémique. Graine: `8140226`. Script: `beta_test_5_seasons_2.js` (supprimé après
génération de ce rapport).

## Méthodologie (identique au run 1)

- **Scouting/signature**: scoute un prospect non révélé tous les 3 semaines (toutes les
  semaines si l'effectif est à 0), scout approfondi dès qu'un profil semble prometteur
  (potentiel ≥ 62) si la trésorerie le permet. Signe le meilleur prospect scouté affordable
  (potentiel ≥ 48, marge ×1.1 ; potentiel ≥ 40 et marge ×1.02 si effectif à 0) via négociation
  à ~105% du prix de base, relance avec la contre-offre en cas de refus. Croissance d'effectif
  calée sur la cible saisonnière du design (1/2/3/5/8 pilotes visés en S1-S5), pas de nouvelle
  signature au-delà tant que la trésorerie n'est pas très confortable (>100 000€).
- **Baquets/contrats**: propose systématiquement les pilotes sans écurie, accepte la meilleure
  offre, négocie les transferts à 110% de l'indemnité de référence, renouvelle les contrats
  avec une offre généreuse puis réutilise la contre-offre du pilote en cas de refus (au lieu de
  répéter la même offre).
- **Staff**: un membre de chaque rôle dès que possible ; licenciement d'urgence du membre le
  plus cher si effectif à 0 et trésorerie sous 3 000€.
- **Infrastructures/Académies/Sponsoring/Style de vie/Boutique**: mêmes règles qu'au run 1 (voir
  `BETA_TEST_REPORT.md` pour le détail).
- **Prêt**: réservé aux urgences réelles (trésorerie sous 3 000€), pas à chaque dip sous
  10 000€.
- **Rachat d'écurie**: dès que réputation ET trésorerie le permettent (prix ≤ 35% de la
  trésorerie), le moins cher en premier.
- **Dilemmes**: dilemme de débauchage rassuré sauf 1 fois sur 5 ; les autres dilemmes
  choisissent l'option la plus prudente sous 6 000€ de trésorerie, sinon font tourner
  cycliquement toutes les options au fil des occurrences.

## Constats clés (analyse) — et comparaison avec le run 1

1. **Confirmation inter-graines de la fragilité mono-pilote.** Comme au run 1, la perte du seul
   pilote de l'agence (débauchage, semaine ~104 ici contre ~50/~215 selon les runs de calibrage
   du run 1) a laissé l'agence sans pilote pendant **156 semaines sur 260** (60% de la partie),
   staff licencié en urgence à 3 reprises pour limiter la casse. Le schéma se reproduit avec une
   graine totalement différente et un pilote de qualité très supérieure (potentiel 86 contre 46
   au run 1) — ce n'est donc pas une malchance de graine, c'est un risque structurel dès qu'une
   agence dépend d'un seul pilote.
2. **Nouveau constat, plus grave que le run 1 : le renouvellement de contrat peut échouer
   INTÉGRALEMENT.** 0 succès sur 49 tentatives pour l'unique pilote de ce run, toutes rejetées
   faute de trésorerie suffisante pour l'indemnité demandée. Le mécanisme en cause :
   `negotiateContract` (state.js) construit une contre-offre plus chère après un refus
   (`buildCounterOffer`), et cette indemnité suit la valeur marchande du pilote — qui grimpe
   justement parce que le pilote progresse bien (note 46→78 sur ce run). Résultat pervers : plus
   un pilote réussit, plus sa contre-offre de renouvellement devient chère à un moment où la
   trésorerie de l'agence n'a pas forcément suivi au même rythme, et le pilote finit par partir
   au premier dilemme de débauchage venu — précisément le scénario qu'un joueur cherche à
   éviter en investissant dans un bon pilote. Le run 1 montrait déjà ce mécanisme (2 succès sur
   14) ; ce run le confirme à l'échec total.
3. **Question ouverte du run 1 résolue : la simulation de course n'écrase pas l'apport
   individuel du pilote.** Le run 1 s'interrogeait sur 0 podium en 80 courses pour un pilote
   modeste (potentiel ~46-56). Ici, un pilote nettement plus doué (potentiel 86) décroche 5
   victoires et 10 podiums en seulement 37 courses (~40% de taux de podium) avant d'être
   débauché — la performance en course répond donc bien au niveau réel du pilote. Le constat du
   run 1 n'était pas un signal d'un biais de simulation, seulement le résultat attendu d'un
   pilote médiocre face à une grille IA plus relevée.
4. **Le rebond après une double panne (effectif à 0 + trésorerie négative) est possible mais
   très lent.** Contrairement au run 1 (resté légèrement négatif jusqu'à la fin), ce run
   finit en territoire positif (+8 920€, contre un plancher de -34 619€ à mi-parcours) — sans
   jamais retrouver de pilote. Le seul moteur de ce redressement est le revenu sponsor passif
   une fois le staff licencié (donc plus de salaires à payer) ; il a fallu près de 100 semaines
   pour repasser durablement au-dessus de zéro. C'est une confirmation que la "roue de secours"
   manquante identifiée au run 1 n'est pas totale (l'agence ne fait pas systématiquement
   faillite pour de bon), mais le prix est une très longue période — potentiellement plus d'une
   saison entière — où le jeu n'offre plus aucune action significative au joueur.
5. **Réputation et rachat d'écurie** : plafond similaire au run 1 (10-13 ici contre ~11 au run
   1), rachat d'écurie toujours hors de portée sur les 2 runs malgré une politique d'achat
   active — renforce le constat que ce contenu de fin de partie reste largement inaccessible
   sur un horizon de 5 saisons pour une agence de taille modeste.

## Suivi 5 semaines par 5 semaines

### Semaine 5 (Saison 1, S5)
- **Trésorerie**: 27 580€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nordic Air (6 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 46.0, 16 ans
- **Faits marquants**:
  - S1W1: Scouting normal — Chiara Kobayashi
  - S1W1: Scouting approfondi — Chiara Kobayashi (potentiel réel: 86)
  - S1W1: Signé Chiara Kobayashi (potentiel 86, 39 270€) [reconstruction après effectif à 0]
  - S1W1: Sponsor signé — Nordic Air (Bronze, 391€/sem)
  - S1W2: Baquet — Chiara Kobayashi chez Comet Dynamics (Karting KZ1, 6 825€)
  - S1W2: Prêt contracté — 30 000€ sur 18 mois
  - S1W4: Académie financée — Académie Raptor Performance
  - S1W5: Dilemme "Programme d'entraînement intensif" -> option 1/2 -> Chiara Kobayashi en ressort méthodiquement plus solide, presque une nouvelle version de lui-même.

### Semaine 10 (Saison 1, S10)
- **Trésorerie**: 22 176€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nordic Air (1 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 48.3, 16 ans
- **Faits marquants**:
  - S1W6: Staff engagé — Emma Silva (recruiter, 6 650€)

### Semaine 15 (Saison 1, S15)
- **Trésorerie**: 18 294€ · **Réputation**: 4 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (5 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 55.8, 16 ans
- **Faits marquants**:
  - S1W11: Dilemme "Offre de documentaire" -> option 1/2 -> Le cachet du documentaire est versé — mais le montage expose aussi les coulisses moins reluisantes : réputation -1.
  - S1W11: Sponsor signé — Kryon Boissons (Bronze, 352€/sem)
  - S1W12: Staff engagé — Tom Martin (negotiator, 6 500€)
  - S1W12: Campagne PR achetée
  - S1W15: Dilemme "Sponsor controversé" -> option 1/2 -> Le chèque est confortable, l'image en pâtit un peu.

### Semaine 20 (Saison 1, S20)
- **Trésorerie**: 9 304€ · **Réputation**: 4 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: aucun
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 58.6, 16 ans
- **Faits marquants**:
  - S1W16: Dilemme "Grosse performance" -> option 1/2 -> Chiara Kobayashi prend la grosse tête et se relâche : niveau -1.
  - S1W18: Staff engagé — Stella Watanabe (physio, 7 400€)

### Semaine 25 (Saison 1, S25)
- **Trésorerie**: 6 596€ · **Réputation**: 4 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (4 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 62.9, 16 ans
- **Faits marquants**:
  - S1W20: Sponsor signé — Meridian Bank (Bronze, 368€/sem)

### Semaine 30 (Saison 1, S30)
- **Trésorerie**: 6 388€ · **Réputation**: 4 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (13 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 61.9, 16 ans
- **Faits marquants**:
  - S1W26: Dilemme "Retard à l'entraînement" -> option 1/2 -> Chiara Kobayashi se braque et se relâche.
  - S1W29: Sponsor signé — Kryon Boissons (Bronze, 213€/sem)

### Semaine 35 (Saison 1, S35)
- **Trésorerie**: 2 866€ · **Réputation**: 4 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (8 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 65.6, 16 ans

### Semaine 40 (Saison 1, S40)
- **Trésorerie**: 7 498€ · **Réputation**: 4 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (3 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 68.0, 16 ans
- **Faits marquants**:
  - S1W39: Dilemme "Retard à l'entraînement" -> option 2/2 -> L'écurie voit d'un mauvais œil ce laisser-aller.

### Semaine 45 (Saison 1, S45)
- **Trésorerie**: 4 445€ · **Réputation**: 3 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (11 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 70.1, 16 ans
- **Faits marquants**:
  - S1W43: Sponsor signé — Titan Constructions (Bronze, 269€/sem)

### Semaine 50 (Saison 1, S50)
- **Trésorerie**: 1 666€ · **Réputation**: 5 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (6 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 71.7, 16 ans
- **Faits marquants**:
  - S1W48: Dilemme "Offre de documentaire" -> option 2/2 -> Ton refus discret séduit le milieu : réputation +1.
  - S1W49: Dilemme "Demande de dopage" -> option 2/2 -> Chiara Kobayashi prend mal ce recadrage, mais ton intégrité est reconnue : relation -12, réputation +1.
  - S1W50: Dilemme "Tentative de débauchage" -> option 2/2 -> Chiara Kobayashi est vexé de ne pas être retenu : relation en forte baisse.

### Semaine 55 (Saison 2, S3)
- **Trésorerie**: -3 345€ · **Réputation**: 7 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (1 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 73.0, 17 ans

### Semaine 60 (Saison 2, S8)
- **Trésorerie**: -9 949€ · **Réputation**: 7 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (6 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 73.0, 17 ans
- **Faits marquants**:
  - S2W4: Sponsor signé — Cascade Horlogerie (Bronze, 173€/sem)
  - S2W6: Dilemme "Sponsor exigeant" -> option 2/2 -> Tu refuses — la paperasse à elle seule valait le déclin.

### Semaine 65 (Saison 2, S13)
- **Trésorerie**: -15 317€ · **Réputation**: 7 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (1 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 74.9, 17 ans

### Semaine 70 (Saison 2, S18)
- **Trésorerie**: -20 660€ · **Réputation**: 7 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Ferrovia Logistique (10 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 75.7, 17 ans
- **Faits marquants**:
  - S2W14: Sponsor signé — Ferrovia Logistique (Bronze, 327€/sem)
  - S2W17: Dilemme "Blessure légère, veut courir" -> option 2/2 -> L'écurie regrette son absence.

### Semaine 75 (Saison 2, S23)
- **Trésorerie**: -25 407€ · **Réputation**: 7 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Ferrovia Logistique (5 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 76.9, 17 ans
- **Faits marquants**:
  - S2W20: Dilemme "Invitation média exclusive" -> option 3/3 -> Tu déclines poliment — dormir avant la course, c'est aussi ça, le métier.
  - S2W22: Dilemme "Stage d'équipe spécial" -> option 2/2 -> L'écurie prend mal ce refus.

### Semaine 80 (Saison 2, S28)
- **Trésorerie**: -34 619€ · **Réputation**: 8 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: aucun
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 77.3, 17 ans
- **Faits marquants**:
  - S2W26: Dilemme "Optimisation fiscale douteuse" -> option 2/2 -> Tu régularises : coûteux mais sain.

### Semaine 85 (Saison 2, S33)
- **Trésorerie**: -4 245€ · **Réputation**: 8 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (7 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 77.6, 17 ans
- **Faits marquants**:
  - S2W28: Sponsor signé — Meridian Bank (Bronze, 334€/sem)
  - S2W28: Prêt contracté — 30 000€ sur 18 mois
  - S2W32: Dilemme "Tuyau d'investissement" -> option 2/2 -> Tu passes ton tour — l'amitié a ses limites.
  - S2W33: Dilemme "Grosse performance" -> option 2/2 -> Chiara Kobayashi apprécie la reconnaissance mesurée : relation +6.

### Semaine 90 (Saison 2, S38)
- **Trésorerie**: -8 740€ · **Réputation**: 8 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (2 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 77.3, 17 ans
- **Faits marquants**:
  - S2W34: Dilemme "Demande de dopage" -> option 2/2 -> Chiara Kobayashi prend mal ce recadrage, mais ton intégrité est reconnue : relation -12, réputation +1.
  - S2W38: Dilemme "Troubles psychologiques" -> option 2/2 -> Livré à lui-même, Chiara Kobayashi rumine et régresse légèrement.

### Semaine 95 (Saison 2, S43)
- **Trésorerie**: -13 768€ · **Réputation**: 6 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (9 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 78.3, 17 ans
- **Faits marquants**:
  - S2W38: Sponsor résilié volontairement (test du mécanisme)
  - S2W39: Dilemme "Post polémique sur les réseaux" -> option 2/2 -> Chiara Kobayashi se sent lâché par l'agence.
  - S2W39: Sponsor signé — Meridian Bank (Bronze, 349€/sem)
  - S2W41: Dilemme "Tentative de débauchage" -> option 2/2 -> Chiara Kobayashi est vexé de ne pas être retenu : relation en forte baisse.

### Semaine 100 (Saison 2, S48)
- **Trésorerie**: -18 397€ · **Réputation**: 6 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (4 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Chiara Kobayashi — Karting KZ1, note 78.0, 17 ans
- **Faits marquants**:
  - S2W47: Dilemme "Troubles psychologiques" -> option 2/2 -> Livré à lui-même, Chiara Kobayashi rumine et régresse légèrement.
  - S2W48: Dilemme "Tuyau d'investissement" -> option 2/2 -> Tu passes ton tour — l'amitié a ses limites.

### Semaine 105 (Saison 3, S1)
- **Trésorerie**: -12 837€ · **Réputation**: 4 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (14 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S2W49: Dilemme "Tentative de débauchage" -> option 2/2 -> Chiara Kobayashi claque la porte et rejoint l'agence rivale sur-le-champ !
  - S2W49: Staff licencié en urgence — Stella Watanabe (366€/sem économisés) [effectif à 0, trésorerie critique]
  - S2W50: Staff licencié en urgence — Emma Silva (336€/sem économisés) [effectif à 0, trésorerie critique]
  - S2W51: Staff licencié en urgence — Tom Martin (330€/sem économisés) [effectif à 0, trésorerie critique]
  - S2W52: Sponsor signé — Meridian Bank (Bronze, 175€/sem)

### Semaine 110 (Saison 3, S6)
- **Trésorerie**: -17 126€ · **Réputation**: 5 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (9 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W2: Dilemme "Procès d'un pilote célèbre" -> option 2/2 -> Ton intégrité est remarquée : réputation en hausse.

### Semaine 115 (Saison 3, S11)
- **Trésorerie**: -18 656€ · **Réputation**: 5 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (4 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W8: Dilemme "Tuyau d'investissement" -> option 2/2 -> Tu passes ton tour — l'amitié a ses limites.
  - S3W10: Dilemme "Sponsor controversé" -> option 2/2 -> La marque se venge dans la presse : réputation -1.

### Semaine 120 (Saison 3, S16)
- **Trésorerie**: -20 178€ · **Réputation**: 5 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Solstice Media (8 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W15: Sponsor signé — Solstice Media (Bronze, 183€/sem)
  - S3W16: Dilemme "Sponsor exigeant" -> option 2/2 -> Tu refuses — la paperasse à elle seule valait le déclin.

### Semaine 125 (Saison 3, S21)
- **Trésorerie**: -21 668€ · **Réputation**: 5 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Solstice Media (3 sem. restantes)
- **Écuries possédées**: aucune

### Semaine 130 (Saison 3, S26)
- **Trésorerie**: -22 768€ · **Réputation**: 5 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (7 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W24: Sponsor signé — Kryon Boissons (Bronze, 378€/sem)

### Semaine 135 (Saison 3, S31)
- **Trésorerie**: -23 546€ · **Réputation**: 8 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (2 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W27: Dilemme "Sponsor controversé" -> option 2/2 -> Tu refuses proprement, sans vagues.
  - S3W30: Dilemme "Optimisation fiscale douteuse" -> option 2/2 -> Tu régularises : coûteux mais sain.

### Semaine 140 (Saison 3, S36)
- **Trésorerie**: -25 774€ · **Réputation**: 9 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (8 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W33: Sponsor signé — Vantage Pneus (Bronze, 238€/sem)

### Semaine 145 (Saison 3, S41)
- **Trésorerie**: -26 989€ · **Réputation**: 10 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (3 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W40: Dilemme "Tuyau d'investissement" -> option 2/2 -> Tu passes ton tour — l'amitié a ses limites.

### Semaine 150 (Saison 3, S46)
- **Trésorerie**: -28 082€ · **Réputation**: 10 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (14 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W44: Sponsor signé — Titan Constructions (Bronze, 299€/sem)

### Semaine 155 (Saison 3, S51)
- **Trésorerie**: -28 992€ · **Réputation**: 7 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (9 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W47: Dilemme "Demande d'une fondation caritative" -> option 2/2 -> Tu déclines poliment.
  - S3W49: Dilemme "Sponsor controversé" -> option 2/2 -> Tu refuses proprement, sans vagues.

### Semaine 160 (Saison 4, S4)
- **Trésorerie**: 116€ · **Réputation**: 7 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (4 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W2: Prêt contracté — 30 000€ sur 18 mois
  - S4W4: Dilemme "Sponsor exigeant" -> option 2/2 -> Tu refuses — la paperasse à elle seule valait le déclin.

### Semaine 165 (Saison 4, S9)
- **Trésorerie**: 4 920€ · **Réputation**: 7 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Ferrovia Logistique (9 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W8: Scouting normal — Nolan Lopez
  - S4W8: Sponsor signé — Ferrovia Logistique (Bronze, 368€/sem)

### Semaine 170 (Saison 4, S14)
- **Trésorerie**: 4 355€ · **Réputation**: 7 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Ferrovia Logistique (4 sem. restantes)
- **Écuries possédées**: aucune

### Semaine 175 (Saison 4, S19)
- **Trésorerie**: 11 449€ · **Réputation**: 6 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (15 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W18: Sponsor signé — Vantage Pneus (Bronze, 280€/sem)
  - S4W19: Dilemme "Optimisation fiscale douteuse" -> option 1/2 -> Les caisses se remplissent... à tes risques.

### Semaine 180 (Saison 4, S24)
- **Trésorerie**: 13 592€ · **Réputation**: 8 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (10 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W20: Dilemme "Demande d'une fondation caritative" -> option 1/2 -> Ton don est largement relayé : réputation +2.

### Semaine 185 (Saison 4, S29)
- **Trésorerie**: 9 387€ · **Réputation**: 8 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Vantage Pneus (5 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W26: Scouting normal — Theo Duval
  - S4W26: Scouting approfondi — Theo Duval (potentiel réel: 65)
  - S4W27: Scouting normal — Adam Petit
  - S4W28: Scouting normal — Talia Wallace

### Semaine 190 (Saison 4, S34)
- **Trésorerie**: 14 216€ · **Réputation**: 8 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: aucun
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W29: Scouting normal — Selma Fontaine
  - S4W30: Scouting normal — Emma Roux
  - S4W31: Dilemme "Sponsor exigeant" -> option 1/2 -> Le sponsor est ravi du résultat : +7 034€.
  - S4W31: Scouting normal — Elena Sokolov

### Semaine 195 (Saison 4, S39)
- **Trésorerie**: 9 631€ · **Réputation**: 10 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (4 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W34: Sponsor signé — Cobalt Assurance (Bronze, 364€/sem)
  - S4W35: Dilemme "Optimisation fiscale douteuse" -> option 2/2 -> Tu régularises : coûteux mais sain.
  - S4W37: Dilemme "Offre de documentaire" -> option 2/2 -> Ton refus discret séduit le milieu : réputation +1.

### Semaine 200 (Saison 4, S44)
- **Trésorerie**: 15 436€ · **Réputation**: 10 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Lumina Tech (14 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W43: Sponsor signé — Lumina Tech (Bronze, 238€/sem)

### Semaine 205 (Saison 4, S49)
- **Trésorerie**: 14 221€ · **Réputation**: 11 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Lumina Tech (9 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W48: Dilemme "Sponsor exigeant" -> option 2/2 -> Tu refuses — la paperasse à elle seule valait le déclin.

### Semaine 210 (Saison 5, S2)
- **Trésorerie**: 12 606€ · **Réputation**: 12 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Lumina Tech (4 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W1: Scouting normal — Dmitri Santos

### Semaine 215 (Saison 5, S7)
- **Trésorerie**: 4 914€ · **Réputation**: 12 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nordic Air (10 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W2: Scouting normal — Rafael Martin
  - S5W2: Scouting approfondi — Rafael Martin (potentiel réel: 92)
  - S5W3: Dilemme "Demande d'une fondation caritative" -> option 2/2 -> Tu déclines poliment.
  - S5W3: Scouting normal — Elena Chevalier
  - S5W4: Scouting normal — Emma Cortez
  - S5W5: Scouting normal — Erik Suzuki
  - S5W6: Scouting normal — Sofia Dubois
  - S5W6: Sponsor signé — Nordic Air (Bronze, 386€/sem)

### Semaine 220 (Saison 5, S12)
- **Trésorerie**: 10 082€ · **Réputation**: 11 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nordic Air (5 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W8: Dilemme "Tuyau d'investissement" -> option 2/2 -> Tu passes ton tour — l'amitié a ses limites.

### Semaine 225 (Saison 5, S17)
- **Trésorerie**: 13 607€ · **Réputation**: 10 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: aucun
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W16: Dilemme "Offre de documentaire" -> option 1/2 -> Le cachet du documentaire est versé — mais le montage expose aussi les coulisses moins reluisantes : réputation -1.

### Semaine 230 (Saison 5, S22)
- **Trésorerie**: 8 472€ · **Réputation**: 10 · **Effectif**: 0 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (5 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W17: Sponsor signé — Cobalt Assurance (Bronze, 399€/sem)
  - S5W20: Staff engagé — Yanis Ferrari (recruiter, 6 950€)

### Semaine 235 (Saison 5, S27)
- **Trésorerie**: 1 018€ · **Réputation**: 11 · **Effectif**: 0 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: aucun
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W24: Dilemme "Demande d'une fondation caritative" -> option 1/2 -> Ton don est largement relayé : réputation +2.
  - S5W26: Scouting normal — Noemie Sato

### Semaine 240 (Saison 5, S32)
- **Trésorerie**: 23 176€ · **Réputation**: 11 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Solstice Media (11 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W27: Staff licencié en urgence — Yanis Ferrari (348€/sem économisés) [effectif à 0, trésorerie critique]
  - S5W27: Sponsor signé — Solstice Media (Bronze, 249€/sem)
  - S5W28: Prêt contracté — 30 000€ sur 18 mois
  - S5W29: Scouting normal — Mateo Moreau
  - S5W29: Scouting approfondi — Ines Lefevre (potentiel réel: 91)
  - S5W30: Dilemme "Tuyau d'investissement" -> option 1/2 -> Le tuyau était crevé : perte sèche.
  - S5W30: Scouting normal — Ines Conti
  - S5W31: Scouting normal — Marco Romano
  - S5W31: Scouting approfondi — Mateo Moreau (potentiel réel: 77)

### Semaine 245 (Saison 5, S37)
- **Trésorerie**: 9 784€ · **Réputation**: 13 · **Effectif**: 0 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Solstice Media (6 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W32: Staff engagé — Pierre Fischer (recruiter, 7 400€)
  - S5W32: Campagne PR achetée
  - S5W34: Dilemme "Offre de documentaire" -> option 2/2 -> Le studio hausse les épaules et va filmer une agence rivale à la place.

### Semaine 250 (Saison 5, S42)
- **Trésorerie**: 8 779€ · **Réputation**: 12 · **Effectif**: 0 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Solstice Media (1 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W40: Dilemme "Offre de documentaire" -> option 1/2 -> Le cachet du documentaire est versé — mais le montage expose aussi les coulisses moins reluisantes : réputation -1.

### Semaine 255 (Saison 5, S47)
- **Trésorerie**: 19 890€ · **Réputation**: 10 · **Effectif**: 0 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (11 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W43: Sponsor signé — Nébuleuse Streaming (Bronze, 323€/sem)
  - S5W45: Dilemme "Sponsor exigeant" -> option 1/2 -> Le sponsor est ravi du résultat : +6 783€.

### Semaine 260 (Saison 5, S52)
- **Trésorerie**: 9 786€ · **Réputation**: 10 · **Effectif**: 0 pilote(s) · **Staff**: 2 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (6 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W50: Staff engagé — Theo Fischer (negotiator, 6 800€)

## Résumé agrégé

- **Durée effective**: 260/260 semaines, aucun crash
- **Trésorerie finale**: 8 920€ · **minimum atteint**: -34 619€ · **semaines en négatif à la fin**: 0
- **Réputation finale**: 10
- **Effectif final**: 0 pilote(s), 2 membre(s) de staff
- **Signatures**: 1 réussies / 1 tentées (échecs: 0)
- **Approches de pilotes établis**: 0 réussies / 0 tentées
- **Baquets obtenus**: 1 (sur 1 propositions), **2e championnats**: 0, **remplacements**: 0, **transferts négociés**: 0
- **Renouvellements de contrat**: 0 réussis / 49 tentés
- **Résiliations**: 0 · **Débauchages subis**: 0
- **Courses disputées**: 37 (victoires: 5, podiums: 10, abandons: 1) · **Titres remportés**: 0
- **Traits acquis**: 0 · **Graduations d'académie manquées**: 0
- **Staff engagé**: recruiter: 3, negotiator: 2, physio: 1
- **Infrastructures améliorées**: aucune
- **Style de vie amélioré**: aucun
- **Achats boutique**: 2
- **Académies financées**: 1 · **Prospects d'académie signés**: 0
- **Sponsors signés**: 22 · **Résiliés**: 1
- **Prêts contractés**: 4
- **Licenciements d'urgence (effectif à 0)**: 4
- **Écuries rachetées** (0):
  (aucune)
- **Améliorations de développement d'écurie**: 0

### Répartition des choix de dilemmes (eventId#optionIndex)
- investment-tip#1 — 5 fois
- sponsor-conditions#1 — 4 fois
- documentary-offer#0 — 3 fois
- documentary-offer#1 — 3 fois
- poaching-attempt#1 — 3 fois
- tax-evasion#1 — 3 fois
- controversial-sponsor#1 — 3 fois
- doping-request#1 — 2 fois
- psychological-issues#1 — 2 fois
- charity-request#1 — 2 fois
- charity-request#0 — 2 fois
- sponsor-conditions#0 — 2 fois
- push-driver#0 — 1 fois
- controversial-sponsor#0 — 1 fois
- great-performance#0 — 1 fois
- late-training#0 — 1 fois
- late-training#1 — 1 fois
- light-injury-race#1 — 1 fois
- media-invitation#2 — 1 fois
- team-camp#1 — 1 fois
- great-performance#1 — 1 fois
- social-media-post#1 — 1 fois
- driver-lawsuit#1 — 1 fois
- tax-evasion#0 — 1 fois
- investment-tip#0 — 1 fois

### Échecs d'actions les plus fréquents
- negotiateContract: budget insuffisant pour l'indemnité de renouvellement — 49 fois

## Avertissements d'équilibrage relevés (8)
- **S1W2 (semaine 2)** — Trésorerie passée sous le seuil de prêt (10 000€) — prêt d'urgence contracté.
- **S2W4 (semaine 56)** — Trésorerie négative depuis 4+ semaines consécutives (min atteint: -4 589€) — signal de quasi-faillite.
- **S2W28 (semaine 80)** — Trésorerie passée sous le seuil de prêt (10 000€) — prêt d'urgence contracté.
- **S4W2 (semaine 158)** — Trésorerie passée sous le seuil de prêt (10 000€) — prêt d'urgence contracté.
- **S5W28 (semaine 236)** — Trésorerie passée sous le seuil de prêt (10 000€) — prêt d'urgence contracté.
- **S6W1 (semaine 261)** — Aucune écurie rachetée en 5 saisons malgré une politique d'achat active dès que réputation+budget le permettaient — le rachat d'écurie reste hors de portée en pratique sur cet horizon.
- **S6W1 (semaine 261)** — 4 prêts contractés au total — la trésorerie a replongé de manière répétée sous le seuil critique.
- **S6W1 (semaine 261)** — 4 licenciement(s) d'urgence pour limiter la casse pendant une période sans pilote — signale un vrai risque de spirale (staff/prêt continuent de coûter sans aucun revenu de course tant que l'effectif est à 0).
