const { test } = require('node:test')
const assert = require('node:assert/strict')
const load = require('../helpers/load')

const cases = [
  ['findByEmailOrPseudo', ['mail', 'pseudo'], ['mail', 'pseudo'], false],
  ['findByEmail', ['mail'], ['mail'], false],
  ['findByEmailExcludingId', ['mail', 7], ['mail', 7], false],
  ['findById', [7], [7], false],
  ['createUser', ['mail', 'hash', 'pseudo', null], ['mail', 'hash', 'pseudo', null], false],
  ['changeUser', ['pseudo', 'mail', 'hash', '/avatar', 7], ['pseudo', 'mail', 'hash', '/avatar', 7], false],
  ['createToken', [7, 'hash', 'date'], [7, 'hash', 'date'], false],
  ['findValidResetTokens', [], undefined, true],
  ['createRefreshToken', [7, 'hash', 'date'], [7, 'hash', 'date'], false],
  ['findValidRefreshTokens', [], undefined, true],
  ['findProfileConflict', [7, 'mail', 'pseudo'], [7, 'mail', 'pseudo'], false],
]
for (const [name, args, expected, list] of cases) {
  test(`userModel.${name}: paramètres SQL, résultat et absence`, async () => {
    let rows = [{ id: 7 }]
    const model = load('models/userModel.js', { '../config/db': { pool: { async query(sql, params) {
      assert.equal(typeof sql, 'string')
      assert.deepEqual(params, expected)
      return { rows }
    } } } })
    assert.deepEqual(await model[name](...args), list ? rows : rows[0])
    rows = []
    assert.deepEqual(await model[name](...args), list ? [] : name.startsWith('create') ? undefined : null)
  })
}
test('Révocation: nombre de sessions et token déjà révoqué', async () => {
  let rowCount = 2
  const model = load('models/userModel.js', { '../config/db': { pool: { query: async () => ({ rowCount }) } } })
  assert.equal(await model.revokeUserRefreshTokens(7), 2)
  rowCount = 1
  assert.equal(await model.revokeRefreshTokenById(8), true)
  rowCount = 0
  assert.equal(await model.revokeRefreshTokenById(8), false)
})

const transactions = [
  ['changePasswordAndClearToken', ['hash', 7, 8], 7],
  ['rotateRefreshToken', [8, 7, 'hash', 'date'], 5],
  ['updateUser', [7, { email: null, pseudo: 'new', hashedPassword: 'hash', avatarUrl: null }], 5],
]
for (const [name, args, expectedCalls] of transactions) {
  for (const scenario of ['success', 'missingUser', 'error', ...(name !== 'updateUser' ? ['consumedToken'] : ['noPassword', 'undefinedPassword', 'missingResult'])]) {
    test(`${name}: ${scenario}, transaction et libération du client`, async () => {
      const queries = []
      let released = 0
      const failure = new Error('database unavailable')
      const client = {
        async query(sql) {
          queries.push(sql)
          if (scenario === 'error' && queries.length === 3) throw failure
          const absent = (scenario === 'missingUser' && queries.length === 2) ||
            (scenario === 'consumedToken' && queries.length === 3)
          return { rowCount: absent ? 0 : 1, rows: scenario === 'missingResult' ? [] : [{ id: 7 }] }
        }, release() { released++ }
      }
      const model = load('models/userModel.js', { '../config/db': { pool: { connect: async () => client } } })
      const input = structuredClone(args)
      if (scenario === 'noPassword') input[1].hashedPassword = null
      if (scenario === 'undefinedPassword') delete input[1].hashedPassword
      if (scenario === 'error') {
        await assert.rejects(model[name](...input), error => error === failure)
        assert.equal(queries.at(-1), 'ROLLBACK')
      } else {
        const result = await model[name](...input)
        if (scenario === 'missingUser' || scenario === 'consumedToken') {
          assert.equal(result, name === 'updateUser' ? null : false)
          assert.equal(queries.at(-1), 'ROLLBACK')
          assert.ok(!queries.some(sql => sql.startsWith('INSERT')))
          if (scenario === 'missingUser') assert.ok(!queries.some(sql => sql.startsWith('UPDATE')))
        } else {
          assert.deepEqual(result, name === 'updateUser' ? (scenario === 'missingResult' ? null : { id: 7 }) : true)
          assert.equal(queries.at(-1), 'COMMIT')
          assert.equal(queries.length, expectedCalls - (['noPassword', 'undefinedPassword'].includes(scenario) ? 1 : 0))
        }
      }
      assert.equal(released, 1)
    })
  }
}
test('historyModel: isolation utilisateur, sérialisation et absence', async () => {
  const calls = []
  let rows = [{ id: 'episode' }], rowCount = 1
  const model = load('models/historyModel.js', { '../config/db': { pool: { async query(sql, params) {
    calls.push({ sql, params }); return { rows, rowCount }
  } } } })
  assert.deepEqual(await model.createHistory(7, { pain: 2 }, []), rows[0])
  assert.deepEqual(calls.at(-1).params, [7, '{"pain":2}', '[]'])
  assert.deepEqual(await model.getHistory(7), rows)
  assert.deepEqual(await model.getHistoryById('episode', 7), rows[0])
  assert.deepEqual(calls.at(-1).params, ['episode', 7])
  assert.match(calls.at(-1).sql, /user_id = \$2/)
  assert.equal(await model.deleteHistory('episode', 7), true)
  assert.deepEqual(calls.at(-1).params, ['episode', 7])
  rows = []; rowCount = 0
  assert.equal(await model.getHistoryById('other', 7), null)
  assert.equal(await model.deleteHistory('other', 7), false)
})
