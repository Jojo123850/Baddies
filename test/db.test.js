const { test } = require('node:test')
const assert = require('node:assert/strict')
const { pool, connectDB } = require('../config/db')

test('connectDB : libère la connexion après une réussite', async t => {
  let connexionLiberee = false

  // Simuler une connexion PostgreSQL.
  t.mock.method(pool, 'connect', async () => {
    return {
      release() {
        connexionLiberee = true
      }
    }
  })

  // Éviter d’afficher le message de réussite pendant le test.
  t.mock.method(console, 'log', () => {})

  await connectDB()

  assert.equal(connexionLiberee, true)
})

test('connectDB : affiche l’erreur si la connexion échoue', async t => {
  const panne = new Error('Connexion impossible')
  let erreurAffichee = null

  // Simuler une connexion qui échoue.
  t.mock.method(pool, 'connect', async () => {
    throw panne
  })

  // Récupérer l’erreur au lieu de l’afficher.
  t.mock.method(console, 'error', (message, erreur) => {
    erreurAffichee = erreur
  })

  await connectDB()

  assert.equal(erreurAffichee, panne)
})