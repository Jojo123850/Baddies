
const { test, describe, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const bcrypt = require('bcrypt')
require('dotenv').config()

const { pool } = require('../config/db')
const {register,login,refreshTokens} = require('../controllers/authController')

const createMockRes = () => ({
  statusCode: 200,
  body: null,

  status(code) {
    this.statusCode = code
    return this
  },

  json(data) {
    this.body = data
    return this
  }
})

const testId = `${Date.now()}_${process.pid}_refresh`
const testEmail = `baddies_${testId}@example.com`
const testPseudo = `Refresh_${testId}`

const password = 'Password123!'

const loginUser = async () => {
  const res = createMockRes()

  await login({
    body: { email: testEmail, password }
  }, res)

  assert.equal(res.statusCode, 200)
  assert.ok(res.body.refreshToken)

  return res.body.refreshToken
}

describe('Refresh Token Tests', () => {
  let userId

  // Nettoyage des données créées par ce fichier
  after(async () => {
    await pool.query(
      `DELETE FROM "Refresh_tokens"
       WHERE user_id IN (
         SELECT id FROM "Users" WHERE email = $1
       )`,
      [testEmail]
    )

    await pool.query(
      `DELETE FROM "Password_reset_tokens"
       WHERE user_id IN (
         SELECT id FROM "Users" WHERE email = $1
       )`,
      [testEmail]
    )

    await pool.query(
      `DELETE FROM "Users" WHERE email = $1`,
      [testEmail]
    )
  })

  // 1. Créer l'utilisateur de test
  test('Register: créer un compte pour les tests', async () => {
    const res = createMockRes()

    await register({
      body: {
        email: testEmail,
        password,
        pseudo: testPseudo
      }
    }, res)

    assert.equal(res.statusCode, 201)
    assert.ok(res.body.user)

    userId = res.body.user.id
  })

  // 2. Token manquant
  test('RefreshToken: token manquant', async () => {
    const res = createMockRes()

    await refreshTokens({ body: {} }, res)

    assert.equal(res.statusCode, 400)
    assert.equal(res.body.status, 400)
  })

  // 3. Token invalide
  test('RefreshToken: token inconnu', async () => {
    const res = createMockRes()

    await refreshTokens({
      body: {
        token: crypto.randomBytes(32).toString('hex')
      }
    }, res)

    assert.equal(res.statusCode, 401)
    assert.equal(res.body.status, 401)
  })

  // 4. Rotation et réutilisation interdite
  test('RefreshToken: rotation du token', async () => {
    const oldToken = await loginUser()

    const res = createMockRes()

    await refreshTokens({
      body: { token: oldToken }
    }, res)

    assert.equal(res.statusCode, 200)
    assert.ok(res.body.accessToken)
    assert.ok(res.body.refreshToken)

    const newToken = res.body.refreshToken

    assert.notEqual(newToken, oldToken)

    // Vérifier en base que l'ancien token est révoqué
    const result = await pool.query(
      `SELECT token_hash, revoked_at
       FROM "Refresh_tokens"
       WHERE user_id = $1`,
      [userId]
    )

    let oldTokenRow = null

    for (const row of result.rows) {
      if (await bcrypt.compare(oldToken, row.token_hash)) {
        oldTokenRow = row
        break
      }
    }

    assert.ok(oldTokenRow)
    assert.ok(oldTokenRow.revoked_at)

    // L'ancien token doit être refusé
    const reusedRes = createMockRes()

    await refreshTokens({
      body: { token: oldToken }
    }, reusedRes)

    assert.equal(reusedRes.statusCode, 401)

    // Le nouveau token doit fonctionner
    const newRes = createMockRes()

    await refreshTokens({
      body: { token: newToken }
    }, newRes)

    assert.equal(newRes.statusCode, 200)
    assert.ok(newRes.body.refreshToken)
  })

  // 5. Token expiré
  test('RefreshToken: token expiré', async () => {
    const expiredToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = await bcrypt.hash(expiredToken, 10)

    await pool.query(
      `INSERT INTO "Refresh_tokens"
       (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() - INTERVAL '1 hour')`,
      [userId, hashedToken]
    )

    const res = createMockRes()

    await refreshTokens({
      body: { token: expiredToken }
    }, res)

    assert.equal(res.statusCode, 401)
  })

  // 6. Révocation après changement de mot de passe
  test('RefreshToken: révoqué après changement de mot de passe', async () => {
    const token = await loginUser()

    const { updateProfile } = require('../controllers/authController')

    const updateRes = createMockRes()

    await updateProfile({
      user: { id: userId },
      body: { password: 'UpdatedPassword123!' }
    }, updateRes)

    assert.equal(updateRes.statusCode, 200)

    const refreshRes = createMockRes()

    await refreshTokens({
      body: { token }
    }, refreshRes)

    assert.equal(refreshRes.statusCode, 401)
  })
})
