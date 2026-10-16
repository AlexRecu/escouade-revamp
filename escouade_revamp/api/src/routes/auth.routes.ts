import { Router } from 'express'
import { register, login } from '../controllers/authController'
 
const router = Router()

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Inscription d'un nouveau joueur
 *     description: Crée un joueur et renvoie un token JWT (1h, ou 7j si rememberMe).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string, example: "Alfonso" }
 *               email: { type: string, example: "alfonso@escouade.fr" }
 *               password: { type: string, format: password, example: "secret" }
 *               rememberMe: { type: boolean, description: "Valide le token 7 jours au lieu de 1h" }
 *     responses:
 *       201:
 *         description: Joueur créé, token JWT renvoyé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       400:
 *         description: Email déjà utilisé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/register', register)

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Connexion d'un joueur
 *     description: Vérifie les identifiants et renvoie un token JWT (1h, ou 7j si rememberMe).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "alfonso@escouade.fr" }
 *               password: { type: string, format: password, example: "secret" }
 *               rememberMe: { type: boolean }
 *     responses:
 *       200:
 *         description: Connexion réussie, token JWT renvoyé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       400:
 *         description: Identifiants invalides
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/login', login)

export default router