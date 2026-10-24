# US-31 — Scénarios contrôlés pour clavier, flash et gestes

Les parcours d’audit conservent désormais des observations manuelles pour les
critères RGAA 12.9, 13.7 et 13.10 à 13.12 :

- les cycles probables de focus existants restent rattachés au critère 12.9 ;
- les animations nommées comme flash/blink/flicker/strobe et les transitions de
  couleur, opacité ou filtre sont signalées comme candidates pour 13.7 ;
- les séquences pointer/touch sont journalisées sans valeur métier : un
  `pointerdown`/`up` produit un scénario point unique, un mouvement produit un
  scénario de geste complexe ;
- les inscriptions ou événements `DeviceMotion`/`DeviceOrientation` produisent
  un scénario à tester pour 13.12.

Les observations sont conservées dans le contexte de chaque étape du parcours,
avec les critères associés et `requiresHumanReview: true`. Elles apparaissent
dans l’annexe des parcours du rapport.

## Limites et sécurité

La sonde n’exécute aucun geste ou mouvement supplémentaire et ne déclenche pas
de fonctionnalité authentifiée. Elle observe uniquement les événements générés
par l’étape de parcours déjà demandée. Les candidats ne mesurent ni fréquence,
luminance, annulation effective, complexité réelle ni équivalence d’un geste
simple. Un auditeur doit confirmer ces points dans un environnement contrôlé,
avec un appareil compatible pour les critères de mouvement.

Les sélecteurs d’événements sans identifiant peuvent rester génériques (par
exemple `button`) et plusieurs contrôles peuvent alors partager la même preuve.
Les événements perdus lors d’une navigation, les capteurs déclarés dans une
iframe ou via une propriété `ondevicemotion`, ainsi que le bruit ou les doublons
des événements pointer/touch restent des limites connues de cette observation.
