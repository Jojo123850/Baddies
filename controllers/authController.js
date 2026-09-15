const jwt = require('jsonwebtoken')
const { pool } = require("../config/db")
const validator = require('validator')
const bcrypt = require('bcrypt')


const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '364d'

// génère un token JWT contenant l'id de l'utilisateur. créer et génère
const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

const register = async (req, res) => {

  const { email, password, pseudo } = req.body

  if (!email || !password || !pseudo) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' })
  }

  const isPasswordOk = validator.isStrongPassword(password, {
    minLength: 6, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1
  })
  if (!isPasswordOk) {
    return res.status(400).json({ error: 'Mot de passe trop faible.' })
  }

  try {
    const userCheck = await pool.query(
      'SELECT "id" FROM "Users" WHERE email = $1 OR pseudo = $2',
      [email, pseudo]
    )

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email ou pseudo déjà utilisé.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const insertQuery = `
      INSERT INTO "Users" (email, password, pseudo, avatar_url)
      VALUES ($1, $2, $3, $4) RETURNING id, email, password, pseudo,avatar_url
    `

    const values = [email, hashedPassword, pseudo, null]

    const newUser = await pool.query(insertQuery, values)

    const user = newUser.rows[0]

    const token =  generateToken (user.id)

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

const login = async ( req, res) => {
    try {
        const { email, password } = req.body
    
        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' })
        }

        const queryText = 'SELECT "id", "email", "password", "pseudo" FROM "Users" WHERE email = $1' 
        const result = await pool.query(queryText, [email])

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' })
        }
   
        const user = result.rows[0]

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' })
        }
        const token = generateToken(user.id)

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email,pseudo: user.pseudo }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: 'Erreur serveur.' })
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
            const existingUser = await pool.query(
                'SELECT "id","email" FROM "Users" WHERE "email"= $1', [email]
            )
            if (existingUser.rows.length > 0 && existingUser.rows[0].id !== user.id) {
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

        const updateQuery = `
            UPDATE "Users"
            SET email = COALESCE($1, email),
                password = COALESCE($2, password),
                pseudo = COALESCE($3, pseudo),
                avatar_url = COALESCE($4, avatar_url)
            WHERE "id" = $5
            RETURNING id, email, pseudo, avatar_url
        `
        const values = [email || null, hashedPassword, pseudo || null, avatar_url || null, user.id]

        const result = await pool.query(updateQuery, values)

        return res.status(200).json({
            message: 'Profil modifié avec succès',
            user: result.rows[0]
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: 'Erreur serveur.' })
    }
}
module.exports = { register, login, updateProfile}
