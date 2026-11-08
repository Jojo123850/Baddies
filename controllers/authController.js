/** @module controllers/authController */

const jwt = require('jsonwebtoken')
const validator = require('validator')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const userModel = require('../models/userModel')
const mailSender = require('../utils/mailSender')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '15m'


// Générer un access token JWT
/**
 * Signe un access token JWT valable 15 minutes.
 * @memberof module:controllers/authController
 * @static
 * @param {string|number} id id.
 * @returns {string} Jeton signé ou valeur aléatoire encodée en hexadécimal.
 */
const generateToken = (id) => {
  return jwt.sign(
    { id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}


// Générer un token aléatoire de 64 caractères hexadécimaux
/**
 * Génère un jeton aléatoire hexadécimal de 32 octets.
 * @memberof module:controllers/authController
 * @static
 * @returns {string} Jeton signé ou valeur aléatoire encodée en hexadécimal.
 */
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex')
}


/**
 * Génère un refresh token aléatoire hexadécimal de 32 octets.
 * @memberof module:controllers/authController
 * @static
 * @returns {string} Jeton signé ou valeur aléatoire encodée en hexadécimal.
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(32).toString('hex')
}


// Vérifier le format des tokens aléatoires
/**
 * Vérifie qu’un jeton contient 64 caractères hexadécimaux.
 * @memberof module:controllers/authController
 * @static
 * @param {string} token token.
 * @returns {boolean} Vrai uniquement pour un jeton hexadécimal de longueur attendue.
 */
const isTokenFormatValid = (token) => {
  return (
    typeof token === 'string' &&
    /^[a-f0-9]{64}$/i.test(token)
  )
}

// INSCRIPTION
/**
 * Crée un compte après validation Zod ; répond 201, 409 ou 500.
 * @memberof module:controllers/authController
 * @static
 * @param {Object} req Requête Express.
 * @param {Object} res Réponse Express.
 * @returns {Promise<Object>} Réponse HTTP Express.
 */
const register = async (req, res) => {
  try {
    // Les données sont validées par le middleware Zod
    const { email, password, pseudo } = req.body

    const existingUser =
      await userModel.findByEmailOrPseudo(email, pseudo)

    if (existingUser) {
      return res.status(409).json({
        title: 'Compte déjà existant',
        status: 409,
        detail: 'Cet email ou ce pseudo est déjà utilisé.'
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await userModel.createUser(
      email,
      hashedPassword,
      pseudo,
      null
    )

    const token = generateToken(user.id)

    return res.status(201).json({
      title: 'Inscription réussie',
      status: 201,
      detail: 'Votre compte a été créé avec succès.',
      token,
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        avatar_url: user.avatar_url
      }
    })
  } catch (error) {
    console.error("Erreur d'inscription :", error)
        return res.status(500).json({
          title: 'Erreur serveur',
          status: 500,
          detail: "Impossible de créer votre compte pour le moment."
        })
  }
}

// CONNEXION
/**
 * Vérifie les identifiants et crée une paire de jetons de session.
 * @memberof module:controllers/authController
 * @static
 * @param {Object} req Requête Express.
 * @param {Object} res Réponse Express.
 * @returns {Promise<Object>} Réponse HTTP Express.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await userModel.findByEmail(email)

    // Ne pas révéler si l'email existe
    if (!user) {
      return res.status(401).json({
        title: 'Authentification échouée',
        status: 401,
        detail: 'Email ou mot de passe incorrect.'
      })
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    )

    if (!isMatch) {
      return res.status(401).json({
        title: 'Authentification échouée',
        status: 401,
        detail: 'Email ou mot de passe incorrect.'
      })
    }

    // Générer un refresh token
    const refreshToken = generateRefreshToken()

 
    const tokenHash = await bcrypt.hash(refreshToken, 10)
    // 7j expirations
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    )

    await userModel.createRefreshToken(
      user.id,
      tokenHash,
      expiresAt
    )

    const accessToken = generateToken(user.id)

    return res.status(200).json({
      title: 'Connexion réussie',
      status: 200,
      detail: 'Vous êtes connecté avec succès.',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        avatar_url: user.avatar_url
      }
    })
  } catch (error) {
    console.error('Erreur login :', error)

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: 'Impossible de vous connecter pour le moment.'
    })
  }
}

// MOT DE PASSE OUBLIÉ
/**
 * Prépare un jeton et demande son envoi via Brevo, sans divulguer l’existence du compte dans la réponse de succès.
 * @memberof module:controllers/authController
 * @static
 * @param {Object} req Requête Express.
 * @param {Object} res Réponse Express.
 * @returns {Promise<Object>} Réponse HTTP Express.
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {}

    if (!email) {
      return res.status(400).json({
        title: 'Email manquant',
        status: 400,
        detail: "L'adresse email est obligatoire."
      })
    }

  const user = await userModel.findByEmail(email)

    // Même réponse pour un compte existant ou inconnu
    const successResponse = {
      title: 'Demande prise en compte',
      status: 200,
      detail: 'Si un compte correspond à cette adresse, un email de réinitialisation sera envoyé.'
    }

    if (!user) {
      return res.status(200).json(successResponse)
    }

    const token = generateResetToken()

    // Hasher le token de réinitialisation avec bcrypt
    const tokenHash = await bcrypt.hash(token, 10)

    const expiresAt = new Date(
      Date.now() + 60 * 60 * 1000
    )
    await userModel.createToken(
      user.id,
      tokenHash,
      expiresAt
    )
    // Envoyer uniquement le token brut par email
   await mailSender(email, user.pseudo, token)

    outcome = 'ok'
    return res.status(200).json(successResponse)
  } catch (error) {
    // La mesure indique l'étape en échec sans exposer les données de la requête.

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: 'Impossible de traiter la demande de réinitialisation.'
    })
  } 
}

// RÉINITIALISATION DU MOT DE PASSE
/**
 * Consomme un jeton de réinitialisation et remplace le mot de passe.
 * @memberof module:controllers/authController
 * @static
 * @param {Object} req Requête Express.
 * @param {Object} res Réponse Express.
 * @returns {Promise<Object>} Réponse HTTP Express.
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {}

    if (!token || !newPassword) {
      return res.status(400).json({
        title: 'Informations manquantes',
        status: 400,
        detail: 'Le token et le nouveau mot de passe sont obligatoires.'
      })
    }

    if (!isTokenFormatValid(token)) {
      return res.status(401).json({
        title: 'Token invalide',
        status: 401,
        detail: 'Le lien de réinitialisation est invalide ou expiré.'
      })
    }

    const isPasswordOk =
      typeof newPassword === 'string' &&
      validator.isStrongPassword(newPassword, {
        minLength: 6,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      })

    if (!isPasswordOk) {
      return res.status(400).json({
        title: 'Mot de passe trop faible',
        status: 400,
        detail: 'Le mot de passe doit contenir au moins 6 caractères, une minuscule, une majuscule, un chiffre et un symbole.'
      })
    }

    // Récupérer uniquement les tokens actifs
    const tokens = await userModel.findValidResetTokens()

    let matchingToken = null

    // Comparer les tokens avec bcrypt
    for (const savedToken of tokens) {
      const isMatch = await bcrypt.compare(
        token,
        savedToken.token_hash
      )

      if (isMatch) {
        matchingToken = savedToken
        break
      }
    }

    if (!matchingToken) {
      return res.status(401).json({
        title: 'Token invalide',
        status: 401,
        detail: 'Le lien de réinitialisation est invalide ou expiré.'
      })
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    )

    // Transaction PostgreSQL :
    // modifier le mot de passe et invalider les tokens
    const changed =
      await userModel.changePasswordAndClearToken(
        hashedPassword,
        matchingToken.user_id,
        matchingToken.id
      )

    if (!changed) {
      return res.status(401).json({
        title: 'Token invalide',
        status: 401,
        detail: 'Ce lien de réinitialisation a déjà été utilisé ou a expiré.'
      })
    }

    return res.status(200).json({
      title: 'Mot de passe modifié',
      status: 200,
      detail: 'Votre mot de passe a été modifié avec succès. Veuillez vous reconnecter.'
    })
  } catch (error) {
    console.error('Erreur resetPassword :', error)

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: 'Impossible de réinitialiser votre mot de passe.'
    })
  }
}

// RENOUVELLEMENT DU REFRESH TOKEN
/**
 * Vérifie un refresh token et réalise sa rotation.
 * @memberof module:controllers/authController
 * @static
 * @param {Object} req Requête Express.
 * @param {Object} res Réponse Express.
 * @returns {Promise<Object>} Réponse HTTP Express.
 */
const refreshTokens = async (req, res) => {
  try {
    const { token } = req.body || {}

    if (!token) {
      return res.status(400).json({
        title: 'Refresh token manquant',
        status: 400,
        detail: 'Un refresh token est nécessaire pour renouveler la session.'
      })
    }

    if (!isTokenFormatValid(token)) {
      return res.status(401).json({
        title: 'Session invalide',
        status: 401,
        detail: 'Le refresh token est invalide.'
      })
    }

    // Chercher les tokens non expirés et non révoqués
    const tokens = await userModel.findValidRefreshTokens()

    let matchingToken = null

    for (const savedToken of tokens) {
      const isMatch = await bcrypt.compare(
        token,
        savedToken.token_hash
      )

      if (isMatch) {
        matchingToken = savedToken
        break
      }
    }

    if (!matchingToken) {
      return res.status(401).json({
        title: 'Session invalide',
        status: 401,
        detail: 'Le refresh token est invalide ou expiré.'
      })
    }

    // Générer un nouveau refresh token
    const newRefreshToken = generateRefreshToken()

    const newTokenHash = await bcrypt.hash(
      newRefreshToken,
      10
    )

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    )

    // Rotation atomique en base de données
    const rotated = await userModel.rotateRefreshToken(
      matchingToken.id,
      matchingToken.user_id,
      newTokenHash,
      expiresAt
    )

    if (!rotated) {
      return res.status(401).json({
        title: 'Session invalide',
        status: 401,
        detail: 'Ce refresh token a déjà été utilisé ou a expiré.'
      })
    }

    const accessToken = generateToken(
      matchingToken.user_id
    )

    return res.status(200).json({
      title: 'Session renouvelée',
      status: 200,
      detail: 'Votre session a été renouvelée avec succès.',
      accessToken,
      refreshToken: newRefreshToken
    })
  } catch (error) {
    console.error('Erreur refreshTokens :', error)

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: 'Impossible de renouveler votre session.'
    })
  }
}

