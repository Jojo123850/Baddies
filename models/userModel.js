const { pool } = require('../config/db')

// Trouver un utilisateur avec son email OU son pseudo
const findByEmailOrPseudo = async (email, pseudo) => {
  const result = await pool.query(
    'SELECT "id" FROM "Users" WHERE email = $1 OR pseudo = $2',
    [email, pseudo]
  )

  return result.rows[0] || null
}

// Trouver un utilisateur avec son email
const findByEmail = async (email) => {
  const result = await pool.query(
    'SELECT "id", "email", "password", "pseudo" FROM "Users" WHERE email = $1',
    [email]
  )

  return result.rows[0] || null
}

// Trouver un utilisateur avec son email sauf un utilisateur précis
const findByEmailExcludingId = async (email, excludeId) => {
  const result = await pool.query(
    'SELECT "id", "email" FROM "Users" WHERE "email" = $1',
    [email]
  )

  const user = result.rows[0]

  return user && user.id !== excludeId ? user : null
}

// Créer un utilisateur
const createUser = async (email, password, pseudo, avatarUrl) => {
  const result = await pool.query(
    `INSERT INTO "Users" (email, password, pseudo, avatar_url)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, password, pseudo, avatar_url`,
    [email, password, pseudo, avatarUrl]
  )

  return result.rows[0]
}

// Modifier un utilisateur
const changeUser = async (pseudo, email, password, avatarUrl, id) => {
  const result = await pool.query(
    `UPDATE "Users"
     SET pseudo = $1,
         email = $2,
         password = $3,
         avatar_url = $4
     WHERE id = $5
     RETURNING *`,
    [pseudo, email, password, avatarUrl, id]
  )

  return result.rows[0]
}

// Changer le mot de passe d'un utilisateur
const changePassword = async (password, id) => {
  const result = await pool.query(
    `UPDATE "Users"
     SET password = $1
     WHERE id = $2
     RETURNING id, email, pseudo, avatar_url`,
    [password, id]
  )

  return result.rows[0]
}

// Créer un token de réinitialisation
const createToken = async (user_id, token_hash, expires_at) => {
  const result = await pool.query(
    `INSERT INTO "Password_reset_token"
      (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [user_id, token_hash, expires_at]
  )

  return result.rows[0]
}

// Trouver un token de réinitialisation non utilisé
const findValidResetTokens = async () => {
  const result = await pool.query(
    `SELECT *
     FROM "Password_reset_token"
     WHERE used_at IS NULL
       AND expires_at > NOW()
     ORDER BY id DESC`
  )

  return result.rows
}

// Marquer un token comme utilisé
const markTokenAsUsed = async (id) => {
  const result = await pool.query(
    `UPDATE "Password_reset_token"
     SET used_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  )

  return result.rows[0]
}

// Modifier le profil
const updateUser = async (
  id,
  { email, hashedPassword, pseudo, avatarUrl }
) => {
  const result = await pool.query(
    `UPDATE "Users"
     SET email = COALESCE($1, email),
         password = COALESCE($2, password),
         pseudo = COALESCE($3, pseudo),
         avatar_url = COALESCE($4, avatar_url)
     WHERE "id" = $5
     RETURNING id, email, pseudo, avatar_url`,
    [email, hashedPassword, pseudo, avatarUrl, id]
  )

  return result.rows[0]
}

module.exports = {
  findByEmailOrPseudo,
  findByEmail,
  findByEmailExcludingId,
  changeUser,
  changePassword,
  createToken,
  findValidResetTokens,
  markTokenAsUsed,
  createUser,
  updateUser
}