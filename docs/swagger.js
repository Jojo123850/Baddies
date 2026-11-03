const swaggerUi = require('swagger-ui-express')
const specification = require('./openapi.json')

/**
 * Monte Swagger UI et le contrat OpenAPI quand la documentation est activée.
 * @param {Object} app Application Express.
 * @returns {void}
 */
module.exports = function setupSwagger(app) {
  if (process.env.ENABLE_API_DOCS !== 'true') return
  app.get('/openapi.json', (req, res) => res.json(specification))
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specification, {
    swaggerOptions: { supportedSubmitMethods: [], persistAuthorization: false }
  }))
}
