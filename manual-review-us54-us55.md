# Revue manuelle — US-54 et US-55

Date : 2026-11-05  
Environnement : application locale Vite (`http://localhost:3002/`) et API
locale (`http://127.0.0.1:3001`) avec accès explicite aux fixtures locales  
Navigateur : Chrome intégré via navigateur Codex  
Type : revue fonctionnelle en lecture seule côté application

## Résumé

Les deux tâches sont **PASS partiel** sur les flux visibles dans Results. Les
preuves sont affichées dans les annexes attendues et les contrôles humains sont
explicitement rappelés. Aucun verdict RGAA n’a été enregistré.

## M-54 — Pertinence du titre d’une frame

Fixture auditée :
`http://127.0.0.1:4173/frames/with-title.html`

Étapes : sélection manuelle de la fixture, lancement d’un audit sans contraste,
ouverture de Results, puis activation de l’onglet **Cadres**.

Résultat observé :

- l’annexe affiche `iframe#help-frame` ;
- le titre collecté `Aide à la saisie` est visible ;
- la ligne expose **Pertinence du titre — critère 2.2** ;
- la preuve est présentée comme une revue humaine, sans conformité déduite.

Limite : le scénario vérifie l’exposition de la preuve et du contrôle, pas la
pertinence éditoriale réelle du titre par rapport au contenu interne de la frame.

## M-55 — Alternatives des médias non temporels

Fixture auditée :
`http://127.0.0.1:4173/media/us-55-media-non-temporal-candidates.html`

Étapes : sélection manuelle de la fixture, lancement d’un audit sans contraste,
ouverture de Results, puis activation de l’onglet **Médias**.

Résultat observé :

- la ligne `canvas#chart` est visible dans l’annexe ;
- les critères **4.8** et **4.9** sont affichés ;
- la preuve `contenu de secours textuel candidat observé` est conservée ;
- les contrôles humains officiels sont affichés pour la présence et la
  pertinence de l’alternative ;
- les signaux restent associés à **Revue humaine requise**.

Limite : la fixture confirme un candidat d’alternative. Elle ne permet pas de
décider si l’alternative est nécessaire ni si son contenu restitue réellement
l’information utile.

## Conclusion

Les critères 2.2, 4.8 et 4.9 sont correctement exposés comme preuves candidates
dans l’interface. Cette revue ne justifie pas le déplacement automatique des
issues ou cartes GitHub vers **Done** : la clôture doit tenir compte des tests de
régression et de la synchronisation du Project, et les décisions de conformité
restent du ressort de l’auditeur humain.
