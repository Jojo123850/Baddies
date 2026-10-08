
// ça active le mode strict de JS pour détecter les érreurs courantes et interdire les syntaxes non sécurisés
'use strict'

const { z } = require('zod');

const registerSchema = z.object({
    pseudo: z.string()
        .min(3, {error: "Le pseudo doit contenir au moins 3 caractères"})
        .max(50, {error: "Le pseudo doit pas dépasser 60 caractères"})
        .trim(),
    email: z.email({error: "Adresse email invalide"})
        .trim()
        .toLowerCase(),
    password: z.string()
        .min(6, {error: "Le mot de passe doit au moins contenir 6 caractères"})
        .regex(/[A-Z]/, {error: "Au moins une majuscule requise"})
        .regex(/[0-9]/, {error: "Au moins un chiffre requis"})
        .regex(/[^a-zA-Z0-9]/, {error: "Au moins un caractère spécial est requis"})

}).strict(); //ça interdit tout champ supplémentaire non défini dans l'objet pour éviter le mass assignement (injection de paramètre non désiré)


const loginSchema = z.object({
    email: z.email({error: "Adresse email invalide"})
        .trim()
        .toLowerCase(),
    password: z.string()
        .min(6, {error: "Le mot de passe doit au moins contenir 6 caractères"})
        .regex(/[A-Z]/, {error: "Au moins une majuscule requise"})
        .regex(/[0-9]/, {error: "Au moins un chiffre requis"})
        .regex(/[^a-zA-Z0-9]/, {error: "Au moins un caractère spécial est requis"})

}).strict();

/*
              null    undefined/absent
.nullable()   oui     non
.optional()   non     oui
.nullish()    oui     oui
*/ 

// si avec identifiant
// const loginSchema = z.object({
    // identifiant: z.string()
        // .trim()
        // .min(3, {error: "L'identifiant doit contenir au moins 3 caractères"})
        // .refine(
            // value => validator.isEmail(value || /^[a-zA-Z0-9_-]+$/.test(value),
            // {error: "Veuillez saisir un email ou un pseudo valide"})
        // ),
    // password: z.string()
        // .min(6, { error: "Le mot de passe doit contenir au moins 6 caractères"})
        // .regex(/[A-Z]/, { error: "Au moins une majuscule est requise"})
        // .regex(/[0-9]/, { error: "Au moins un chiffre est requis"})
        // .regex(/[^a-zA-Z0-9]/, { error: "Au moins un caractère spécial est requis"})
// }).strict()

module.exports = {registerSchema, loginSchema}

 