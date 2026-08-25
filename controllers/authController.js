const jwt = require('jsonwebtoken')
const User = require('../models/userModel')
const validator = require('validator')
const bcrypt = require('bcrypt')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '364d'

// génère un token JWT contenant l'id de l'utilisateur. créer et génère
const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// US1:: Création de compte
const register = async (req, res) => {
    try {
        const { email, password, pseudo } = req.body  

        if (!email || !password || !pseudo) {
            return res.status(400).json({ message: 'Please provide email and password' })
        }

        // vérifier que  mdp respecte les règles de sécurité
        const isPasswordOk = validator.isStrongPassword(password, {
            minLength: 6, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1
        })

        if (!isPasswordOk) {
            return res.status(400).json({ message:"Le mot de passe doit contenir au moins 1 minuscule, 1 majuscule, 1 chiffre, 1 symbole et faire au moins 6 caractères" })
        }

        // verifier si mail format valide
        if (!validator.isEmail(email)) {
            return res.status(400).json({ message: 'You must provide a valid email' })
        }

        const existingUser = await User.findOne({ where: { email } })
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await User.create({ email, password: hashedPassword })

        // générer token
        const token = generateToken(user.id)

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: user.id, email: user.email, role: user.role } 
        })

    } catch (err) {
        res.status(500).json({ message: 'Server error during registration', error: err.message })
    }
}

// US2:Connexion
const login = async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' })
        }

        const user = await User.findOne({ where: { email } })
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
            user: { id: user.id, email: user.email, role: user.role }
        })
    } catch (err) {
        res.status(500).json({ message: 'Server error during login', error: err.message })
    }
}

module.exports = { register, login }