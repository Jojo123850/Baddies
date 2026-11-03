/** @module middlewares/validateMiddleware */


// middleware générique de validation zod
/**
 * Valide le corps avec Zod, applique les transformations ou répond HTTP 422.
 * @param {Object} schema Schéma Zod exposant safeParse.
 * @returns {Function} Middleware Express (req, res, next).
 */
function validateBody(schema) {
    return(req, res, next) => {
            const result = schema.safeParse(req.body);
            if(!result.success){
                return res.status(422).json({
                    title: "Données invalides",
                    status: 422,
                    invalidParams: result.error.issues.map(err => ({
                        path: err.path.join("."),
                        message: err.message
                    }))
                })
            }
            // si on arrive ici, on a passé la validation, on envoye les données sur body et on passe à la suite
            req.body = result.data;
            next();
    }

}
module.exports = validateBody
