import { Router } from 'express';
import { getWorld, getHub, getStatuses, getJobs } from '../controllers/worldController';

const router = Router();

/**
 * @swagger
 * /api/world:
 *   get:
 *     tags: [World]
 *     summary: Résumer le monde (mappemonde)
 *     description: >
 *       Renvoie les villes (hubs), les donjons et leurs connexions.
 *       Route publique (pas d'auth) : sert les données statiques du monde
 *       nécessaires au front pour afficher la mappemonde.
 *     responses:
 *       200:
 *         description: Monde sérialisé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hubs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       services:
 *                         type: object
 *                         properties:
 *                           shop: { type: boolean }
 *                           inn: { type: boolean }
 *                           church: { type: boolean }
 *                           questBoard: { type: boolean }
 *                       layout:
 *                         type: object
 *                         description: Layout de la ville (grille de tuiles, bâtiments, sortie)
 *                 dungeons:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       zoneLevel: { type: integer }
 *                       biome: { type: string }
 *                       floors: { type: integer }
 *                 edges:
 *                   type: object
 *                   description: Connexions (id nœud → liste des ids voisins)
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', getWorld);

/**
 * @swagger
 * /api/world/hub/{hubId}:
 *   get:
 *     tags: [World]
 *     summary: Détail d'une ville
 *     description: Renvoie le layout et les services d'une ville (par son id).
 *     parameters:
 *       - in: path
 *         name: hubId
 *         required: true
 *         schema: { type: string }
 *         description: Id de la ville
 *     responses:
 *       200:
 *         description: Ville sérialisée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 services: { type: object }
 *                 layout: { type: object }
 *       404:
 *         description: Ville introuvable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/hub/:hubId', getHub);

/**
 * @swagger
 * /api/world/statuses:
 *   get:
 *     tags: [World]
 *     summary: Liste des statuts (armes + sorts + compétences)
 *     description: >
 *       Renvoie la liste des statuts avec leur effet, leur type (boon/curse),
 *       leur icône et leur contre-statut. Source unique des descriptions
 *       d'effets de statut (tooltips de la boutique). Route publique.
 *     responses:
 *       200:
 *         description: Liste des statuts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name: { type: string }
 *                   statusType: { type: string, enum: [boon, curse] }
 *                   icon: { type: string }
 *                   description: { type: string }
 *                   nbTurnEffect: { type: [integer, "null"] }
 *                   counterItem: { type: [string, "null"] }
 *                   sources:
 *                     type: array
 *                     items: { type: string }
 */
router.get('/statuses', getStatuses);

/**
 * @swagger
 * /api/world/jobs:
 *   get:
 *     tags: [World]
 *     summary: Liste des jobs disponibles (création de personnage)
 *     description: >
 *       Renvoie les jobs jouables avec leur description, leurs stats de base
 *       et leur or de classe. Route publique (pas d'auth) : le front l'appelle
 *       à l'ouverture de l'écran de création de personnage.
 *     responses:
 *       200:
 *         description: Liste des jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name: { type: string }
 *                   description: { type: string }
 *                   defaultStats:
 *                     type: object
 *                     properties:
 *                       strength: { type: integer }
 *                       dexterity: { type: integer }
 *                       endurance: { type: integer }
 *                       mana: { type: integer }
 *                       intelligence: { type: integer }
 *                       perception: { type: integer }
 *                       charisma: { type: integer }
 *                   gold: { type: integer }
 */
router.get('/jobs', getJobs);

export default router;
