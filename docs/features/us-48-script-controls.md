# US-48 — Alternatives et contrôles des scripts

## Périmètre couvert

Le moteur de parcours existant partage son instrumentation d’événements avec
les observations des scripts :

- les éléments `script` exécutables sont inventoriés avec une alternative
  `noscript` adjacente lorsqu’elle est présente, comme preuve candidate du
  critère RGAA **7.2** ;
- les événements `pointerdown`, `pointerup`, `touchstart`, `touchend`,
  `keydown` et `keyup` sont regroupés par sélecteur sur les contrôles observés,
  comme preuve candidate du critère RGAA **7.3**.

Les preuves sont ajoutées à l’observation de contexte de l’étape, puis rendues
par l’interface de parcours, l’annexe HTML et l’API publique rédigée. Aucun
probe parallèle n’est créé : les événements réutilisent
`installInteractionProbe`, déjà utilisé pour les interactions contrôlées.

## Scénario reproductible

La fixture
`e2e/fixtures/test-sites/journey/us-48-script-controls.html` contient un
contrôle `div` scripté, opérable par clic et par `Enter`, ainsi qu’une
alternative `noscript`. Le test de parcours vérifie que les preuves de
pointage, clavier et alternative sont attachées aux étapes correspondantes.

## Limites et revue humaine

Une alternative `noscript` adjacente n’est pas nécessairement l’alternative
pertinente du script. De même, la présence d’événements ne prouve pas que la
fonctionnalité complète est utilisable par tous les claviers, dispositifs de
pointage ou technologies d’assistance. Les scripts externes, les gestionnaires
ajoutés indirectement et les comportements dépendant du contexte peuvent ne
pas être identifiés par cet inventaire.

L’auditeur doit désactiver JavaScript, comparer l’alternative à la fonction
réelle, puis rejouer le contrôle au clavier et au pointage avant d’enregistrer
la décision humaine RGAA.
