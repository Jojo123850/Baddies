const parser = require('@apidevtools/swagger-parser')
parser.validate(require('../docs/openapi.json'))
  .then(() => console.log('OpenAPI 3 : contrat valide.'))
  .catch(error => { console.error(error.message); process.exitCode = 1 })
