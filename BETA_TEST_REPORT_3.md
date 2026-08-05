# Rapport de beta-test — 5 saisons (260 semaines) — RUN 3

Troisième simulation headless, même politique de jeu disciplinée que les runs 1 et 2
(`BETA_TEST_REPORT.md` / `BETA_TEST_REPORT_2.md`), avec une 3e graine différente — objectif :
consolider (ou infirmer) les schémas déjà observés sur 2 runs avant l'analyse groupée des 3.
Graine: `51423897`. Script: `beta_test_5_seasons_3.js` (supprimé après génération de ce rapport).

## Méthodologie (identique aux runs 1 et 2)

- **Scouting/signature**: scoute un prospect non révélé tous les 3 semaines (toutes les
  semaines si l'effectif est à 0), scout approfondi dès qu'un profil semble prometteur
  (potentiel ≥ 62) si la trésorerie le permet. Signe le meilleur prospect scouté affordable
  (potentiel ≥ 48, marge ×1.1 ; potentiel ≥ 40 et marge ×1.02 si effectif à 0) via négociation
  à ~105% du prix de base, relance avec la contre-offre en cas de refus. Croissance d'effectif
  calée sur la cible saisonnière du design (1/2/3/5/8 pilotes visés en S1-S5), pas de nouvelle
  signature au-delà tant que la trésorerie n'est pas très confortable (>100 000€).
- **Baquets/contrats**: propose systématiquement les pilotes sans écurie, accepte la meilleure
  offre, négocie les transferts à 110% de l'indemnité de référence, renouvelle les contrats
  avec une offre généreuse puis réutilise la contre-offre du pilote en cas de refus.
- **Staff**: un membre de chaque rôle dès que possible ; licenciement d'urgence du membre le
  plus cher si effectif à 0 et trésorerie sous 3 000€.
- **Infrastructures/Académies/Sponsoring/Style de vie/Boutique**: mêmes règles que les runs
  précédents.
- **Prêt**: réservé aux urgences réelles (trésorerie sous 3 000€), pas à chaque dip sous
  10 000€.
- **Rachat d'écurie**: dès que réputation ET trésorerie le permettent (prix ≤ 35% de la
  trésorerie), le moins cher en premier.
- **Dilemmes**: dilemme de débauchage rassuré sauf 1 fois sur 5 ; les autres dilemmes
  choisissent l'option la plus prudente sous 6 000€ de trésorerie, sinon font tourner
  cycliquement toutes les options au fil des occurrences.

## Constats clés (analyse) — et comparaison avec les runs 1 et 2

1. **Le renouvellement de contrat échoue quasi-systématiquement, sur les 3 runs.** 2/14 (run 1),
   0/49 (run 2), 0/31 (run 3) — jamais plus de ~15% de succès, souvent 0%. C'est désormais le
   constat le plus solidement établi des trois simulations : la spirale contre-offre/indemnité
   de `negotiateContract` (state.js) n'est pas un accident de graine, elle se reproduit à chaque
   run avec la même signature ("budget insuffisant pour l'indemnité de renouvellement" — 31
   occurrences ici, 49 au run 2, 11 au run 1).
2. **Perte du pilote unique + longue traversée du désert, à nouveau.** Débauché semaine ~83,
   effectif à 0 pendant ~155 semaines sur 260 (60%, quasi identique au run 2). Troisième
   confirmation que la dépendance à un seul pilote est le point de rupture principal de ce
   style de jeu prudent.
3. **Un pilote très doué (potentiel 88, comme au run 2) performe bien en course** — 4 victoires
   et 9 podiums en 24 courses (~54% de podiums), avant d'être débauché. Confirme à nouveau que
   la simulation de course répond correctement au niveau du pilote (cf. run 2, point 3).
