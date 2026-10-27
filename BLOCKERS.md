# Décisions bloquantes

## Décisions produit confirmées — 2026-10-27

Les choix suivants ont été confirmés par le client :

- PDF : **toujours à jour** après un rejeu ou une décision ; le cache doit être
  invalidé à partir des données du parcours et de ses décisions.
- US-28 / 12.8 : réutiliser les actions `press` définies dans les parcours ; ne
  pas généraliser automatiquement à toute la page.
- US-28 / 13.5 et 13.8 : produire des signaux et orientations de revue, sans
  décider automatiquement.
- US-28 : réutiliser les preuves `keyboard/context` existantes et afficher les
  captures en miniature dans le rapport, avec la taille complète dans l’annexe.
- US-41 / critère 1.3 : synchroniser l’annexe Images et `ReviewWorkspace`.
  Une suggestion peut être affichée, mais la décision humaine reste finale.

Les sections ci-dessous conservent le contexte et les conséquences de ces
choix. Elles ne constituent plus des questions ouvertes.

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

## 2026-10-27 — Revue manuelle de l’interface non disponible

L’agent de test manuel n’a pas pu ouvrir l’application : aucun navigateur
intégré ni environnement local accessible n’était disponible dans cette
session. Les parcours PDF, US-41 et US-28 n’ont donc pas été validés comme un
utilisateur.

Ce n’est pas un blocage d’implémentation : les tests automatisés et les
typechecks passent. Refaire la revue lorsque le navigateur intégré et
l’application locale seront disponibles, sans transformer cette absence de
preuve en conclusion de conformité.

## 2026-10-25 — Fraîcheur du PDF après ajout d’un parcours ou d’une décision

### Contexte

Le rapport HTML et le rapport JSON reconstruisent l’annexe des parcours à chaque demande. Le endpoint PDF réutilise toutefois le premier fichier PDF généré pour une session (`journey-annex-v1`). Si un rejeu ou une décision de preuve est enregistré après cette première génération, les téléchargements suivants peuvent donc continuer à servir un PDF sans ces dernières données.

### Décision retenue

**Option 2 — PDF toujours à jour** : recalculer la clé/invalidation du cache à
partir des parcours et décisions rattachés à la session.

### État

L’empreinte du rapport public inclut maintenant les parcours et décisions ; une
modification force donc une nouvelle génération du PDF. Les tests de
non-régression couvrent la différence entre deux versions.

### Reprise

Vérifier la génération depuis une session réelle lorsque GitHub et l’interface
sont à nouveau accessibles, puis synchroniser l’issue et le Project.

## 2026-10-25 — Périmètre de l’US-28 (tabulation, contenus cryptiques et contenus animés)

### Contexte

L’US-28 peut réutiliser le moteur de parcours, mais son périmètre exact conditionne les preuves à collecter. Le code actuel observe déjà partiellement le focus et les changements d’état, sans conclure automatiquement pour les critères 12.8, 13.5 et 13.8.

### Décisions retenues

1. Pour le critère 12.8, réutiliser les actions `press` définies dans un
   parcours ; aucune tabulation exhaustive automatique n’est ajoutée.
2. Pour le critère 13.5, inventorier des candidats de contenus cryptiques et
   laisser la vérification de l’alternative à l’humain.
3. Pour le critère 13.8, inventorier les contrôles de pause, d’arrêt ou de
   masquage ; ne pas produire de décision automatique.
4. Réutiliser les preuves `keyboard/context` avec des contrôles humains
   propres aux critères concernés.
5. Afficher une miniature dans le rapport et conserver la capture complète
   dans l’annexe.

### Recommandation PO

Ne pas déduire de non-conformité. Commencer par un inventaire de preuves
reproductibles (ordre de focus observé, contenu animé détecté, contexte et
capture lorsque disponible), puis conserver une décision humaine explicite par
preuve. Les actions `press` existantes restent le périmètre confirmé.

### Reprise

Les règles sont implémentées ; il reste à vérifier l’exposition complète depuis
le parcours réel et à synchroniser l’issue lorsque GitHub sera accessible.

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

### Décision retenue

Choisir le flux de décision de la pertinence du critère 1.3 :

1. **Décision uniquement dans `ReviewWorkspace`** — l’annexe reste un
   inventaire de signaux et doit employer une formulation qui ne prétend pas
   afficher une décision 1.3 enregistrée ; ou
**Option 2 — synchronisation annexe ↔ revue** : l’annexe enregistre ou met à
jour une décision humaine explicitement rattachée au critère 1.3, et
`ReviewWorkspace` recharge ce même état. Une suggestion automatique ne peut
jamais remplacer la décision humaine.

### État

La signalisation `ALT_RELEVANCE_REVIEW`, la fixture, la suggestion séparée et
la synchronisation avec le critère 1.3 sont implémentées et validées. Aucun
verdict automatique n’est produit ; une décision saisie directement dans
`ReviewWorkspace` conserve la priorité.

### Reprise

Vérifier le flux depuis l’interface complète lorsque GitHub sera accessible,
puis synchroniser l’issue et le Project.
