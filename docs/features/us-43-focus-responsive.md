# US-43 — Visibilité du focus et responsive

Cette feature étend les observations de présentation au critère RGAA 10.7.

## Observations

Pour chaque état sondé (`baseline`, `viewport-320x256`, `zoom-200-probe` et état sans feuille de style), RGAAudit inventorie les éléments interactifs visibles et tente de leur donner le focus sans défilement. L’observation conserve le sélecteur, le type, le texte court et l’indication calculée d’un contour ou d’une ombre de focus.

Les observations sont des preuves candidates. Un indicateur détecté ne constitue pas une conformité et son absence ne constitue pas à elle seule une non-conformité : la validation au clavier et avec les réglages de zoom du navigateur reste humaine.

Les éléments masqués visuellement ou sémantiquement (`hidden`, `aria-hidden` ou `inert`) sont exclus de cette sonde de visibilité. Les états non observables sont conservés avec leur statut explicite, sans valeur de remplacement.

La mise au focus programmée est un inventaire technique : elle ne reproduit pas une séquence réelle avec la touche Tab, la modalité clavier de `:focus-visible`, les pièges de focus ou les comportements d’assistance. L’auditeur doit donc refaire le parcours au clavier dans chaque état et viewport avant de conclure.

## Restitution

- le mapping expose les observations par état et sélecteur pour le critère 10.7 ;
- l’annexe HTML et l’onglet web « Présentation et focus » affichent le viewport, le débordement et les observations de focus ;
- la revue humaine est explicitement demandée pour chaque état.

## Fixtures

- `e2e/fixtures/test-sites/presentation/us-43-focus-visible.html` : variantes avec indicateur visible et indicateur neutralisé ;
- `us-43-focus-conform.html` : indicateur candidat visible ;
- `us-43-focus-non-conform.html` : indicateur neutralisé, à confirmer au clavier ;
- `us-43-focus-non-applicable.html` : aucun élément interactif observé, à confirmer comme non applicable par l’auditeur.
