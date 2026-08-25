const jwt = require('jsonwebtoken')
const { pool } = require('../config/db')

const authMiddleware = async (req, res, next) => {
  try {
    let token

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({ message: 'Accès non autorisé, token manquant.' })
    }

  
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

  
    const queryText = 'SELECT id, email, pseudo, avatar_url FROM "Users" WHERE id = $1'
    const result = await pool.query(queryText, [decoded.id])

    // Si l'utilisateur a été supprimé entre-temps de la BDD
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "L'utilisateur n'existe plus." })
    }

    // 4. Injecter les données de l'utilisateur dans l'objet req pour la suite
    req.user = result.rows[0]

  
    next()
  } catch (err) {
    return res.status(401).json({
      message: 'Token invalide ou expiré.',
      error: err.message
    })
  }
}


module.exports = authMiddleware