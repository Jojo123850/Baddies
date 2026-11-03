const Module = require('node:module')
const path = require('node:path')
const fs = require('node:fs')

// Charge le vrai fichier source, en isolant seulement ses dépendances externes.
module.exports = function load(relative, stubs = {}) {
  const filename = path.resolve(__dirname, '../..', relative)
  const instance = new Module(filename, module)
  instance.filename = filename
  instance.paths = Module._nodeModulePaths(path.dirname(filename))
  const realRequire = instance.require.bind(instance)
  instance.require = name => Object.hasOwn(stubs, name) ? stubs[name] : realRequire(name)
  instance._compile(fs.readFileSync(filename, 'utf8'), filename)
  return instance.exports
}
