const historyModel = require('../models/historyModel')

// Enregistrer une évaluation terminée
const createHistory = async (req, res) => {
    try {
        const {evaluation, solutions} = req.body

         if (!evaluation || !solutions) {
            return res.status(400).json({
                error: 'Évaluation et solutions obligatoires.'
            })
        }

        const userId = req.user.id

        const history = await historyModel.createHistory(userId, evaluation, solutions)

         res.status(201).json({
            message: 'Episode enregistré avec succès', history
    })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: 'Erreur serveur.' })
    }

}


const getHistory = async (req, res) => {
    try {
        const userId = req.user.id

        const history = await historyModel.getHistory(userId)

         res.status(201).json({
            history
    })
        
    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: 'Erreur serveur.' })
        
    }
}


const getHistoryById = async (req, res) => {
    try {
        const userId = req.user.id
        const { id } = req.params

        const history = await historyModel.getHistoryById(id, userId)

        if (!history) {
            return res.status(404).json({
                error: 'Épisode introuvable.'
            })
        }

        return res.status(200).json({
            history
        })

    } catch (error) {
        console.log(error)

        return res.status(500).json({
            error: 'Erreur serveur.'
        })
    }
}


module.exports = {createHistory, getHistory, getHistoryById}