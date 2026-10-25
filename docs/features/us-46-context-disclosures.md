# US-46 — Changements de contexte, divulgations et retours d’information

## Périmètre

Les exécutions de parcours comparent les signaux DOM avant et après chaque
étape. Elles conservent les changements de navigation, de titre, de dialogue,
de région live et de perturbation déjà observés, et ajoutent les états
`aria-expanded` et `details` lorsqu’ils changent. Pour un contrôle
`aria-controls`, la visibilité observée du panneau référencé est incluse dans
la preuve.

Les observations sont associées aux critères RGAA 7.4, 7.5 et 10.13 dans la
revue du parcours et dans l’annexe HTML. Elles restent des preuves candidates
et nécessitent une vérification humaine.

## Limites

La collecte ne détermine pas si l’utilisateur a été averti, si une région live
est correctement restituée par une technologie d’assistance ou si la
divulgation est contrôlable au clavier. Les changements de style ou les
composants non exposés par `aria-expanded`/`details` ne sont pas conclus à partir
de ce signal. La fixture
`e2e/fixtures/test-sites/journey/us-46-context-disclosures.html` couvre une
divulgation `aria-expanded` et un retour de statut `aria-live` sans action
externe.
