
const jwt = require('jsonwebtoken')
const validator = require('validator')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const userModel = require('../models/userModel')
const mailSender = require('../utils/mailSender')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '15m'

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

const generateRefreshToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

// INSCRIPTION
const register = async (req, res) => {
  try {
    // Les champs sont validés par le middleware Zod.
    const { email, password, pseudo } = req.body

    const existingUser = await userModel.findByEmailOrPseudo(email, pseudo)

    if (existingUser) {
      return res.status(409).json({
        title: 'Compte déjà existant',
        status: 409,
        detail: 'Cet email ou ce pseudo est déjà utilisé.'
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await userModel.createUser(email, hashedPassword, pseudo, null)
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

    if (error.code === '23505') {
      return res.status(409).json({
        title: 'Compte déjà existant',
        status: 409,
        detail: 'Cet email ou ce pseudo est déjà utilisé.'
      })
    }

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: "Impossible de créer votre compte pour le moment."
    })
  }
}

// CONNEXION
const login = async (req, res) => {
  try {
    // Le middleware Zod vérifie les champs obligatoires.
    const { email, password } = req.body
    const user = await userModel.findByEmail(email)

    // Même réponse pour un email inconnu et un mauvais mot de passe.
    if (!user) {
      return res.status(401).json({
        title: 'Authentification échouée',
        status: 401,
        detail: 'Email ou mot de passe incorrect.'
      })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(401).json({
        title: 'Authentification échouée',
        status: 401,
        detail: 'Email ou mot de passe incorrect.'
      })
    }

    const refreshToken = generateRefreshToken()
    const tokenHash = await bcrypt.hash(refreshToken, 10)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

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
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        title: 'Email manquant',
        status: 400,
        detail: "L'adresse email est obligatoire."
      })
    }

    const user = await userModel.findByEmail(email)

    // Ne pas révéler si une adresse email possède un compte.
    if (!user) {
      return res.status(200).json({
        title: 'Demande prise en compte',
        status: 200,
        detail: 'Si un compte correspond à cette adresse, un email de réinitialisation sera envoyé.'
      })
    }

    const token = generateResetToken()
    const tokenHash = await bcrypt.hash(token, 10)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await userModel.createToken(user.id, tokenHash, expiresAt)
    await mailSender(email, user.pseudo, token)

    return res.status(200).json({
      title: 'Demande prise en compte',
      status: 200,
      detail: 'Si un compte correspond à cette adresse, un email de réinitialisation sera envoyé.'
    })
  } catch (error) {
    console.error('Erreur forgotPassword :', error)

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: 'Impossible de traiter la demande de réinitialisation.'
    })
  }
}

// RÉINITIALISATION DU MOT DE PASSE
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      return res.status(400).json({
        title: 'Informations manquantes',
        status: 400,
        detail: 'Le token et le nouveau mot de passe sont obligatoires.'
      })
    }

    const isPasswordOk = validator.isStrongPassword(newPassword, {
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

    const resetTokens = await userModel.findValidResetTokens()
    let matchingToken = null

    for (const resetToken of resetTokens) {
      const isMatch = await bcrypt.compare(
        token,
        resetToken.token_hash
      )

      if (isMatch) {
        matchingToken = resetToken
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

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await userModel.changePasswordAndClearToken(
      hashedPassword,
      matchingToken.user_id,
      matchingToken.id
    )

    return res.status(200).json({
      title: 'Mot de passe modifié',
      status: 200,
      detail: 'Votre mot de passe a été modifié avec succès.'
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

// RENOUVELLEMENT DU TOKEN
const refreshTokens = async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({
        title: 'Refresh token manquant',
        status: 400,
        detail: 'Un refresh token est nécessaire pour renouveler la session.'
      })
    }

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

    const accessToken = generateToken(matchingToken.user_id)

    return res.status(200).json({
      title: 'Session renouvelée',
      status: 200,
      detail: 'Un nouveau token d’accès a été généré.',
      accessToken
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
const updateProfile = async (req, res) => {
  try {
    const body = req.body

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({
        title: 'Données invalides',
        status: 400,
        detail: 'Les données du profil doivent être un objet valide.'
      })
    }

    const { email, password, pseudo, avatar_url } = body

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

    const cleanEmail = email === undefined ? null : email.trim()
    const cleanPseudo = pseudo === undefined ? null : pseudo.trim()

    if (cleanEmail !== null && !validator.isEmail(cleanEmail)) {
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

    const existingUser = await userModel.findProfileConflict(
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
      const isPasswordOk = validator.isStrongPassword(password, {
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

      hashedPassword = await bcrypt.hash(password, 10)
    }

    const updatedUser = await userModel.updateUser(req.user.id, {
      email: cleanEmail,
      hashedPassword,
      pseudo: cleanPseudo,
      avatarUrl: avatar_url === undefined ? null : avatar_url
    })

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

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  refreshTokens,
  updateProfile
}