// MODIFICATION DU PROFIL
/**
 * Valide et modifie les champs du profil authentifié.
 * @memberof module:controllers/authController
 * @static
 * @param {Object} req Requête Express.
 * @param {Object} res Réponse Express.
 * @returns {Promise<Object>} Réponse HTTP Express.
 */
const updateProfile = async (req, res) => {
  try {
    const body = req.body

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        title: 'Données invalides',
        status: 400,
        detail: 'Les données du profil doivent être un objet valide.'
      })
    }

    const {
      email,
      password,
      pseudo,
      avatar_url
    } = body

    if (
      (email !== undefined && typeof email !== 'string') ||
      (pseudo !== undefined && typeof pseudo !== 'string') ||
      (avatar_url !== undefined && typeof avatar_url !== 'string') ||
      (password !== undefined && typeof password !== 'string')
    ) {
      return res.status(400).json({
        title: 'Format invalide',
        status: 400,
        detail: 'Un ou plusieurs champs ont un format invalide.'
      })
    }

    if (
      email === undefined &&
      pseudo === undefined &&
      avatar_url === undefined &&
      password === undefined
    ) {
      return res.status(400).json({
        title: 'Aucune modification',
        status: 400,
        detail: 'Vous devez fournir au moins un champ à modifier.'
      })
    }

    const cleanEmail =
      email === undefined ? null : email.trim()

    const cleanPseudo =
      pseudo === undefined ? null : pseudo.trim()

    if (
      cleanEmail !== null &&
      !validator.isEmail(cleanEmail)
    ) {
      return res.status(400).json({
        title: 'Email invalide',
        status: 400,
        detail: 'Vous devez utiliser une adresse email valide.'
      })
    }

    if (cleanPseudo !== null && !cleanPseudo) {
      return res.status(400).json({
        title: 'Pseudo invalide',
        status: 400,
        detail: 'Le pseudo ne peut pas être vide.'
      })
    }

    if (
      avatar_url !== undefined &&
      (
        !avatar_url ||
        avatar_url.length > 2048 ||
        /[\s\\]/.test(avatar_url) ||
        !/^\/(?!\/)/.test(avatar_url)
      )
    ) {
      return res.status(400).json({
        title: 'Avatar invalide',
        status: 400,
        detail: 'L’avatar doit être un chemin local valide.'
      })
    }

    const existingUser =
      await userModel.findProfileConflict(
        req.user.id,
        cleanEmail,
        cleanPseudo
      )

    if (existingUser) {
      return res.status(409).json({
        title: 'Profil déjà existant',
        status: 409,
        detail: 'Cet email ou ce pseudo est déjà utilisé.'
      })
    }

    let hashedPassword = null

    if (password !== undefined) {
      const isPasswordOk = validator.isStrongPassword(
        password,
        {
          minLength: 6,
          minLowercase: 1,
          minUppercase: 1,
          minNumbers: 1,
          minSymbols: 1
        }
      )

      if (!isPasswordOk) {
        return res.status(400).json({
          title: 'Mot de passe trop faible',
          status: 400,
          detail: 'Le mot de passe doit contenir au moins 6 caractères, une minuscule, une majuscule, un chiffre et un symbole.'
        })
      }

      hashedPassword = await bcrypt.hash(password, 10)
    }

    const updatedUser = await userModel.updateUser(
      req.user.id,
      {
        email: cleanEmail,
        hashedPassword,
        pseudo: cleanPseudo,
        avatarUrl:
          avatar_url === undefined ? null : avatar_url
      }
    )

    if (!updatedUser) {
      return res.status(401).json({
        title: 'Compte indisponible',
        status: 401,
        detail: "L'utilisateur n'existe plus."
      })
    }

    return res.status(200).json({
      title: 'Profil modifié',
      status: 200,
      detail: 'Votre profil a été modifié avec succès.',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        pseudo: updatedUser.pseudo,
        avatar_url: updatedUser.avatar_url
      }
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        title: 'Profil déjà existant',
        status: 409,
        detail: 'Cet email ou ce pseudo est déjà utilisé.'
      })
    }

    console.error('Erreur updateProfile :', error)

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: 'Impossible de modifier votre profil.'
    })
  }
}

