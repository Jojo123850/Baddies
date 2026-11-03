/** @module middlewares/authMiddleware */

const jwt = require('jsonwebtoken')
const { pool } = require('../config/db')

/**
 * Vérifie le JWT et l’existence du compte avant d’appeler next.
 * @memberof module:middlewares/authMiddleware
 * @static
 * @param {Object} req Requête Express.
 * @param {Object} res Réponse Express.
 * @param {Function} next Middleware suivant.
 * @returns {Promise<*>} Résultat ou réponse HTTP selon la couche.
 */
const authMiddleware = async (req, res, next) => {
  try {
    let token

    // 1. Récupérer le token dans Authorization
    const authorization = req.headers.authorization

    if (authorization && authorization.startsWith('Bearer ')) {
      token = authorization.split(' ')[1]
    }

    // 2. Vérifier la présence du token
    if (!token) {
      return res.status(401).json({
        title: 'Authentification requise',
        status: 401,
        detail: 'Accès non autorisé, token manquant.'
      })
    }

    // 3. Vérifier le JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // 4. Vérifier que decoded.id est un BIGINT positif valide
    const userId = decoded.id

    const validId =
      (typeof userId === 'string' &&
        /^[1-9]\d*$/.test(userId) &&
        BigInt(userId) <= 9223372036854775807n) ||
      (typeof userId === 'number' &&
        Number.isSafeInteger(userId) &&
        userId > 0)

    if (!validId) {
      return res.status(401).json({
        title: 'Token invalide',
        status: 401,
        detail: "Le token contient un identifiant utilisateur invalide."
      })
    }

    // 5. Vérifier que l'utilisateur existe dans PostgreSQL
    const queryText = `
      SELECT id, email, pseudo, avatar_url
      FROM "Users"
      WHERE id = $1
    `

    const result = await pool.query(queryText, [userId])

    if (result.rows.length === 0) {
      return res.status(401).json({
        title: 'Utilisateur introuvable',
        status: 401,
        detail: "L'utilisateur associé au token n'existe plus."
      })
    }

    // 6. Ajouter l'utilisateur à la requête
    req.user = result.rows[0]

    // 7. Autoriser l'accès
    return next()

  } catch (error) {
    // JWT expiré
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        title: 'Token expiré',
        status: 401,
        detail: 'Votre session a expiré. Veuillez vous reconnecter.'
      })
    }

    // JWT invalide ou mauvaise signature
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'NotBeforeError'
    ) {
      return res.status(401).json({
        title: 'Token invalide',
        status: 401,
        detail: "Le token d'authentification est invalide."
      })
    }

    // Erreur inattendue ou PostgreSQL
    console.error('Erreur authMiddleware :', error)

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: "Impossible de vérifier l'authentification."
    })
  }
}

module.exports = authMiddleware
