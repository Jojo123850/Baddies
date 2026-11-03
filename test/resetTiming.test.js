const { test } = require('node:test')
const assert = require('node:assert/strict')
const resetTiming = require('../utils/resetTiming')

test('timings preserve results and errors without logging their contents', async () => {
  const entries = []
  const original = console.info
  console.info = message => entries.push(JSON.parse(message))
  try {
    const timing = resetTiming()
    const sensitive = { email: 'private@example.invalid', token: 'secret' }
    assert.equal(await timing.measure('database_lookup', async () => sensitive), sensitive)
    const failure = new Error('secret provider payload')
    await assert.rejects(timing.measure('brevo_send', async () => { throw failure }), error => error === failure)
    timing.finish('error')
    assert.deepEqual(entries.map(entry => entry.outcome), ['ok', 'error', 'error'])
    assert.equal(new Set(entries.map(entry => entry.requestId)).size, 1)
    assert.ok(entries.every(entry => Number.isFinite(entry.durationMs) && entry.durationMs >= 0))
    assert.ok(!JSON.stringify(entries).includes('secret'))
    assert.ok(!JSON.stringify(entries).includes('private@'))
  } finally {
    console.info = original
  }
})
