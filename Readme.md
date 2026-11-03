# BADDIES  backend

API REST du projet BADDIES, utilisée par le frontend pour l’authentification, la gestion du profil et l’historique des évaluations des douleurs menstruelles.

- [Frontend en ligne](https://baddies-beryl.vercel.app)
- [API hébergée sur Render](https://baddies-api.onrender.com)
- [Dépôt backend](https://github.com/Jojo123850/Baddies)
- [Dépôt frontend](https://github.com/Jojo123850/BaddiesFront)

## Technologies et fonctionnalités

Node.js, Express 5, PostgreSQL avec `pg`, JWT, bcrypt, validation Zod, Helmet, CORS et limitation de débit avec express-rate-limit. Les emails de réinitialisation sont envoyés via Brevo.

L’API gère l’inscription, la connexion, les jetons d’accès et leur renouvellement, la déconnexion, la récupération du mot de passe, la modification du profil et les opérations sur l’historique du compte. Les requêtes SQL utilisent des paramètres ; les routes privées vérifient le jeton et les historiques sont filtrés par utilisateur.

## Installation

Utiliser une version maintenue de Node.js compatible avec les dépendances (Node 22.13+ convient au projet), npm et une instance PostgreSQL accessible.

```bash
git clone https://github.com/Jojo123850/Baddies.git
cd Baddies
npm ci
```

Créer un fichier `.env` à la racine :

```dotenv
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=REMPLACER_PAR_UN_SECRET_ALEATOIRE_LONG
BREVO_API_KEY=REMPLACER_PAR_LA_CLE_BREVO
BREVO_SENDER=expediteur@example.com
NODE_ENV=development
```

Ne jamais publier les valeurs réelles. `.env` est ignoré par Git. `DATABASE_URL` doit utiliser les paramètres de connexion et TLS exigés par le fournisseur PostgreSQL ; la configuration actuelle de `pg` est dans `config/db.js`.

| Variable | Rôle |
| --- | --- |
| `PORT` | Port d’écoute ; valeur par défaut `3001`, fourni par Render sur le service déployé. |
| `DATABASE_URL` | Connexion PostgreSQL. |
| `JWT_SECRET` | Signature et vérification des jetons JWT. |
| `BREVO_API_KEY` | Accès à l’API d’envoi d’emails Brevo. |
| `BREVO_SENDER` | Expéditeur à configurer et autoriser dans Brevo. |
| `NODE_ENV` | Environnement d’exécution. Le code d’envoi d’emails ignore les envois pour la valeur particulière `baddies`. |

### Base de données

Le dépôt ne contient actuellement ni migration SQL ni script de création du schéma. Lancer le serveur ne crée pas les tables. Il faut provisionner un schéma compatible avec les modèles avant d’utiliser les fonctions de compte.

Les modèles utilisent les tables sensibles à la casse `"Users"`, `"History"`, `"Password_reset_tokens"` et `"Refresh_tokens"`. Le détail des colonnes et des requêtes se trouve dans `models/userModel.js` et `models/historyModel.js`. Obtenir le schéma de référence du projet plutôt que recréer une base de production approximative.

## Démarrer le serveur

```bash
npm start
```

L’API locale écoute par défaut sur `http://localhost:3001`. Le frontend est un projet séparé : son URL d’API est définie dans `src/services/apiService.ts` du dépôt frontend.

## Routes

| Méthode | Route | Accès / fonction |
| --- | --- | --- |
| GET | `/` | Message d’accueil public. |
| GET | `/health` | Réponse `200 OK` du processus HTTP. |
| POST | `/api/v1/auth/register` | Inscription : email, password, pseudo. |
| POST | `/api/v1/auth/login` | Connexion : email, password. |
| POST | `/api/v1/auth/refresh` | Renouvellement : token de renouvellement. |
| POST | `/api/v1/auth/logout` | Révocation du token de renouvellement transmis. |
| POST | `/api/v1/auth/forgotPassword` | Demande de réinitialisation par email. |
| POST | `/api/v1/auth/resetPassword` | Réinitialisation : token, newPassword. |
| PATCH | `/api/v1/user/profile` | Profil ; jeton d’accès requis. |
| POST | `/api/v1/history` | Enregistrement d’un historique ; jeton requis. |
| GET | `/api/v1/history` | Historiques du compte ; jeton requis. |
| GET | `/api/v1/history/:id` | Historique appartenant au compte ; jeton requis. |
| DELETE | `/api/v1/history/:id` | Suppression d’un historique du compte ; jeton requis. |

Les corps des requêtes sont envoyés en JSON avec `Content-Type: application/json`. Les routes protégées attendent `Authorization: Bearer <accessToken>`. Les formats et validations détaillés sont définis dans `schemas/`, `controllers/` et `middlewares/`.

L’access token expire après 15 minutes. Les refresh tokens sont hashés en base et renouvelés par rotation ; le front conserve les nouveaux jetons renvoyés. Le lien de réinitialisation envoyé par email pointe actuellement vers l’URL de production du frontend, définie dans `utils/mailSender.js`.

## Organisation

```text
app.js           Configuration Express, middlewares, routes et démarrage
config/          Connexion PostgreSQL
controllers/     Traitement des requêtes
models/          Accès aux données SQL
routes/          Déclaration des endpoints
middlewares/     Authentification et validation
schemas/         Schémas de validation Zod
utils/           Envoi d’emails
test/            Tests avec node:test
```

## CORS et limitation de débit

Dans `app.js`, les origines autorisées sont actuellement :

- `https://baddies-beryl.vercel.app`
- `https://baddies-api.onrender.com`

Une adresse Vercel de Preview ou un frontend sur `localhost` possède une autre origine et n’est pas autorisé par cette liste. Pour un environnement supplémentaire, ajouter son origine exacte à la configuration et redéployer le backend. Éviter d’autoriser toutes les origines pour résoudre une erreur sans identifier sa cause.

Le limiteur est configuré à 100 requêtes par adresse IP sur 15 minutes pour les routes placées après le middleware. CORS est placé avant le limiteur. Les routes `/` et `/health`, déclarées plus tôt, ne passent pas par ces middlewares. Les prérequêtes OPTIONS sont prises en charge par CORS.

## Déploiement sur Render

1. Créer un **Web Service** relié à ce dépôt.
2. Choisir le runtime Node et la branche à déployer.
3. Configurer **Build Command** : `npm ci`.
4. Configurer **Start Command** : `npm start`.
5. Renseigner les secrets dans **Environment** : `DATABASE_URL`, `JWT_SECRET`, `BREVO_API_KEY`, `BREVO_SENDER` ; utiliser `NODE_ENV=production`.
6. Configurer le chemin de contrôle HTTP sur `/health`.
7. Vérifier les logs de démarrage, la connexion PostgreSQL et l’accès depuis le frontend autorisé.

Render fournit le port ; le code utilise `process.env.PORT`. La disponibilité du serveur HTTP ne prouve pas celle de la base : `connectDB()` journalise les erreurs mais ne les propage pas, puis le serveur peut démarrer malgré une connexion PostgreSQL échouée.

Sur une offre gratuite, Render peut mettre le service en veille après 15 minutes sans trafic et le réveil peut prendre environ une minute. Les quotas et les éventuelles limites de la base restent applicables. Voir la [documentation des offres gratuites Render](https://render.com/docs/free) et les [contrôles de santé](https://render.com/docs/health-checks).

## Surveillance UptimeRobot

Pour surveiller la réponse HTTP de ce backend, utiliser un moniteur HTTP(S) ciblant :

```text
https://baddies-api.onrender.com/health
```

La réponse attendue est `200` avec `OK`. Le moniteur ne doit pas appeler les endpoints de connexion ou de création de compte et n’a pas besoin d’identifiants.

La fréquence, les alertes et l’historique des incidents se règlent dans UptimeRobot. Sa présence ne garantit ni la disponibilité PostgreSQL ni le bon fonctionnement de l’authentification : `/health` ne teste actuellement aucune dépendance. Un contrôle de disponibilité de la base nécessiterait une route ou une vérification supplémentaire.

## Tests

```bash
npm test
```

La commande utilise `node --test` malgré la présence de Jest dans les dépendances de développement. Plusieurs tests créent et suppriment des utilisateurs, historiques et tokens : les exécuter uniquement avec une **base de test dédiée**, jamais avec la base de production. Fournir un `JWT_SECRET` de test et la configuration nécessaire aux modules chargés ; éviter tout envoi réel d’email.

Pour les seules validations et le middleware de validation :

```bash
node --test test/authSchemas.test.js test/validateMiddleware.test.js
```


## Licence

`package.json` déclare la licence ISC. Le dépôt ne contient pas actuellement de fichier LICENSE détaillé. Le fichier `licences-frontend.csv`, malgré son nom, est aussi présent dans ce dépôt ; vérifier son contenu et les licences des dépendances avant toute réutilisation.


# Auteur
Giovanie ANDRIANIRINA