const { test } = require('node:test')
const assert = require('node:assert/strict')
const load = require('../helpers/load')
const token = 'a'.repeat(64)
function response() {
  return { status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this }, send() { return this } }
}
function auth(overrides = {}, bcrypt = {}, mailSender = async () => {}) {
  const user = { id: 7, email: 'test@example.invalid', pseudo: 'Tester', password: 'hash', avatar_url: null }
  const model = {
    findByEmailOrPseudo: async () => null, findByEmail: async () => user,
    createUser: async () => user, createRefreshToken: async () => ({}),
    createToken: async () => ({}), findValidResetTokens: async () => [{ id: 8, user_id: 7, token_hash: 'hash' }],
    changePasswordAndClearToken: async () => true,
    findValidRefreshTokens: async () => [{ id: 8, user_id: 7, token_hash: 'hash' }],
    rotateRefreshToken: async () => true, findProfileConflict: async () => null,
    updateUser: async () => user, revokeRefreshTokenById: async () => true,
    ...overrides
  }
  return load('controllers/authController.js', {
    '../models/userModel': model, '../utils/mailSender': mailSender,
    bcrypt: { hash: async () => 'hashed-value', compare: async () => true, ...bcrypt },
    jsonwebtoken: { sign: () => 'signed-access-token' },
    '../utils/resetTiming': () => ({ measure: async (step, action) => action(), finish() {} })
  })
}
const fail = async () => { throw new Error('simulated outage') }
const cases = [
  ['register', { email: 'a', password: 'Password1!', pseudo: 'Tester' }, {}, {}, 201],
  ['register', {}, { findByEmailOrPseudo: async () => ({ id: 7 }) }, {}, 409],
  ['register', {}, { findByEmailOrPseudo: fail }, {}, 500],
  ['register', {}, { findByEmailOrPseudo: async () => { throw Object.assign(new Error(), { code: '23505' }) } }, {}, 409],
  ['login', {}, { findByEmail: async () => null }, {}, 401],
  ['login', {}, {}, { compare: async () => false }, 401],
  ['login', {}, {}, {}, 200],
  ['login', {}, { createRefreshToken: fail }, {}, 500],
  ['forgotPassword', undefined, {}, {}, 400],
  ['forgotPassword', { email: 'a' }, { findByEmail: async () => null }, {}, 200],
  ['forgotPassword', { email: 'a' }, {}, {}, 200],
  ['forgotPassword', { email: 'a' }, { createToken: fail }, {}, 500],
  ['resetPassword', undefined, {}, {}, 400],
  ['resetPassword', { token: 'bad', newPassword: 'Password1!' }, {}, {}, 401],
  ['resetPassword', { token: 123, newPassword: 'Password1!' }, {}, {}, 401],
  ['resetPassword', { token, newPassword: 'weak' }, {}, {}, 400],
  ['resetPassword', { token, newPassword: 12 }, {}, {}, 400],
  ['resetPassword', { token, newPassword: 'Password1!' }, {}, { compare: async () => false }, 401],
  ['resetPassword', { token, newPassword: 'Password1!' }, { changePasswordAndClearToken: async () => false }, {}, 401],
  ['resetPassword', { token, newPassword: 'Password1!' }, {}, {}, 200],
  ['resetPassword', { token, newPassword: 'Password1!' }, { findValidResetTokens: fail }, {}, 500],
  ['refreshTokens', undefined, {}, {}, 400],
  ['refreshTokens', { token: 'bad' }, {}, {}, 401],
  ['refreshTokens', { token }, {}, { compare: async () => false }, 401],
  ['refreshTokens', { token }, { rotateRefreshToken: async () => false }, {}, 401],
  ['refreshTokens', { token }, {}, {}, 200],
  ['refreshTokens', { token }, { rotateRefreshToken: fail }, {}, 500],
  ['logout', undefined, {}, {}, 400],
  ['logout', { token }, {}, {}, 200],
  ['logout', { token }, {}, { compare: async () => false }, 200],
  ['logout', { token }, { revokeRefreshTokenById: fail }, {}, 500],
  ['updateProfile', undefined, {}, {}, 400],
  ['updateProfile', [], {}, {}, 400],
  ['updateProfile', {}, {}, {}, 400],
  ['updateProfile', { email: 12 }, {}, {}, 400],
  ['updateProfile', { pseudo: 12 }, {}, {}, 400],
  ['updateProfile', { password: 12 }, {}, {}, 400],
  ['updateProfile', { avatar_url: 12 }, {}, {}, 400],
  ['updateProfile', { email: 'bad' }, {}, {}, 400],
  ['updateProfile', { pseudo: '  ' }, {}, {}, 400],
  ...['', '//remote', '/white space', '/back\\slash', 'https://remote', '/'+'a'.repeat(2049)].map(avatar_url => ['updateProfile', { avatar_url }, {}, {}, 400]),
  ['updateProfile', { password: 'weak' }, {}, {}, 400],
  ['updateProfile', { pseudo: 'New' }, { findProfileConflict: async () => ({ id: 8 }) }, {}, 409],
  ['updateProfile', { pseudo: 'New' }, { updateUser: async () => null }, {}, 401],
  ['updateProfile', { pseudo: 'New' }, {}, {}, 200],
  ['updateProfile', { password: 'Password1!', email: 'test@example.invalid', avatar_url: '/avatar.png' }, {}, {}, 200],
  ['updateProfile', { pseudo: 'New' }, { updateUser: fail }, {}, 500],
  ['updateProfile', { pseudo: 'New' }, { updateUser: async () => { throw Object.assign(new Error(), { code: '23505' }) } }, {}, 409],
]
for (const [index, [name, body, model, bcrypt, status]] of cases.entries()) {
  test(`authController ${name} cas ${index + 1} → ${status}`, async t => {
    t.mock.method(console, 'error', () => {})
    const res = response()
    await auth(model, bcrypt)[name]({ body, user: { id: 7 } }, res)
    assert.equal(res.statusCode, status)
    assert.equal(res.body.status, status)
    if (name === 'login' && status === 200) {
      assert.equal(res.body.accessToken, 'signed-access-token')
      assert.match(res.body.refreshToken, /^[a-f0-9]{64}$/)
      assert.equal(res.body.user.password, undefined)
    }
  })
}
test('forgotPassword: erreur du fournisseur email → 500', async () => {
  const res = response()
  await auth({}, {}, fail).forgotPassword({ body: { email: 'test@example.invalid' } }, res)
  assert.equal(res.statusCode, 500)
})

