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
tableaux, titres, cadres, formulaires, médias, contenus spécialisés et
heuristiques.

Pour chaque élément ou critère concerné :

1. consulter la preuve et son contexte ;
2. choisir `non testé`, `conforme`, `non conforme` ou `non applicable` ;
3. ajouter un commentaire si le contexte le justifie ;
4. enregistrer la décision.

Les décisions remplacées restent accessibles dans l’historique. Une décision
humaine reste séparée du signal automatique qui l’a motivée.

### 5.1. Examiner les libellés et regroupements de formulaires (US-44)

Dans l’annexe **Formulaires**, chaque contrôle peut afficher son libellé et sa
source, le sélecteur DOM du libellé, l’accolement observé, le `fieldset` et sa
`legend`, ainsi que les `optgroup` d’une liste et les intitulés des boutons.
Les groupes de champs sont listés séparément avec leurs contrôles associés.

Ces éléments sont des preuves candidates pour les critères RGAA 11.2, 11.4,
11.5, 11.7, 11.8 et 11.9. Ils ne concluent pas sur la pertinence du texte, la
nécessité d’un regroupement, les cas particuliers d’accolement ou la pertinence
du regroupement des options. Vérifier chaque relation dans la page et enregistrer
la décision humaine depuis le critère concerné.

### 5.2. Vérifier la validation et les soumissions (US-45)

L’annexe **Formulaires** signale les contraintes natives (`required`, `pattern`,
longueurs, bornes et types), les états invalides et les aides ou messages
associés à un champ. Elle signale également les formulaires qui possèdent un
contrôle de soumission et indique explicitement que la collecte ne l’a pas
exécuté.

Ces signaux alimentent les preuves candidates des critères RGAA 11.3, 11.10,
11.11 et 11.12. Ils ne permettent pas de conclure sur la pertinence du type de
contrôle, la qualité d’une suggestion, la cohérence éditoriale ou le caractère
sensible d’une opération. Pour un parcours de validation, utiliser seulement
une fixture locale contrôlée et non authentifiée, puis enregistrer une décision
humaine. RGAAudit ne soumet jamais automatiquement un formulaire réel.

### 5.3. Vérifier les changements de contexte et les divulgations (US-46)

Dans une exécution de parcours, chaque étape compare l’état avant et après
l’interaction. L’annexe signale les navigations, changements de titre, boîtes de
dialogue et régions live, ainsi que les changements d’état `aria-expanded` et
`details` avec leur contrôle visible associé. Ces observations sont reliées aux
critères RGAA 7.4, 7.5 et 10.13 lorsqu’un signal est observé.

Ces éléments restent des preuves candidates : l’outil ne conclut pas que le
changement de contexte était annoncé, que le message de statut est correctement
restitué ou que la divulgation est contrôlable. L’auditeur doit rejouer le cas,
vérifier le clavier et les technologies d’assistance, puis enregistrer une
décision humaine depuis la revue du parcours.

### 5.4. Vérifier la consultation, les délais et les contenus additionnels (US-47)

Dans une exécution de parcours, l’annexe de chaque étape peut afficher :

- les contenus référencés par un composant et observés autour du focus ou de
  l’activation, avec leur sélecteur et leur atteignabilité clavier candidate
  (RGAA 12.11) ;
- les minuteurs JavaScript, rafraîchissements `meta` et comptes à rebours
  observés (RGAA 13.1) ;
- les appels `window.open` et les liens `target="_blank"` observés (RGAA 13.2) ;
- les contenus cryptiques candidats et les alternatives textuelles observées
  (RGAA 13.5 et 13.6).

Chaque signal conserve l’étape qui l’a déclenché et l’horodatage de cette
observation. Ces données ne constituent jamais un verdict : vérifier au clavier
les contenus additionnels, le contrôle laissé à l’utilisateur sur le délai,
l’absence d’ouverture automatique et la pertinence de l’alternative avant de
prendre une décision humaine. Les minuteurs détectés correspondent aux
enregistrements observables du navigateur et ne prouvent ni la durée réelle ni
la possibilité de prolonger ou d’arrêter le délai.

### 5.5. Vérifier les alternatives et contrôles des scripts (US-48)

Lorsqu’un parcours est rejoué, l’annexe peut présenter les éléments `script`
observés, une éventuelle alternative `noscript` adjacente et les événements
clavier ou de pointage constatés sur un contrôle scripté. Ces preuves candidates
sont associées aux critères RGAA 7.2 et 7.3.

L’outil ne juge pas la pertinence de l’alternative et ne déduit pas qu’un
contrôle est entièrement opérable. Vérifier le contenu proposé sans JavaScript,
la correspondance fonctionnelle avec le script, les touches attendues, le
pointage, le focus et les technologies d’assistance avant d’enregistrer une
décision humaine.

### 5.6. Vérifier les médias temporels et leurs pistes (US-49)

