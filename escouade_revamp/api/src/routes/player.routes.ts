import { Router } from 'express'
import { buildBuilding } from '../controllers/playerController'
import { authMiddleware } from '../middleware/authMiddleware'
 
const router = Router()
 
router.use(authMiddleware)
 
router.post('/planet/:planetId/building/:buildingId', buildBuilding)
// router.post('/planet/:planetId/technology/:technologyId', researchTechnology)
// router.delete('/planet/:planetId/building/:buildingId/demolish', demolishBuilding)
// router.post('/planet/:planetId/ship/:shipId/queue', queueShipConstruction)
// router.post('/planet/:planetId/move-fleet', moveFleet)
 
export default router
 
 