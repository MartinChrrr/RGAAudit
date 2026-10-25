# RGAAudit — Fonctionnalités

Ce document décrit les fonctionnalités réellement disponibles dans RGAAudit et
leur niveau de maturité. Il complète le [manuel utilisateur](USER_MANUAL.md).

## Positionnement

RGAAudit est une application locale d’aide à l’audit d’accessibilité web selon
le RGAA 4.1.2. Elle rassemble des signaux automatiques, des preuves et des
décisions humaines. Elle ne déclare jamais à elle seule la conformité d’un
site.

## Fonctionnalités disponibles

| Fonctionnalité | Ce qu’elle apporte | État |
|---|---|---|
| Découverte par sitemap | Recherche `sitemap.xml` et `sitemap_index.xml`, filtrage du domaine et normalisation des URL | Disponible |
| Sélection des pages | Sélection globale, désélection, ajout manuel, limite configurable de 50 pages | Disponible |
| Analyse automatique | Playwright + axe-core, collecteurs dédiés et heuristiques | Disponible |
| Mapping RGAA | Relie les résultats aux 106 critères RGAA 4.1.2 et aux règles WCAG disponibles | Disponible |
| Preuves | Conserve les éléments concernés, leur contexte, les identifiants de résultat et les horodatages | Disponible |
| Revue humaine | Décisions `non testé`, `conforme`, `non conforme` et `non applicable`, avec commentaire et historique | Disponible |
| Annexes | Images, médias, tableaux, cadres, liens, titres, formulaires, heuristiques et contenus spécialisés | Disponible |
| Relations de formulaires | Inventorie les libellés, leur accolement, les regroupements `fieldset`/`legend`, les `optgroup` et les intitulés de boutons pour les critères RGAA 11.2, 11.4, 11.5, 11.7, 11.8 et 11.9 | Disponible avec limites documentées |
| Validation et soumission contrôlées | Signale les contraintes, états invalides, aides/messages associés et contrôles de soumission des formulaires pour les critères RGAA 11.3, 11.10, 11.11 et 11.12, sans exécuter de soumission | Disponible avec limites documentées |
| Changements de contexte et divulgations | Les parcours rejoués consignent les navigations, changements de titre, dialogues, régions live et divulgations `aria-expanded`/`details` pour les critères RGAA 7.4, 7.5 et 10.13 | Disponible avec limites documentées |
| Consultation, délais et contenus additionnels | Les parcours consignent des candidats de contenu additionnel, minuteurs/rafraîchissements, ouvertures de fenêtre et contenus cryptiques pour les critères RGAA 12.11, 13.1, 13.2 et 13.6 | Disponible avec limites documentées |
| Comparaison | Compare des observations appartenant au même groupe de comparaison | Disponible |
| Rapport HTML | Rapport local avec couverture, limites, critères, preuves et annexes | Disponible |
| Rapport PDF | Export du rapport avec avertissement sur les limites de l’accessibilité PDF | Disponible |
| Repères visuels candidats | Inventaire des indices DOM/CSS de couleur, forme, taille et position pour la revue humaine des critères 3.1, 10.9 et 10.10 | Disponible avec limites documentées |
| Pertinence des alternatives d’image | Signal de revue pour les alternatives non vides du critère 1.3, avec distinction des cas absents/vides | Partiel — synchronisation de la décision 1.3 à décider |
| Tableaux complexes et de mise en forme | Candidats de tableaux, signaux de complexité, titre/résumé, lecture linéarisée et preuves des associations d’en-têtes pour les critères 5.1, 5.2, 5.3, 5.5 et 5.7 | Disponible avec limites documentées |
| Visibilité du focus et responsive | Observations candidates par état de présentation et viewport pour le critère 10.7, avec annexe filtrable et vérification humaine au clavier | Disponible avec limites documentées |
| Scénarios contrôlés d’interaction | Observations de focus, flash, pointer/touch et APIs de mouvement rattachées aux parcours pour revue humaine | Disponible avec limites documentées |
| Progression d’audit | Suivi temps réel d’une session et reprise depuis les fichiers persistés | Disponible |
| Parcours interactifs | Création, édition, rejeu, captures contextuelles, preuves et décisions par exécution | En cours de finalisation (US-23) |
| Annexe de parcours dans le rapport | Rattachement à une session et annexe versionnée HTML/PDF | En cours de finalisation (US-23) |

## Garanties et limites

- Les données sont conservées localement dans le répertoire RGAAudit configuré.
- Les URL et les textes exposés dans les rapports et API publiques sont
  rédigés pour éviter de divulguer des paramètres de requête.
- Les URL complètes nécessaires au rejeu sont conservées dans l’éditeur privé
  du parcours, conformément à la décision produit prise pour US-23.
- Une décision humaine est toujours distincte d’un signal axe-core ou d’une
  heuristique.
- Le registre contient 106 critères, mais la couverture fonctionnelle actuelle
  reste partielle. Les critères non couverts apparaissent comme nécessitant une
  revue humaine ou un lot ultérieur.

## Architecture fonctionnelle

```text
URL / sitemap
      ↓
Sélection des pages
      ↓
Session d’audit persistée
      ↓
Analyse axe-core + collecteurs + heuristiques
      ↓
Mapping RGAA / preuves
      ↓
Revue humaine dans les annexes
      ↓
Rapport HTML / PDF
```

Un parcours interactif suit un flux séparé mais convergera vers le même rapport
versionné :

```text
Définition du parcours → rejeu → preuves horodatées → décisions humaines
                                     ↓
                              annexe de session
```

## Développement et vérification

Les commandes usuelles sont documentées dans le [README](README.md). Toute
nouvelle fonctionnalité doit être accompagnée de tests unitaires,
d’intégration ou de composant adaptés à son package.
