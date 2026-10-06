const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_API_KEY
    }
})

const mailSender = async (email, pseudo, token) => {
    const resetLink = `http://localhost:5173/ResetPassword?token=${token}`
    await transporter.sendMail({
        from: `"Baddies" <${process.env.BREVO_SENDER}>`,
        to: email,
        subject: 'Réinitialisation de votre mot de passe',
        text: `Bonjour ${pseudo},
                 Vous avez demandé à réinitialiser votre mot de passe.
                 Cliquez sur le lien pour  réinitialiser votre mot de passe :  
                  ${resetLink}

        Ce token est valable pendant 1 heure.`,

        html:`
        <p>Bonjoour ${pseudo}</p>
       
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>

            <p>
                <a href="${resetLink}">
                    Réinitialiser mon mot de passe
                </a>
            </p>
            <p>Ce lien est valable pendant 1 heure.</p>

            <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>

            `,
})
}
module.exports = mailSender