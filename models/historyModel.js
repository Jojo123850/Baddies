/** @module models/historyModel */
const { pool } = require('../config/db')

/**
 * Enregistre un épisode pour l’utilisateur authentifié.
 * @memberof module:models/historyModel
 * @static
 * @param {string|number} userId userId.
 * @param {*} evaluation evaluation.
 * @param {*} solutions solutions.
 * @returns {Promise<Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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


/**
 * Liste les épisodes du compte authentifié.
 * @memberof module:models/historyModel
 * @static
 * @param {string|number} userId userId.
 * @returns {Promise<Array<Object>>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
const getHistory = async (userId) => {
    const result = await pool.query(
        `SELECT * FROM "History" WHERE user_id=$1 ORDER BY created_at DESC`,
        [userId]
    )

    return result.rows
}

/**
 * Recherche un épisode appartenant au compte authentifié.
 * @memberof module:models/historyModel
 * @static
 * @param {string|number} id id.
 * @param {string|number} userId userId.
 * @returns {Promise<?Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
const getHistoryById = async (id, userId) => {
    const result = await pool.query(
        `SELECT *
         FROM "History"
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
    )

    return result.rows[0] || null
}

/**
 * Supprime uniquement un épisode appartenant au compte authentifié.
 * @memberof module:models/historyModel
 * @static
 * @param {string|number} id id.
 * @param {string|number} userId userId.
 * @returns {Promise<boolean>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
const deleteHistory = async (id, userId) => {
    const result = await pool.query(
        `DELETE FROM "History"
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [id, userId]
    )

    return result.rowCount > 0
}

/**
 * Importe une évaluation locale pour le compte authentifié.
 * Une nouvelle tentative renvoie l'épisode déjà importé
 * sans écraser son contenu.
 *
 * @param {string|number} userId Identifiant du compte.
 * @param {string} localId Identifiant stable de l'évaluation locale.
 * @param {string} date Date de l'évaluation.
 * @param {Object} evaluation Réponses de l'évaluation.
 * @param {Array} solutions Solutions associées.
 * @returns {Promise<Object>} Épisode enregistré.
 */
const importHistory = async (userId,localId,date,evaluation,solutions) => {
    const result = await pool.query(
        `INSERT INTO "History"
            (user_id, local_id, created_at, evaluation, solutions)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, local_id)
         DO UPDATE SET local_id = EXCLUDED.local_id
         RETURNING *`,
        [userId,localId,date,
            JSON.stringify(evaluation),
            JSON.stringify(solutions)
        ]
    )

    return result.rows[0]
}

module.exports = { createHistory, getHistory, getHistoryById, deleteHistory, importHistory}