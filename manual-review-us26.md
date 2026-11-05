# Revue manuelle — US-26

Date : 2026-11-05  
Environnement : application locale Vite (`http://localhost:3002/`) et API
locale (`http://127.0.0.1:3001`) avec accès explicite aux fixtures locales  
Navigateur : Chrome intégré via navigateur Codex  
Type : revue fonctionnelle en lecture seule côté application

## Scénario

Fixture :
`http://127.0.0.1:4173/structure/us-26-review.html`

La fixture a été ajoutée depuis la sélection manuelle, auditée sans contraste,
puis consultée dans l’onglet **Langue et structure** de Results.

## Résultat observé

Les annexes affichent les signaux suivants, tous associés à une revue humaine :

- langue : déclaration vide et textes nécessitant une vérification ;
- direction : `direction: rtl` et signal de texte bidirectionnel ;
- régions : région présente, avec nom et arbre à vérifier ;
- citations : citation textuelle probable et absence de `cite` à examiner.

Les quatre critères du périmètre sont exposés dans la revue : **8.7**, **8.10**,
**9.2** et **9.4**. Aucun signal n’est présenté comme une conformité ou une
non-conformité automatique.

## Limites

La fixture vérifie l’exposition des observations et des contrôles humains. Elle
ne permet pas de décider si la langue, la direction, la structure ou la citation
sont pertinentes dans leur contexte éditorial réel. Aucune décision humaine n’a
été enregistrée et aucune issue GitHub n’a été déplacée durant cette revue.
