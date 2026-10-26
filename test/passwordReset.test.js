
const { test, describe, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const bcrypt = require('bcrypt')
require('dotenv').config()

const { pool } = require('../config/db')

const {
  register,
  login,
  forgotPassword,
  resetPassword
} = require('../controllers/authController')

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

const testId = `${Date.now()}_${process.pid}_reset`
const testEmail = `baddies_${testId}@example.com`
const testPseudo = `Reset_${testId}`

const originalPassword = 'Password123!'
const newPassword = 'NewPassword123!'

describe('Password Reset Tests', () => {
  let userId

  after(async () => {
    await pool.query(
      `DELETE FROM "Password_reset_tokens"
       WHERE user_id IN (
         SELECT id FROM "Users" WHERE email = $1
       )`,
      [testEmail]
    )

    await pool.query(
      `DELETE FROM "Refresh_tokens"
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

  // 1. Créer le compte de test
  test('Register: créer utilisateur de test', async () => {
    const res = createMockRes()

    await register({
      body: {
        email: testEmail,
        password: originalPassword,
        pseudo: testPseudo
      }
    }, res)

    assert.equal(res.statusCode, 201)
    userId = res.body.user.id
  })

  // 2. Email inconnu
  test('ForgotPassword: email inconnu', async () => {
    const res = createMockRes()

    await forgotPassword({
      body: {
        email: `unknown_${testId}@example.com`
      }
    }, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.status, 200)
  })

  // 3. Email manquant
  test('ForgotPassword: email manquant', async () => {
    const res = createMockRes()

    await forgotPassword({
      body: {}
    }, res)

    assert.equal(res.statusCode, 400)
  })

  // 4. Token manquant
  test('ResetPassword: token manquant', async () => {
    const res = createMockRes()

    await resetPassword({
      body: {
        newPassword
      }
    }, res)

    assert.equal(res.statusCode, 400)
  })

  // 5. Token invalide
  test('ResetPassword: token invalide', async () => {
    const res = createMockRes()

    await resetPassword({
      body: {
        token: crypto.randomBytes(32).toString('hex'),
        newPassword
      }
    }, res)

    assert.equal(res.statusCode, 401)
  })

  // 6. Réinitialisation réussie
  test('ResetPassword: réinitialisation réussie', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = await bcrypt.hash(rawToken, 10)

    await pool.query(
      `INSERT INTO "Password_reset_tokens"
       (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [userId, hashedToken]
    )

    const res = createMockRes()

    await resetPassword({
      body: {
        token: rawToken,
        newPassword
      }
    }, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.status, 200)

    // Vérifier le mot de passe enregistré
    const result = await pool.query(
      `SELECT password FROM "Users" WHERE id = $1`,
      [userId]
    )

    assert.equal(result.rowCount, 1)

    const valid = await bcrypt.compare(
      newPassword,
      result.rows[0].password
    )

    assert.equal(valid, true)

    // Vérifier que le nouveau mot de passe permet de se connecter
    const loginRes = createMockRes()

    await login({
      body: {
        email: testEmail,
        password: newPassword
      }
    }, loginRes)

    assert.equal(loginRes.statusCode, 200)

    // L'ancien mot de passe ne doit plus fonctionner
    const oldLoginRes = createMockRes()

    await login({
      body: {
        email: testEmail,
        password: originalPassword
      }
    }, oldLoginRes)

    assert.equal(oldLoginRes.statusCode, 401)

    // Le lien de réinitialisation ne doit plus fonctionner
    const reusedRes = createMockRes()

    await resetPassword({
      body: {
        token: rawToken,
        newPassword: 'AnotherPassword123!'
      }
    }, reusedRes)

    assert.equal(reusedRes.statusCode, 401)
  })

  // 7. Token expiré
  test('ResetPassword: token expiré', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = await bcrypt.hash(rawToken, 10)

    await pool.query(
      `INSERT INTO "Password_reset_tokens"
       (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() - INTERVAL '1 hour')`,
      [userId, hashedToken]
    )

    const res = createMockRes()

    await resetPassword({
      body: {
        token: rawToken,
        newPassword: 'AnotherPassword123!'
      }
    }, res)

    assert.equal(res.statusCode, 401)
  })
})
