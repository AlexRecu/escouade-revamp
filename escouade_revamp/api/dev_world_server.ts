// Mini-serveur de DEV : sert uniquement les routes du monde (publiques, sans
// MongoDB) sur le port 5000, pour tester le front. À supprimer.
import express from 'express';
import cors from 'cors';
import worldRoutes from './src/routes/world.routes';

const app = express();
app.use(
  cors({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json());
app.use('/api/world', worldRoutes);

app.listen(5000, () => {
  console.log('🌍 Mini world server on http://localhost:5000 (routes /api/world)');
});
