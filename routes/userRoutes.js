const express = require('express')
const router = express.Router()
const {updateProfile,deleteAccount } = require('../controllers/authController')
const authMiddleware = require('../middlewares/authMiddleware')


router.patch('/profile', authMiddleware, updateProfile )
router.delete('/account', authMiddleware, deleteAccount)

module.exports = router