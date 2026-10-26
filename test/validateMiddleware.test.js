const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const validate = require('../middlewares/validateMiddleware')
const { registerSchema } = require('../schemas/authSchemas')

function createMockRes() {
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

describe('Middleware de validation Zod', () => {

  test('Accepte les données valides et appelle next()', () => {
    const req = {
      body: {
        pseudo: 'Jojo',
        email: 'JOJO@example.com',
        password: 'Password123!'
      }
    }

    const res = createMockRes()
    let nextCalled = false

    const next = () => {
      nextCalled = true
    }

    validate(registerSchema)(req, res, next)

    assert.equal(nextCalled, true)
    assert.equal(res.statusCode, 200)
    assert.equal(req.body.email, 'jojo@example.com')
  })

  test('Refuse un mot de passe faible avec HTTP 422', () => {
    const req = {
      body: {
        pseudo: 'Jojo',
        email: 'jojo@example.com',
        password: 'password'
      }
    }

    const res = createMockRes()
    let nextCalled = false

    validate(registerSchema)(req, res, () => {
      nextCalled = true
    })

    assert.equal(res.statusCode, 422)
    assert.equal(res.body.status, 422)
    assert.equal(nextCalled, false)
    assert.ok(
      res.body.invalidParams.some(
        error => error.path === 'password'
      )
    )
  })

  test('Refuse un champ supplémentaire', () => {
    const req = {
      body: {
        pseudo: 'Jojo',
        email: 'jojo@example.com',
        password: 'Password123!',
        role: 'admin'
      }
    }

    const res = createMockRes()
    let nextCalled = false

    validate(registerSchema)(req, res, () => {
      nextCalled = true
    })

    assert.equal(res.statusCode, 422)
    assert.equal(nextCalled, false)
  })

})