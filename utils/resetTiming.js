/** @module utils/resetTiming */
const { performance } = require('node:perf_hooks')
const { randomUUID } = require('node:crypto')

/**
 * Crée un chronomètre corrélé par un UUID, sans journaliser les arguments ni les erreurs brutes.
 * @returns {{measure: Function, finish: Function}} Mesure asynchrone et journalisation du total.
 */
module.exports = function resetTiming() {
  const requestId = randomUUID()
  const started = performance.now()
  const log = (step, start, outcome) => console.info(JSON.stringify({
    event: 'password_reset_timing', requestId, step, outcome,
    durationMs: Math.round(performance.now() - start)
  }))
  return {
    /**
     * @param {string} step Nom technique de l'étape.
     * @param {Function} action Opération asynchrone à mesurer.
     * @returns {Promise<*>} Résultat intact de l'opération.
     * @throws {Error} Propage l'erreur originale après journalisation de la durée.
     */
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
