# Revue manuelle — US-28

Date : 2026-11-05  
Environnement : application locale Vite (`http://localhost:3002/`) et API
locale (`http://127.0.0.1:3001`) avec accès explicite aux fixtures locales  
Navigateur : Chrome intégré via navigateur Codex  
Type : revue fonctionnelle en lecture seule côté application

## Scénario

Fixture :
`http://127.0.0.1:4173/journey/us-28-tab-animation-cryptic.html`

Un parcours a été créé depuis le constructeur avec une étape `press` sur
`#next`, touche `Enter`, puis rejoué.

## Résultat observé

L’exécution `90de7b9a-e270-48c2-9b2c-1fbe5576ab51` est affichée avec le statut
**Terminée** et contient une capture contextuelle. L’interface expose :

- une observation du focus clavier, avec indicateur visible et revue humaine
  requise ;
- le contenu cryptique `⚠️ !!` et l’alternative observée `Icône d’information` ;
- les critères associés 13.5, 13.6, 7.2, 7.3 et 13.8 ;
- un contrôle d’animation candidat `#pause — Mettre en pause`, dont la
  suffisance reste à confirmer humainement ;
- les événements clavier observés sur `#next` et la nécessité de vérifier le
  contrôle du script au clavier et au pointage.

## Limites

Les signaux sont des preuves candidates. La collecte ne décide ni de la
conformité du parcours clavier, ni de la suffisance du contrôle d’animation, ni
de la pertinence de l’alternative du contenu cryptique. Aucune décision humaine
n’a été enregistrée et aucune issue GitHub n’a été déplacée durant cette revue.