Dans l’annexe **Médias**, chaque élément audio ou vidéo conserve les sources,
le contenu de secours, les pistes `subtitles`/`captions` et `descriptions`,
ainsi qu’une ligne de preuve candidate pour chacun des critères RGAA 4.1 à 4.6.
Chaque ligne indique un état d’observation (`signal observé`, `signal candidat
absent`, `revue humaine requise` ou `hors périmètre du média temporel`), les
preuves observées et leurs limites.

Un signal de piste ou de contenu de secours ne valide ni la transcription, ni la
qualité, ni la synchronisation, ni la pertinence de la piste. Un état `missing`
signale seulement qu’aucun signal candidat n’a été observé ; il ne constitue pas
un verdict de non-conformité. Vérifier le média réellement joué, les besoins du
contenu, la synchronisation et la pertinence des sous-titres ou de
l’audiodescription avant d’enregistrer une décision humaine.

### 5.7. Vérifier les alternatives des médias non temporels (US-55)

Pour les `canvas`, `object` et `embed`, l’annexe **Médias** rattache les
contenus de secours textuels candidats aux critères RGAA 4.8 et 4.9. L’état
`observed` signifie seulement qu’un contenu de secours a été observé ; `missing`
signale son absence dans le DOM observé et `to_review` rappelle que l’existence
ou la pertinence d’une alternative ne peut pas être déduite automatiquement.
Les médias audio et vidéo affichent ces critères comme `not_applicable`.

Comparer l’alternative avec le rôle et le contenu réel du média, vérifier si une
alternative est nécessaire dans le contexte, puis enregistrer la décision
humaine. Un signal DOM ne produit aucun verdict de conformité.

### 5.8. Vérifier l’identification et l’utilisation des médias (US-50)

L’annexe **Médias** affiche aussi les critères RGAA 4.7, 4.11, 4.12 et 4.13.
Pour chaque média, la colonne **Preuves techniques** reprend les signaux DOM
observés (nom accessible, alternatives déclarées, contrôles natifs et type de
média). La colonne **Validation humaine** rappelle la question du mapping à
vérifier.

La présence d’un nom ou de l’attribut `controls` ne prouve pas que le média est
clairement identifiable, utilisable au clavier ou au pointage, ni compatible
avec les technologies d’assistance. Les critères 4.11 et 4.12 nécessitent un
essai réel au clavier et avec un dispositif de pointage ; le critère 4.13
nécessite une vérification avec les technologies d’assistance. Aucun de ces
signaux ne produit un verdict automatique.

### 5.9. Vérifier les images spécialisées (US-51)

Dans l’annexe **Images**, les images candidates pour un CAPTCHA ou une
image-test sont rattachées aux critères RGAA 1.4 et 1.5. Les déclarations
`aria-describedby` et `longdesc` sont conservées comme candidates pour les
critères 1.6 et 1.7. Les images sont également signalées pour la revue du
critère 1.8 lorsqu’une vérification de texte dans l’image est nécessaire.

La section **Preuves techniques et validation humaine** distingue le signal
observé, les limites et la question à vérifier. Une image ordinaire est indiquée
comme non applicable aux critères CAPTCHA uniquement lorsque aucun indice de
CAPTCHA ou d’image-test n’est observé. La collecte ne juge jamais la pertinence
de l’alternative, d’une description, de la solution de CAPTCHA ou d’un éventuel
remplacement par du texte stylé.

### 5.10. Vérifier les documents bureautiques (US-52)

Dans l’annexe **Contenus spécialisés**, chaque lien vers un document bureautique
est rattaché aux critères RGAA 13.3 et 13.4. Les preuves locales peuvent
reprendre le type MIME déclaré dans le DOM, la taille déclarée, l’extension de
la source et la présence de l’attribut `download`. L’annexe indique aussi que
l’analyse locale n’a pas été exécutée automatiquement.

Ces observations ne récupèrent pas le MIME ou la taille HTTP réels et ne
téléchargent ni n’exécutent de contenu distant. Vérifier manuellement le
téléchargement, le format et la taille effectivement servis, l’existence d’une
version accessible lorsque nécessaire, puis l’équivalence des informations
entre les deux versions. L’absence d’une métadonnée DOM n’est pas un verdict de
non-conformité.

### 5.11. Vérifier la pertinence des titres de cadres (US-54)

Dans l’annexe **Cadres**, chaque `iframe` ou `frame` dont le titre est observé
est rattaché au critère RGAA 2.2. La preuve rappelle le titre collecté, le
contexte de la frame, les limites de la collecte et la question officielle à
vérifier. Une frame sans titre reste « à vérifier » : l’absence est signalée
comme preuve et ne remplace pas le contrôle de présence du critère 2.1.

La collecte ne peut pas décider si « Aide », « Publicité » ou un autre titre
décrit réellement la fonction du contenu embarqué. Comparer le titre avec le
contenu et le rôle de la frame, puis enregistrer une décision humaine ; aucun
signal n’est présenté comme une conformité automatique.

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

## 9. Repères visuels candidats (US-30)

