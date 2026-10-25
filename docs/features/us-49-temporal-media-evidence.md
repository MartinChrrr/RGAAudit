# US-49 — Preuves candidates des médias temporels

## Périmètre

Cette fonctionnalité étend le contrat `MediaData` déjà utilisé par la collecte,
l’API, l’annexe web et le rapport HTML. Elle couvre les critères RGAA 4.1 à 4.6
pour les éléments `audio` et `video`, avec les signaux observables liés aux
transcriptions textuelles, sous-titres/captions et audiodescriptions.

Les éléments `canvas`, `object` et `embed` reçoivent un état `not_applicable`
pour cette série de critères temporels ; leurs critères existants 4.8 et 4.9
restent inchangés.

## Contrat de preuve

Chaque média collecté peut exposer `evidence[]`. Une entrée contient :

- `criterionId` : un identifiant de 4.1 à 4.6 ;
- `state` : `observed`, `missing`, `to_review` ou `not_applicable` ;
- `proof` : signaux DOM observés, sans conclure à la conformité ;
- `limits` : limites explicites et rappel de la revue humaine.

`observed` signifie qu’un signal candidat existe. `missing` signifie qu’aucun
signal candidat attendu par la sonde n’a été observé. Ces états ne sont pas les
statuts de revue humaine et ne produisent aucun verdict automatique.

Les URL contenues dans les preuves et limites sont rédigées par l’API publique
et les rapports de la même manière que les autres données média.

## Fixtures de vérification

- `us-49-media-with-tracks.html` : vidéo avec sous-titres, audiodescription et
  contenu de secours candidat ;
- `us-49-media-without-tracks.html` : vidéo sans piste candidate, utilisée pour
  vérifier la distinction entre absence de signal et non-conformité ;
- `us-49-media-non-applicable.html` : canvas, hors périmètre des médias
  temporels 4.1–4.6.

## Limites connues

La collecte ne lit pas le contenu des fichiers VTT, ne mesure pas la
synchronisation, ne vérifie pas la fidélité ou la pertinence des textes, et ne
détermine pas si une alternative est nécessaire dans le contexte éditorial.
L’auditeur doit donc consulter le média et enregistrer une décision humaine.
