const { test } = require('node:test')
const assert = require('node:assert/strict')
const load = require('../helpers/load')

for (const [id, accepted] of [[7, true], [0, false], [-1, false], [1.2, false], [Number.MAX_SAFE_INTEGER + 1, false], ['0', false], ['abc', false], [undefined, false], ['9223372036854775807', true]]) {
  test(`authMiddleware: validation BIGINT ${String(id)}`, async () => {
    let calls = 0, next = false
    const middleware = load('middlewares/authMiddleware.js', {
      jsonwebtoken: { verify: () => ({ id }) },
      '../config/db': { pool: { async query(sql, params) { calls++; assert.deepEqual(params, [id]); return { rows: [{ id }] } } } }
    })
    const res = { status(code) { this.code = code; return this }, json() {} }
    await middleware({ headers: { authorization: 'Bearer test' } }, res, () => { next = true })
    assert.equal(next, accepted)
    assert.equal(calls, accepted ? 1 : 0)
    if (!accepted) assert.equal(res.code, 401)
  })
}

test('connectDB: libère le client en succès, journalise un échec', async t => {
  let released = false
  t.mock.method(console, 'log', () => {})
  t.mock.method(console, 'error', () => {})
  const db = load('config/db.js', { pg: { Pool: class { async connect() { return { release() { released = true } } } } } })
  await db.connectDB()
  assert.equal(released, true)
  const broken = load('config/db.js', { pg: { Pool: class { async connect() { throw new Error('offline') } } } })
  await broken.connectDB()
  assert.equal(console.error.mock.callCount(), 1)
})
for (const outcome of ['success', 'failure', 'disabled']) {
  test(`mailSender: ${outcome}, aucun email réel`, async t => {
    t.mock.method(console, 'error', () => {})
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = outcome === 'disabled' ? 'baddies' : 'test'
    let calls = 0
    const send = load('utils/mailSender.js', { '@getbrevo/brevo': { BrevoClient: class {
      transactionalEmails = { async sendTransacEmail(payload) {
        calls++
        assert.deepEqual(payload.to, [{ email: 'test@example.invalid' }])
        assert.match(payload.textContent, /ResetPassword\?token=test-token/)
        if (outcome === 'failure') throw new Error('provider secret')
      } }
    } } })
    try {
      if (outcome === 'failure') {
        await assert.rejects(send('test@example.invalid', 'Tester', 'test-token'), /email did not sent/)
        assert.ok(!JSON.stringify(console.error.mock.calls).includes('provider secret'))
      } else await send('test@example.invalid', 'Tester', 'test-token')
      assert.equal(calls, outcome === 'disabled' ? 0 : 1)
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previous
    }
  })
}

for (const scenario of ['valid', 'missing', 'badHeader', 'expired', 'invalid', 'notBefore', 'database', 'deleted', 'invalidId']) {
  test(`authMiddleware: ${scenario}`, async t => {
    t.mock.method(console, 'error', () => {})
    let queried = 0, next = 0
    const middleware = load('middlewares/authMiddleware.js', {
      jsonwebtoken: { verify() {
        const names = { expired: 'TokenExpiredError', invalid: 'JsonWebTokenError', notBefore: 'NotBeforeError' }
        if (names[scenario]) throw Object.assign(new Error('jwt'), { name: names[scenario] })
        return { id: scenario === 'invalidId' ? '9223372036854775808' : '7' }
      } }, '../config/db': { pool: { async query() {
        queried++
        if (scenario === 'database') throw new Error('offline')
        return { rows: scenario === 'deleted' ? [] : [{ id: '7' }] }
      } } }
    })
    const req = { headers: { authorization: scenario === 'missing' ? undefined : scenario === 'badHeader' ? 'Basic abc' : 'Bearer abc' } }
    const res = { status(value) { this.statusCode = value; return this }, json(body) { this.body = body; return this } }
    await middleware(req, res, () => next++)
    assert.equal(next, scenario === 'valid' ? 1 : 0)
    if (scenario === 'valid') assert.deepEqual(req.user, { id: '7' })
    else assert.equal(res.statusCode, scenario === 'database' ? 500 : 401)
    if (['missing', 'badHeader', 'expired', 'invalid', 'notBefore', 'invalidId'].includes(scenario)) assert.equal(queried, 0)
  })
}
