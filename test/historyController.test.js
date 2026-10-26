
const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')
require('dotenv').config()

const { pool } = require('../config/db')

const {
  createHistory,
  getHistory,
  getHistoryById,
  deleteHistory
} = require('../controllers/historyController')

// Simuler la réponse Express
const createMockRes = () => {
  return {
    statusCode: 200,
    body: null,
    sent: false,

    status(code) {
      this.statusCode = code
      return this
    },

    json(data) {
      this.body = data
      return this
    },

    send() {
      this.sent = true
      return this
    }
  }
}

describe('History Controller Tests', () => {
  let userA
  let userB
  let historyA
  let historyB

  const testId = `${Date.now()}_${process.pid}`

  const emailA = `history_a_${testId}@example.com`
  const emailB = `history_b_${testId}@example.com`

  // Données fictives d'une évaluation BADDIES
  const evaluation = {
    intensiteNiveau: 'moderee',
    localisations: ['bas-ventre'],
    contextes: ['domicile'],
    symptomes: ['crampes']
  }

  const solutions = [
    {
      titre: 'Appliquer une chaleur douce',
      description: 'Utiliser une bouillotte tiède.'
    }
  ]

  // Préparer deux comptes de test
  before(async () => {
    const resultA = await pool.query(
      `INSERT INTO "Users" (email, password, pseudo)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        emailA,
        'hash_fictif_test',
        `HistoryA_${testId}`
      ]
    )

    const resultB = await pool.query(
      `INSERT INTO "Users" (email, password, pseudo)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        emailB,
        'hash_fictif_test',
        `HistoryB_${testId}`
      ]
    )

    userA = resultA.rows[0]
    userB = resultB.rows[0]
  })

  // Nettoyage après les tests
  after(async () => {
    const ids = [userA?.id, userB?.id].filter(Boolean)

    if (ids.length === 0) return

    // Supprimer uniquement les épisodes des utilisateurs de test
    await pool.query(
      `DELETE FROM "History"
       WHERE user_id = ANY($1::int[])`,
      [ids]
    )

    // Supprimer uniquement les comptes créés par ce fichier
    await pool.query(
      `DELETE FROM "Users"
       WHERE id = ANY($1::int[])`,
      [ids]
    )

    // Ne pas appeler pool.end() :
    // les autres fichiers de tests utilisent le même pool.
  })

  // 1. Enregistrer un épisode
  test('CreateHistory: enregistrer un épisode valide', async () => {
    const req = {
      user: { id: userA.id },
      body: {
        evaluation,
        solutions
      }
    }

    const res = createMockRes()

    await createHistory(req, res)

    assert.equal(res.statusCode, 201)
    assert.equal(res.body.status, 201)
    assert.ok(res.body.history)
    assert.ok(res.body.history.id)
    assert.equal(res.body.history.user_id, userA.id)

    historyA = res.body.history
  })

  // 2. Évaluation manquante
  test('CreateHistory: refuser une évaluation manquante', async () => {
    const req = {
      user: { id: userA.id },
      body: { solutions }
    }

    const res = createMockRes()

    await createHistory(req, res)

    assert.equal(res.statusCode, 400)
    assert.equal(res.body.status, 400)
    assert.ok(res.body.detail)
  })

  // 3. Solutions manquantes
  test('CreateHistory: refuser des solutions manquantes', async () => {
    const req = {
      user: { id: userA.id },
      body: { evaluation }
    }

    const res = createMockRes()

    await createHistory(req, res)

    assert.equal(res.statusCode, 400)
    assert.equal(res.body.status, 400)
    assert.ok(res.body.detail)
  })

  // 4. Enregistrer un épisode pour l'utilisateur B
  test('CreateHistory: enregistrer un épisode pour B', async () => {
    const req = {
      user: { id: userB.id },
      body: {
        evaluation,
        solutions
      }
    }

    const res = createMockRes()

    await createHistory(req, res)

    assert.equal(res.statusCode, 201)
    assert.equal(res.body.history.user_id, userB.id)

    historyB = res.body.history
  })

  // 5. Récupérer la liste des épisodes de A
  test('GetHistory: récupérer les épisodes de A', async () => {
    const req = {
      user: { id: userA.id }
    }

    const res = createMockRes()

    await getHistory(req, res)

    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.body.history))
    assert.equal(res.body.history.length, 1)
    assert.equal(res.body.history[0].id, historyA.id)
  })

  // 6. Vérifier la séparation des comptes
  test('Security: A ne voit pas les épisodes de B', async () => {
    const req = {
      user: { id: userA.id }
    }

    const res = createMockRes()

    await getHistory(req, res)

    assert.equal(res.statusCode, 200)

    const episodeBVisible = res.body.history.some(
      episode => episode.id === historyB.id
    )

    assert.equal(episodeBVisible, false)
  })

  // 7. Récupérer un épisode précis
  test('GetHistoryById: récupérer son propre épisode', async () => {
    const req = {
      user: { id: userA.id },
      params: { id: historyA.id }
    }

    const res = createMockRes()

    await getHistoryById(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.history.id, historyA.id)
  })

  // 8. Refuser l'accès à l'épisode de B
  test('Security: A ne peut pas consulter un épisode de B', async () => {
    const req = {
      user: { id: userA.id },
      params: { id: historyB.id }
    }

    const res = createMockRes()

    await getHistoryById(req, res)

    assert.equal(res.statusCode, 404)
    assert.equal(res.body.status, 404)
  })

  // 9. Épisode inexistant
 
