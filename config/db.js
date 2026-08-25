const { Pool } = require('pg') 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

const connectDB = async () => {
  try {
    const client = await pool.connect()
    console.log('Connection has been established successfully')
    client.release() // Toujours libérer le client de test
  } catch (err) {
    console.error('Unable to connect to the database: ', err)
  }
}

module.exports = { pool, connectDB }