for (const name of ['createHistory', 'getHistory', 'getHistoryById', 'deleteHistory']) {
  for (const scenario of ['success', 'database', ...(['getHistoryById', 'deleteHistory'].includes(name) ? ['invalidId', 'missing'] : name === 'createHistory' ? ['missingBody'] : [])]) {
    test(`historyController ${name}: ${scenario}`, async t => {
      t.mock.method(console, 'error', () => {})
      let called = false
      const model = { async [name](...args) {
        called = true
        assert.ok(args.includes(7), 'La requête est rattachée au compte authentifié')
        if (scenario === 'database') throw new Error('offline')
        return scenario === 'missing' ? null : name === 'getHistory' ? [] : name === 'deleteHistory' ? true : { id: 'episode' }
      } }
      const controller = load('controllers/historyController.js', { '../models/historyModel': model })
      const res = response()
      await controller[name]({ body: scenario === 'missingBody' ? undefined : { evaluation: {}, solutions: [] }, user: { id: 7 }, params: { id: scenario === 'invalidId' ? 'bad' : '12345678-1234-1234-1234-123456789abc' } }, res)
      const status = scenario === 'database' ? 500 : ['invalidId', 'missingBody'].includes(scenario) ? 400 : scenario === 'missing' ? 404 : name === 'createHistory' ? 201 : name === 'deleteHistory' ? 204 : 200
      assert.equal(res.statusCode, status)
      if (['invalidId', 'missingBody'].includes(scenario)) assert.equal(called, false)
    })
  }
}