test('GetHistoryById: épisode inexistant', async () => {
  const req = {
    user: { id: userA.id },
    params: {
      id: '00000000-0000-4000-8000-000000000000'
    }
  }

  const res = createMockRes()

  await getHistoryById(req, res)

  assert.equal(res.statusCode, 404)
  assert.equal(res.body.status, 404)
  assert.ok(res.body.detail)
})


  // 10. Refuser la suppression de l'épisode de B
  test('Security: A ne peut pas supprimer un épisode de B', async () => {
    const req = {
      user: { id: userA.id },
      params: { id: historyB.id }
    }

    const res = createMockRes()

    await deleteHistory(req, res)

    assert.equal(res.statusCode, 404)

    // Vérifier que l'épisode B existe toujours en base
    const verification = await pool.query(
      `SELECT id FROM "History"
       WHERE id = $1 AND user_id = $2`,
      [historyB.id, userB.id]
    )

    assert.equal(verification.rowCount, 1)
  })

  // 11. Supprimer son propre épisode
  test('DeleteHistory: supprimer son propre épisode', async () => {
    const req = {
      user: { id: userA.id },
      params: { id: historyA.id }
    }

    const res = createMockRes()

    await deleteHistory(req, res)

    assert.equal(res.statusCode, 204)
    assert.equal(res.sent, true)

    // Vérifier que la suppression est réelle
    const verification = await pool.query(
      `SELECT id FROM "History" WHERE id = $1`,
      [historyA.id]
    )

    assert.equal(verification.rowCount, 0)
  })
  test('GetHistoryById: refuser un UUID invalide', async () => {
  const req = {
    user: { id: userA.id },
    params: { id: '-1' }
  }

  const res = createMockRes()

  await getHistoryById(req, res)

  assert.equal(res.statusCode, 400)
  assert.equal(res.body.status, 400)
})

test('DeleteHistory: refuser un UUID invalide', async () => {
  const req = {
    user: { id: userA.id },
    params: { id: 'identifiant-invalide' }
  }

  const res = createMockRes()

  await deleteHistory(req, res)

  assert.equal(res.statusCode, 400)
  assert.equal(res.body.status, 400)
})
  // 12. Vérifier la liste après suppression
  test('GetHistory: liste vide après suppression', async () => {
    const req = {
      user: { id: userA.id }
    }

    const res = createMockRes()

    await getHistory(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body.history, [])
  })
})
