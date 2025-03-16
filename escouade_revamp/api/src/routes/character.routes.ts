import { Router } from 'express';
import { getCharactersByPlayer, getCharacterById, createCharacter, updateCharacter, deleteCharacter } from "../controllers/characterController";
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router()

router.use(authMiddleware)

router.get("/characters/:playerId", getCharactersByPlayer);
router.get("/character/:characterId", getCharacterById);
router.post("/character", createCharacter);
router.put("/character/:characterId", updateCharacter);
router.delete("/character/:characterId", deleteCharacter);

export default router;
