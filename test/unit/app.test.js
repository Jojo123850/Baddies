const { test } = require('node:test')
const assert = require('node:assert/strict')
const load = require('../helpers/load')

for (const port of [undefined, '4567']) {
  test(`app: démarrage ${port || 'port par défaut'}, routes et CORS`, async t => {
    const old = process.env.PORT
    if (port === undefined) delete process.env.PORT
    else process.env.PORT = port
    t.after(() => { if (old === undefined) delete process.env.PORT; else process.env.PORT = old })
    t.mock.method(console, 'log', () => {})
    let connected = false, listened = false, corsOptions, limitOptions
    const routes = new Map(), mounts = []
    const app = {
      set(name, value) { assert.equal(name, 'trust proxy'); assert.equal(value, 1) },
      get(path, handler) { routes.set(path, handler) },
      use(...args) { mounts.push(args) },
      listen(value, ready) {
        assert.equal(connected, true)
        assert.equal(value, port || 3001)
        listened = true; ready()
      }
    }
    const express = Object.assign(() => app, { json: () => 'json', urlencoded: () => 'urlencoded' })
    const auth = {}, user = {}, history = {}
    load('app.js', {
      express, dotenv: { config() {} },
      './config/db': { connectDB: async () => { connected = true } },
      cors: options => { corsOptions = options; return 'cors' },
      helmet: () => 'helmet',
      'express-rate-limit': options => { limitOptions = options; return 'limiter' },
      './routes/authRoutes': auth, './routes/userRoutes': user, './routes/historyRoutes': history,
      './docs/swagger': target => assert.equal(target, app)
    })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(listened, true)
    assert.ok(corsOptions.origin.includes('https://baddies-beryl.vercel.app'))
    assert.equal(limitOptions.limit, 100)
    assert.equal(limitOptions.windowMs, 900000)
    assert.ok(mounts.findIndex(args => args[0] === 'cors') < mounts.findIndex(args => args[0] === 'limiter'))
    for (const [path, router] of [['/api/v1/auth', auth], ['/api/v1/user', user], ['/api/v1/history', history]]) {
      assert.ok(mounts.some(args => args[0] === path && args[1] === router))
    }
    const res = { status(code) { assert.equal(code, 200); return this }, send(value) { this.body = value } }
    routes.get('/health')({}, res)
    assert.equal(res.body, 'OK')
    routes.get('/')({}, res)
    assert.match(res.body, /Bienvenue/)
  })
}
