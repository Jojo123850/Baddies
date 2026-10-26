
const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')
require('dotenv').config()

const { pool } = require('../config/db')

const {
  register,
  login,
  updateProfile
} = require('../controllers/authController')

const validate = require('../middlewares/validateMiddleware')
const {
  registerSchema,
  loginSchema
} = require('../schemas/authSchemas')

// Simuler une réponse Express
const createMockRes = () => {
  return {
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
  }
}

// Exécuter le middleware Zod avant le contrôleur
const executeWithValidation = async (schema, controller, req, res) => {
  let valid = false

  validate(schema)(req, res, () => {
    valid = true
  })

  if (valid) {
    await controller(req, res)
  }
}

// Identifiant unique pour éviter les conflits entre exécutions
const testId = `${Date.now()}_${process.pid}`

const testEmailA = `baddies_a_${testId}@example.com`
const testEmailB = `baddies_b_${testId}@example.com`
const testEmailC = `baddies_c_${testId}@example.com`
const testEmailUpdated = `baddies_updated_${testId}@example.com`

const pseudoA = `TestA_${testId}`
const pseudoB = `TestB_${testId}`
const pseudoC = `TestC_${testId}`

const testEmails = [
  testEmailA,
  testEmailB,
  testEmailC,
  testEmailUpdated
]

