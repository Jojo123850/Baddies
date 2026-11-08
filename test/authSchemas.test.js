const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const {registerSchema,loginSchema} = require('../schemas/authSchemas')

describe('Validation Zod - Inscription', () => {
  test('Accepte une inscription valide', () => {
    const result = registerSchema.safeParse({
      pseudo: 'Jojo',
      email: 'jojo@example.com',
      password: 'Password123!'
    })

    assert.equal(result.success, true)
  })

  test('Refuse un mot de passe sans caractère spécial', () => {
    const result = registerSchema.safeParse({
      pseudo: 'Jojo',
      email: 'jojo@example.com',
      password: 'Password123'
    })

    assert.equal(result.success, false)
  })

  test('Refuse un email invalide', () => {
    const result = registerSchema.safeParse({
      pseudo: 'Jojo',
      email: 'email-invalide',
      password: 'Password123!'
    })

    assert.equal(result.success, false)
  })

  test('Refuse un champ supplémentaire', () => {
    const result = registerSchema.safeParse({
      pseudo: 'Jojo',
      email: 'jojo@example.com',
      password: 'Password123!',
      role: 'admin'
    })

    assert.equal(result.success, false)
  })
})

describe('Validation Zod - Connexion', () => {

  test('Refuse un email manquant', () => {
    const result = loginSchema.safeParse({
      password: 'Password123!'
    })

    assert.equal(result.success, false)
  })

  test('Refuse un mot de passe manquant', () => {
    const result = loginSchema.safeParse({
      email: 'jojo@example.com'
    })

    assert.equal(result.success, false)
  })
})