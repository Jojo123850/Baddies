const { test } = require('node:test')
const assert = require('node:assert/strict')
const { BrevoClient } = require('@getbrevo/brevo')

process.env.BREVO_API_KEY = 'cle-fictive-de-test'
process.env.BREVO_SENDER = 'baddies@example.com'

const mailSender = require('../utils/mailSender')

// Retrouver l’objet qui définit les méthodes d’envoi Brevo.
const client = new BrevoClient({
  apiKey: 'cle-fictive-de-test'
})

const methodesEmail = Object.getPrototypeOf(
  client.transactionalEmails
)

test('mailSender : prépare correctement l’email', async t => {
  let messageEnvoye = null

  // Remplacer l’envoi Brevo par une simple mémorisation.
  t.mock.method(
    methodesEmail,
    'sendTransacEmail',
    async message => {
      messageEnvoye = message
    }
  )

  await mailSender('jojo@example.com', 'Jojo', 'token-test')

  const lien =
    'https://baddies-beryl.vercel.app/ResetPassword?token=token-test'

  assert.deepEqual(messageEnvoye.to, [
    { email: 'jojo@example.com' }
  ])

  assert.equal(messageEnvoye.sender.email, 'baddies@example.com')

  assert.equal(
    messageEnvoye.subject,
    'Réinitialisation de votre mot de passe'
  )

  assert.ok(messageEnvoye.textContent.includes('Jojo'))
  assert.ok(messageEnvoye.textContent.includes(lien))
  assert.ok(messageEnvoye.htmlContent.includes(lien))
})

test('mailSender : signale un échec de Brevo', async t => {
  t.mock.method(console, 'error', () => {})

  t.mock.method(
    methodesEmail,
    'sendTransacEmail',
    async () => {
      throw new Error('Brevo indisponible')
    }
  )

  await assert.rejects(
    () => mailSender('jojo@example.com', 'Jojo', 'token-test'),
    /Failed : email did not sent/
  )
})