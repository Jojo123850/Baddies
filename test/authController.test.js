
const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')
require('dotenv').config()
const userModel = require('../models/userModel')
const bcrypt = require('bcrypt')
const { pool } = require('../config/db')

const {register,login,updateProfile, deleteAccount} = require('../controllers/authController')

const validate = require('../middlewares/validateMiddleware')
const {registerSchema,loginSchema} = require('../schemas/authSchemas')

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
  test('DeleteAccount : refuse une confirmation incorrecte', async t => {
  let modeleAppele = false

  t.mock.method(userModel, 'findAccountForDeletion', async () => {
    modeleAppele = true
  })

  const req = {
    body: {
      password: 'Password1!',
      confirmation: 'NON'
    },
    user: { id: 7 }
  }

  const res = createMockRes()

  await deleteAccount(req, res)

  assert.equal(res.statusCode, 400)
  assert.equal(modeleAppele, false)
})

test('DeleteAccount : refuse les données absentes', async () => {
  const req = {
    user: { id: 7 }
  }

  const res = createMockRes()

  await deleteAccount(req, res)

  assert.equal(res.statusCode, 400)
})

test('DeleteAccount : refuse un mot de passe trop long', async () => {
  const req = {
    body: {
      password: 'a'.repeat(1025),
      confirmation: 'SUPPRIMER'
    },
    user: { id: 7 }
  }

  const res = createMockRes()

  await deleteAccount(req, res)

  assert.equal(res.statusCode, 400)
})

test('DeleteAccount : refuse un compte introuvable', async t => {
  t.mock.method(userModel, 'findAccountForDeletion', async () => {
    return null
  })

  const req = {
    body: {
      password: 'Password1!',
      confirmation: 'SUPPRIMER'
    },
    user: { id: 7 }
  }

  const res = createMockRes()

  await deleteAccount(req, res)

  assert.equal(res.statusCode, 401)
})

test('DeleteAccount : un mauvais mot de passe ne supprime rien', async t => {
  t.mock.method(userModel, 'findAccountForDeletion', async () => {
    return { password: 'empreinte-en-base' }
  })

  t.mock.method(bcrypt, 'compare', async () => {
    return false
  })

  let compteSupprime = false

  t.mock.method(userModel, 'deleteAccount', async () => {
    compteSupprime = true
  })

  const req = {
    body: {
      password: 'Mauvais1!',
      confirmation: 'SUPPRIMER'
    },
    user: { id: 7 }
  }

  const res = createMockRes()

  await deleteAccount(req, res)

  assert.equal(res.statusCode, 403)
  assert.equal(compteSupprime, false)
})

test('DeleteAccount : supprime uniquement le compte authentifié', async t => {
  t.mock.method(userModel, 'findAccountForDeletion', async id => {
    assert.equal(id, 7)

    return { password: 'empreinte-en-base' }
  })

  t.mock.method(bcrypt, 'compare', async (password, empreinte) => {
    assert.equal(password, 'Password1!')
    assert.equal(empreinte, 'empreinte-en-base')

    return true
  })

  let compteSupprime = false

  t.mock.method(userModel, 'deleteAccount', async (id, empreinte) => {
    assert.equal(id, 7)
    assert.equal(empreinte, 'empreinte-en-base')

    compteSupprime = true
    return true
  })

  const req = {
    body: {
      password: 'Password1!',
      confirmation: 'SUPPRIMER',
      user_id: 999 // Cette valeur doit être ignorée.
    },
    user: { id: 7 }
  }

  const res = createMockRes()

  // La vraie méthode Express send() ne doit pas envoyer de réseau ici.
  res.send = () => res

  await deleteAccount(req, res)

  assert.equal(res.statusCode, 204)
  assert.equal(compteSupprime, true)
})

test('DeleteAccount : signale un compte modifié entre les vérifications', async t => {
  t.mock.method(userModel, 'findAccountForDeletion', async () => {
    return { password: 'empreinte-en-base' }
  })

  t.mock.method(bcrypt, 'compare', async () => {
    return true
  })

  t.mock.method(userModel, 'deleteAccount', async () => {
    return false
  })

  const req = {
    body: {
      password: 'Password1!',
      confirmation: 'SUPPRIMER'
    },
    user: { id: 7 }
  }

  const res = createMockRes()

  await deleteAccount(req, res)

  assert.equal(res.statusCode, 409)
})

test('DeleteAccount : renvoie 500 en cas de panne', async t => {
  t.mock.method(console, 'error', () => {})

  t.mock.method(userModel, 'findAccountForDeletion', async () => {
    throw new Error('Base indisponible')
  })

  const req = {
    body: {
      password: 'Password1!',
      confirmation: 'SUPPRIMER'
    },
    user: { id: 7 }
  }

  const res = createMockRes()

  await deleteAccount(req, res)

  assert.equal(res.statusCode, 500)
  assert.equal(
    res.body.detail,
    'Impossible de supprimer le compte pour le moment.'
  )
})
})
