import { Router } from 'express';
import { getCharactersByPlayer, getCharacterById, createCharacter, updateCharacter, deleteCharacter } from "../controllers/characterController";
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router()

router.use(authMiddleware)

/**
 * @swagger
 * /api/character/characters/{playerId}:
 *   get:
 *     tags: [Character]
 *     security:
 *       - BearerAuth: []
 *     summary: Lister les personnages d'un joueur
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema: { type: string }
 *         description: ID du joueur
 *     responses:
 *       200:
 *         description: Liste des personnages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: object, description: Personnage }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get("/characters/:playerId", getCharactersByPlayer);

/**
 * @swagger
 * /api/character/character/{characterId}:
 *   get:
 *     tags: [Character]
 *     security:
 *       - BearerAuth: []
 *     summary: Obtenir un personnage par son ID
 *     parameters:
 *       - in: path
 *         name: characterId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Personnage trouvé
 *         content:
 *           application/json:
 *             schema: { type: object, description: Personnage }
 *       404:
 *         description: Personnage non trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   put:
 *     tags: [Character]
 *     security:
 *       - BearerAuth: []
 *     summary: Mettre à jour un personnage
 *     parameters:
 *       - in: path
 *         name: characterId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, description: Champs du personnage à mettre à jour }
 *     responses:
 *       200:
 *         description: Personnage mis à jour
 *         content:
 *           application/json:
 *             schema: { type: object, description: Personnage }
 *       404:
 *         description: Personnage non trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   delete:
 *     tags: [Character]
 *     security:
 *       - BearerAuth: []
 *     summary: Supprimer un personnage
 *     parameters:
 *       - in: path
 *         name: characterId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Personnage supprimé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Personnage supprimé avec succès." }
 *       404:
 *         description: Personnage non trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get("/character/:characterId", getCharacterById);
router.put("/character/:characterId", updateCharacter);
router.delete("/character/:characterId", deleteCharacter);

/**
 * @swagger
 * /api/character/character:
 *   post:
 *     tags: [Character]
 *     security:
 *       - BearerAuth: []
 *     summary: Créer un personnage
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, description: Données du personnage à créer }
 *     responses:
 *       201:
 *         description: Personnage créé
 *         content:
 *           application/json:
 *             schema: { type: object, description: Personnage }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/character", createCharacter);

export default router;
