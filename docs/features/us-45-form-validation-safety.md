# US-45 — Validation et soumissions sensibles des formulaires

## Périmètre

Cette story ajoute des preuves candidates pour les critères RGAA 11.3, 11.10,
11.11 et 11.12, à partir de `FormDataItem` et `collectForms`.

- 11.3 signale une différence de libellé lorsque des contrôles partagent un
  même `name` ou une même valeur `autocomplete` observable.
- 11.10 inventorie les contraintes natives et les états invalides observés.
- 11.11 relie les aides et messages d’erreur référencés présents au contrôle ; leur
  suffisance et leur pertinence restent à vérifier.
- 11.12 signale les formulaires disposant d’un contrôle de soumission. La
  collecte marque explicitement la soumission comme non exécutée.

## Limites et sécurité

Ces signaux ne produisent aucun verdict RGAA. Les contrôles nécessitent une
validation humaine, notamment pour la fonction réelle du champ, la pertinence
des messages et le caractère sensible d’une soumission.

La collecte statique ne clique jamais sur un bouton de soumission. Un parcours
de validation doit être local, explicitement configuré et non authentifié ; la
fixture `e2e/fixtures/test-sites/forms/us-45-validation-safety.html` sert
uniquement à vérifier les observations et n’est pas une cible de soumission.

## Preuves visibles

Les éléments et flags sont associés aux critères dans le mapping, puis affichés
dans l’annexe formulaires du rapport HTML et de l’interface web. Les rapports
publics continuent de rédiger les URLs et textes selon la politique existante.
