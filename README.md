# RGAAudit

Outil open-source **local-first** d'aide à l'audit d'accessibilité web selon le référentiel **RGAA 4.1** français.

RGAAudit tourne entièrement sur votre machine — aucune donnée ne quitte votre ordinateur.

## Prérequis

- **Node.js** v20 ou supérieur
- **npm** v9 ou supérieur

## Installation et lancement

```bash
npx rgaaudit
```

Le navigateur s'ouvre automatiquement sur `http://localhost:3000`.

### Options

```
-p, --port <port>     Port du serveur (défaut : 3000)
--max-pages <n>       Nombre max de pages par audit (défaut : 50)
--no-open             Ne pas ouvrir le navigateur automatiquement
-h, --help            Afficher l'aide
```

## Comment ça marche

1. Entrez l'URL d'un site web
2. RGAAudit découvre les pages via le `sitemap.xml`
3. Sélectionnez les pages à auditer
4. L'audit lance axe-core sur chaque page via Playwright
5. Les résultats sont mappés sur les critères RGAA 4.1
6. Consultez le rapport interactif avec les annexes filtrables

## Ce que l'outil fait

- Découvre les pages d'un site via `sitemap.xml`
- Lance axe-core sur chaque page via un navigateur headless
- Mappe les résultats sur les critères RGAA 4.1
- Génère un rapport HTML interactif avec annexes (images, liens, titres)
- Permet à l'auditeur humain de prendre ses décisions dans les annexes

## Couverture RGAA

RGAAudit couvre actuellement **11 critères** sur les 106 du RGAA 4.1, répartis sur **5 thématiques** :

| Thématique | Critères | Détail |
|---|---|---|
| Images | 1.1, 1.2 | Alternative textuelle (présence, pertinence, décoration) |
| Couleurs | 3.2, 3.3 | Contrastes texte/fond (ratio 4.5:1 et 3:1 composants UI) |
| Liens | 6.1, 6.2 | Liens explicites, intitulés vides/génériques/dupliqués, nouvelle fenêtre |
| Éléments obligatoires | 8.5, 8.6 | Titre de page (présence et pertinence) |
| Structuration | 9.1 | Hiérarchie des titres (sauts de niveau, h1 absent/multiple) |

Les **8 thématiques restantes** (Cadres, Multimédia, Tableaux, Scripts, Présentation, Formulaires, Navigation, Consultation) génèrent une checklist manuelle dans le rapport.

L'outil utilise deux moteurs d'analyse complémentaires :
- **axe-core** — détection automatisée des violations WCAG via Playwright
- **Heuristiques custom** — analyse Playwright complémentaire pour les patterns qu'axe-core ne couvre pas (liens factices, éléments interactifs simulés, etc.)

## Ce que l'outil ne fait PAS

- Il ne remplace pas un auditeur humain
- Il ne couvre pas 100 % des critères RGAA (MVP : environ 25 %)
- Il n'envoie aucune donnée à un serveur externe
- Il ne modifie rien sur le site audité

## Développement

```bash
git clone <repo-url>
cd rgaaudit
npm install
npm run dev
```

### Tests

```bash
# Tous les tests unitaires et d'intégration
npm test

# Tests d'un package spécifique
npm test --workspace=packages/core
npm test --workspace=packages/server
npm test --workspace=packages/web
npm test --workspace=packages/cli

# Tests end-to-end (Playwright)
npm run test:e2e

# Couverture
npm run test:coverage
```

### Structure du projet

```
rgaaudit/
├── packages/
│   ├── core/       — Moteur d'audit (crawl, axe-core, mapping, rapport)
│   ├── server/     — Serveur Express local (API + SSE)
│   ├── web/        — Interface React (Vite + Tailwind CSS)
│   └── cli/        — Point d'entrée CLI (npx rgaaudit)
└── e2e/            — Tests end-to-end (Playwright Test)
```

## Licence

MIT
