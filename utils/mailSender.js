/** @module utils/mailSender */
const { BrevoClient } = require('@getbrevo/brevo');

const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY
});

/**
 * Demande à Brevo d'envoyer le lien ; aucun envoi si NODE_ENV vaut baddies.
 * @param {string} email Adresse du destinataire.
 * @param {string} pseudo Nom affiché dans le message.
 * @param {string} token Jeton brut de réinitialisation, à ne jamais journaliser.
 * @returns {Promise<void>} Résolue après acceptation par le fournisseur, pas après livraison.
 * @throws {Error} Si le fournisseur refuse l'envoi ou n'est pas joignable.
 */
async function  mailSender  (email, pseudo, token)  {
    try {
        const resetLink = `https://baddies-beryl.vercel.app/ResetPassword?token=${token}`
        await client.transactionalEmails.sendTransacEmail({
        sender: {
        name: "Baddies",
        email: process.env.BREVO_SENDER
        },
        to: [{ email }],
        subject: "Réinitialisation de votre mot de passe",
        textContent: `Bonjour ${pseudo}, cliquez ici : ${resetLink}`,
        htmlContent: `
                <p>Bonjour ${pseudo}</p>
                <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
                <p>
                    <a href="${resetLink}">
                        Réinitialiser mon mot de passe
                    </a>
                </p>
                <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
                <p>Ce lien est valable pendant 1 heure.</p>
            `
        });
        
    } catch (error) {
        console.error('Brevo: échec de l’envoi de réinitialisation');
        throw new Error('Failed : email did not sent')
    }
   
}

module.exports = mailSender
