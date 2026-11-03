const { BrevoClient } = require('@getbrevo/brevo');

const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY
});

async function  mailSender  (email, pseudo, token)  {
    if (process.env.NODE_ENV === 'baddies') return;

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
