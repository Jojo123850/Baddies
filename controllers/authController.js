const jwt = require('jsonwebtoken')
const validator = require('validator')
const bcrypt = require('bcrypt')
const userModel = require('../models/userModel')
const mailSender = require('../utils/mailSender')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '364d'

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

const crypto = require('crypto')

const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

const register = async (req, res) => {
  const { email, password, pseudo } = req.body

  if ( !pseudo ||!email || !password ) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' })
  }

  const isPasswordOk = validator.isStrongPassword(password, {
    minLength: 6, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1
  })
  if (!isPasswordOk) {
    return res.status(400).json({ error: 'Mot de passe trop faible.' })
  }

  try {
    const existingUser = await userModel.findByEmailOrPseudo(email, pseudo)
    if (existingUser) {
      return res.status(400).json({ error: 'Email ou pseudo déjà utilisé.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await userModel.createUser(email, hashedPassword, pseudo, null)
    const token = generateToken(user.id)

    return res.status(201).json({
      message: 'Compte créé avec succès !',
      token,
      user
    })
  } catch (error) {
    console.error("Erreur d'inscription :", error)
    return res.status(500).json({ error: 'Erreur serveur.' })
  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' })
    }

    const user = await userModel.findByEmail(email)
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = generateToken(user.id)

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, pseudo: user.pseudo }
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: 'Erreur serveur.' })
  }
}


// reset password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "L'email est obligatoire" })
    }

    const changeUser = await userModel.findByEmail(email)

    if (!changeUser) {
      return res.status(400).json({ message: "Email inexistant" })
    }

    // génération nouvel token grace à l'email
    const token2 = generateResetToken()

    const tokenHash = await bcrypt.hash(token2, 10)

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await userModel.createToken(changeUser.id, tokenHash,expiresAt)

    await mailSender(email, changeUser.pseudo,token2 )
    

    res.status(200).json({ message: "Email envoyé avec succès" })

  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
}

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      return res.status(400).json({
        message: 'Token et nouveau mot de passe obligatoires'
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
        message: 'Mot de passe trop faible'
      })
    }

    // Récupérer les tokens encore valides
    const resetTokens = await userModel.findValidResetTokens()

    // Chercher quel token correspond au token reçu
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
        message: 'Token invalide ou expiré'
      })
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Modifier le mot de passe
    await userModel.changePassword(
      hashedPassword,
      matchingToken.user_id
    )

    // Empêcher de réutiliser le token
    await userModel.markTokenAsUsed(
      matchingToken.id
    )

    return res.status(200).json({
      message: 'Mot de passe modifié avec succès'
    })

  } catch (error) {
    console.log('Erreur resetPassword :', error)

    return res.status(500).json({
      error: 'Erreur serveur'
    })
  }
}
const updateProfile = async (req, res) => {
  try {
    const user = req.user
    const { email, password, pseudo, avatar_url } = req.body

    if (email && !validator.isEmail(email)) {
      return res.status(400).json({ message: 'You must provide a valid email' })
    }

    if (email) {
      const existingUser = await findByEmailExcludingId(email, user.id)
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' })
      }
    }

    let hashedPassword = null
    if (password) {
      const isPasswordOk = validator.isStrongPassword(password, {
        minLength: 6, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1
      })
      if (!isPasswordOk) {
        return res.status(400).json({
          message: 'Password must have 1 lower, 1 upper, 1 number and 1 symbol and be at least 6 characters'
        })
      }
      hashedPassword = await bcrypt.hash(password, 10)
    }

    const updatedUser = await userModel.updateUser(user.id, {
      email: email || null,
      hashedPassword,
      pseudo: pseudo || null,
      avatarUrl: avatar_url || null
    })

    return res.status(200).json({
      message: 'Profil modifié avec succès',
      user: updatedUser
    })

  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: 'Erreur serveur.' })
  }
}

module.exports = { register, login, forgotPassword,resetPassword, updateProfile }