4. **Reconstruction tardive et incomplète.** Un second pilote (potentiel 50) n'a pu être signé
   qu'en semaine 240 — 20 semaines avant la fin — et n'a jamais obtenu de baquet malgré 8
   tentatives de proposition sur l'ensemble du run : fenêtre trop courte pour en tirer une
   conclusion ferme, mais cohérent avec une reconstruction structurellement lente une fois le
   cercle vicieux staff-licencié/trésorerie exsangue enclenché.
5. **Réputation finale la plus basse des 3 runs (2, contre ~3 et ~10-13)** — cohérent avec le
   fait que ce run a passé le plus de temps sans pilote actif générant des dilemmes/opportunités
   de gain de réputation. Rachat d'écurie à nouveau hors de portée.
6. **14 avertissements collectés**, le plus élevé des 3 runs — essentiellement des répétitions
   du même cycle prêt d'urgence -> quasi-faillite plutôt que des problèmes inédits, ce qui est
   en soi révélateur : le jeu, joué prudemment, tourne en boucle sur un nombre restreint de
   mécaniques de crise plutôt que de proposer une vraie diversité de trajectoires possibles une
   fois le pilote unique perdu.

## Suivi 5 semaines par 5 semaines

### Semaine 5 (Saison 1, S5)
- **Trésorerie**: 26 983€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (4 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 59.8, 17 ans
- **Faits marquants**:
  - S1W1: Scouting normal — Tom Wallace
  - S1W1: Scouting approfondi — Tom Wallace (potentiel réel: 88)
  - S1W1: Signé Tom Wallace (potentiel 88, 40 110€) [reconstruction après effectif à 0]
  - S1W1: Sponsor signé — Nébuleuse Streaming (Bronze, 386€/sem)
  - S1W2: Baquet — Tom Wallace chez Quartz Motors (Karting Senior, 6 685€)
  - S1W2: Prêt contracté — 30 000€ sur 18 mois
  - S1W4: Académie financée — Académie Zenith Competizione

### Semaine 10 (Saison 1, S10)
- **Trésorerie**: 21 532€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Lumina Tech (13 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 61.1, 17 ans
- **Faits marquants**:
  - S1W6: Staff engagé — Maxime Moreau (recruiter, 6 800€)
  - S1W9: Sponsor signé — Lumina Tech (Bronze, 267€/sem)

### Semaine 15 (Saison 1, S15)
- **Trésorerie**: 14 654€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Lumina Tech (8 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 63.8, 17 ans
- **Faits marquants**:
  - S1W11: Dilemme "Blessure légère, veut courir" -> option 1/2 -> La blessure s'aggrave : 3 semaines d'arrêt.
  - S1W12: Staff engagé — Milo Garcia (negotiator, 6 800€)

### Semaine 20 (Saison 1, S20)
- **Trésorerie**: 10 791€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Lumina Tech (3 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 67.4, 17 ans
- **Faits marquants**:
  - S1W18: Dilemme "Grosse performance" -> option 1/2 -> Tom Wallace prend la grosse tête et se relâche : niveau -1.
  - S1W19: Remplacement ponctuel accepté — Tom Wallace
  - S1W20: Dilemme "Stage d'équipe spécial" -> option 1/2 -> Tom Wallace revient affûté et soudé à l'écurie.

### Semaine 25 (Saison 1, S25)
- **Trésorerie**: 7 925€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Ferrovia Logistique (13 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 70.1, 17 ans
- **Faits marquants**:
  - S1W22: Dilemme "Demande d'une fondation caritative" -> option 1/2 -> Ton don est largement relayé : réputation +2.
  - S1W23: Sponsor signé — Ferrovia Logistique (Bronze, 248€/sem)

### Semaine 30 (Saison 1, S30)
- **Trésorerie**: 5 185€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Ferrovia Logistique (8 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 70.1, 17 ans
- **Faits marquants**:
  - S1W27: Dilemme "Troubles psychologiques" -> option 1/2 -> Quelques séances plus tard, Tom Wallace retrouve sa sérénité et sa concentration.

### Semaine 35 (Saison 1, S35)
- **Trésorerie**: 4 119€ · **Réputation**: 3 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Ferrovia Logistique (3 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 71.7, 17 ans
- **Faits marquants**:
  - S1W32: Dilemme "Invitation média exclusive" -> option 3/3 -> Tu déclines poliment — dormir avant la course, c'est aussi ça, le métier.
  - S1W35: Dilemme "Demande de dopage" -> option 2/2 -> Tom Wallace prend mal ce recadrage, mais ton intégrité est reconnue : relation -12, réputation +1.

### Semaine 40 (Saison 1, S40)
- **Trésorerie**: 7 352€ · **Réputation**: 3 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Voltis Énergie (9 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 73.0, 17 ans
- **Faits marquants**:
  - S1W38: Dilemme "Blessure légère, veut courir" -> option 2/2 -> L'écurie regrette son absence.
  - S1W38: Sponsor signé — Voltis Énergie (Bronze, 212€/sem)
  - S1W40: Dilemme "Programme d'entraînement intensif" -> option 1/2 -> Tom Wallace en ressort méthodiquement plus solide, presque une nouvelle version de lui-même.

### Semaine 45 (Saison 1, S45)
- **Trésorerie**: 15 791€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 2 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Voltis Énergie (4 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 74.7, 17 ans
- **Faits marquants**:
  - S1W45: Dilemme "Tuyau d'investissement" -> option 1/2 -> Le placement rapporte gros !

### Semaine 50 (Saison 1, S50)
- **Trésorerie**: 11 270€ · **Réputation**: 0 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (15 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 75.9, 17 ans
- **Faits marquants**:
  - S1W46: Dilemme "Méforme" -> option 1/2 -> Tom Wallace se reprend en main : forme en hausse.
  - S1W48: Staff engagé — Oscar Conti (physio, 6 800€)
  - S1W49: Sponsor signé — Nébuleuse Streaming (Bronze, 320€/sem)
  - S1W50: Dilemme "Sponsor controversé" -> option 1/2 -> Le chèque est confortable, l'image en pâtit un peu.

### Semaine 55 (Saison 2, S3)
- **Trésorerie**: 6 179€ · **Réputation**: 4 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (10 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 77.2, 18 ans
- **Faits marquants**:
  - S2W2: Scouting normal — Rafael Cortez

### Semaine 60 (Saison 2, S8)
- **Trésorerie**: 244€ · **Réputation**: 4 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (5 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 77.2, 18 ans
- **Faits marquants**:
  - S2W8: Dilemme "Stage d'équipe spécial" -> option 2/2 -> L'écurie prend mal ce refus.

### Semaine 65 (Saison 2, S13)
- **Trésorerie**: -4 334€ · **Réputation**: 3 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: aucun
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 77.2, 18 ans
- **Faits marquants**:
  - S2W9: Dilemme "Sponsor controversé" -> option 2/2 -> La marque se venge dans la presse : réputation -1.
  - S2W10: Dilemme "Tuyau d'investissement" -> option 2/2 -> Tu passes ton tour — l'amitié a ses limites.
  - S2W13: Dilemme "Troubles psychologiques" -> option 2/2 -> Livré à lui-même, Tom Wallace rumine et régresse légèrement.

### Semaine 70 (Saison 2, S18)
- **Trésorerie**: -9 724€ · **Réputation**: 4 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Lumina Tech (4 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 72.7, 18 ans
- **Faits marquants**:
  - S2W13: Sponsor signé — Lumina Tech (Bronze, 354€/sem)
  - S2W14: Dilemme "Demande de dopage" -> option 2/2 -> Tom Wallace prend mal ce recadrage, mais ton intégrité est reconnue : relation -12, réputation +1.
  - S2W15: Dilemme "Blessure légère, veut courir" -> option 2/2 -> L'écurie regrette son absence.
  - S2W17: Dilemme "Blessure grave" -> option 2/2 -> Tom Wallace traîne sa blessure : 12 semaines d'absence.

### Semaine 75 (Saison 2, S23)
- **Trésorerie**: -15 547€ · **Réputation**: 3 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (14 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 72.7, 18 ans
- **Faits marquants**:
  - S2W20: Dilemme "Crise personnelle" -> option 2/2 -> Tom Wallace se sent seul face à l'agence.
  - S2W22: Sponsor signé — Meridian Bank (Bronze, 296€/sem)

### Semaine 80 (Saison 2, S28)
- **Trésorerie**: -21 584€ · **Réputation**: 3 · **Effectif**: 1 pilote(s) · **Staff**: 3 · **Prêt actif**: non
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (9 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Tom Wallace — Karting Senior, note 72.7, 18 ans

### Semaine 85 (Saison 2, S33)
- **Trésorerie**: 11 832€ · **Réputation**: 1 · **Effectif**: 0 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Meridian Bank (4 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S2W28: Prêt contracté — 30 000€ sur 18 mois
  - S2W29: Scouting normal — Kenji Sato
  - S2W31: Débauché par une agence rivale — Tom Wallace
  - S2W31: Dilemme "Tentative de débauchage" -> option 2/2 -> Tom Wallace est vexé de ne pas être retenu : relation en forte baisse.
  - S2W31: Scouting normal — Chloe Lopez

### Semaine 90 (Saison 2, S38)
- **Trésorerie**: 5 780€ · **Réputation**: 2 · **Effectif**: 0 pilote(s) · **Staff**: 3 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (14 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S2W37: Sponsor signé — Cobalt Assurance (Bronze, 299€/sem)

### Semaine 95 (Saison 2, S43)
- **Trésorerie**: 479€ · **Réputation**: 1 · **Effectif**: 0 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (10 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S2W38: Sponsor résilié volontairement (test du mécanisme)
  - S2W39: Sponsor signé — Cobalt Assurance (Bronze, 302€/sem)
  - S2W41: Staff licencié en urgence — Maxime Moreau (342€/sem économisés) [effectif à 0, trésorerie critique]
  - S2W42: Staff licencié en urgence — Milo Garcia (342€/sem économisés) [effectif à 0, trésorerie critique]

### Semaine 100 (Saison 2, S48)
- **Trésorerie**: -416€ · **Réputation**: 0 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (5 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S2W43: Staff licencié en urgence — Oscar Conti (342€/sem économisés) [effectif à 0, trésorerie critique]
  - S2W47: Dilemme "Sponsor controversé" -> option 2/2 -> La marque se venge dans la presse : réputation -1.

### Semaine 105 (Saison 3, S1)
- **Trésorerie**: -1 311€ · **Réputation**: 0 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: aucun
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S2W52: Dilemme "Sponsor controversé" -> option 2/2 -> Tu refuses proprement, sans vagues.

### Semaine 110 (Saison 3, S6)
- **Trésorerie**: 1 807€ · **Réputation**: 0 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (10 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W1: Sponsor signé — Cascade Horlogerie (Bronze, 203€/sem)
  - S3W4: Dilemme "Demande d'une fondation caritative" -> option 2/2 -> Tu déclines poliment.

### Semaine 115 (Saison 3, S11)
- **Trésorerie**: 417€ · **Réputation**: 1 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (5 sem. restantes)
- **Écuries possédées**: aucune

### Semaine 120 (Saison 3, S16)
- **Trésorerie**: 3 004€ · **Réputation**: 1 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: aucun
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W16: Dilemme "Demande d'une fondation caritative" -> option 2/2 -> Tu déclines poliment.

### Semaine 125 (Saison 3, S21)
- **Trésorerie**: -3 228€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nébuleuse Streaming (3 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W16: Sponsor signé — Nébuleuse Streaming (Bronze, 369€/sem)
  - S3W17: Dilemme "Offre de documentaire" -> option 2/2 -> Ton refus discret séduit le milieu : réputation +1.
  - S3W19: Dilemme "Optimisation fiscale douteuse" -> option 2/2 -> Tu régularises : coûteux mais sain.

### Semaine 130 (Saison 3, S26)
- **Trésorerie**: 1 973€ · **Réputation**: 4 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nordic Air (12 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W22: Dilemme "Offre de documentaire" -> option 2/2 -> Ton refus discret séduit le milieu : réputation +1.
  - S3W24: Sponsor signé — Nordic Air (Bronze, 372€/sem)

### Semaine 135 (Saison 3, S31)
- **Trésorerie**: 1 428€ · **Réputation**: 4 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nordic Air (7 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W27: Dilemme "Offre de documentaire" -> option 2/2 -> Le studio hausse les épaules et va filmer une agence rivale à la place.
  - S3W30: Dilemme "Demande d'une fondation caritative" -> option 2/2 -> Tu déclines poliment.

### Semaine 140 (Saison 3, S36)
- **Trésorerie**: -2 868€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nordic Air (2 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W36: Dilemme "Sponsor controversé" -> option 2/2 -> La marque se venge dans la presse : réputation -1.

### Semaine 145 (Saison 3, S41)
- **Trésorerie**: 1 858€ · **Réputation**: 4 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (6 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W38: Sponsor signé — Cobalt Assurance (Bronze, 189€/sem)

### Semaine 150 (Saison 3, S46)
- **Trésorerie**: 398€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cobalt Assurance (1 sem. restantes)
- **Écuries possédées**: aucune

### Semaine 155 (Saison 3, S51)
- **Trésorerie**: -926€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (8 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S3W47: Dilemme "Offre de documentaire" -> option 2/2 -> Ton refus discret séduit le milieu : réputation +1.
  - S3W47: Sponsor signé — Kryon Boissons (Bronze, 223€/sem)
  - S3W49: Dilemme "Tuyau d'investissement" -> option 2/2 -> Tu passes ton tour — l'amitié a ses limites.

### Semaine 160 (Saison 4, S4)
- **Trésorerie**: 27 402€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Kryon Boissons (3 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W2: Prêt contracté — 30 000€ sur 18 mois
  - S4W3: Scouting normal — Freya Lefevre

### Semaine 165 (Saison 4, S9)
- **Trésorerie**: 18 289€ · **Réputation**: 2 · **Effectif**: 0 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Lumina Tech (13 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W4: Scouting normal — Paula Esposito
  - S4W5: Scouting normal — Vera Bernard
  - S4W6: Staff engagé — Victor Martin (recruiter, 7 250€)
  - S4W6: Scouting normal — Chiara Sato
  - S4W7: Dilemme "Offre de documentaire" -> option 1/2 -> Le cachet du documentaire est versé — mais le montage expose aussi les coulisses moins reluisantes : réputation -1.
  - S4W7: Scouting approfondi — Astrid Bianchi (potentiel réel: 66)
  - S4W7: Sponsor signé — Lumina Tech (Bronze, 374€/sem)

### Semaine 170 (Saison 4, S14)
- **Trésorerie**: 13 275€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Lumina Tech (8 sem. restantes)
- **Écuries possédées**: aucune

### Semaine 175 (Saison 4, S19)
- **Trésorerie**: 10 940€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Lumina Tech (3 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W18: Dilemme "Demande d'une fondation caritative" -> option 2/2 -> Tu déclines poliment.

### Semaine 180 (Saison 4, S24)
- **Trésorerie**: 8 373€ · **Réputation**: 2 · **Effectif**: 0 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (14 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W22: Sponsor signé — Cascade Horlogerie (Bronze, 258€/sem)

### Semaine 185 (Saison 4, S29)
- **Trésorerie**: 4 308€ · **Réputation**: 0 · **Effectif**: 0 pilote(s) · **Staff**: 1 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (9 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W25: Dilemme "Offre de documentaire" -> option 2/2 -> Ton refus discret séduit le milieu : réputation +1.
  - S4W26: Dilemme "Sponsor controversé" -> option 2/2 -> Tu refuses proprement, sans vagues.
  - S4W26: Scouting normal — Hugo Duval
  - S4W27: Scouting normal — Haruto Novak

### Semaine 190 (Saison 4, S34)
- **Trésorerie**: 2 113€ · **Réputation**: 2 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Cascade Horlogerie (4 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W30: Dilemme "Offre de documentaire" -> option 2/2 -> Ton refus discret séduit le milieu : réputation +1.
  - S4W31: Dilemme "Procès d'un pilote célèbre" -> option 2/2 -> Ton intégrité est remarquée : réputation en hausse.
  - S4W32: Staff licencié en urgence — Victor Martin (360€/sem économisés) [effectif à 0, trésorerie critique]

### Semaine 195 (Saison 4, S39)
- **Trésorerie**: 1 121€ · **Réputation**: 2 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Solstice Media (11 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W35: Dilemme "Sponsor controversé" -> option 2/2 -> Tu refuses proprement, sans vagues.
  - S4W36: Dilemme "Offre de documentaire" -> option 2/2 -> Le studio hausse les épaules et va filmer une agence rivale à la place.
  - S4W38: Dilemme "Demande d'une fondation caritative" -> option 2/2 -> Tu déclines poliment.
  - S4W38: Sponsor signé — Solstice Media (Bronze, 381€/sem)

### Semaine 200 (Saison 4, S44)
- **Trésorerie**: 6 625€ · **Réputation**: 2 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Solstice Media (6 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W40: Dilemme "Sponsor controversé" -> option 2/2 -> Tu refuses proprement, sans vagues.

### Semaine 205 (Saison 4, S49)
- **Trésorerie**: 2 970€ · **Réputation**: 2 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Solstice Media (1 sem. restantes)
- **Écuries possédées**: aucune

### Semaine 210 (Saison 5, S2)
- **Trésorerie**: 5 388€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (10 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S4W50: Sponsor signé — Titan Constructions (Bronze, 327€/sem)
  - S4W51: Dilemme "Offre de documentaire" -> option 2/2 -> Ton refus discret séduit le milieu : réputation +1.
  - S5W1: Scouting normal — Louis Watanabe

### Semaine 215 (Saison 5, S7)
- **Trésorerie**: 4 218€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (5 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W2: Scouting normal — Olga Conti

### Semaine 220 (Saison 5, S12)
- **Trésorerie**: 3 448€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: aucun
- **Écuries possédées**: aucune

### Semaine 225 (Saison 5, S17)
- **Trésorerie**: 1 913€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Nordic Air (5 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W12: Sponsor signé — Nordic Air (Bronze, 174€/sem)
  - S5W15: Dilemme "Sponsor controversé" -> option 2/2 -> Tu refuses proprement, sans vagues.

### Semaine 230 (Saison 5, S22)
- **Trésorerie**: 378€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: aucun
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W22: Dilemme "Sponsor controversé" -> option 2/2 -> Tu refuses proprement, sans vagues.

### Semaine 235 (Saison 5, S27)
- **Trésorerie**: -2 844€ · **Réputation**: 3 · **Effectif**: 0 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Solstice Media (3 sem. restantes)
- **Écuries possédées**: aucune
- **Faits marquants**:
  - S5W22: Sponsor signé — Solstice Media (Bronze, 283€/sem)

### Semaine 240 (Saison 5, S32)
- **Trésorerie**: 1 721€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Zenith Motors Oil (11 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Theo Muller — sans catégorie [SANS BAQUET], note 34.9, 16 ans
- **Faits marquants**:
  - S5W28: Prêt contracté — 30 000€ sur 18 mois
  - S5W29: Scouting normal — Lars Renard
  - S5W29: Scouting approfondi — Lars Renard (potentiel réel: 74)
  - S5W30: Dilemme "Demande d'une fondation caritative" -> option 1/2 -> Ton don passe inaperçu médiatiquement.
  - S5W30: Scouting normal — Theo Muller
  - S5W30: Sponsor signé — Zenith Motors Oil (Bronze, 275€/sem)
  - S5W31: Dilemme "Optimisation fiscale douteuse" -> option 1/2 -> Les caisses se remplissent... à tes risques.
  - S5W31: Scouting normal — Jules Petit
  - S5W31: Signé Theo Muller (potentiel 50, 24 150€) [reconstruction après effectif à 0]

### Semaine 245 (Saison 5, S37)
- **Trésorerie**: 2 706€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Zenith Motors Oil (6 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Theo Muller — sans catégorie [SANS BAQUET], note 34.9, 16 ans

### Semaine 250 (Saison 5, S42)
- **Trésorerie**: 3 691€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Zenith Motors Oil (1 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Theo Muller — sans catégorie [SANS BAQUET], note 34.9, 16 ans
- **Faits marquants**:
  - S5W40: Dilemme "Méforme" -> option 2/2 -> Tu laisses passer l'orage, en espérant que ça se tasse tout seul.
  - S5W41: Dilemme "Cours de langue" -> option 2/2 -> Theo Muller se sent bridé dans sa carrière.

### Semaine 255 (Saison 5, S47)
- **Trésorerie**: 2 256€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (11 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Theo Muller — sans catégorie [SANS BAQUET], note 34.9, 16 ans
- **Faits marquants**:
  - S5W43: Sponsor signé — Titan Constructions (Bronze, 170€/sem)
  - S5W44: Dilemme "Programme d'entraînement intensif" -> option 2/2 -> Theo Muller continue sagement son programme habituel — moins spectaculaire, mais personne ne se casse rien.
  - S5W45: Dilemme "Cours de langue" -> option 2/2 -> Theo Muller se sent bridé dans sa carrière.
  - S5W46: Dilemme "Dilemme : approche d'une agence rivale" -> option 1/2 -> Un café, une vraie conversation, et Theo Muller se sent enfin écouté — reste fidèle à l'agence.

### Semaine 260 (Saison 5, S52)
- **Trésorerie**: 2 716€ · **Réputation**: 2 · **Effectif**: 1 pilote(s) · **Staff**: 0 · **Prêt actif**: oui
- **Infrastructures**: bureaux 1, entraînement 1, standing 1, recruteurs 1, réseau 1
- **Sponsor actif**: Titan Constructions (6 sem. restantes)
- **Écuries possédées**: aucune
- **Roster**: Theo Muller — sans catégorie [SANS BAQUET], note 34.9, 16 ans

## Résumé agrégé

- **Durée effective**: 260/260 semaines, aucun crash
- **Trésorerie finale**: 808€ · **minimum atteint**: -21 584€ · **semaines en négatif à la fin**: 0
- **Réputation finale**: 2
- **Effectif final**: 1 pilote(s), 0 membre(s) de staff
- **Signatures**: 2 réussies / 3 tentées (échecs: 1)
- **Approches de pilotes établis**: 0 réussies / 0 tentées
- **Baquets obtenus**: 1 (sur 8 propositions), **2e championnats**: 0, **remplacements**: 1, **transferts négociés**: 0
- **Renouvellements de contrat**: 0 réussis / 31 tentés
- **Résiliations**: 0 · **Débauchages subis**: 1
- **Courses disputées**: 24 (victoires: 4, podiums: 9, abandons: 1) · **Titres remportés**: 0
- **Traits acquis**: 0 · **Graduations d'académie manquées**: 0
- **Staff engagé**: recruiter: 2, negotiator: 1, physio: 1
- **Infrastructures améliorées**: aucune
- **Style de vie amélioré**: aucun
- **Achats boutique**: 0
- **Académies financées**: 1 · **Prospects d'académie signés**: 0
- **Sponsors signés**: 22 · **Résiliés**: 1
- **Prêts contractés**: 4
- **Licenciements d'urgence (effectif à 0)**: 4
- **Écuries rachetées** (0):
  (aucune)
- **Améliorations de développement d'écurie**: 0

### Répartition des choix de dilemmes (eventId#optionIndex)
- controversial-sponsor#1 — 9 fois
- documentary-offer#1 — 8 fois
- charity-request#1 — 5 fois
- charity-request#0 — 2 fois
- doping-request#1 — 2 fois
- light-injury-race#1 — 2 fois
- investment-tip#1 — 2 fois
- language-course#1 — 2 fois
- poach-dilemma#0 — 2 fois
- light-injury-race#0 — 1 fois
- great-performance#0 — 1 fois
- team-camp#0 — 1 fois
- psychological-issues#0 — 1 fois
- media-invitation#2 — 1 fois
- push-driver#0 — 1 fois
- investment-tip#0 — 1 fois
- bad-form#0 — 1 fois
- controversial-sponsor#0 — 1 fois
- team-camp#1 — 1 fois
- psychological-issues#1 — 1 fois
- severe-injury#1 — 1 fois
- private-crisis#1 — 1 fois
- poaching-attempt#1 — 1 fois
- tax-evasion#1 — 1 fois
- documentary-offer#0 — 1 fois
- driver-lawsuit#1 — 1 fois
- tax-evasion#0 — 1 fois
- bad-form#1 — 1 fois
- push-driver#1 — 1 fois

### Échecs d'actions les plus fréquents
- negotiateContract: budget insuffisant pour l'indemnité de renouvellement — 31 fois
- negotiateSigning: Vera Bernard juge cette offre insuffisante — elle demanderait plutôt 19 400€. — 1 fois

## Avertissements d'équilibrage relevés (14)
- **S1W2 (semaine 2)** — Trésorerie passée sous le seuil de prêt (10 000€) — prêt d'urgence contracté.
- **S2W12 (semaine 64)** — Trésorerie négative depuis 4+ semaines consécutives (min atteint: -3 638€) — signal de quasi-faillite.
- **S2W28 (semaine 80)** — Trésorerie passée sous le seuil de prêt (10 000€) — prêt d'urgence contracté.
- **S2W49 (semaine 101)** — Trésorerie négative depuis 4+ semaines consécutives (min atteint: -21 584€) — signal de quasi-faillite.
- **S3W22 (semaine 126)** — Trésorerie négative depuis 4+ semaines consécutives (min atteint: -21 584€) — signal de quasi-faillite.
- **S3W37 (semaine 141)** — Trésorerie négative depuis 4+ semaines consécutives (min atteint: -21 584€) — signal de quasi-faillite.
- **S3W51 (semaine 155)** — Trésorerie négative depuis 4+ semaines consécutives (min atteint: -21 584€) — signal de quasi-faillite.
- **S4W2 (semaine 158)** — Trésorerie passée sous le seuil de prêt (10 000€) — prêt d'urgence contracté.
- **S5W26 (semaine 234)** — Trésorerie négative depuis 4+ semaines consécutives (min atteint: -21 584€) — signal de quasi-faillite.
- **S5W28 (semaine 236)** — Trésorerie passée sous le seuil de prêt (10 000€) — prêt d'urgence contracté.
- **S6W1 (semaine 261)** — Aucune écurie rachetée en 5 saisons malgré une politique d'achat active dès que réputation+budget le permettaient — le rachat d'écurie reste hors de portée en pratique sur cet horizon.
- **S6W1 (semaine 261)** — 4 prêts contractés au total — la trésorerie a replongé de manière répétée sous le seuil critique.
- **S6W1 (semaine 261)** — 4 licenciement(s) d'urgence pour limiter la casse pendant une période sans pilote — signale un vrai risque de spirale (staff/prêt continuent de coûter sans aucun revenu de course tant que l'effectif est à 0).
- **S6W1 (semaine 261)** — Renouvellement de contrat: 0 succès sur toute la partie malgré des tentatives répétées — cf. spirale contre-offre/indemnité déjà observée sur les runs précédents.
