# Revue manuelle — US-23

Date : 2026-11-05  
Environnement : application locale Vite (`http://localhost:3002/`) et API
locale (`http://127.0.0.1:3001`) avec une fixture locale  
Navigateur : Chrome intégré via navigateur Codex  
Type : revue fonctionnelle en lecture seule côté application, hors saisie
locale d’une décision de démonstration

## Scénario

Un parcours a été créé dans l’interface avec une étape `click` sur `#next`
et la fixture :

`http://127.0.0.1:4173/journey/us-28-tab-animation-cryptic.html`

Le parcours a ensuite été rejoué une première fois sans session, puis une
seconde fois en le rattachant à la session d’audit
`2cd2cb9f-8b17-42b2-9dcc-3a637f89d76f`.

## Résultat observé

L’exécution rattachée
`b67821e7-d34d-4ace-a3c9-2bb3a642cc31` est affichée comme **Terminée** et
contient :

- une observation horodatée pour `step-1` ;
- une preuve textuelle liée aux critères **6.1**, **8.7** et **11.9** ;
- une capture visuelle et des signaux de contexte, tous présentés comme
  nécessitant une revue humaine ;
- les contrôles de décision humaine par critère dans l’écran d’exécution.

Une décision locale de démonstration a été enregistrée sur le critère 6.1
(statut **Conforme**, commentaire « Décision de revue manuelle US-23 liée à la
session »). Après retour dans Results, l’**Annexe — Parcours d’audit** affiche
la même exécution avec **1 preuve** et **1 décision**.

## Conclusion

Les parcours peuvent être créés, rejoués, rattachés à une session, relus dans
l’interface et exposés dans l’annexe du rapport avec la décision humaine
persistée. Les tests automatisés ciblés passent : 35 tests cœur et 45 tests
serveur.

## Limites

La décision saisie est une donnée de test locale et ne constitue pas un
verdict de conformité du projet. Les observations automatiques restent des
preuves candidates ; l’auditeur humain conserve la décision finale. Aucun
issue GitHub ni statut de Project n’a été modifié pendant cette revue.
