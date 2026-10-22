# Revue manuelle — US-18

Date : 2026-10-22  
Environnement : local (`http://localhost:3000/`, API `http://127.0.0.1:3001`)  
Navigateur : Chrome intégré via navigateur Codex ; viewport par défaut  
Type : revue fonctionnelle en lecture seule côté application. Les audits ont utilisé uniquement `https://example.org/` et `https://example.org/index.html`, données conservées dans le serveur de développement.

## Résumé

Le parcours principal et la comparaison avec groupe sont **PASS** sur un audit local contrôlé. Le scénario sans groupe est également **PASS**. JourneyRun est **BLOCKED** : aucun parcours de test n’est exposé dans l’interface consultée. Aucun code, backlog ou résultat n’a été supprimé ou corrigé.

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
