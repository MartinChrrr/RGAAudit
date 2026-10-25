# US-47 — Consultation, délais et contenus additionnels

## Périmètre couvert

Les parcours rejoués collectent des preuves candidates pour :

- **12.11** : contenu référencé par `aria-describedby`, `aria-details`,
  `popover`, `role="tooltip"` ou `data-tooltip`, avec visibilité et
  atteignabilité clavier observées ;
- **13.1** : appels `setTimeout`/`setInterval`, balises `meta` de
  rafraîchissement et candidats `role="timer"`, `data-time-limit` ou
  `data-countdown` ;
- **13.2** : appels `window.open` et liens `target="_blank"` ;
- **13.5/13.6** : contenus candidats dans `pre`, `code`, `[role="img"]`,
  `[aria-label]` ou `[title]`, avec l’alternative textuelle observée lorsqu’il
  y en a une.

Chaque preuve est attachée à l’étape de parcours et porte l’heure d’observation
de l’étape. Les preuves sont rendues dans l’interface d’exécution, l’annexe
HTML et les réponses publiques rédigées.

## Scénario reproductible

La fixture
`e2e/fixtures/test-sites/journey/us-47-consultation-evidence.html` fournit un
cas contrôlé : aide complémentaire révélée par activation, minuteur,
`window.open`, lien `target="_blank"` et émoticône avec alternative. Le test
`packages/core/journey/__tests__/journey.test.ts` rejoue ces actions et vérifie
les critères associés.

## Limites et revue humaine

Ces observations ne déterminent pas la conformité. En particulier :

- le parcours ne simule pas tous les états de survol et ne vérifie pas la
  restitution par une technologie d’assistance ;
- l’enregistrement d’un minuteur ne mesure pas sa durée effective et ne prouve
  pas qu’il est contrôlable, prolongeable ou désactivable ;
- `window.open` et `target="_blank"` signalent un candidat, mais ne permettent
  pas de conclure si l’ouverture était provoquée par une action utilisateur ;
- la détection de contenu cryptique est heuristique et ne juge pas la
  pertinence éditoriale de l’alternative.

L’auditeur doit rejouer les scénarios dans le navigateur, vérifier le clavier,
les changements de contexte et les technologies d’assistance, puis enregistrer
la décision humaine correspondante.
