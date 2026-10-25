# US-51 — Images spécialisées et descriptions candidates

## Périmètre

US-51 réutilise `ImageData`, l’annexe Images et les décisions humaines déjà
persistées. Elle ajoute les preuves candidates pour les critères RGAA 1.4 à
1.8 : CAPTCHA/image-test, solution d’accès alternative, description détaillée
et image contenant du texte.

## Contrat de preuve

Chaque image peut exposer `evidence[]`. Une entrée indique :

- `criterionId` : 1.4, 1.5, 1.6, 1.7 ou 1.8 ;
- `state` : `observed`, `missing`, `to_review` ou `not_applicable` ;
- `proof` : signal technique observé (attribut, contexte, description référencée) ;
- `humanChecks` : question issue du mapping à vérifier manuellement ;
- `limits` : limites de la détection.

La détection CAPTCHA s’appuie sur des indices textuels ou d’URL (`captcha`,
`recaptcha`, `hcaptcha`, `challenge`, `image-test`). Elle ne détermine pas la
nature réelle de l’image. `aria-describedby` résolu et `longdesc` sont conservés
comme candidats de description détaillée, sans juger leur pertinence.

## Fixtures

- `us-51-images-candidates.html` : CAPTCHA avec alternative candidate,
  description référencée et image-texte à vérifier ;
- `us-51-images-missing.html` : CAPTCHA sans alternative et image sans
  description détaillée ;
- `us-51-images-non-applicable.html` : image ordinaire, non applicable aux
  critères CAPTCHA en l’absence d’indice détecté.

## Limites

La collecte ne vérifie ni la pertinence de l’alternative, ni l’accessibilité
réelle de la solution CAPTCHA, ni la qualité d’une description détaillée, ni la
présence effective de texte dans les pixels. Toute décision reste humaine.
