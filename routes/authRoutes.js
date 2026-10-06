const express = require('express')
const router = express.Router()
const { register, login, forgotPassword, resetPassword} = require('../controllers/authController')


router.post('/register', register)

router.post('/login', login)

router.post('/forgotPassword', forgotPassword)

router.post('/resetPassword', resetPassword)
module.exports = router