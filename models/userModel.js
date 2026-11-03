/** @module models/userModel */

const { pool } = require('../config/db')

// =====================================================
// GESTION DES UTILISATEURS
// =====================================================

// Rechercher un compte par email ou pseudo
/**
 * Recherche un conflit de compte par email ou pseudo.
 * @memberof module:models/userModel
 * @static
 * @param {string} email email.
 * @param {string} pseudo pseudo.
 * @returns {Promise<?Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Recherche un compte par email, avec le hash nécessaire à la connexion.
 * @memberof module:models/userModel
 * @static
 * @param {string} email email.
 * @returns {Promise<?Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Recherche un email utilisé par un autre compte.
 * @memberof module:models/userModel
 * @static
 * @param {string} email email.
 * @param {string|number} excludeId excludeId.
 * @returns {Promise<?Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Recherche le profil public d’un compte.
 * @memberof module:models/userModel
 * @static
 * @param {string|number} id id.
 * @returns {Promise<?Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Crée un compte avec un mot de passe déjà hashé.
 * @memberof module:models/userModel
 * @static
 * @param {string} email email.
 * @param {string} password Hash pour les modèles ; valeur brute uniquement avant hashage dans le contrôleur.
 * @param {string} pseudo pseudo.
 * @param {string} avatarUrl avatarUrl.
 * @returns {Promise<Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Modifie un compte (ancienne fonction conservée pour compatibilité).
 * @memberof module:models/userModel
 * @static
 * @param {string} pseudo pseudo.
 * @param {string} email email.
 * @param {string} password Hash pour les modèles ; valeur brute uniquement avant hashage dans le contrôleur.
 * @param {string} avatarUrl avatarUrl.
 * @param {string|number} id id.
 * @returns {Promise<?Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Enregistre un jeton de réinitialisation déjà hashé.
 * @memberof module:models/userModel
 * @static
 * @param {string|number} userId userId.
 * @param {string} tokenHash tokenHash.
 * @param {Date} expiresAt expiresAt.
 * @returns {Promise<Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Liste les jetons de réinitialisation encore actifs.
 * @memberof module:models/userModel
 * @static
 * @returns {Promise<Array<Object>>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Change le mot de passe et révoque les sessions dans une transaction ; retourne false si le jeton est consommé.
 * @memberof module:models/userModel
 * @static
 * @param {string} password Hash pour les modèles ; valeur brute uniquement avant hashage dans le contrôleur.
 * @param {string|number} userId userId.
 * @param {string|number} tokenId tokenId.
 * @returns {Promise<boolean>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Enregistre un refresh token hashé.
 * @memberof module:models/userModel
 * @static
 * @param {string|number} userId userId.
 * @param {string} tokenHash tokenHash.
 * @param {Date} expiresAt expiresAt.
 * @returns {Promise<Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Liste les refresh tokens actifs.
 * @memberof module:models/userModel
 * @static
 * @returns {Promise<Array<Object>>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Révoque toutes les sessions du compte.
 * @memberof module:models/userModel
 * @static
 * @param {string|number} userId userId.
 * @returns {Promise<number>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Révoque une session par son identifiant.
 * @memberof module:models/userModel
 * @static
 * @param {string|number} tokenId tokenId.
 * @returns {Promise<boolean>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Révoque l’ancien jeton et insère le nouveau atomiquement.
 * @memberof module:models/userModel
 * @static
 * @param {string|number} tokenId tokenId.
 * @param {string|number} userId userId.
 * @param {string} newTokenHash newTokenHash.
 * @param {Date} expiresAt expiresAt.
 * @returns {Promise<boolean>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Modifie les champs fournis et révoque les sessions si le mot de passe change.
 * @memberof module:models/userModel
 * @static
 * @param {string|number} id id.
 * @param {Object} options Champs partiels : email, hashedPassword, pseudo, avatarUrl.
 * @returns {Promise<?Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
/**
 * Recherche un email ou pseudo déjà utilisé par un autre compte.
 * @memberof module:models/userModel
 * @static
 * @param {string|number} id id.
 * @param {string} email email.
 * @param {string} pseudo pseudo.
 * @returns {Promise<?Object>} Ligne SQL, liste, résultat de suppression ou null selon la fonction.
 * @throws {Error} Propage les erreurs PostgreSQL après rollback si nécessaire.
 */
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