describe('Auth Controller Tests', () => {
  let userA
  let userB

  before(async () => {
    // Aucun DELETE préalable nécessaire :
    // les emails et pseudos sont uniques à chaque exécution.
  })

  after(async () => {
    try {
      // Supprimer les refresh tokens des comptes de test.
      await pool.query(
        `DELETE FROM "Refresh_tokens"
         WHERE user_id IN (
           SELECT id FROM "Users"
           WHERE email = ANY($1)
         )`,
        [testEmails]
      )

      // Supprimer les éventuels tokens de réinitialisation.
      await pool.query(
        `DELETE FROM "Password_reset_tokens"
         WHERE user_id IN (
           SELECT id FROM "Users"
           WHERE email = ANY($1)
         )`,
        [testEmails]
      )

      // Supprimer uniquement les utilisateurs créés par ces tests.
      await pool.query(
        'DELETE FROM "Users" WHERE email = ANY($1)',
        [testEmails]
      )
    } finally {
      // Ne pas fermer le pool ici :
      // d'autres fichiers de tests peuvent l'utiliser.
    }
  })

  // 1. INSCRIPTION A
  test('Register: créer utilisateur A', async () => {
    const req = {
      body: {
        email: testEmailA,
        password: 'Password123!',
        pseudo: pseudoA
      }
    }

    const res = createMockRes()

    await executeWithValidation(registerSchema, register, req, res)

    assert.equal(res.statusCode, 201)
    assert.equal(res.body.status, 201)
    assert.ok(res.body.token)
    assert.ok(res.body.user)
    assert.equal(res.body.user.email, testEmailA)

    // Sécurité : ne jamais renvoyer le mot de passe.
    assert.equal(res.body.user.password, undefined)

    userA = res.body.user
  })

  // 2. INSCRIPTION B
  test('Register: créer utilisateur B', async () => {
    const req = {
      body: {
        email: testEmailB,
        password: 'Password123!',
        pseudo: pseudoB
      }
    }

    const res = createMockRes()

    await executeWithValidation(registerSchema, register, req, res)

    assert.equal(res.statusCode, 201)
    assert.equal(res.body.status, 201)
    assert.equal(res.body.user.email, testEmailB)

    userB = res.body.user
  })

  // 3. EMAIL EN DOUBLE
  test('Register: email déjà utilisé', async () => {
    const req = {
      body: {
        email: testEmailB,
        password: 'Password123!',
        pseudo: pseudoC
      }
    }

    const res = createMockRes()

    await executeWithValidation(registerSchema, register, req, res)

    assert.equal(res.statusCode, 409)
    assert.equal(res.body.status, 409)
    assert.ok(res.body.title)
    assert.ok(res.body.detail)
  })

  // 4. MOT DE PASSE FAIBLE
  test('Register: mot de passe faible', async () => {
    const req = {
      body: {
        email: testEmailC,
        password: 'Passwordtest3',
        pseudo: pseudoC
      }
    }

    const res = createMockRes()

    await executeWithValidation(registerSchema, register, req, res)

    // Zod rejette les données avant le contrôleur.
    assert.equal(res.statusCode, 422)
    assert.equal(res.body.status, 422)
    assert.ok(res.body.invalidParams)
  })

  // 5. CONNEXION RÉUSSIE
  test('Login: obtenir les tokens', async () => {
    const req = {
      body: {
        email: testEmailA,
        password: 'Password123!'
      }
    }

    const res = createMockRes()

    await executeWithValidation(loginSchema, login, req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.status, 200)
    assert.ok(res.body.accessToken)
    assert.ok(res.body.refreshToken)
    assert.equal(res.body.user.id, userA.id)
    assert.equal(res.body.user.password, undefined)
  })

  // 6. EMAIL INCONNU
  test('Login: email inconnu', async () => {
    const req = {
      body: {
        email: `unknown_${testId}@example.com`,
        password: 'Password123!'
      }
    }

    const res = createMockRes()

    await executeWithValidation(loginSchema, login, req, res)

    assert.equal(res.statusCode, 401)
    assert.equal(res.body.status, 401)
    assert.ok(res.body.detail)
  })

  // 7. MAUVAIS MOT DE PASSE
  test('Login: mauvais mot de passe', async () => {
    const req = {
      body: {
        email: testEmailA,
        password: 'Password423!'
      }
    }

    const res = createMockRes()

    await executeWithValidation(loginSchema, login, req, res)

    assert.equal(res.statusCode, 401)
    assert.equal(res.body.status, 401)
  })

  // 8. EMAIL MANQUANT
  test('Login: email manquant', async () => {
    const req = {
      body: {
        email: '',
        password: 'Password123!'
      }
    }

    const res = createMockRes()

    await executeWithValidation(loginSchema, login, req, res)

    assert.equal(res.statusCode, 422)
    assert.equal(res.body.status, 422)
    assert.ok(res.body.invalidParams)
  })

  // 9. MOT DE PASSE MANQUANT
  test('Login: mot de passe manquant', async () => {
    const req = {
      body: {
        email: testEmailA,
        password: ''
      }
    }

    const res = createMockRes()

    await executeWithValidation(loginSchema, login, req, res)

    assert.equal(res.statusCode, 422)
    assert.equal(res.body.status, 422)
    assert.ok(res.body.invalidParams)
  })

  // 10. MODIFICATION DU PROFIL
  test('UpdateProfile: modifier le mot de passe', async () => {
    const req = {
      user: { id: userA.id },
      body: {
        password: 'UpdateTest123!'
      }
    }

    const res = createMockRes()

    await updateProfile(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.status, 200)
    assert.equal(res.body.user.email, testEmailA)
    assert.equal(res.body.user.password, undefined)
  })

  // 11. EMAIL INVALIDE
  test('UpdateProfile: email invalide', async () => {
    const req = {
      user: { id: userA.id },
      body: {
        email: 'email-invalide'
      }
    }

    const res = createMockRes()

    await updateProfile(req, res)

    assert.equal(res.statusCode, 400)
    assert.equal(res.body.status, 400)
    assert.ok(res.body.detail)
  })

  // 12. MODIFICATION EMAIL VALIDE
  test('UpdateProfile: modifier email', async () => {
    const req = {
      user: { id: userA.id },
      body: {
        email: testEmailUpdated
      }
    }

    const res = createMockRes()

    await updateProfile(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.status, 200)
    assert.equal(res.body.user.email, testEmailUpdated)
  })

  // 13. EMAIL DÉJÀ UTILISÉ
  test('UpdateProfile: email en double', async () => {
    const req = {
      user: { id: userA.id },
      body: {
        email: testEmailB
      }
    }

    const res = createMockRes()

    await updateProfile(req, res)

    assert.equal(res.statusCode, 409)
    assert.equal(res.body.status, 409)
    assert.ok(res.body.detail)

    // Vérifier que l'utilisateur B existe bien.
    assert.ok(userB.id)
  })

  // 14. MOT DE PASSE FAIBLE
  test('UpdateProfile: mot de passe faible', async () => {
    const req = {
      user: { id: userA.id },
      body: {
        password: 'password123!'
      }
    }

    const res = createMockRes()

    await updateProfile(req, res)

    assert.equal(res.statusCode, 400)
    assert.equal(res.body.status, 400)
    assert.ok(res.body.detail)
  })
})
