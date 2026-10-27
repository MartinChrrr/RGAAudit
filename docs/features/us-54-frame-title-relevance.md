# US-54 — Pertinence des titres de cadres

## Périmètre

US-54 complète l’inventaire `FrameData` et l’annexe **Cadres** pour le critère
RGAA 2.2. Un titre non vide est conservé comme preuve candidate ; sa pertinence
reste une décision humaine.

## Preuves et états

- `to_review` : un titre existe et doit être comparé au contenu et à la fonction
  de la frame ;
- `to_review` : le cadre doit être vérifié par un humain, qu’un titre soit
  présent ou non. L’absence de titre est rappelée comme preuve et reste aussi
  traitée par le critère 2.1.

Chaque preuve expose séparément le titre observé, les limites et le contrôle
humain issu du mapping officiel. Aucun verdict de conformité n’est produit.

## Sorties et limites

La preuve est disponible dans l’annexe web, le rapport HTML et la réponse API.
Les URL et textes sont rédigés côté API. La collecte ne lit pas le contenu
interne d’une frame pour juger la pertinence du titre ; l’absence de titre reste
traitée par le critère 2.1.

## Tests

Les tests couvrent les titres présents, absents ou vides, l’affichage de la
preuve dans l’annexe et le rapport, la rédaction API et l’échappement des
contenus dynamiques.
