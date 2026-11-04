# Revue manuelle — US-18

Date : 2026-10-22  
Environnement : local (`http://localhost:3000/`, API `http://127.0.0.1:3001`)  
Navigateur : Chrome intégré via navigateur Codex ; viewport par défaut  
Type : revue fonctionnelle en lecture seule côté application. Les audits ont utilisé uniquement `https://example.org/` et `https://example.org/index.html`, données conservées dans le serveur de développement.

## Résumé

Le parcours principal et la comparaison avec groupe sont **PASS** sur un audit local contrôlé. Le scénario sans groupe est également **PASS**. JourneyRun est **BLOCKED** : aucun parcours de test n’est exposé dans l’interface consultée. Aucun code, backlog ou résultat n’a été supprimé ou corrigé.

## Reprise de revue — 2026-11-01

Environnement : application locale Vite (`http://localhost:3000/`) et API
locale attendue sur `http://127.0.0.1:3001`.

### M-06 — Accès au parcours depuis Results

Statut : **PASS partiel**

Après un audit local de test, Results affichait bien l’**Annexe — Parcours
d’audit** et le lien **Créer un parcours pour cette session**. Le parcours a
pu être créé depuis ce flux et a reçu un identifiant persistant.

### M-07 — Création et lancement d’un JourneyRun

Statut : **BLOCKED**

La création du parcours a abouti après configuration d’une étape `click` sur
`body`. Le rejeu a obtenu un identifiant d’exécution, mais est resté en état
**En cours** sans observation d’étape. Après l’interruption de l’API locale,
le navigateur a signalé des erreurs proxy `socket hang up` et la page est
restée sur « Chargement des observations… ».

L’audit préalable de `https://example.org/` s’est terminé avec l’erreur
visible `page.evaluate: ReferenceError: __name is not defined`. Cette erreur
est une anomalie technique à diagnostiquer séparément ; elle ne constitue pas
une décision RGAA.

Conclusion : l’exposition du parcours est vérifiée, mais le rejeu complet,
les comparaisons d’étapes et la décision humaine sur preuve restent à valider
avec une API locale stable.

## Analyse technique — 2026-11-04

L’erreur `__name is not defined` a été reproduite dans les callbacks DOM
transpilés par `tsx`. Elle ne vient pas de la page auditée : `tsx` injectait
son helper de conservation des noms de fonctions dans le code exécuté par
Playwright, alors que ce helper n’était défini que côté Node.

Un runtime page-local est désormais installé avant les collectes et les
rejeux. Les tests automatisés du moteur de parcours (8) et des collecteurs et
de l’audit (61) passent. Cette preuve technique ne remplace pas le rejeu
manuel demandé en M-07 ; le statut reste **À rejouer** jusqu’à une validation
avec l’interface et une API stable.

## Scénarios

### M-01 — Audit avec groupe de comparaison

Statut : **PASS**

Étapes : sélection manuelle, ajout de `https://example.org/` et `https://example.org/index.html`, saisie de `manual-review-01`, désactivation des contrastes, lancement, puis ouverture de Results.

Attendu : audit terminé, groupe conservé et comparaison affichée.

Observé : audit terminé avec `2 / 2 page(s)`, deux identifiants de page (`b9e3c04c`, `c6882d3b`) et Results affiche « Comparaison des observations ». La carte distingue « Avant » et « Après », les deux identifiants, les horodatages, et affiche « Ajouts : aucun » / « Suppressions : aucune ». Les pages distantes ont retourné une erreur de collecte, donc aucun champ modifié n’a pu être constaté.

### M-02 — Afficher les comparaisons dans Results

Statut : **PASS**

Preuve : Results affichait le titre « Comparaison des observations », une paire Avant/Après avec identifiants de page, URLs visibles sous forme contrôlée et les états ajoutés/supprimés. Le message « Comparaison indisponible — revue humaine requise » est affiché pour les pages en erreur.

### M-03 — Parcours JourneyRun et comparaisons d’étapes

Statut : **BLOCKED**

Attendu : consulter un parcours à deux étapes et ses comparaisons.

Observé : l’interface Results expose uniquement « Nouvel audit » ; aucun lien ou parcours JourneyRun de test n’est disponible après l’audit. Aucun parcours n’a pu être ouvert sans deviner une URL interne.

### M-04 — Audit sans groupe

Statut : **PASS**

Étapes : nouvel audit, ajout de `https://example.org/`, champ de groupe laissé vide, lancement, ouverture de Results.

Attendu : audit utilisable et aucune comparaison implicite.

Observé : audit terminé avec `1 / 1 page(s)` et Results affiche `1 page(s) auditée(s)` sans section « Comparaison des observations ». Le champ de groupe est bien facultatif.

### M-05 — Smoke test critique

Statut : **PASS**

Parcours : chargement → sélection manuelle → ajout d’URL → lancement → progression → Results.

Observé : parcours navigable de bout en bout. Les pages `example.org` ont affiché une erreur de collecte, mais l’application a terminé les audits, exposé les identifiants de page et rendu Results sans erreur bloquante.

## Contexte du GitHub Project

Consulté le 22 octobre 2026 dans `RGAAudit — Développement` (Project 5) :

- `[US-18] Comparer les pages et conserver les observations` est dans **In Progress** ;
- l’`[EPIC] Parcours, formulaires et comparaison de pages` est également dans **In Progress** ;
- aucune carte n’a été déplacée et aucun issue n’a été modifié pendant cette revue.

## Limites

Les audits ont créé des sessions et résultats locaux dans le serveur de développement ; rien n’a été supprimé. La cible distante a répondu en erreur, donc la comparaison n’a pas permis de vérifier des changements de données sémantiques. JourneyRun doit être rejoué avec une donnée de parcours existante. Aucune correction n’est proposée ni appliquée dans ce rapport.
