const express = require('express')
const router = express.Router()
const {createHistory, getHistory, getHistoryById, deleteHistory, importHistory } = require('../controllers/historyController')
const authMiddleware = require('../middlewares/authMiddleware')


router.post('/', authMiddleware, createHistory)
router.get('/', authMiddleware, getHistory)
router.get('/:id', authMiddleware, getHistoryById)
router.delete('/:id', authMiddleware, deleteHistory)
router.post('/import', authMiddleware, importHistory)

module.exports = router