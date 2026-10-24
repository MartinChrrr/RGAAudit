# US-29 — Systèmes de navigation entre pages

RGAAudit inventorie, pour chaque page auditée, les mécanismes candidats utiles
à la revue des critères RGAA 12.1 à 12.5 :

- zones `nav` ou `[role="navigation"]` ;
- formulaires de recherche (`role="search"` et champs `type="search"`) ;
- liens dont le libellé correspond aux candidats configurés du registre RGAA
  (`plan du site`, `sitemap`, `site map`) ;
- libellé, sélecteur, destination, ordre DOM et position géométrique observée.

Les observations sont reliées aux critères 12.1 à 12.5 et sont affichées dans
l’annexe « Systèmes de navigation ». Lorsqu’un groupe de comparaison est fourni
à l’audit, les observations de navigation sont aussi comparées entre pages :
ajouts, suppressions et changements de position ou de libellé sont signalés.

## Limites

Un système candidat ne prouve pas qu’il constitue une navigation pertinente,
qu’il est accessible au clavier ou qu’il est atteint de manière identique sur
toutes les pages. L’auditeur doit confirmer l’existence de deux systèmes, la
pertinence et la couverture du plan du site, ainsi que l’identité d’accès au
moteur de recherche. Une comparaison n’est produite que pour les pages placées
dans le même groupe de comparaison explicite.
