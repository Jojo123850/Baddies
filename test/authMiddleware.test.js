
const { describe, test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const { pool } = require('../config/db')
const authMiddleware = require('../middlewares/authMiddleware')

// Simuler la réponse Express
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

describe('Auth Middleware Tests', () => {
  let userId

  const testId = `${Date.now()}_${process.pid}`
  const email = `middleware_${testId}@example.com`
  const pseudo = `Middleware_${testId}`

  // Créer un utilisateur de test dans PostgreSQL
  before(async () => {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET manquant dans .env')
    }

    const result = await pool.query(
      `INSERT INTO "Users" (email, password, pseudo)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email, 'hash_fictif_test', pseudo]
    )

    userId = result.rows[0].id
  })

  // Nettoyer uniquement notre utilisateur de test
  after(async () => {
    if (!userId) return

    await pool.query(
      `DELETE FROM "Users" WHERE id = $1`,
      [userId]
    )
  })

  // 1. Token valide
  test('JWT: accepter un token valide', async () => {
    const token = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    const req = {
      headers: {
        authorization: `Bearer ${token}`
      }
    }

    const res = createMockRes()
    let nextCalled = false

    const next = () => {
      nextCalled = true
    }

    await authMiddleware(req, res, next)

    assert.equal(nextCalled, true)
    assert.equal(req.user.id, userId)
    assert.equal(req.user.email, email)
    assert.equal(req.user.pseudo, pseudo)

    // Vérifier qu'aucun mot de passe n'est exposé
    assert.equal(req.user.password, undefined)
  })

  // 2. Token absent
  test('JWT: refuser un token absent', async () => {
    const req = {
      headers: {}
    }

    const res = createMockRes()
    let nextCalled = false

    await authMiddleware(req, res, () => {
      nextCalled = true
    })

    assert.equal(res.statusCode, 401)
    assert.equal(nextCalled, false)
  })

  // 3. Token invalide
  test('JWT: refuser un token invalide', async () => {
    const req = {
      headers: {
        authorization: 'Bearer token_invalide'
      }
    }

    const res = createMockRes()
    let nextCalled = false

    await authMiddleware(req, res, () => {
      nextCalled = true
    })

    assert.equal(res.statusCode, 401)
    assert.equal(nextCalled, false)
  })

  // 4. Token expiré
  test('JWT: refuser un token expiré', async () => {
    const expiredToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: -10 }
    )

    const req = {
      headers: {
        authorization: `Bearer ${expiredToken}`
      }
    }

    const res = createMockRes()
    let nextCalled = false

    await authMiddleware(req, res, () => {
      nextCalled = true
    })

    assert.equal(res.statusCode, 401)
    assert.equal(nextCalled, false)
    assert.equal(res.body.status, 401)
        assert.ok(res.body.title)
        assert.ok(res.body.detail)
        })

  // 5. Token signé avec une mauvaise clé
  test('JWT: refuser une mauvaise signature', async () => {
    const token = jwt.sign(
      { id: userId },
      'mauvaise_cle_de_test',
      { expiresIn: '1h' }
    )

    const req = {
      headers: {
        authorization: `Bearer ${token}`
      }
    }

    const res = createMockRes()
    let nextCalled = false

    await authMiddleware(req, res, () => {
      nextCalled = true
    })

    assert.equal(res.statusCode, 401)
    assert.equal(nextCalled, false)
  })

  // 6. Utilisateur inexistant
  
test('JWT: refuser un utilisateur inexistant', async () => {
  // Trouver un identifiant numérique absent de la base
  const result = await pool.query(
    'SELECT COALESCE(MAX(id), 0) + 1 AS id FROM "Users"'
  )

  const unknownId = result.rows[0].id

  // Créer un JWT valide pour cet utilisateur inexistant
  const token = jwt.sign(
    { id: unknownId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )

  const req = {
    headers: {
      authorization: `Bearer ${token}`
    }
  }

  const res = createMockRes()
  let nextCalled = false

  await authMiddleware(req, res, () => {
    nextCalled = true
  })

  // L'utilisateur n'existe pas : accès refusé
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.status, 401)
  assert.equal(nextCalled, false)

  assert.equal(res.body.title, 'Utilisateur introuvable')
})


  // 7. Token sans ID utilisateur
  test('JWT: refuser un token sans ID', async () => {
    const token = jwt.sign(
      { role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    const req = {
      headers: {
        authorization: `Bearer ${token}`
      }
    }

    const res = createMockRes()
    let nextCalled = false

    await authMiddleware(req, res, () => {
      nextCalled = true
    })

    assert.equal(res.statusCode, 401)
    assert.equal(nextCalled, false)
  })

  test('JWT: refuser un identifiant UUID au lieu d’un BIGINT', async () => {
  const token = jwt.sign(
    { id: '00000000-0000-4000-8000-000000000000' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )

  const req = {
    headers: {
      authorization: `Bearer ${token}`
    }
  }

  const res = createMockRes()
  let nextCalled = false

  await authMiddleware(req, res, () => {
    nextCalled = true
  })

  assert.equal(res.statusCode, 401)
  assert.equal(res.body.status, 401)
  assert.equal(res.body.title, 'Token invalide')
  assert.equal(nextCalled, false)
})
})
