/** @module config/db */
const { Pool } = require('pg') 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

/**
 * Vérifie la connexion et libère le client ; journalise les erreurs sans les propager.
 * @memberof module:config/db
 * @static
 * @returns {Promise<void>} Vérification terminée ; les erreurs sont journalisées.
 */
const connectDB = async () => {
  try {
    const client = await pool.connect()
    console.log('Connection has been established successfully')
    client.release() 
  } catch (err) {
    console.error('Unable to connect to the database: ', err)
  }
}

module.exports = { pool, connectDB }