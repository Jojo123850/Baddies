const { test } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const parser = require('@apidevtools/swagger-parser')
const specification = require('../../docs/openapi.json')
const setupSwagger = require('../../docs/swagger')
const load = require('../helpers/load')

test('OpenAPI: contrat valide et routes Express documentées', async () => {
  await parser.validate(structuredClone(specification))
  const noop = (req, res) => res.end()
  const controllers = Object.fromEntries(['register', 'login', 'forgotPassword', 'resetPassword', 'refreshTokens', 'logout', 'updateProfile', 'createHistory', 'getHistory', 'getHistoryById', 'deleteHistory'].map(name => [name, noop]))
  for (const [file, prefix] of [['authRoutes', '/api/v1/auth'], ['userRoutes', '/api/v1/user'], ['historyRoutes', '/api/v1/history']]) {
    const router = load(`routes/${file}.js`, {
      '../controllers/authController': controllers,
      '../controllers/historyController': controllers,
      '../middlewares/authMiddleware': (req, res, next) => next()
    })
    for (const layer of router.stack.filter(layer => layer.route)) {
      const path = (prefix + (layer.route.path === '/' ? '' : layer.route.path)).replace(':id', '{id}')
      for (const method of Object.keys(layer.route.methods)) {
        assert.ok(specification.paths[path]?.[method], `${method} ${path} documentée`)
      }
    }
  }
  assert.deepEqual(specification.paths['/api/v1/history'].get.security, [{ bearerAuth: [] }])
  assert.equal(specification.paths['/api/v1/history/{id}'].delete.responses['204'].content, undefined)
})
for (const enabled of [false, true]) {
  test(`Swagger HTTP: documentation ${enabled ? 'activée' : 'désactivée'}`, async t => {
    const old = process.env.ENABLE_API_DOCS
    process.env.ENABLE_API_DOCS = String(enabled)
    const app = express()
    try { setupSwagger(app) } finally {
      if (old === undefined) delete process.env.ENABLE_API_DOCS
      else process.env.ENABLE_API_DOCS = old
    }
    const server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    t.after(() => new Promise(resolve => server.close(resolve)))
    const base = `http://127.0.0.1:${server.address().port}`
    const contract = await fetch(`${base}/openapi.json`)
    assert.equal(contract.status, enabled ? 200 : 404)
    const ui = await fetch(`${base}/api-docs/`)
    assert.equal(ui.status, enabled ? 200 : 404)
    if (enabled) {
      assert.equal((await contract.json()).info.title, 'BADDIES API')
      assert.match(await ui.text(), /swagger-ui/)
      const init = await fetch(`${base}/api-docs/swagger-ui-init.js`)
      assert.match(await init.text(), /"supportedSubmitMethods": \[\]/)
    }
  })
}
