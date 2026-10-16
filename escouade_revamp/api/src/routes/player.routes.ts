import { Router } from 'express'
import { buildBuilding } from '../controllers/playerController'
import { authMiddleware } from '../middleware/authMiddleware'
 
const router = Router()
 
router.use(authMiddleware)

/**
 * @swagger
 * /api/player/planet/{planetId}/building/{buildingId}:
 *   post:
 *     tags: [Player]
 *     security:
 *       - BearerAuth: []
 *     summary: Lancer la construction d'un bâtiment (exemple)
 *     description: >
 *       Route d'exemple (squelette) : démarre la construction d'un bâtiment
 *       sur une planète. Le `playerId` est injecté par le middleware d'auth.
 *     parameters:
 *       - in: path
 *         name: planetId
 *         required: true
 *         schema: { type: string }
 *         description: ID de la planète
 *       - in: path
 *         name: buildingId
 *         required: true
 *         schema: { type: string }
 *         description: ID du bâtiment à construire
 *     responses:
 *       201:
 *         description: Construction démarrée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "La construction a démarré avec succès." }
 *       404:
 *         description: Joueur introuvable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/planet/:planetId/building/:buildingId', buildBuilding)
// router.post('/planet/:planetId/technology/:technologyId', researchTechnology)
// router.delete('/planet/:planetId/building/:buildingId/demolish', demolishBuilding)
// router.post('/planet/:planetId/ship/:shipId/queue', queueShipConstruction)
// router.post('/planet/:planetId/move-fleet', moveFleet)

export default router
 
 