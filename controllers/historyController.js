
const historyModel = require('../models/historyModel')

// Vérifier le format des identifiants UUID
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Enregistrer une évaluation terminée
const createHistory = async (req, res) => {
  try {
    const { evaluation, solutions } = req.body || {}

    // Vérifier que les données obligatoires sont présentes
    if (!evaluation || !solutions) {
      return res.status(400).json({
        title: 'Données manquantes',
        status: 400,
        detail: 'Évaluation et solutions obligatoires.'
      })
    }

    const userId = req.user.id

    const history = await historyModel.createHistory(
      userId,
      evaluation,
      solutions
    )

    return res.status(201).json({
      title: 'Épisode enregistré',
      status: 201,
      detail: 'Épisode enregistré avec succès.',
      history
    })

  } catch (error) {
    console.error('Erreur création historique :', error)

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: "Impossible d'enregistrer cet épisode."
    })
  }
}

// Récupérer les épisodes de l'utilisateur connecté
const getHistory = async (req, res) => {
  try {
    const userId = req.user.id

    const history = await historyModel.getHistory(userId)

    return res.status(200).json({
      title: 'Historique récupéré',
      status: 200,
      detail: 'Historique récupéré avec succès.',
      history
    })

  } catch (error) {
    console.error('Erreur récupération historique :', error)

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: "Impossible de récupérer l'historique."
    })
  }
}

// Récupérer un épisode précis par son UUID
const getHistoryById = async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params

    // Vérifier le format UUID avant d'interroger PostgreSQL
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        title: 'Identifiant invalide',
        status: 400,
        detail: "L'identifiant de l'épisode doit être un UUID valide."
      })
    }

    const history = await historyModel.getHistoryById(id, userId)

    // Épisode inexistant ou appartenant à un autre utilisateur
    if (!history) {
      return res.status(404).json({
        title: 'Épisode introuvable',
        status: 404,
        detail: 'Aucun épisode trouvé pour cet identifiant.'
      })
    }

    return res.status(200).json({
      title: 'Épisode récupéré',
      status: 200,
      detail: 'Épisode récupéré avec succès.',
      history
    })

  } catch (error) {
    console.error('Erreur récupération épisode :', error)

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: 'Impossible de récupérer cet épisode.'
    })
  }
}

// Supprimer un épisode appartenant à l'utilisateur connecté
const deleteHistory = async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params

    // Vérifier le format UUID avant la suppression
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        title: 'Identifiant invalide',
        status: 400,
        detail: "L'identifiant de l'épisode doit être un UUID valide."
      })
    }

    const deleted = await historyModel.deleteHistory(id, userId)

    // Refuser la suppression si l'épisode n'existe pas
    // ou appartient à un autre utilisateur
    if (!deleted) {
      return res.status(404).json({
        title: 'Épisode introuvable',
        status: 404,
        detail: 'Aucun épisode trouvé pour cet identifiant.'
      })
    }

    // 204 No Content : aucune réponse JSON
    return res.status(204).send()

  } catch (error) {
    console.error('Erreur suppression épisode :', error)

    return res.status(500).json({
      title: 'Erreur serveur',
      status: 500,
      detail: 'Impossible de supprimer cet épisode.'
    })
  }
}

module.exports = {
  createHistory,
  getHistory,
  getHistoryById,
  deleteHistory
}
