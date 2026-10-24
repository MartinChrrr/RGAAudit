# US-41 — Pertinence des alternatives textuelles des images

Le collecteur réutilise `ImageData` pour distinguer les images dont
l’alternative est absente ou vide de celles qui disposent d’une alternative
non vide. Une alternative non vide reçoit le signal `ALT_RELEVANCE_REVIEW` et
`altRelevanceStatus: "to_review"` : cela sélectionne l’image pour le critère
RGAA 1.3 sans conclure sur sa pertinence.

L’annexe Images affiche ce signal comme « Pertinence de l’alternative à
vérifier » et ne l’affiche pas comme conforme avant l’enregistrement d’une
décision humaine. Les images sans alternative textuelle ou avec une alternative vide
restent `not_applicable` pour le critère 1.3 ; leur absence ou leur caractère
décoratif relève des contrôles correspondants. La décision finale du critère
est saisie par l’auditeur dans l’espace de revue et n’est jamais déduite par le
collecteur. L’affichage d’une décision d’image dans l’annexe n’est pas encore
synchronisé avec cette décision de critère ; ce choix est consigné dans
`BLOCKERS.md`.

La fixture `e2e/fixtures/test-sites/images/us-41-alt-relevance.html` couvre les
trois états observables : alternative non vide, `alt=""` et attribut `alt`
absent. Elle ne réalise aucune action authentifiée ou irréversible.

Limites : la sonde ne sait pas déterminer si le texte décrit correctement le
contenu de l’image, ni si l’image est réellement porteuse d’information. Ces
points restent une décision humaine documentée par la preuve et le contexte.
