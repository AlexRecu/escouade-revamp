import express from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/auth.routes';
import playerRoutes from './routes/player.routes';
import saveRoutes from './routes/save.routes';
import worldRoutes from './routes/world.routes';
import { swaggerDefinition, swaggerPaths } from './config/swagger';
import { connectDB } from './db';
import dotenv from 'dotenv';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeSocket } from './socket';
import { PartyRoomService } from './services/Hub/PartyRoomService';
 
dotenv.config({
  path:
    process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'release'
      ? '.env'
      : '.env.local',
});
 
const LOCAL_API = process.env.LOCAL_API || '';
 
const app = express();
 
const corsOptions = {
  origin: ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
 
app.use(cors(corsOptions));
app.use(express.json());
 
app.use(`${LOCAL_API}/auth`, authRoutes);
app.use(`${LOCAL_API}/player`, playerRoutes);
app.use(`${LOCAL_API}/save`, saveRoutes);
app.use(`${LOCAL_API}/world`, worldRoutes);

// Documentation Swagger UI : agrège les annotations JSDoc des routes avec la
// définition de base (infos, sécurité JWT, tags) et sert l'interface sur
// /api-docs. Le spec JSON brut est disponible sur /api-docs.json.
const swaggerOptions = {
  definition: swaggerDefinition,
  apis: swaggerPaths,
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));
 
const startServer = async () => {
  try {
    console.log('\n\x1b[36m%s\x1b[0m', '-------------------------------------');
    console.log('\x1b[36m%s\x1b[0m', '            ESCOUADE API            ');
    console.log('\x1b[36m%s\x1b[0m', '-------------------------------------');
    console.log(
      `\x1b[35m🌍 Environment:\x1b[0m ${process.env.NODE_ENV || 'development'}\n`
    );
 
    await connectDB();
 
    const server: Server = app.listen(5000, () => {
      console.log('\x1b[36m%s\x1b[0m', '\n-------------------------------------');
      console.log('\x1b[32m%s\x1b[0m', '🌍 Server running on port 5000');
      console.log('\x1b[36m%s\x1b[0m', '-------------------------------------\n');
    });
 
    const io = new SocketIOServer(server, {
      cors: corsOptions,
    });
 
    initializeSocket(io);

    // Nettoyage périodique des parties **vides** trop anciennes (abandonnées).
    // Une room vide est conservée pour que le joueur puisse reprendre sa
    // partie ; au-delà d'une heure d'inactivité, elle est supprimée.
    const cleanupEmptyRooms = () => {
      PartyRoomService.cleanupEmptyRooms()
        .then((n) => {
          if (n > 0) console.log(`🧹 ${n} partie(s) vide(s) supprimée(s).`);
        })
        .catch((err) => console.error('Erreur nettoyage rooms vides :', err));
    };
    cleanupEmptyRooms();
    setInterval(cleanupEmptyRooms, 15 * 60 * 1000); // toutes les 15 min
  } catch (error) {
    console.error('\x1b[31m❌ Failed to start server:\x1b[0m', error);
    process.exit(1);
  }
};
 
startServer();