# US-42 — Tableaux complexes et tableaux de mise en forme

Le collecteur structurel réutilise `StructureTableData` pour produire des
preuves candidates sur les tableaux : type probable (données, mise en forme ou
indéterminé), fusions de cellules, plusieurs lignes d’en-têtes, attributs
`headers`, `caption`, `summary` et texte linéarisé.

Ces signaux alimentent les critères RGAA 5.1, 5.2, 5.3, 5.5 et 5.7 :

- un tableau complexe candidat est associé à la vérification de la présence et
  de la pertinence d’un résumé ;
- un tableau de mise en forme candidat expose son contenu linéarisé pour une
  revue de compréhension ;
- un `caption` sur un tableau de données candidat est une preuve de titre dont
  la pertinence reste à juger ;
- les attributs `scope`, `headers` et les cellules d’en-tête sont conservés
  comme preuves pour la revue de l’association des cellules.

Le collecteur ne conclut ni sur la nature réelle du tableau, ni sur la
pertinence d’un résumé ou d’un titre, ni sur la compréhension du contenu
linéarisé. Les critères restent `MANUAL_ONLY`, et les situations sans
caractéristique de données sont marquées comme candidates ou indéterminées,
jamais conformes automatiquement.

La fixture `e2e/fixtures/test-sites/tables/us-42-complex-and-layout.html`
couvre un tableau de données avec `caption`, `summary`, cellules fusionnées,
plusieurs en-têtes et `headers`, un tableau de données complexe sans résumé ni
titre, ainsi qu’un tableau de présentation sans caractéristique de données.
Elle n’exécute aucune action authentifiée ou irréversible.
