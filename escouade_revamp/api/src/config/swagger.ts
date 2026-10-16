/**
 * Configuration Swagger (OpenAPI 3.0) pour l'API Escouade.
 *
 * Utilisée par `swagger-jsdoc` : les annotations JSDoc des routes (fichiers
 * `src/routes/*.ts`) sont agrégées avec cette définition de base pour générer
 * le spec OpenAPI, servi par Swagger UI sur `/api-docs`.
 *
 * La sécurité JWT est déclarée ici (Bearer token) : chaque route protégée
 * référence le schéma `BearerAuth` via `@security BearerAuth`.
 */
export const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Escouade API",
    description:
      "API REST du JDR Escouade (auth, joueurs, personnages, sauvegardes). " +
      "Le temps réel (combat, exploration, ville) est géré via **Socket.IO** " +
      "et n'est pas couvert par cette doc REST.",
    license: {
      name: "ISC",
    },
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Serveur local de développement",
    },
  ],
  tags: [
    { name: "Auth", description: "Inscription et connexion (JWT)" },
    { name: "Player", description: "Gestion des joueurs (protégé)" },
    { name: "Character", description: "Gestion des personnages (protégé)" },
    { name: "Save", description: "Sauvegarde de partie (protégé)" },
    { name: "World", description: "Mappemonde et villes (public)" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Token JWT obtenu via /auth/login ou /auth/register. " +
          "À passer dans l'en-tête `Authorization: Bearer <token>`.",
      },
    },
    schemas: {
      Player: {
        type: "object",
        properties: {
          _id: { type: "string", description: "ID du joueur (ObjectId)" },
          username: { type: "string" },
          email: { type: "string" },
          lastUpdate: { type: "string", format: "date-time" },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          token: { type: "string", description: "Token JWT" },
          username: { type: "string" },
        },
      },
      Error: {
        type: "object",
        properties: {
          message: { type: "string" },
          error: { type: "string" },
        },
      },
    },
  },
};

/** Fichiers à scanner pour les annotations JSDoc des routes. */
export const swaggerPaths = [
  "./src/routes/*.ts",
  "./src/controllers/*.ts",
];
