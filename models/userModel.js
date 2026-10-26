
const { pool } = require('../config/db')

// =====================================================
// GESTION DES UTILISATEURS
// =====================================================

// Rechercher un compte par email ou pseudo
const findByEmailOrPseudo = async (email, pseudo) => {
  const result = await pool.query(
    `SELECT id
     FROM "Users"
     WHERE email = $1 OR pseudo = $2`,
    [email, pseudo]
  )

  return result.rows[0] || null
}

// Rechercher un compte par email
const findByEmail = async (email) => {
  const result = await pool.query(
    `SELECT id, email, password, pseudo, avatar_url
     FROM "Users"
     WHERE email = $1`,
    [email]
  )

  return result.rows[0] || null
}

// Rechercher un email utilisé par un autre compte
const findByEmailExcludingId = async (email, excludeId) => {
  const result = await pool.query(
    `SELECT id, email
     FROM "Users"
     WHERE email = $1 AND id <> $2`,
    [email, excludeId]
  )

  return result.rows[0] || null
}

// Rechercher un utilisateur par son ID
const findById = async (id) => {
  const result = await pool.query(
    `SELECT id, email, pseudo, avatar_url
     FROM "Users"
     WHERE id = $1`,
    [id]
  )

  return result.rows[0] || null
}

// Créer un utilisateur
const createUser = async (
  email,
  password,
  pseudo,
  avatarUrl
) => {
  const result = await pool.query(
    `INSERT INTO "Users"
       (email, password, pseudo, avatar_url)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, pseudo, avatar_url`,
    [email, password, pseudo, avatarUrl]
  )

  return result.rows[0]
}

// Ancienne fonction de modification utilisateur
// Conservée pour compatibilité avec le reste du projet
const changeUser = async (
  pseudo,
  email,
  password,
  avatarUrl,
  id
) => {
  const result = await pool.query(
    `UPDATE "Users"
     SET pseudo = $1,
         email = $2,
         password = $3,
         avatar_url = $4
     WHERE id = $5
     RETURNING id, email, pseudo, avatar_url`,
    [pseudo, email, password, avatarUrl, id]
  )

  return result.rows[0] || null
}

// =====================================================
// RÉINITIALISATION DU MOT DE PASSE
// =====================================================

// Enregistrer un token de réinitialisation hashé
// Le contrôleur effectue le hashage avec bcrypt
const createToken = async (
  userId,
  tokenHash,
  expiresAt
) => {
  const result = await pool.query(
    `INSERT INTO "Password_reset_tokens"
       (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, expires_at`,
    [userId, tokenHash, expiresAt]
  )

  return result.rows[0]
}

// Récupérer uniquement les tokens de reset actifs
// La comparaison bcrypt est effectuée dans le contrôleur
const findValidResetTokens = async () => {
  const result = await pool.query(
    `SELECT id, user_id, token_hash, expires_at
     FROM "Password_reset_tokens"
     WHERE used_at IS NULL
       AND expires_at > NOW()`
  )

  return result.rows
}

// Modifier le mot de passe et invalider les sessions
// Toutes les opérations sont atomiques
const changePasswordAndClearToken = async (
  password,
  userId,
  tokenId
) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Verrouiller le compte pendant la modification
    const user = await client.query(
      `SELECT id
       FROM "Users"
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    )

    if (user.rowCount !== 1) {
      await client.query('ROLLBACK')
      return false
    }

    // Consommer le token une seule fois
    const token = await client.query(
      `DELETE FROM "Password_reset_tokens"
       WHERE id = $1
         AND user_id = $2
         AND used_at IS NULL
         AND expires_at > NOW()
       RETURNING id`,
      [tokenId, userId]
    )

    if (token.rowCount !== 1) {
      await client.query('ROLLBACK')
      return false
    }

    // Mettre à jour le mot de passe hashé
    await client.query(
      `UPDATE "Users"
       SET password = $1
       WHERE id = $2`,
      [password, userId]
    )

    // Révoquer toutes les sessions de l'utilisateur
    await client.query(
      `UPDATE "Refresh_tokens"
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId]
    )

    // Supprimer les autres tokens de réinitialisation
    await client.query(
      `DELETE FROM "Password_reset_tokens"
       WHERE user_id = $1`,
      [userId]
    )

    await client.query('COMMIT')
    return true

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// =====================================================
// GESTION DES REFRESH TOKENS
// =====================================================

