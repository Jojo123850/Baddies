const jwt = require('jsonwebtoken')
const validator = require('validator')
const bcrypt = require('bcrypt')
const userModel = require('../models/userModel')
const mailSender = require('../utils/mailSender')

const JWT_SECRET = process.env.JWT_SECRET
// pour la sécurité
const JWT_EXPIRES_IN = '15m'

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

const crypto = require('crypto')

const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

const generateRefreshToken = () => {
  return crypto.randomBytes(32).toString('hex')
}
const register = async (req, res) => {
  const { email, password, pseudo } = req.body
// on les enlève parce qu'on a crée un schéma
  // if ( !pseudo ||!email || !password ) {
  //   return res.status(400).json({ error: 'Champs obligatoires manquants.' })
  // }

  // const isPasswordOk = validator.isStrongPassword(password, {
  //   minLength: 6, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1
  // })
  // if (!isPasswordOk) {
  //   return res.status(400).json({ error: 'Mot de passe trop faible.' })
  // }

  try {
    const existingUser = await userModel.findByEmailOrPseudo(email, pseudo)
    if (existingUser) {
      return res.status(400).json({
        title: "Vous ne pouvez pas  utilisé ce mail ou ce pseudo",
        status: 400,
        detail: 'Email ou pseudo déjà utilisé.' })
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
    const { email, password } = req.body;

    // 1. Rechercher l'utilisateur
    const user = await userModel.findByEmail(email);
    if(!password){
        return res.status(401).json({
        message: ' mot de passe incorrect'
      });

    }


    if (!user) {
      return res.status(401).json({
        message: 'Email  incorrect'
      });
    }

    // 2. Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: 'Email ou mot de passe incorrect'
      });
    }

    // 3. Générer le refresh token
    const refreshToken = generateRefreshToken();

    // 4. Hacher le refresh token pour la base de données
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    // 5. Définir une expiration de 7 jours
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    // 6. Enregistrer le hash dans PostgreSQL
    await userModel.createRefreshToken(
      user.id,
      tokenHash,
      expiresAt
    );

    // 7. Générer l'access token
    const accessToken = generateToken(user.id);

    // 8. Renvoyer les tokens pour le test
    return res.status(200).json({
      message: 'Connexion réussie',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        avatar_url: user.avatar_url
      }
    });

  } catch (error) {
    console.error('Erreur login :', error);

    return res.status(500).json({
      message: 'Erreur serveur'
    });
  }
};



// forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "L'email est obligatoire" })
    }

    const user = await userModel.findByEmail(email)

    if (!user) {
      return res.status(400).json({ message: "Email inexistant" })
    }

    // génération nouvel token grace à l'email
    const token = generateResetToken()

    const tokenHash = await bcrypt.hash(token, 10)

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await userModel.createToken(user.id, tokenHash,expiresAt)

    await mailSender(email, user.pseudo,token )
    

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
    // prendre les tokens un par un  et comparer le token hashé avec le token reçu
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

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await userModel.changePasswordAndClearToken(
    hashedPassword,
    matchingToken.user_id,
    matchingToken.id
    );

    return res.status(200).json({
        message: 'Mot de passe modifié avec succès'
    });
   
    
    // await userModel.changePassword(
    //   hashedPassword,
    //   matchingToken.user_id
    // )

    // await userModel.clearToken(
    //   matchingToken.id
    // )
  

    // // Empêcher de réutiliser le token
    // await userModel.markTokenAsUsed(
    //   matchingToken.id
    // )


  } catch (error) {
    console.log('Erreur resetPassword :', error)

    return res.status(500).json({
      error: 'Erreur serveur'
    })
  }
}

const refreshTokens = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        message: 'Refresh token manquant'
      });
    }

    // 1. Récupérer les refresh tokens valides en base
    const tokens = await userModel.findValidRefreshTokens();

    // 2. Chercher celui qui correspond au token reçu
    let matchingToken = null;

    for (const savedToken of tokens) {
      const isMatch = await bcrypt.compare(
        token,
        savedToken.token_hash
      );

      if (isMatch) {
        matchingToken = savedToken;
        break;
      }
    }

    // 3. Refuser si aucun token ne correspond
    if (!matchingToken) {
      return res.status(401).json({
        message: 'Refresh token invalide ou expiré'
      });
    }

    // 4. Générer un nouvel access token
    const accessToken = jwt.sign(
      { id: matchingToken.user_id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // 5. Renvoyer le nouvel access token
    return res.status(200).json({
      accessToken
    });

  } catch (error) {
    console.error('Erreur refreshTokens :', error);

    return res.status(500).json({
      message: 'Erreur serveur'
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const body = req.body

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ message: 'Données invalides.' })
    }

    const { email, password, pseudo, avatar_url } = body

    if (
      (email !== undefined && typeof email !== 'string') ||
      (pseudo !== undefined && typeof pseudo !== 'string') ||
      (avatar_url !== undefined && typeof avatar_url !== 'string') ||
      (password !== undefined && typeof password !== 'string')
    ) {
      return res.status(400).json({ message: 'Format des champs invalide.' })
    }

    if (
      email === undefined &&
      pseudo === undefined &&
      avatar_url === undefined &&
      password === undefined
    ) {
      return res.status(400).json({ message: 'Aucune modification fournie.' })
    }

    const cleanEmail = email === undefined ? null : email.trim()
    const cleanPseudo = pseudo === undefined ? null : pseudo.trim()

    if (cleanEmail !== null && !validator.isEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Vous devez utiliser un email valide.' })
    }

    if (cleanPseudo !== null && !cleanPseudo) {
      return res.status(400).json({ message: 'Le pseudo ne peut pas être vide.' })
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
        message: 'L’avatar doit être un chemin local valide.'
      })
    }

    const existingUser = await userModel.findProfileConflict(
      req.user.id,
      cleanEmail,
      cleanPseudo
    )

    if (existingUser) {
      return res.status(409).json({
        message: 'Email ou pseudo déjà utilisé.'
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
          message: 'Le mot de passe doit contenir au moins 6 caractères, une minuscule, une majuscule, un chiffre et un symbole.'
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
        message: "L’utilisateur n’existe plus."
      })
    }

    return res.status(200).json({
      message: 'Profil modifié avec succès',
      user: updatedUser
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'Email ou pseudo déjà utilisé.'
      })
    }

    console.error('Erreur updateProfile :', error)

    return res.status(500).json({
      message: 'Impossible de modifier le profil.'
    })
  }
}

module.exports = { register, login, forgotPassword,resetPassword,refreshTokens, updateProfile }