import { Router } from 'express';
import { saveGame, loadGame, deleteGame, listSaves } from '../controllers/saveController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Toutes les routes de sauvegarde exigent une authentification (le playerId
// est injecté dans req.body par le middleware).
router.use(authMiddleware);

/**
 * @swagger
 * /api/save:
 *   post:
 *     tags: [Save]
 *     security:
 *       - BearerAuth: []
 *     summary: Sauvegarder la partie du joueur
 *     description: >
 *       Enregistre l'état de jeu (JSON de `ExplorationState.toJSON()`) en base
 *       (upsert : une sauvegarde par joueur). Le `playerId` est injecté par le
 *       middleware d'auth.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [state]
 *             properties:
 *               state:
 *                 type: object
 *                 description: État complet de la partie (sortie de ExplorationState.toJSON())
 *     responses:
 *       200:
 *         description: Partie sauvegardée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Partie sauvegardée." }
 *                 save: { type: object, description: Résumé de la sauvegarde (zone, difficulté, taille de l'escouade, date) }
 *       400:
 *         description: État de jeu manquant ou invalide
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   get:
 *     tags: [Save]
 *     security:
 *       - BearerAuth: []
 *     summary: Charger la partie du joueur
 *     description: Renvoie l'état de jeu sauvegardé (ou 404 s'il n'y en a pas).
 *     responses:
 *       200:
 *         description: État de jeu chargé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 state: { type: object, description: État complet de la partie }
 *       404:
 *         description: Aucune sauvegarde trouvée
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   delete:
 *     tags: [Save]
 *     security:
 *       - BearerAuth: []
 *     summary: Supprimer la sauvegarde du joueur
 *     responses:
 *       200:
 *         description: Sauvegarde supprimée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Sauvegarde supprimée." }
 *       404:
 *         description: Aucune sauvegarde trouvée
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', saveGame);
router.get('/', loadGame);
router.delete('/', deleteGame);

/**
 * @swagger
 * /api/save/list:
 *   get:
 *     tags: [Save]
 *     security:
 *       - BearerAuth: []
 *     summary: Lister les sauvegardes
 *     description: >
 *       Renvoie la liste des sauvegardes (champs dénormalisés : zone,
 *       difficulté, taille de l'escouade, date).
 *     responses:
 *       200:
 *         description: Liste des sauvegardes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 saves:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       player: { type: string, description: ID du joueur }
 *                       zoneName: { type: string }
 *                       difficulty: { type: string, enum: [easy, hard] }
 *                       partySize: { type: integer }
 *                       savedAt: { type: string, format: date-time }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/list', listSaves);

export default router;
