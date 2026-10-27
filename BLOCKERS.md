# Décisions bloquantes

## 2026-10-27 — Synchronisation GitHub indisponible

### Contexte

Le navigateur GitHub a disparu de la session et le jeton `gh` local est
invalide. La lecture publique des issues reste possible, mais l’accès au
GitHub Project et les mutations GitHub ne le sont pas.

### Impact

Les commits des stories US-26 (#35), US-52 (#52), US-54 (#54) et US-55 (#55)
sont poussés, mais leurs issues restent ouvertes et leurs colonnes du Project
ne peuvent pas être vérifiées ou mises à jour. Il ne faut pas les déclarer
`Done` par déduction à partir du dépôt local.

### Reprise

Rouvrir une session GitHub authentifiée, vérifier chaque issue et le Project 5,
puis synchroniser les cartes et les états. Ce blocage n’empêche pas les tests
ou les commits locaux, mais il empêche la clôture et la mise à jour du suivi.

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

## 2026-10-25 — Synchronisation de la décision RGAA 1.3 pour les alternatives d’image (tâche #41)

### Contexte

La collecte et l’annexe Images distinguent maintenant les alternatives absentes,
vides et non vides. Une alternative non vide est signalée
`ALT_RELEVANCE_REVIEW` et reste en `MANUAL_ONLY`. En revanche, la décision du
critère 1.3 dans `ReviewWorkspace` est actuellement enregistrée dans le modèle
de revue des critères, tandis que l’annexe Images persiste ses propres
`image-decisions` orientées vers l’examen de l’image. Ces deux flux ne sont pas
reliés : l’annexe ne sait donc pas si la décision 1.3 a été prise dans la revue,
et une modification d’image ne peut pas clôturer le statut du critère 1.3.

### Décision attendue

Choisir le flux de décision de la pertinence du critère 1.3 :

1. **Décision uniquement dans `ReviewWorkspace`** — l’annexe reste un
   inventaire de signaux et doit employer une formulation qui ne prétend pas
   afficher une décision 1.3 enregistrée ; ou
2. **Synchronisation annexe ↔ revue** — l’annexe enregistre ou met à jour une
   décision humaine explicitement rattachée au critère 1.3, et `ReviewWorkspace`
   recharge ce même état (recommandation PO/architecture : option 2 si l’on
   veut décider depuis l’annexe).

### État

La signalisation `ALT_RELEVANCE_REVIEW`, le mapping manuel, la fixture et les
tests sont implémentés et validés, mais la tâche #41 reste `In Progress` et ne
doit pas être clôturée avant ce choix. Aucun verdict automatique n’est produit.

### Reprise au prochain échange

Me demander de choisir l’option 1 ou 2, puis implémenter le flux correspondant,
ajouter le test de synchronisation et mettre à jour le manuel. En attendant,
poursuivre les cartes indépendantes.
