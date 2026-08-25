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

  try {
    const userCheck = await pool.query(
      'SELECT "id" FROM "Users" WHERE email = $1 OR pseudo = $2',
      [email, pseudo]
    )

    if (userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email ou pseudo déjà utilisé.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const insertQuery = `
      INSERT INTO "Users" (email, password, pseudo, avatar_url)
      VALUES ($1, $2, $3, $4)
    `

    const values = [email, hashedPassword, pseudo, null]

    const newUser = await pool.query(insertQuery, values)

    return res.status(201).json({
      message: 'Compte créé avec succès !',
      user: newUser.rows[0]
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
        const {email, password, pseudo} = req.body
        const updateQuery = 'UPDATE "Users" SET email:$1, password:$2, pseudo:$3, avatar_url:$4 WHERE "id"=:id'
        const result = (updateQuery)

        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Vous devez renseigner quelque chose' })
        }

        const user = result.rows[0]

        
        res.status(200).json({
            message: 'Profil modifié avec succès',
            user: { id: user.id, email: user.email,pseudo: user.pseudo }
        })

        
    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: 'Erreur serveur.' })
    }
}
module.exports = { register, login, updateProfile}
