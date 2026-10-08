const express = require('express')
const router = express.Router()
const {createHistory, getHistory, getHistoryById} = require('../controllers/historyController')
const authMiddleware = require('../middlewares/authMiddleware')



router.post('/', authMiddleware, createHistory)

router.get('/', authMiddleware, getHistory)

router.get('/:id', authMiddleware, getHistoryById)

module.exports = router