// DÉCONNEXION
/**
 * Révoque le refresh token fourni ; opération idempotente pour un jeton inconnu.
 * @memberof module:controllers/authController
 * @static
 * @param {Object} req Requête Express.
 * @param {Object} res Réponse Express.
 * @returns {Promise<Object>} Réponse HTTP Express.
 */
const logout = async (req, res) => {
  try {
    const { token } = req.body || {}

    if (!isTokenFormatValid(token)) {
      return res.status(400).json({
        title: 'Token invalide',
        status: 400,
        detail: 'Un refresh token valide est obligatoire.'
      })
    }

    const tokens = await userModel.findValidRefreshTokens()

    // Identifier le token avec bcrypt
    for (const savedToken of tokens) {
      const isMatch = await bcrypt.compare(
        token,
        savedToken.token_hash
      )

      if (isMatch) {
        // Révoquer uniquement le token correspondant
        await userModel.revokeRefreshTokenById(
          savedToken.id
        )

        break
      }
    }

    return res.status(200).json({
      title: 'Déconnexion réussie',
      status: 200,
      detail: 'Votre session a été déconnectée.'
    })
  } catch (error) {
    console.error('Erreur logout :', error)

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: 'Impossible de terminer la session.'
    })
  }
}

const deleteAccount = async (req, res) => {
    const { password, confirmation } = req.body || {}

    if (
        typeof password !== 'string' ||
        !password ||
        password.length > 1024 ||
        confirmation !== 'SUPPRIMER'
    ) {
        return res.status(400).json({
            detail: 'Mot de passe et confirmation obligatoires.'
        })
    }

    try {
        const user = await userModel.findAccountForDeletion(
            req.user.id
        )

        if (!user) {
            return res.status(401).json({
                detail: 'Veuillez vous reconnecter.'
            })
        }

        const validPassword = await bcrypt.compare(
            password,
            user.password
        )

        if (!validPassword) {
            return res.status(403).json({
                detail: 'Mot de passe incorrect.'
            })
        }

        const deleted = await userModel.deleteAccount(
            req.user.id,
            user.password
        )

        if (!deleted) {
            return res.status(409).json({
                detail: 'Le compte a changé. Veuillez réessayer.'
            })
        }

        return res.status(204).send()
    } catch {
        // Ne pas afficher le mot de passe ou les données du compte.
        console.error('Échec de la suppression du compte.')

        return res.status(500).json({
            detail: 'Impossible de supprimer le compte pour le moment.'
        })
    }
}

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  refreshTokens,
  updateProfile,
  logout,
   deleteAccount
}
