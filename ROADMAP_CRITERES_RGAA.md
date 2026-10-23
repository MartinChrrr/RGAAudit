# Feuille de route de couverture des critères RGAA

> Référentiel cible : **RGAA 4.1.2**, 106 critères. État du dépôt relevé le 11 septembre 2026.

Cette feuille de route classe les critères selon la facilité d'ajout dans **RGAAudit** et selon la part de jugement humain nécessaire. Elle décrit l'ordre d'implémentation du moteur d'aide à l'audit, pas l'ordre de correction d'un site audité.

Le mot « intégré » signifie qu'un critère est présent dans le mapping et dans le parcours de revue. Il ne signifie pas que le critère peut être déclaré conforme sans auditeur. RGAAudit doit continuer à séparer le signal machine de la décision humaine.

Sources de référence :

- [Critères et tests du RGAA 4.1.2](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/)
- [Méthodologie de test](https://accessibilite.numerique.gouv.fr/ressources/methodologie-de-test/)
- [Environnement de test](https://accessibilite.numerique.gouv.fr/methode/environnement-de-test/)
- État actuel du produit : [`packages/core/mapping/rgaa-4.1.json`](packages/core/mapping/rgaa-4.1.json), collecteurs Playwright et règles axe-core 4.9.1.

## Registre canonique (source de vérité)

La couverture et l'ordre d'implémentation sont ceux du registre runtime
[`packages/core/mapping/rgaa-4.1.json`](packages/core/mapping/rgaa-4.1.json). Les anciens tableaux de cette feuille de route ne doivent pas
réintroduire un critère déjà présent dans le lot 0.

| Lot runtime | Nombre | Identifiants RGAA |
|---:|---:|---|
| 0 — socle intégré | 27 | 1.1, 1.2, 1.9, 2.1, 3.2, 3.3, 5.4, 5.6, 6.1, 6.2, 7.1, 8.1, 8.3, 8.4, 8.5, 8.6, 8.8, 8.9, 9.1, 9.3, 10.6, 10.12, 11.1, 11.13, 12.7, 12.10, 13.9 |
| 1 — prochain incrément | 6 | 5.8, 8.2, 10.1, 10.5, 11.6, 12.6 |
| 2 — collecteurs et preuves | 28 | 1.3, 2.2, 4.10, 5.1–5.7, 8.7, 8.10, 9.2, 9.4, 10.2–10.4, 10.7, 10.8, 10.11, 10.14, 11.2, 11.4–11.9, 12.8, 13.5, 13.8 |
| 3 — parcours et comparaisons | 17 | 4.7, 7.4, 7.5, 10.13, 11.3, 11.10–11.12, 12.1–12.5, 12.11, 13.1, 13.2, 13.6 |
| 4 — interactions complexes | 13 | 3.1, 4.11–4.13, 7.2, 7.3, 10.9, 10.10, 12.9, 13.7, 13.10–13.12 |
| 5 — médias et documents | 15 | 1.4–1.8, 4.1–4.6, 4.8, 4.9, 13.3, 13.4 |

Les colonnes `coverage`, `humanLevel` et `implementationLot` du registre runtime
décrivent respectivement le niveau de signal, la validation humaine restante et
le lot de backlog. Elles sont déjà validées par les tests du mapper.

Les tableaux emploient des intitulés abrégés pour rester lisibles. L'identifiant fait foi et renvoie au libellé complet de la source officielle ci-dessus.

## Légende

### Difficulté de développement

| Niveau | Signification |
|---|---|
| **E1 — facile** | Mapping axe-core existant ou contrôle DOM déterministe, avec peu d'interface nouvelle. |
| **E2 — modéré** | Nouveau collecteur, annexe ou scénario visuel simple. |
| **E3 — difficile** | Interactions Playwright, comparaison entre pages, gestion d'états ou heuristique délicate. |
| **E4 — très difficile** | Analyse multimédia/documentaire, gestes, capteurs, technologies d'assistance ou outillage externe. |

### Intervention humaine

| Niveau | Signification |
|---|---|
| **H0 — minimale** | Le test technique peut être déterministe. L'auditeur garde la validation finale. |
| **H1 — confirmation rapide** | La machine fournit une conclusion forte et les preuves ; un humain confirme les cas limites. |
| **H2 — jugement nécessaire** | La machine inventorie ou signale, mais la pertinence doit être décidée par un humain. |
| **H3 — expertise indispensable** | Test fonctionnel, éditorial, multimédia ou avec technologie d'assistance réalisé par un expert. |

### État

- **Intégré** : présent aujourd'hui dans le mapping et le parcours d'audit.
- **Partiel** : intégré, mais seule une partie des tests RGAA est préanalysée.
- **À faire** : absent du mapping courant.

## Résumé de l'ordre recommandé

| Lot | Contenu | Critères | Pourquoi cet ordre |
|---|---|---:|---|
| **0** | Consolider l'existant | 27 | Sécuriser ce qui est déjà visible avant d'augmenter le compteur. |
| **1** | Gains rapides DOM / axe-core | 6 | Faible coût, preuves fiables, briques réutilisables par les lots suivants. |
| **2** | Collecteurs et preuves visuelles | 28 | Forte valeur pour l'auditeur sans prétendre automatiser la pertinence. |
| **3** | Parcours, formulaires et comparaisons | 17 | Demande un moteur de scénarios et des analyses inter-pages. |
| **4** | Interactions complexes et expertise | 13 | Automatisation partielle seulement ; environnement de test plus exigeant. |
| **5** | Contenus spécialisés, médias et documents | 15 | Coût maximal et forte dépendance à l'expertise humaine ou à des outils externes. |

Après le lot 1, RGAAudit afficherait **33 critères intégrés sur 106**. Après le lot 2, il en afficherait **61**. Cette progression mesure la couverture du parcours d'aide à l'audit, pas le nombre de critères entièrement automatisés.

## Lot 0 — critères déjà intégrés

Les 12 critères ci-dessous détaillent les premiers contrôles historiques du
socle. La liste exhaustive des 27 critères intégrés est celle du registre
canonique ci-dessus ; la colonne « suite » évite de considérer un critère
partiel comme définitivement terminé.

| Critère | Objet du critère (résumé) | État réel | Difficulté | Humain | Signal actuel et suite recommandée |
|---|---|---|---|---|---|
| **1.1** | Chaque image porteuse d'information a-t-elle une alternative textuelle ? | **Intégré, partiel** | E2 | H2 | axe `image-alt`, collecteur d'images et heuristique SVG. Étendre à `area`, `object`, `embed`, canvas et images CSS ; ne jamais conclure automatiquement à la pertinence. |
| **1.2** | Chaque image de décoration est-elle correctement ignorée par les technologies d'assistance ? | **Intégré, partiel** | E2 | H2 | axe et conflits de rôle. Ajouter l'inventaire des images CSS/SVG et une décision humaine « décorative ou informative ». |
| **2.1** | Chaque cadre a-t-il un titre de cadre ? | **Intégré, bon socle** | E1 | H0 | axe `frame-title`, collecteur `iframe`/`frame` et annexe Cadres. La présence d'un `title` non vide est contrôlée ; la pertinence sera couverte par 2.2. |
| **3.2** | Le contraste entre le texte et son arrière-plan est-il suffisant ? | **Intégré, partiel** | E1 | H1 | axe `color-contrast`. Conserver les cas `incomplete`, images-texte et SVG pour revue. |
| **3.3** | Les composants d'interface et éléments graphiques porteurs d'information sont-ils suffisamment contrastés ? | **Intégré, manuel** | E2 | H2 | Fiche manuelle seulement. Ajouter un sélecteur de couleurs et des captures ciblées ; ne pas utiliser `color-contrast-enhanced`, qui ne couvre pas ce critère. |
| **6.1** | Chaque lien est-il explicite (hors cas particuliers) ? | **Intégré, partiel** | E2 | H2 | axe `link-name` et collecteur des libellés génériques/dupliqués. Montrer le contexte du lien et traiter le nom accessible contenant le libellé visible. |
| **6.2** | Chaque lien a-t-il un intitulé ? | **Intégré, bon socle** | E1 | H1 | axe `link-name`. Compléter les formes SVG et les cas rendus dynamiquement. |
| **7.1** | Chaque script est-il, si nécessaire, compatible avec les technologies d'assistance ? | **Intégré, partiel** | E3 | H3 | Heuristique des faux composants interactifs. Ajouter un inventaire nom/rôle/valeur/état et un protocole de test avec lecteur d'écran. |
| **8.5** | Chaque page web a-t-elle un titre de page ? | **Intégré, bon socle** | E1 | H0 | axe `document-title` et collecteur. Le test de présence est déterministe. |
| **8.6** | Pour chaque page ayant un titre, ce titre est-il pertinent ? | **Intégré, partiel** | E1 | H2 | Détection des titres absents/génériques. Ajouter la comparaison inter-pages ; la pertinence reste humaine. |
| **8.9** | Les balises ne sont-elles pas utilisées uniquement à des fins de présentation ? | **Intégré, partiel** | E2 | H2 | Heuristiques de faux titres, paragraphes et listes. Étendre aux autres détournements de balises et présenter la preuve visuelle. |
| **9.1** | L'information est-elle structurée par une utilisation appropriée des titres ? | **Intégré, partiel** | E2 | H2 | axe et arbre des titres. Un saut de niveau est un indice, pas à lui seul une non-conformité ; garder la décision humaine. |

### Garde-fous avant le lot 1

Les métadonnées `coverage`, `humanLevel` et `implementationLot`, l'affichage
des 106 critères et les contrôles d'identifiants uniques existent déjà dans le
runtime et ses tests. Toute nouvelle story doit les réutiliser, et non créer un
second registre.

1. Conserver la séparation entre critères intégrés, signaux machine et décisions humaines.
2. Interdire qu'une absence de violation axe produise à elle seule une conformité RGAA lorsque tous les tests du critère ne sont pas couverts.
3. Maintenir le test garantissant que chaque identifiant RGAA apparaît une seule fois et que le total de référence reste 106.

## Lot 1 — gains rapides DOM et axe-core

Le lot runtime ne contient plus que six critères réellement non couverts par le
lot 0 : **5.8, 8.2, 10.1, 10.5, 11.6 et 12.6**. Les critères 8.1, 8.3, 8.4,
8.8, 9.3, 10.6, 10.12, 11.1, 12.7, 12.10, 13.9, 1.9, 5.4 et 5.6 sont
déjà intégrés au lot 0 et doivent être traités comme du hardening ou des
extensions, jamais comme de nouvelles entrées de couverture.

| Ordre | Critère | Objet du critère (résumé) | Difficulté | Humain | Première tranche utile |
|---:|---|---|---|---|---|
| **1** | **5.8** | Un tableau de mise en forme évite-t-il les éléments propres aux tableaux de données ? | E2 | H1 | Détecter les tableaux de présentation contenant `caption`, `th`, `scope`, `headers` ou résumé. |
| **2** | **8.2** | Le code généré est-il valide selon le type de document ? | E2 | H1 | Ajouter la validation HTML ciblée par les tests RGAA, sans remonter les erreurs sans impact. |
| **3** | **10.1** | Des feuilles de styles sont-elles utilisées pour contrôler la présentation ? | E1 | H0 | Détecter les attributs et balises de présentation interdits ainsi que l'usage effectif de CSS. |
| **4** | **10.5** | Les couleurs de fond et de police sont-elles correctement déclarées ensemble ? | E2 | H1 | Examiner les styles calculés et signaler les couples couleur/fond incomplets. |
| **5** | **11.6** | Chaque regroupement de champs a-t-il une légende ? | E1 | H0 | Inventorier `fieldset` et vérifier la présence d'un `legend`. |
| **6** | **12.6** | Les zones récurrentes peuvent-elles être atteintes ou évitées ? | E2 | H1 | Mapper landmarks et `bypass`; présenter la structure des régions. |

## Lot 2 — collecteurs et preuves visuelles

Ordre 23 à 50. Ces critères sont rentables si l'objectif est d'accélérer l'auditeur : la machine localise les éléments et reproduit l'état de test, tandis que l'humain juge le sens.

| Ordre | Critère | Objet du critère (résumé) | Difficulté | Humain | Première tranche utile |
|---:|---|---|---|---|---|
| **23** | **2.2** | Le titre de chaque cadre est-il pertinent ? | E1 | H2 | Afficher URL, titre, nom accessible et capture du cadre dans une annexe dédiée. |
| **24** | **1.3** | L'alternative d'une image porteuse d'information est-elle pertinente ? | E2 | H2 | Réutiliser l'annexe Images, montrer image, contexte et alternative côte à côte. |
| **25** | **5.1** | Chaque tableau de données complexe a-t-il un résumé ? | E2 | H2 | Classer simple/complexe par heuristique et inventorier les mécanismes de résumé possibles. |
| **26** | **5.2** | Le résumé d'un tableau de données complexe est-il pertinent ? | E2 | H2 | Afficher tableau, structure d'en-têtes et résumé pour comparaison humaine. |
| **27** | **5.3** | Le contenu linéarisé d'un tableau de mise en forme reste-t-il compréhensible ? | E2 | H2 | Fournir une vue linéarisée sans CSS et l'ordre DOM. |
| **28** | **5.5** | Le titre d'un tableau de données est-il pertinent ? | E1 | H2 | Présenter `caption`/nom accessible et aperçu du tableau. |
| **29** | **5.7** | Chaque cellule est-elle associée à ses en-têtes par la technique appropriée ? | E2 | H2 | Construire une matrice cellule → en-têtes avec `scope`, `headers`/`id` et règles axe liées. |
| **30** | **8.7** | Chaque changement de langue est-il indiqué dans le code source ? | E2 | H2 | Lister les passages avec `lang` et signaler par heuristique les changements probables non balisés. |
| **31** | **8.10** | Les changements de sens de lecture sont-ils signalés ? | E2 | H2 | Inventorier `dir`, texte bidirectionnel et styles `direction`/`unicode-bidi`. |
| **32** | **9.2** | La structure du document est-elle cohérente ? | E2 | H2 | Afficher l'arbre sémantique des régions, sections, en-tête, contenu principal et pied de page. |
| **33** | **9.4** | Chaque citation est-elle correctement indiquée ? | E2 | H2 | Inventorier `q`, `blockquote`, `cite` et guillemets textuels probables. |
| **34** | **10.2** | Le contenu visible porteur d'information reste-t-il présent sans CSS ? | E2 | H2 | Comparer inventaires et captures avec/sans feuilles de styles. |
| **35** | **10.3** | L'information reste-t-elle compréhensible sans CSS ? | E2 | H2 | Produire une vue sans CSS et une comparaison de l'ordre de lecture. |
| **36** | **10.4** | Le texte reste-t-il lisible à un zoom d'au moins 200 % ? | E2 | H1 | Scénario Playwright à 200 %, détection de texte tronqué/chevauché et captures. |
| **37** | **10.7** | La prise de focus est-elle visible ? | E2 | H1 | Tabuler automatiquement et comparer l'apparence avant/après focus. |
| **38** | **10.8** | Les contenus cachés ont-ils vocation à être ignorés des technologies d'assistance ? | E2 | H2 | Inventorier contenu masqué, `aria-hidden`, `hidden`, `inert` et éléments focusables cachés. |
| **39** | **10.11** | Le contenu s'adapte-t-il à 320 px sans perte ni double défilement ? | E2 | H1 | Tester viewport 320 × 256, détecter les débordements et fournir des captures. |
| **40** | **11.2** | Chaque étiquette de champ est-elle pertinente ? | E2 | H2 | Afficher champ, nom accessible, étiquette visible, type et contexte. |
| **41** | **11.4** | Chaque étiquette et son champ sont-ils accolés ? | E2 | H1 | Mesurer la proximité visuelle et l'ordre DOM ; faire confirmer les cas ambigus. |
| **42** | **11.5** | Les champs de même nature sont-ils regroupés si nécessaire ? | E2 | H2 | Regrouper visuellement les radios, cases et champs apparentés ; signaler l'absence de `fieldset`. |
| **43** | **11.7** | La légende d'un regroupement de champs est-elle pertinente ? | E1 | H2 | Présenter `legend`, champs et contexte dans l'annexe Formulaires. |
| **44** | **11.8** | Les items de même nature d'une liste de choix sont-ils regroupés pertinemment ? | E2 | H2 | Inventorier `select`, `optgroup` et listes personnalisées. |
| **45** | **11.9** | L'intitulé de chaque bouton est-il pertinent ? | E2 | H2 | Mapper les règles de nom des boutons et comparer libellé visible, nom accessible et action. |
| **46** | **12.8** | L'ordre de tabulation est-il cohérent ? | E2 | H2 | Enregistrer l'ordre réel, `tabindex`, position visuelle et capture numérotée. |
| **47** | **13.5** | Chaque contenu cryptique a-t-il une alternative ? | E2 | H2 | Détecter émoticônes, art ASCII et syntaxes suspectes ; afficher `title` et contexte adjacent. |
| **48** | **10.14** | Les contenus additionnels créés uniquement en CSS sont-ils accessibles au clavier et au pointeur ? | E3 | H2 | Relever `:hover`/`:focus`, pseudo-éléments et reproduire les états clavier/pointeur. |
| **49** | **13.8** | Chaque contenu en mouvement ou clignotant est-il contrôlable ? | E2 | H2 | Inventorier animations, carrousels, `marquee`/`blink` et mécanismes pause/arrêt/masquage. |
| **50** | **4.10** | Chaque son déclenché automatiquement est-il contrôlable ? | E2 | H2 | Mapper `no-autoplay-audio`, détecter l'autoplay et localiser le contrôle d'arrêt/volume. |

## Lot 3 — parcours, formulaires et comparaisons

Ordre 51 à 67. Avant ce lot, créer une abstraction de **scénario de test** capable de conserver plusieurs états d'une page et une abstraction de **preuve inter-pages**.

| Ordre | Critère | Objet du critère (résumé) | Difficulté | Humain | Première tranche utile |
|---:|---|---|---|---|---|
| **51** | **11.3** | Les étiquettes répétées de champs ayant la même fonction sont-elles cohérentes ? | E3 | H2 | Comparer noms accessibles et fonctions sur toutes les pages de l'échantillon. |
| **52** | **12.1** | Chaque ensemble de pages possède-t-il au moins deux systèmes de navigation ? | E3 | H2 | Détecter menu, plan du site et recherche à l'échelle de l'audit. |
| **53** | **12.2** | Menus et barres de navigation restent-ils à la même place ? | E3 | H2 | Comparer landmarks, sélecteurs stables et géométrie entre pages. |
| **54** | **12.3** | La page « plan du site » est-elle pertinente ? | E3 | H2 | Identifier la page, extraire sa couverture et laisser juger organisation/pertinence. |
| **55** | **12.4** | Le plan du site est-il accessible par une fonctionnalité identique ? | E3 | H1 | Comparer intitulé, destination et position du mécanisme entre pages. |
| **56** | **12.5** | Le moteur de recherche est-il atteignable de manière identique ? | E3 | H1 | Identifier les formulaires de recherche et comparer leur accès entre pages. |
| **57** | **7.4** | L'utilisateur est-il averti ou maître des changements de contexte initiés par un script ? | E3 | H2 | Instrumenter clic, focus, saisie et navigation pour journaliser les changements de contexte. |
| **58** | **7.5** | Les messages de statut sont-ils correctement restitués ? | E2 | H2 | Inventorier live regions/rôles de statut et observer les mutations après actions. |
| **59** | **10.13** | Les contenus apparaissant au focus ou au survol sont-ils contrôlables ? | E3 | H2 | Tester masquage, survol possible et persistance sur tooltip, menu et popover. |
| **60** | **12.11** | Les contenus additionnels sont-ils, si nécessaire, atteignables au clavier ? | E3 | H2 | Ouvrir chaque contenu additionnel et tester ordre de focus et accès aux contrôles. |
| **61** | **13.2** | Une nouvelle fenêtre n'est-elle ouverte qu'après une action utilisateur ? | E3 | H2 | Instrumenter `window.open`, popups et navigations automatiques pendant un scénario. |
| **62** | **11.10** | Le contrôle de saisie est-il utilisé de manière pertinente ? | E3 | H3 | Soumettre des valeurs invalides/vides et rassembler obligatoire, format, erreur et association. |
| **63** | **11.11** | Le contrôle de saisie fournit-il les suggestions nécessaires à la correction ? | E3 | H3 | Rejouer les erreurs et présenter messages, suggestions et associations au champ. |
| **64** | **11.12** | Les données sensibles saisies peuvent-elles être modifiées, vérifiées ou récupérées ? | E3 | H3 | Définir des scénarios métier configurables ; conserver une validation humaine explicite. |
| **65** | **13.1** | L'utilisateur contrôle-t-il chaque limite de temps ? | E3 | H3 | Détecter minuteries, refresh et expiration ; tester prolongation, suppression ou adaptation. |
| **66** | **13.6** | L'alternative d'un contenu cryptique est-elle pertinente ? | E2 | H3 | Réutiliser l'inventaire 13.5 et demander une appréciation éditoriale. |
| **67** | **4.7** | Chaque média temporel est-il clairement identifiable ? | E2 | H2 | Créer l'annexe Médias avec lecteur, titre, contexte, type et durée. |

## Lot 4 — interactions complexes et expertise

Ordre 68 à 80. Ici l'automatisation doit surtout exécuter et documenter le protocole ; elle ne remplace pas l'expertise.

| Ordre | Critère | Objet du critère (résumé) | Difficulté | Humain | Première tranche utile |
|---:|---|---|---|---|---|
| **68** | **7.3** | Chaque script est-il contrôlable au clavier et par tout dispositif de pointage ? | E3 | H3 | Générer un parcours clavier guidé par composant et permettre la saisie d'un verdict. |
| **69** | **12.9** | La navigation est-elle dépourvue de piège au clavier ? | E3 | H3 | Journaliser le cycle de focus, détecter les boucles probables et faire confirmer au clavier. |
| **70** | **13.10** | Un geste complexe possède-t-il une alternative par geste simple ? | E4 | H3 | Inventorier événements tactiles/pointeur et fournir un protocole manuel sur appareil. |
| **71** | **13.11** | Une action sur point unique peut-elle être annulée ? | E4 | H3 | Instrumenter `pointerdown`/`mousedown` et vérifier annulation ou déclenchement à la relâche. |
| **72** | **13.12** | Une fonction déclenchée par mouvement possède-t-elle une alternative ? | E4 | H3 | Détecter API de capteurs/mouvement et guider un essai sur appareil compatible. |
| **73** | **4.11** | La consultation d'un média temporel est-elle contrôlable au clavier et au pointeur ? | E3 | H3 | Exécuter la grille clavier sur les lecteurs natifs et personnalisés. |
| **74** | **4.12** | La consultation d'un média non temporel est-elle contrôlable au clavier et au pointeur ? | E3 | H3 | Appliquer la même grille aux cartes, animations et objets interactifs. |
| **75** | **4.13** | Les médias sont-ils compatibles avec les technologies d'assistance ? | E4 | H3 | Capturer nom/rôle/état puis fournir le protocole lecteur d'écran de la base de référence. |
| **76** | **3.1** | L'information n'est-elle pas donnée uniquement par la couleur ? | E3 | H3 | Produire captures, palette et simulation sans couleur ; décision humaine sur le sens. |
| **77** | **10.9** | L'information n'est-elle pas donnée uniquement par la forme, la taille ou la position ? | E3 | H3 | Inventorier formulations et repères visuels probables, puis revue éditoriale. |
| **78** | **10.10** | L'usage de forme, taille ou position est-il implémenté de façon pertinente ? | E3 | H3 | Réutiliser 10.9 et comparer les alternatives textuelles présentes. |
| **79** | **13.7** | Les changements brusques de luminosité et effets de flash sont-ils correctement utilisés ? | E4 | H3 | Prévoir une analyse de fréquence/luminance des médias et animations, avec contrôle expert. |
| **80** | **7.2** | L'alternative à un script est-elle pertinente ? | E3 | H3 | Inventorier `noscript` et parcours alternatifs, puis comparer information et fonctionnalité. |

## Lot 5 — contenus spécialisés, médias et documents

Ordre 81 à 95. Ce lot arrive en dernier car ajouter seulement une ligne manuelle au mapping gonflerait artificiellement la couverture. Il faut d'abord disposer d'annexes spécialisées et de protocoles de preuve adaptés.

| Ordre | Critère | Objet du critère (résumé) | Difficulté | Humain | Première tranche utile |
|---:|---|---|---|---|---|
| **81** | **1.4** | L'alternative d'une image CAPTCHA ou image-test en indique-t-elle la nature et la fonction ? | E3 | H2 | Détecter les CAPTCHA probables et afficher alternative, contexte et fonction. |
| **82** | **1.5** | Une solution alternative au CAPTCHA est-elle présente ? | E3 | H3 | Inventorier les modalités proposées et laisser tester leur équivalence/accessibilité. |
| **83** | **1.6** | Chaque image porteuse d'information a-t-elle, si nécessaire, une description détaillée ? | E3 | H3 | Ajouter repérage des images complexes et mécanismes de description longue. |
| **84** | **1.7** | La description détaillée d'une image est-elle pertinente ? | E3 | H3 | Afficher image, contexte et description complète pour comparaison experte. |
| **85** | **1.8** | Une image-texte est-elle remplacée, si possible, par du texte stylé ? | E4 | H3 | Ajouter OCR/détection d'image-texte et revue des logos/cas particuliers. |
| **86** | **4.8** | Chaque média non temporel possède-t-il, si nécessaire, une alternative ? | E3 | H3 | Inventorier objets/canvas/animations et leurs alternatives. |
| **87** | **4.9** | L'alternative d'un média non temporel est-elle pertinente ? | E3 | H3 | Comparer média, fonction, contenu et alternative dans l'annexe Médias. |
| **88** | **4.1** | Chaque média pré-enregistré possède-t-il la transcription ou l'audiodescription nécessaire ? | E4 | H3 | Détecter pistes et liens de transcription ; faire qualifier le besoin par un humain. |
| **89** | **4.2** | La transcription ou l'audiodescription d'un média est-elle pertinente ? | E4 | H3 | Extraire et présenter la transcription/piste pour écoute et comparaison experte. |
| **90** | **4.3** | Chaque média synchronisé pré-enregistré possède-t-il les sous-titres nécessaires ? | E3 | H3 | Inventorier pistes `track`, sous-titres incrustés et versions alternatives. |
| **91** | **4.4** | Les sous-titres synchronisés sont-ils pertinents ? | E4 | H3 | Fournir lecture, extraction des cues et grille de synchronisation/identification des locuteurs. |
| **92** | **4.5** | Chaque média pré-enregistré possède-t-il l'audiodescription nécessaire ? | E4 | H3 | Inventorier pistes/versions et faire qualifier les informations visuelles nécessaires. |
| **93** | **4.6** | L'audiodescription synchronisée est-elle pertinente ? | E4 | H3 | Fournir écoute synchronisée et protocole expert. |
| **94** | **13.3** | Chaque document bureautique possède-t-il, si nécessaire, une version accessible ? | E4 | H3 | Inventorier téléchargements, formats, date/exemption et lancer les vérificateurs adaptés. |
| **95** | **13.4** | La version accessible d'un document offre-t-elle la même information ? | E4 | H3 | Comparer document source et version accessible ; verdict humain obligatoire. |

## Architecture recommandée avant d'élargir le mapping

Les lots deviennent nettement plus simples si les ajouts sont organisés autour de cinq briques réutilisables :

1. **Registre complet des 106 critères** : métadonnées officielles séparées de la couverture effective du moteur.
2. **Collecteurs par famille d'objets** : cadres, tableaux, formulaires, landmarks, médias, téléchargements et contenus cachés.
3. **Scénarios d'états** : sans CSS, zoom 200 %, largeur 320 px, espacement forcé, clavier, focus, survol et soumission de formulaire.
4. **Analyse inter-pages** : cohérence des titres, étiquettes, menus, recherche, plan du site et position des navigations.
5. **Annexes de preuve** : une file de revue par élément avec contexte, capture, signal machine, protocole et décision humaine.

## Définition de fini pour un nouveau critère

Un critère ne devrait passer à « intégré » que si les éléments suivants existent :

- titre officiel et identifiant RGAA 4.1.2 ;
- liste précise des tests RGAA couverts et non couverts ;
- stratégie machine (`violation certaine`, `à vérifier`, `preuve seulement`, `manuel`) ;
- collecteur ou règle axe testés sur des fixtures conformes, non conformes et non applicables ;
- présentation des preuves dans l'interface et dans le rapport ;
- possibilité de choisir conforme, non conforme, non applicable ou non testé ;
- limites connues visibles par l'auditeur ;
- aucun « conforme » automatique si la couverture du critère est partielle.

## Premier incrément concret conseillé

Le prochain incrément devrait implémenter ensemble **5.8, 8.2, 10.1, 10.5, 11.6 et 12.6**. Ils couvrent plusieurs thématiques, exploitent des règles axe/DOM déjà disponibles et réutilisent le modèle de couverture canonique sans nécessiter tout de suite les scénarios complexes des lots 3 et 4.

Une fois ce socle validé, poursuivre strictement l'ordre des lots, mais traiter dans une même branche les critères partageant un collecteur : **5.x tableaux**, **11.x formulaires**, **12.x navigation**, puis **4.x médias**.

## Point de vigilance sur la version du référentiel

Le site officiel annonce une publication du RGAA 5 prévue fin 2026. Cette feuille de route reste volontairement basée sur le RGAA 4.1.2, qui est la cible déclarée du projet. Lors de la publication effective du RGAA 5, comparer les identifiants, critères et méthodes avant de poursuivre les lots non commencés, sans supposer que la numérotation restera identique.
