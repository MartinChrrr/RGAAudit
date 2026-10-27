# US-52 — Documents bureautiques et versions accessibles

## Périmètre

US-52 réutilise l’annexe **Contenus spécialisés** pour les critères RGAA 13.3
et 13.4. Les candidats sont les liens et ressources `object`/`embed` dont
l’extension correspond à un format bureautique ou PDF.

## Preuves locales

Pour chaque document candidat, le collecteur conserve, lorsqu’ils sont déclarés
dans le DOM :

- le type MIME (`type`) ;
- la taille (`data-size-bytes` ou `data-size`) ;
- l’attribut `download` ;
- l’extension de la source ;
- les preuves et limites associées aux critères 13.3 et 13.4.

L’état reste `to_review`, avec une validation humaine explicite issue du
mapping officiel. Aucun signal partiel ne produit de verdict de conformité ou
de non-conformité.

## Sécurité et limites

La collecte n’effectue aucune requête de téléchargement et n’exécute jamais le
contenu distant. Elle ne peut donc pas confirmer le MIME ou la taille HTTP
réels, ni analyser le document localement sans action humaine ou outil dédié.
La personne qui audite doit télécharger le fichier avec les précautions de son
environnement, vérifier la présence et la pertinence de la version accessible,
puis comparer l’information fournie. L’attribut `download` est seulement un
signal DOM ; son absence ne prouve pas l’absence de téléchargement.

## Fixtures et tests

- `e2e/fixtures/test-sites/documents/us-52-documents-candidates.html` : liens
  avec MIME, taille et `download` déclarés ;
- `e2e/fixtures/test-sites/documents/us-52-documents-missing.html` : document
  sans métadonnées locales ;
- `e2e/fixtures/test-sites/documents/us-52-documents-non-applicable.html` :
  page sans document bureautique candidat.

Les tests vérifient la collecte des signaux, l’absence de verdict automatique,
le rendu HTML et de l’annexe web ainsi que la rédaction des preuves dans l’API.
