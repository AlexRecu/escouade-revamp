import { Request, Response } from 'express';
import { WorldService } from '../services/World/WorldService';
import { JobFactory } from '../services/factory/JobFactory';
import statusesData from '../config/statuses_data.json';

/**
 * Controller du monde (mappemonde + villes).
 *
 * Ces routes sont **publiques** (pas d'auth) : elles servent les données
 * statiques du monde (layout des villes, connexions) nécessaires au front
 * pour afficher la mappemonde et les villes avant même la connexion.
 */

/** GET /world — résume le monde (hubs, donjons, connexions). */
export const getWorld = async (_req: Request, res: Response): Promise<void> => {
  try {
    const world = await WorldService.getWorldSummary();
    res.status(200).json(world);
  } catch (error) {
    res.status(500).json({ message: "Une erreur s'est produite lors du chargement du monde." });
  }
};

/** GET /world/hub/:hubId — détail d'une ville (layout, services). */
export const getHub = async (req: Request, res: Response): Promise<void> => {
  try {
    const hub = await WorldService.getHubById(req.params.hubId);
    if (!hub) {
      res.status(404).json({ message: 'Ville introuvable.' });
      return;
    }
    res.status(200).json(WorldService.serializeHub(hub));
  } catch (error) {
    res.status(500).json({ message: "Une erreur s'est produite lors du chargement de la ville." });
  }
};

/**
 * GET /world/statuses — liste des statuts (armes + sorts + compétences).
 *
 * Source unique des descriptions d'effets de statut : le front lit ce fichier
 * pour afficher les tooltips des chips de statut/élément dans la boutique.
 * Route publique (pas d'auth), comme le reste du monde.
 */
export const getStatuses = (_req: Request, res: Response): void => {
  res.status(200).json(statusesData);
};

/**
 * GET /world/jobs — liste des jobs disponibles pour la création de
 * personnage (nom, description, stats de base, or de classe).
 *
 * Route **publique** (pas d'auth) : le front l'appelle à l'ouverture de
 * l'écran de création de personnage, avant même d'avoir rejoint une partie.
 */
export const getJobs = (_req: Request, res: Response): void => {
  res.status(200).json(JobFactory.listJobs());
};
