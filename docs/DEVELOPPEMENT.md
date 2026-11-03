# Tests et documentation du backend

## Tests sans PostgreSQL ni email réel

Avec Node 22.13+ et les dépendances de développement installées :

```sh
npm ci
npm run test:unit
npm run test:coverage:unit
```

Cette suite charge les vrais fichiers sources et remplace les dépendances PostgreSQL, Brevo, bcrypt ou JWT selon le scénario. Elle vérifie les erreurs serveur, les transactions (COMMIT, ROLLBACK, libération du client), les validations et les réponses HTTP. Les tests HTTP Swagger utilisent un serveur local sur un port temporaire. Ils n'appellent pas les services de production.

Le rapport de couverture concerne uniquement les fichiers chargés par cette suite. Une couverture de lignes élevée ne prouve pas la disponibilité d'une base réelle, la livraison d'un email ni la validité de tous les scénarios métier.

Les tests d'intégration existants restent accessibles avec `npm test`. Ils écrivent et suppriment des données : utiliser exclusivement une base dédiée et ses variables d'environnement de test. Ils ne sont pas exécutés automatiquement par `test:unit`.

## Swagger / OpenAPI

Le contrat de toutes les routes métier est dans `docs/openapi.json` (OpenAPI 3.0.3). Il décrit les corps JSON, les réponses, les identifiants UUID et l'authentification Bearer JWT. Les tests comparent les routes Express au contrat.

```sh
npm run docs:validate
```

Pour afficher Swagger UI localement, définir `ENABLE_API_DOCS=true` dans `.env`, démarrer l'API avec `npm start`, puis ouvrir :

- `http://localhost:3001/api-docs/` : documentation Swagger UI ;
- `http://localhost:3001/openapi.json` : contrat JSON.

Les deux routes restent absentes tant que la variable n'est pas exactement `true`. Les boutons d'exécution des requêtes sont désactivés pour éviter les modifications de comptes ou d'historiques depuis la documentation. Aucun jeton n'est persisté dans Swagger UI. Aucune activation sur Render n'est nécessaire pour lire le contrat localement.

Les schémas `evaluation` et `solutions` restent volontairement ouverts : le backend actuel vérifie leur présence mais ne leur applique pas de schéma métier détaillé. OpenAPI ne renforce pas à lui seul la validation du serveur.

## JSDoc

```sh
npm run docs:jsdoc
```

Ouvrir `docs/generated/index.html`. Les pages générées sont ignorées par Git et peuvent être recréées depuis les commentaires et `jsdoc.json`. Les commentaires décrivent les responsabilités des contrôleurs, modèles, middlewares, services de connexion et d'email.

## Publication

Ces ajouts n'exigent aucune migration de base. Installer les nouvelles dépendances avant le démarrage. Laisser `ENABLE_API_DOCS` absent en production si l'on ne souhaite pas y servir la documentation. Les fonctionnalités de connexion et de récupération du mot de passe conservent leur comportement actuel.
