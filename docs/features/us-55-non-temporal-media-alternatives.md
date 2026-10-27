# US-55 — Alternatives des médias non temporels

## Périmètre

US-55 étend le contrat `MediaData`, l’annexe **Médias** et le rapport HTML aux
critères RGAA 4.8 et 4.9 pour les éléments `canvas`, `object` et `embed`.
Les éléments audio et vidéo conservent ces critères avec l’état
`not_applicable`.

## Preuves et états

- `observed` : un contenu de secours textuel candidat est présent dans le DOM ;
- `missing` : aucun contenu de secours textuel candidat n’a été observé pour la
  présence attendue par 4.8 ;
- `to_review` : l’existence ou la pertinence de l’alternative doit être vérifiée
  par un auditeur, notamment pour 4.9 ;
- `not_applicable` : le média est temporel pour ces deux critères.

Ces états décrivent des signaux de collecte et ne sont jamais des verdicts de
conformité. La collecte ne détermine ni la nécessité d’une alternative, ni la
pertinence de son contenu.

## Fixtures

- `us-55-media-non-temporal-candidates.html` : canvas et object avec un contenu
  de secours candidat ;
- `us-55-media-non-temporal-missing.html` : canvas et embed sans contenu de
  secours candidat ;
- `us-55-media-non-applicable.html` : vidéo, hors périmètre 4.8/4.9.

## Limites

Les alternatives déclarées uniquement par une relation externe, une image, un
fichier distant ou le contexte éditorial ne sont pas jugées automatiquement.
L’auditeur doit consulter le média réel, décider si une alternative est requise
et vérifier qu’elle restitue l’information utile.
