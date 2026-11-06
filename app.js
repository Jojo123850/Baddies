const express = require('express')
require('dotenv').config()
const { connectDB, pool } = require('./config/db')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const app = express()
app.set('trust proxy', 1)          
const port = process.env.PORT || 3001

const authRoutes = require('./routes/authRoutes')
const userRoutes = require('./routes/userRoutes')
const historyRoutes = require('./routes/historyRoutes')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/health', (req, res) => res.status(200).send('OK'))

app.get('/', (req, res) => {
    res.send('Bienvenue sur mon API RESTful !')
})


const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: { status: 429, error: 'Trop de requêtes, réessayer plus tard' }
})

app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" }
    })
)

const corsOptions = {
    origin: [  'https://baddies-beryl.vercel.app', 'https://baddies-api.onrender.com', "http://localhost:5173"]
}
app.use(cors(corsOptions))

app.use(limiter)

require('./docs/swagger')(app)

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/user', userRoutes)
app.use('/api/v1/history', historyRoutes)

async function start() {
    await connectDB() // Vérifie la connexion au démarrage
    app.listen(port, () => {
        console.log(`Serveur lancé sur le port ${port}`)
    })
}
start()
