# Revue manuelle — US-41 et US-52

Date : 2026-11-05  
Environnement : application locale Vite (`http://127.0.0.1:3002/`) et API
locale en mode fixtures privées (`http://127.0.0.1:3001`)  
Navigateur : navigateur intégré Codex  
Type : revue fonctionnelle en lecture seule côté application

## Scénario

Un audit local a été lancé avec deux pages sélectionnées :

- `e2e/fixtures/test-sites/images/us-41-alt-relevance.html` ;
- `e2e/fixtures/test-sites/documents/us-52-documents-candidates.html`.

L’audit s’est terminé pour les deux pages et a produit la session
`2444707d-fd52-42d4-85ac-1193803994cb`.

## US-41 — Pertinence des alternatives d’image

Dans **Annexe Images**, la recherche de l’alternative « Équipe réunie autour
d’une table » affiche :

- le signal `ALT_RELEVANCE_REVIEW` et le statut « Pertinence de l’alternative à
  vérifier » ;
- la suggestion « porteuse d’information » séparée de la décision humaine ;
- le sélecteur « Décision humaine — pertinence 1.3 », initialement « Non testé » ;
- le contexte observé et les sources d’alternative `alt`, `figcaption` et
  `surrounding-text` ;
- les champs distincts pour une correction proposée et un commentaire.

Les lignes avec `alt` absent ou vide restent distinguées et rendent la décision
1.3 non applicable, sans la transformer en verdict automatique. Aucune décision
humaine n’a été enregistrée pendant cette revue.

## US-52 — Documents bureautiques

Dans **Annexe Contenus spécialisés**, deux documents sont exposés avec le
statut « Revue humaine requise » et les critères 13.3 et 13.4 :

- `guide.pdf` : libellé, MIME `application/pdf`, taille déclarée de 4096 octets,
  attribut `download` et extension `.pdf` ;
- `guide.docx` : libellé, MIME
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document` et
  extension `.docx`.

L’interface indique que ces éléments sont des signaux techniques et conserve la
validation humaine. Aucun téléchargement ni aucune exécution de document n’a
été déclenché par la revue.

## Résultat et limites

- **PASS fonctionnel** : les deux annexes sont accessibles depuis Results et
  présentent les preuves attendues, les critères concernés et la nécessité d’une
  décision humaine.
- **PASS de sécurité du parcours** : l’audit n’exécute pas les documents et la
  revue n’a utilisé que des fixtures locales.
- **Non testé** : la pertinence réelle de l’alternative, la présence d’une
  version accessible et l’équivalence de contenu doivent encore être vérifiées
  par un auditeur humain sur les documents réels.

Cette revue ne constitue pas une décision de conformité RGAA et ne ferme pas les
issues GitHub #41 ou #52.