Dans l’annexe **Présentation et responsive**, la table **Repères visuels
candidats** inventorie les éléments dont l’attribut `style` contient une
propriété explicite de couleur, forme, taille ou position. Elle affiche le
sélecteur, le texte ou nom accessible observé, les valeurs CSS calculées, les
dimensions et les signaux associés aux critères RGAA 3.1, 10.9 et 10.10.

Cette table est une aide à la revue : elle ne conclut jamais qu’une information
dépend uniquement d’un repère visuel et ne valide pas automatiquement une
alternative. Les feuilles CSS externes, les pseudo-éléments, les états
interactifs et la pertinence éditoriale doivent être vérifiés par l’auditeur.

## 10. Pertinence des alternatives d’image (US-41)

Dans l’annexe **Images**, une image avec un texte alternatif non vide est
marquée **Pertinence de l’alternative à vérifier** pour le critère RGAA 1.3.
Une image sans attribut `alt` ou avec `alt=""` est indiquée comme non applicable
à 1.3 ; elle reste examinée au titre des critères relatifs à l’absence ou au
caractère décoratif. L’interface peut afficher qu’une décision d’image a été
enregistrée, mais sa synchronisation avec la décision du critère 1.3 dans
`ReviewWorkspace` reste à choisir (voir `BLOCKERS.md`).

Le signal ne juge pas si le texte décrit correctement l’image. L’auditeur doit
ouvrir la preuve, consulter le contexte et enregistrer sa décision dans la
revue du critère.

## 11. Tableaux complexes et de mise en forme (US-42)

Dans l’onglet **Tableaux**, chaque tableau observé est présenté comme un
candidat : tableau de données, tableau de mise en forme ou classification à
déterminer. L’annexe conserve les caractéristiques observées (`caption`, `th`,
`scope`, `headers`, `summary`), les signaux de complexité, le titre, le résumé
et une lecture linéarisée du contenu.

Utiliser le lien **Examiner dans l’annexe** depuis un critère 5.x pour ouvrir
la page et le tableau concernés. La colonne **Décision** rappelle qu’une revue
humaine est requise : les critères 5.1, 5.2, 5.3, 5.5 et 5.7 restent manuels.
Un tableau sans caractéristique de données est seulement un candidat de mise
en forme ; il n’est jamais déclaré automatiquement conforme ou non applicable.

Vérifier notamment la nature réelle du tableau, la nécessité et la pertinence
du résumé, la compréhension de la lecture linéarisée, le titre et
l’association effective des cellules avec leurs en-têtes.

## 12. Visibilité du focus et responsive (US-43)

Dans l’onglet **Présentation et focus**, RGAAudit affiche, pour chaque état sondé
(`État initial`, feuilles de style désactivées, viewport 320 × 256 et sonde de
zoom 200 %), les dimensions observées, le débordement éventuel et les éléments
interactifs visibles dont le focus a été sondé. Depuis un critère 10.7, le lien
**Examiner dans l’annexe** limite l’affichage aux états et sélecteurs associés.

Ces observations sont des preuves candidates : elles ne produisent aucun
verdict automatique. La sonde déplace le focus par programmation et ne simule
pas une séquence réelle avec la touche Tab, la modalité `:focus-visible`, un
piège de focus ou l’usage d’une technologie d’assistance. Refaire le parcours
au clavier et avec le zoom du navigateur dans chaque état avant d’enregistrer
une décision humaine.

## 13. Scénarios contrôlés clavier, flash et gestes (US-31)

Lorsqu’un parcours déclenche un changement de contexte, le rapport peut afficher
des candidats pour les critères RGAA 12.9, 13.7 et 13.10 à 13.12 : cycles de
focus, animations de type flash, événements pointer/touch et inscriptions aux
APIs de mouvement. Chaque observation indique le sélecteur, le détail observé
et les critères associés.

Ces éléments sont uniquement des pistes de vérification. RGAAudit ne mesure pas
la fréquence ou la luminance d’un flash, ne juge pas la complexité réelle d’un
geste, ne vérifie pas son annulation et ne remplace pas un essai sur appareil
pour les capteurs. Aucun geste supplémentaire ni action authentifiée n’est
exécuté automatiquement.

## 14. Interpréter les limites

RGAAudit aide à organiser un audit ; il ne remplace pas l’auditeur. Les points
suivants nécessitent fréquemment une intervention humaine :

- pertinence d’un intitulé, d’une alternative ou d’un titre ;
- changements de langue et de sens de lecture ;
- cohérence éditoriale et structure du document ;
- compréhension des erreurs, aides et changements de contexte ;
- comportement avec les technologies d’assistance.

Toujours conserver le contexte de la page, la preuve consultée et la décision
prise pour rendre l’audit reproductible.

## 15. Données locales et confidentialité

Les sessions, décisions et parcours sont stockés localement. Ne pas saisir dans
un parcours une URL ou une valeur sensible qui ne devrait pas être conservée
sur la machine locale. Les rapports et API publiques retirent les paramètres
de requête, mais l’éditeur privé peut conserver l’URL complète nécessaire au
rejeu.
