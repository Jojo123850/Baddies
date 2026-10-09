const express = require('express')
const router = express.Router()
const { register, login, forgotPassword, resetPassword, refreshTokens} = require('../controllers/authController')
const validate = require('../middlewares/validateMiddleware')
const { registerSchema, loginSchema } = require('../schemas/authSchemas')

router.post('/register',validate(registerSchema), register)

router.post('/login',validate(loginSchema), login)

router.post('/forgotPassword', forgotPassword)

router.post('/resetPassword', resetPassword)
router.post('/Refresh', refreshTokens)

module.exports = router

