const { pool } = require('../config/db')

const createHistory = async (userId, evaluation, solutions) => {
    const result = await pool.query(
        `INSERT INTO "History" (user_id, evaluation, solutions)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [
            userId,
            JSON.stringify(evaluation),
            JSON.stringify(solutions)
        ]
    )

    return result.rows[0]
}


const getHistory = async(userId) => {
    result = await pool.query(
        `SELECT * FROM "History" WHERE user_id=$1 ORDER BY created_at DESC`, [userId]
    )
    return result.rows
}

const getHistoryById = async (id, userId) => {
    const result = await pool.query(
        `SELECT *
         FROM "History"
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
    )

    return result.rows[0] || null
}

module.exports = { createHistory, getHistory, getHistoryById }