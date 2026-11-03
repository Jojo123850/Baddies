const { performance } = require('node:perf_hooks')
const { randomUUID } = require('node:crypto')

module.exports = function resetTiming() {
  const requestId = randomUUID()
  const started = performance.now()
  const log = (step, start, outcome) => console.info(JSON.stringify({
    event: 'password_reset_timing', requestId, step, outcome,
    durationMs: Math.round(performance.now() - start)
  }))
  return {
    async measure(step, action) {
      const start = performance.now()
      try {
        const result = await action()
        log(step, start, 'ok')
        return result
      } catch (error) {
        log(step, start, 'error')
        throw error
      }
    },
    finish(outcome) { log('total', started, outcome) }
  }
}
