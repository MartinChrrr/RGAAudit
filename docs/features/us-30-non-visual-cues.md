# US-30 — Informations indépendantes de la perception visuelle

RGAAudit collecte des indices DOM/CSS pour la revue humaine des critères
RGAA 3.1, 10.9 et 10.10 :

- propriétés CSS explicites portant sur la couleur, la forme, la taille ou la
  position ;
- valeur calculée observée, dimensions du rendu et position CSS ;
- texte présent et nom accessible (`aria-label`, `aria-labelledby` ou `title`)
  lorsqu’ils sont observables.

Ces éléments sont exposés dans l’annexe « Présentation et responsive » et sont
rattachés aux critères concernés comme preuves manuelles. Ils servent à guider
la vérification du contenu et ne produisent jamais de verdict automatique.

## Limites

La collecte cible les déclarations présentes dans l’attribut `style`. Elle ne
peut pas décider si une couleur, une forme, une taille ou une position porte
réellement une information, ni si une formulation constitue une alternative
compréhensible. Les règles CSS externes, les états interactifs et la pertinence
éditoriale restent à examiner pendant la revue humaine.