// Enregistrer un refresh token hashé avec bcrypt
const createRefreshToken = async (
  userId,
  tokenHash,
  expiresAt
) => {
  const result = await pool.query(
    `INSERT INTO "Refresh_tokens"
       (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, expires_at`,
    [userId, tokenHash, expiresAt]
  )

  return result.rows[0]
}

// Récupérer les refresh tokens encore actifs
// Le contrôleur identifie le token avec bcrypt.compare()
const findValidRefreshTokens = async () => {
  const result = await pool.query(
    `SELECT id, user_id, token_hash, expires_at
     FROM "Refresh_tokens"
     WHERE expires_at > NOW()
       AND revoked_at IS NULL`
  )

  return result.rows
}

// Révoquer tous les refresh tokens d'un utilisateur
const revokeUserRefreshTokens = async (userId) => {
  const result = await pool.query(
    `UPDATE "Refresh_tokens"
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId]
  )

  return result.rowCount
}

// Révoquer un refresh token par son identifiant
// Utilisé pour la déconnexion
const revokeRefreshTokenById = async (tokenId) => {
  const result = await pool.query(
    `UPDATE "Refresh_tokens"
     SET revoked_at = NOW()
     WHERE id = $1
       AND revoked_at IS NULL
     RETURNING id`,
    [tokenId]
  )

  return result.rowCount === 1
}

// Rotation d'un refresh token
// L'ancien token est révoqué et un nouveau est créé
// dans une seule transaction PostgreSQL
const rotateRefreshToken = async (
  tokenId,
  userId,
  newTokenHash,
  expiresAt
) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Verrouiller le compte pour synchroniser les opérations
    const user = await client.query(
      `SELECT id
       FROM "Users"
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    )

    if (user.rowCount !== 1) {
      await client.query('ROLLBACK')
      return false
    }

    // Révoquer uniquement un token encore actif
    const revoked = await client.query(
      `UPDATE "Refresh_tokens"
       SET revoked_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()
       RETURNING id`,
      [tokenId, userId]
    )

    if (revoked.rowCount !== 1) {
      await client.query('ROLLBACK')
      return false
    }

    // Enregistrer le nouveau token hashé
    await client.query(
      `INSERT INTO "Refresh_tokens"
         (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, newTokenHash, expiresAt]
    )

    await client.query('COMMIT')
    return true

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// =====================================================
// MODIFICATION DU PROFIL
// =====================================================

// Modifier les informations du profil
// Révoquer les sessions si le mot de passe change
const updateUser = async (
  id,
  { email, hashedPassword, pseudo, avatarUrl }
) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Verrouiller le compte
    const lockedUser = await client.query(
      `SELECT id
       FROM "Users"
       WHERE id = $1
       FOR UPDATE`,
      [id]
    )

    if (lockedUser.rowCount !== 1) {
      await client.query('ROLLBACK')
      return null
    }

    // Conserver les valeurs non modifiées avec COALESCE
    const result = await client.query(
      `UPDATE "Users"
       SET email = COALESCE($1, email),
           password = COALESCE($2, password),
           pseudo = COALESCE($3, pseudo),
           avatar_url = COALESCE($4, avatar_url)
       WHERE id = $5
       RETURNING id, email, pseudo, avatar_url`,
      [email, hashedPassword, pseudo, avatarUrl, id]
    )

    // Un changement de mot de passe invalide les sessions
    if (
      hashedPassword !== null &&
      hashedPassword !== undefined
    ) {
      await client.query(
        `UPDATE "Refresh_tokens"
         SET revoked_at = NOW()
         WHERE user_id = $1
           AND revoked_at IS NULL`,
        [id]
      )
    }

    await client.query('COMMIT')

    return result.rows[0] || null

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Vérifier les conflits d'email ou de pseudo
const findProfileConflict = async (
  id,
  email,
  pseudo
) => {
  const result = await pool.query(
    `SELECT id
     FROM "Users"
     WHERE id <> $1
       AND (email = $2 OR pseudo = $3)
     LIMIT 1`,
    [id, email, pseudo]
  )

  return result.rows[0] || null
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  findByEmailOrPseudo,
  findByEmail,
  findByEmailExcludingId,
  findById,
  createUser,
  changeUser,
  createToken,
  findValidResetTokens,
  changePasswordAndClearToken,
  createRefreshToken,
  findValidRefreshTokens,
  revokeUserRefreshTokens,
  revokeRefreshTokenById,
  rotateRefreshToken,
  updateUser,
  findProfileConflict
}
