import { Request, Response } from 'express'
import mongoose from 'mongoose'
import { PlayerModel } from '../models/player.model'

async function getPlayer(playerId: string, res: Response) {
    const player = await PlayerModel.findById(playerId)
    if (!player) {
        res.status(404).json({ message: 'Le joueur est introuvable.' })
        return null
    }
    return player
}

//exemple
export const buildBuilding = async (req: Request, res: Response): Promise<void> => {
    const { planetId, buildingId } = req.params
    try {
        const player = await getPlayer(req.body.playerId, res)
        if (!player) return
        const result = { success: true, message: '' };
        if (!result.success) {
            res.status(400).json({ message: result.message })
            return
        }
        res.status(201).json({ message: 'La construction a démarré avec succès.' })
    } catch (error) {
        res.status(500).json({ message: 'Une erreur s\'est produite lors du lancement de la construction.' })
    }
}