# US-27 — États de présentation et responsive

RGAAudit collecte des preuves reproductibles pour les contrôles de présentation
du lot 2 (RGAA 10.2, 10.3, 10.4, 10.11 et, pour le protocole manuel, 10.14) :

- un état initial avec dimensions du viewport, ratio de pixels, échelle du
  `VisualViewport`, dimensions du document et inventaire textuel compact ;
- un état temporaire avec les feuilles de styles désactivées ;
- un état temporaire à `320 × 256` pixels ;
- une sonde temporaire à `200 %` via CSS `zoom`.

Les modifications temporaires sont restaurées avant la fin de la collecte. Les
états sont enregistrés dans `CollectedData.presentation` et leurs flags sont
reliés aux critères du registre RGAA runtime. Un débordement horizontal est un
signal à analyser, jamais une non-conformité automatique.

## Limites connues

La sonde CSS `zoom` ne remplace pas le zoom texte du navigateur : l’auditeur
doit confirmer le critère 10.4 à 200 %. La comparaison sans CSS expose des
métriques DOM mais ne juge ni la compréhension ni la pertinence du contenu.
Les contenus additionnels `:hover`/`:focus`, les interactions au clavier et au
pointeur, ainsi que la décision finale pour 10.2, 10.3, 10.4, 10.11 et 10.14
restent manuels.
