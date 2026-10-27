# US-28 — Tabulation, contenus cryptiques et animations

Les parcours réutilisent les actions `press` configurées par l’auditeur. Chaque
transition de focus conserve l’avant, l’après, le caractère bloqué ou visible du
focus et les critères candidats associés. Cette observation est toujours
marquée comme nécessitant une revue humaine.

Le moteur compare aussi le contexte avant/après une action. Il recense les
contenus cryptiques candidats et une éventuelle alternative textuelle, ainsi
que les boutons ou contrôles dont le libellé suggère une pause, un arrêt ou un
masquage d’un contenu animé. Ces contrôles sont des signaux d’orientation pour
le critère 13.8 : leur présence ne permet pas de conclure à la conformité.

Les captures contextuelles restent soumises aux limites existantes (étape
sensible, quota, taille et erreurs). Une capture disponible est exposée en
miniature dans l’annexe HTML du rapport et reste accessible à sa taille
complète depuis l’espace de revue.

## Limites

- Le rejeu ne simule pas une tabulation exhaustive de toute la page ; seules les
  actions `press` du parcours sont exécutées.
- La détection cryptique est heuristique et n’évalue ni la compréhension du
  contenu ni la pertinence de l’alternative.
- Les contrôles d’animation sont repérés par leur libellé et doivent être
  vérifiés humainement dans le contexte réel.
- Une observation ne crée ni statut conforme ni statut non conforme.
