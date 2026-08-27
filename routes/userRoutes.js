const express = require('express')
const router = express.Router()
const {updateProfile} = require('../controllers/authController')
const authMiddleware = require('../middleware/authMiddleware')

router.patch('/profile', authMiddleware, updateProfile )


module.exports = router