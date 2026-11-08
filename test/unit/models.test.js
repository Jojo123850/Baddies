const { test } = require('node:test')
const assert = require('node:assert/strict')

const { pool } = require('../../config/db')
const userModel = require('../../models/userModel')
const historyModel = require('../../models/historyModel')

test('findByEmail : renvoie le compte trouvé', async t => {
  const compte = {
    id: 7,
    email: 'jojo@example.com'
  }

  t.mock.method(pool, 'query', async (sql, params) => {
    // Vérifier la valeur transmise séparément au SQL.
    assert.deepEqual(params, ['jojo@example.com'])

    return { rows: [compte] }
  })

  const resultat = await userModel.findByEmail('jojo@example.com')

  assert.deepEqual(resultat, compte)
})

test('findByEmail : renvoie null si aucun compte ne correspond', async t => {
  t.mock.method(pool, 'query', async () => {
    return { rows: [] }
  })

  const resultat = await userModel.findByEmail('inconnu@example.com')

  assert.equal(resultat, null)
})

test('getHistoryById : utilise l’identifiant de l’épisode et du compte', async t => {
  const episode = { id: 'episode-test', user_id: 7 }

  t.mock.method(pool, 'query', async (sql, params) => {
    assert.deepEqual(params, ['episode-test', 7])

    // Vérifier que la requête filtre aussi par utilisateur.
    assert.match(sql, /user_id\s*=\s*\$2/)

    return { rows: [episode] }
  })

  const resultat = await historyModel.getHistoryById('episode-test', 7)

  assert.deepEqual(resultat, episode)
})

test('getHistoryById : renvoie null si aucun épisode ne correspond', async t => {
  t.mock.method(pool, 'query', async () => {
    return { rows: [] }
  })

  const resultat = await historyModel.getHistoryById('episode-inconnu', 7)

  assert.equal(resultat, null)
})

test('deleteHistory : indique si une ligne a été supprimée', async t => {
  t.mock.method(pool, 'query', async (sql, params) => {
    assert.deepEqual(params, ['episode-test', 7])

    return { rowCount: 1 }
  })

  const resultat = await historyModel.deleteHistory('episode-test', 7)

  assert.equal(resultat, true)
})

test('deleteHistory : renvoie false si aucune ligne n’a été supprimée', async t => {
  t.mock.method(pool, 'query', async () => {
    return { rowCount: 0 }
  })

  const resultat = await historyModel.deleteHistory('episode-inconnu', 7)

  assert.equal(resultat, false)
})

test('rotateRefreshToken : valide la transaction et libère la connexion', async t => {
  const requetes = []
  let connexionLiberee = false

  const client = {
    async query(sql) {
      requetes.push(sql)

      // Simuler un compte trouvé et un ancien token actif.
      return { rowCount: 1, rows: [{ id: 7 }] }
    },

    release() {
      connexionLiberee = true
    }
  }

  t.mock.method(pool, 'connect', async () => {
    return client
  })

  const expiration = new Date(Date.now() + 60 * 60 * 1000)

  const resultat = await userModel.rotateRefreshToken(
    8,
    7,
    'nouvelle-empreinte',
    expiration
  )

  assert.equal(resultat, true)
  assert.equal(requetes[0], 'BEGIN')
  assert.equal(requetes[requetes.length - 1], 'COMMIT')
  assert.equal(connexionLiberee, true)
})

test('rotateRefreshToken : annule la transaction en cas d’erreur', async t => {
  const requetes = []
  let connexionLiberee = false

  const client = {
    async query(sql) {
      requetes.push(sql)

      // Simuler une panne pendant la recherche du compte.
      if (sql.includes('SELECT')) {
        throw new Error('Base indisponible')
      }

      return { rowCount: 1, rows: [] }
    },

    release() {
      connexionLiberee = true
    }
  }

  t.mock.method(pool, 'connect', async () => {
    return client
  })

  const expiration = new Date(Date.now() + 60 * 60 * 1000)

  await assert.rejects(
    () => userModel.rotateRefreshToken(
      8,
      7,
      'nouvelle-empreinte',
      expiration
    ),
    /Base indisponible/
  )

  assert.equal(requetes[requetes.length - 1], 'ROLLBACK')
  assert.equal(connexionLiberee, true)
})