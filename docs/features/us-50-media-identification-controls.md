# US-50 — Identification, contrôle et compatibilité des médias

## Périmètre

US-50 réutilise le contrat `MediaData` et l’annexe Médias. Elle rattache les
critères RGAA 4.7, 4.11, 4.12 et 4.13 à chaque média applicable :

- 4.7 pour les médias temporels ;
- 4.11 pour les médias temporels ;
- 4.12 pour les médias non temporels ;
- 4.13 pour les médias temporels et non temporels.

Les critères non applicables à un type de média restent visibles avec l’état
`not_applicable`, sans être ajoutés à la liste des critères applicables du
média.

## Preuve technique et validation humaine

Chaque entrée `MediaData.evidence[]` distingue :

- `proof` : signaux techniques observés dans le DOM, par exemple un nom
  accessible, une alternative déclarée ou l’attribut `controls` ;
- `humanChecks` : question du mapping à contrôler par l’auditeur ;
- `limits` : limites de l’observation et rappel qu’aucun verdict automatique
  n’est produit.

Les états `observed`, `missing`, `to_review` et `not_applicable` décrivent des
indices de collecte. Ils ne remplacent pas les statuts de revue humaine
(`conforme`, `non conforme`, etc.).

## Fixtures

- `us-50-media-identifiable.html` : vidéo nommée avec contrôles et canvas nommé
  avec une possibilité de focus candidate ;
- `us-50-media-unidentified.html` : vidéo et canvas sans signaux d’identification
  explicites ;
- `us-50-media-non-applicable.html` : page sans média, donc sans élément auquel
  rattacher une décision.

## Limites

La collecte ne simule pas une utilisation complète au clavier ou au pointage,
ne teste pas les contrôles d’un lecteur média, et ne vérifie pas la restitution
par une technologie d’assistance. L’auditeur doit effectuer ces validations
sur le média réel avant de décider.
