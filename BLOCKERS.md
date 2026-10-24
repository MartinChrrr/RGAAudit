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

## 2026-10-25 — Périmètre de l’US-28 (tabulation, contenus cryptiques et contenus animés)

### Contexte

L’US-28 peut réutiliser le moteur de parcours, mais son périmètre exact conditionne les preuves à collecter. Le code actuel observe déjà partiellement le focus et les changements d’état, sans conclure automatiquement pour les critères 12.8, 13.5 et 13.8.

### Décisions attendues

1. Pour le critère 12.8, confirmer si le test doit parcourir toute la page avec Tab ou seulement les actions `press` définies dans un parcours.
2. Pour le critère 13.5, préciser les motifs à inventorier comme contenu cryptique (par exemple emojis, art ASCII ou syntaxes techniques) et le niveau d’alternative attendu.
3. Pour le critère 13.8, préciser quels contrôles sont acceptés comme mécanisme pause/arrêt/masquage pour les contenus animés.
4. Confirmer si les décisions humaines doivent réutiliser les preuves `keyboard/context` ou disposer d’un modèle de décision dédié.
5. Confirmer si les captures visuelles doivent être intégrées directement dans le rapport HTML/PDF ou seulement accessibles depuis la revue.

### Recommandation PO

Ne pas déduire de non-conformité. Commencer par un inventaire de preuves reproductibles (ordre de focus observé, contenu animé détecté, contexte et capture lorsque disponible), puis conserver une décision humaine explicite par preuve. Reprendre les actions `press` existantes par défaut, et ne généraliser à toute la page qu’après confirmation.

### Reprise au prochain échange

Me demander de choisir les options ci-dessus avant de démarrer l’US-28. En attendant, poursuivre les stories indépendantes qui ne dépendent pas de ces décisions.
