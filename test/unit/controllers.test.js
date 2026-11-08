const { test } = require('node:test')
const assert = require('node:assert/strict')

// Configuration avant de charger les contrôleurs.
process.env.JWT_SECRET = 'secret-reserve-aux-tests'

const bcrypt = require('bcrypt')
const userModel = require('../../models/userModel')
const {
  register,
  login,
  forgotPassword
} = require('../../controllers/authController')

// Simule la réponse Express.
function createMockRes() {
  return {
    statusCode: null,
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

test('Inscription : refuse un compte déjà existant', async t => {
  // Simuler un compte trouvé dans la base.
  t.mock.method(userModel, 'findByEmailOrPseudo', async () => {
    return { id: 7 }
  })

  const req = {
    body: {
      email: 'jojo@example.com',
      pseudo: 'Jojo',
      password: 'Password123!'
    }
  }

  const res = createMockRes()

  await register(req, res)

  assert.equal(res.statusCode, 409)
  assert.equal(res.body.title, 'Compte déjà existant')
})

test('Inscription : crée un compte sans renvoyer son mot de passe', async t => {
  t.mock.method(userModel, 'findByEmailOrPseudo', async () => {
    return null
  })

  t.mock.method(bcrypt, 'hash', async () => {
    return 'mot-de-passe-hache'
  })

  t.mock.method(userModel, 'createUser', async (email, password, pseudo) => {
    // Vérifier ce qui serait envoyé à la base.
    assert.equal(password, 'mot-de-passe-hache')

    return {
      id: 7,
      email,
      pseudo,
      password,
      avatar_url: null
    }
  })

  const req = {
    body: {
      email: 'jojo@example.com',
      pseudo: 'Jojo',
      password: 'Password123!'
    }
  }

  const res = createMockRes()

  await register(req, res)

  assert.equal(res.statusCode, 201)
  assert.equal(res.body.user.email, 'jojo@example.com')
  assert.equal(res.body.user.password, undefined)
  assert.equal(typeof res.body.token, 'string')
})

test('Connexion : refuse un email inconnu', async t => {
  t.mock.method(userModel, 'findByEmail', async () => {
    return null
  })

  const req = {
    body: {
      email: 'inconnu@example.com',
      password: 'Password123!'
    }
  }

  const res = createMockRes()

  await login(req, res)

  assert.equal(res.statusCode, 401)
  assert.equal(res.body.detail, 'Email ou mot de passe incorrect.')
})

test('Connexion : refuse un mauvais mot de passe', async t => {
  t.mock.method(userModel, 'findByEmail', async () => {
    return {
      id: 7,
      password: 'empreinte-en-base'
    }
  })

  // Simuler un mot de passe qui ne correspond pas.
  t.mock.method(bcrypt, 'compare', async () => {
    return false
  })

  const req = {
    body: {
      email: 'jojo@example.com',
      password: 'Mauvais123!'
    }
  }

  const res = createMockRes()

  await login(req, res)

  assert.equal(res.statusCode, 401)
})

test('Connexion : renvoie les deux tokens', async t => {
  t.mock.method(userModel, 'findByEmail', async () => {
    return {
      id: 7,
      email: 'jojo@example.com',
      pseudo: 'Jojo',
      password: 'empreinte-en-base',
      avatar_url: null
    }
  })

  t.mock.method(bcrypt, 'compare', async () => {
    return true
  })

  t.mock.method(bcrypt, 'hash', async () => {
    return 'refresh-token-hache'
  })

  let tokenEnregistre = false

  t.mock.method(
    userModel,
    'createRefreshToken',
    async (userId, tokenHash, expiresAt) => {
      assert.equal(userId, 7)
      assert.equal(tokenHash, 'refresh-token-hache')
      assert.ok(expiresAt > new Date())

      tokenEnregistre = true
    }
  )

  const req = {
    body: {
      email: 'jojo@example.com',
      password: 'Password123!'
    }
  }

  const res = createMockRes()

  await login(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(tokenEnregistre, true)
  assert.equal(typeof res.body.accessToken, 'string')
  assert.match(res.body.refreshToken, /^[a-f0-9]{64}$/)
  assert.equal(res.body.user.password, undefined)
})

test('Mot de passe oublié : refuse un email manquant', async () => {
  const req = { body: {} }
  const res = createMockRes()

  await forgotPassword(req, res)

  assert.equal(res.statusCode, 400)
  assert.equal(res.body.title, 'Email manquant')
})