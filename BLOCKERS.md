# Décisions bloquantes

## 2026-10-25 — Fraîcheur du PDF après ajout d’un parcours ou d’une décision

### Contexte

Le rapport HTML et le rapport JSON reconstruisent l’annexe des parcours à chaque demande. Le endpoint PDF réutilise toutefois le premier fichier PDF généré pour une session (`journey-annex-v1`). Si un rejeu ou une décision de preuve est enregistré après cette première génération, les téléchargements suivants peuvent donc continuer à servir un PDF sans ces dernières données.

### Décision attendue

Choisir le comportement attendu pour le PDF :

1. **PDF immuable dès la première génération** — le fichier représente un instantané explicite et il faut le documenter ainsi dans l’interface et le manuel ; ou
2. **PDF toujours à jour** — recalculer la clé/invalidation du cache à partir des parcours et décisions rattachés à la session (recommandation PO/architecture).

### État

La story d’intégration des parcours dans les rapports est implémentée et poussée, mais elle ne doit pas être clôturée avant cette décision. Aucune modification de comportement n’a été inventée.

### Reprise au prochain échange

Me demander de confirmer l’option 1 ou 2, puis appliquer la décision, ajouter le test de non-régression correspondant et mettre à jour le manuel utilisateur.
