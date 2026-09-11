# RGAAudit

Application web open-source d’aide à l’audit d’accessibilité selon le **RGAA 4.1.2**. RGAAudit préanalyse les pages, rassemble les preuves utiles et laisse toujours la décision finale à l’auditeur.

## Principe

L’application sépare volontairement deux informations :

- la **suggestion machine** : anomalie probable, à vérifier, aucune anomalie détectée ;
- la **décision humaine** : non vérifié, conforme, non conforme, non applicable.

Le vert ne signifie donc jamais qu’un critère est automatiquement déclaré conforme.

## Lancement avec Docker

Prérequis : Docker avec le plugin Compose.

```bash
docker compose up --build -d
```

L’application est ensuite disponible sur `http://localhost:3000`. Les audits et les validations sont conservés dans le volume Docker `rgaaudit-data`.

Pour utiliser un autre port :

```bash
RGAAUDIT_PORT=8080 docker compose up --build -d
```

Commandes utiles :

```bash
docker compose logs -f app
docker compose ps
docker compose down
```

`docker compose down` conserve les données. L’option `-v` supprime aussi le volume et doit donc être utilisée avec prudence.

## Architecture

Le produit reste un **monolithe modulaire**, simple à exploiter :

```text
packages/
├── core/       moteur d’analyse, mapping RGAA/WCAG et rapports
├── server/     API Express, orchestration et dépôt de données JSON
├── web/        interface React de préanalyse et validation humaine
└── cli/        lancement local historique
```

Le dépôt `AuditRepository` isole la persistance du reste de l’application. La V1 utilise des fichiers JSON atomiques ; une base SQLite ou PostgreSQL pourra le remplacer sans réécrire le moteur ni l’interface.

La table de correspondance stocke déjà les critères WCAG liés aux critères RGAA pour permettre de futurs exports.

## Couverture et limites

Le mapping actuel prépare **11 critères sur les 106** du RGAA. Certains restent entièrement manuels ; le taux de couverture fonctionnelle est donc d’environ **10,4 %**, pas 25 %.

L’analyse combine axe-core, des collecteurs dédiés aux images, liens et titres, et quelques heuristiques Playwright. Elle ne remplace pas un audit RGAA complet et ne produit pas seule un taux de conformité opposable.

## Développement

```bash
npm ci
npm run dev
```

Ou dans le conteneur de développement :

```bash
docker compose --profile dev run --rm --service-ports dev
```

Vérifications :

```bash
npm test
npm run build
npx tsc --noEmit -p tsconfig.json
npm run test:e2e
```

## Configuration serveur

| Variable | Défaut | Usage |
|---|---:|---|
| `PORT` | `3000` dans Docker | Port HTTP |
| `RGAAUDIT_DATA_DIR` | `/data` dans Docker | Répertoire persistant |
| `AUDIT_MAX_URLS` | `50` | Pages maximum par audit |
| `AUDIT_MAX_CONCURRENT` | `2` | Pages analysées en parallèle |
| `AUDIT_MAX_RUNNING` | `1` | Audits globaux simultanés |
| `CORS_ORIGIN` | vide | Origine front autorisée si séparée |

## Licence

MIT
