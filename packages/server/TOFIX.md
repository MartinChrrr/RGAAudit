# Server — Points restants

## P1

### SSEManager multi-clients par session
`sse/progress.ts` stocke un seul client par `sessionId`. Si le front se reconnecte ou si l'utilisateur ouvre 2 onglets, l'ancien client est silencieusement remplacé. Passer la Map à `Map<string, Set<Response>>`.

### Logger structuré + log dans errorHandler
Aucun log côté serveur (ni audits lancés, ni erreurs, ni PDF générés). Ajouter un logger minimal (pino ou wrapper console avec niveaux). Le middleware `errorHandler` doit logger la stack en dev et le message en prod, sans exposer la stack au client.

### Abstraction session store (interface + list/delete)
`session.store.ts` ne sait que charger une session par ID. Ajouter :
- `listSessions()` — historique des audits
- `deleteSession(id)` — nettoyage
- Interface `SessionStore` pour pouvoir switcher vers SQLite ou autre plus tard

## P2

### Système d'extracteurs d'annexes par thème
Le socle `packages/core/report/extractors.ts` fournit désormais un contrat versionné, un plafond d'éléments et un indicateur de troncature. Le registre doit être étendu aux prochaines annexes (tableaux, formulaires, navigation) au fil des stories, sans contourner cette limite ni la redaction serveur.

### Version injectée au build plutôt que readFileSync
`report.service.ts` lit `package.json` avec `readFileSync` + `import.meta.url` au boot. Fragile si on déplace le fichier. Préférer une constante injectée au build (define plugin Vite/esbuild) ou un simple `export const VERSION = '0.1.0'` dans `config.ts`.
