# RGAAudit — Manuel utilisateur

## 1. Démarrer une analyse

1. Ouvrir l’interface locale RGAAudit.
2. Saisir l’URL publique du site à analyser (`https://` ou `http://`).
3. Cliquer sur **Analyser**.
4. Si aucun sitemap n’est trouvé, choisir **Continuer sans sitemap** ou saisir
   les pages manuellement.

RGAAudit ne modifie jamais le site audité. Les pages sont chargées pour
observation et analyse.

## 2. Choisir les pages

Dans l’écran de sélection :

- utiliser **Tout sélectionner** ou **Tout désélectionner** ;
- ajouter une page avec le champ d’URL manuel ;
- ne garder que les pages utiles à l’audit ;
- associer plusieurs pages à un même **groupe de comparaison** si leur état
  doit être comparé ;
- laisser l’option de contraste active, sauf besoin explicite de réduire le
  périmètre.

La limite actuelle est de 50 pages par audit. Cliquer sur **Démarrer l’audit**
pour créer une session.

## 3. Suivre l’analyse

L’écran de progression affiche les pages terminées, en attente ou en erreur.
La session est écrite progressivement : une interruption ne transforme pas les
résultats déjà enregistrés en résultats conformes.

Lorsque l’analyse est terminée, ouvrir les résultats.

## 4. Lire les résultats

Le rapport présente :

- le rappel des limites de l’automatisation ;
- le nombre total de critères observés ;
- les violations, passes et critères nécessitant une revue humaine ;
- la couverture RGAA ;
- les principaux problèmes et les pages concernées ;
- les comparaisons entre observations ;
- les annexes détaillées.

Un signal automatique n’est pas une décision de conformité. La présence d’un
pass axe-core ne dispense pas d’une vérification humaine lorsque le critère est
partiellement couvert ou manuel.

## 5. Faire la revue humaine

Les annexes permettent de retrouver les éléments observés : images, liens,
titres, cadres, formulaires, médias, contenus spécialisés et heuristiques.

Pour chaque élément ou critère concerné :

1. consulter la preuve et son contexte ;
2. choisir `non testé`, `conforme`, `non conforme` ou `non applicable` ;
3. ajouter un commentaire si le contexte le justifie ;
4. enregistrer la décision.

Les décisions remplacées restent accessibles dans l’historique. Une décision
humaine reste séparée du signal automatique qui l’a motivée.

## 6. Comparer des observations

Quand un groupe de comparaison est renseigné à la sélection des pages, le
rapport rapproche les observations successives du groupe et indique les
éléments ajoutés, supprimés ou modifiés. Une comparaison indisponible doit être
interprétée comme une limite de preuve, pas comme une absence de changement.

## 7. Exporter

- **Rapport HTML** : à consulter dans le navigateur, y compris hors ligne une
  fois généré.
- **Rapport PDF** : à télécharger depuis l’écran des résultats.

Les exports rédigent les paramètres de requête des URL. Ils utilisent des
identifiants de page pour permettre le rapprochement des preuves sans exposer
de valeurs sensibles.

## 8. Parcours interactifs (US-23)

La fonctionnalité est en cours de finalisation. Elle permet de définir des
étapes `navigate`, `click`, `fill`, `press` et `wait`, puis de rejouer le
parcours. Les preuves sont horodatées et peuvent recevoir une décision humaine.

Les valeurs de champs marquées sensibles ne sont pas exposées dans les
réponses publiques. Les URL complètes restent disponibles dans l’éditeur privé
pour que le rejeu conserve son comportement ; elles sont rédigées dans les
preuves, rapports et exports.

Une annexe versionnée du parcours sera rattachée à la session d’audit lorsque
la story US-23 sera terminée.

## 9. Interpréter les limites

RGAAudit aide à organiser un audit ; il ne remplace pas l’auditeur. Les points
suivants nécessitent fréquemment une intervention humaine :

- pertinence d’un intitulé, d’une alternative ou d’un titre ;
- changements de langue et de sens de lecture ;
- cohérence éditoriale et structure du document ;
- compréhension des erreurs, aides et changements de contexte ;
- comportement avec les technologies d’assistance.

Toujours conserver le contexte de la page, la preuve consultée et la décision
prise pour rendre l’audit reproductible.

## 10. Données locales et confidentialité

Les sessions, décisions et parcours sont stockés localement. Ne pas saisir dans
un parcours une URL ou une valeur sensible qui ne devrait pas être conservée
sur la machine locale. Les rapports et API publiques retirent les paramètres
de requête, mais l’éditeur privé peut conserver l’URL complète nécessaire au
rejeu.
