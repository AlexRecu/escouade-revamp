import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import playerRoutes from './routes/player.routes';
import { connectDB } from './db';
import dotenv from 'dotenv';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeSocket } from './socket';
 
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
  } catch (error) {
    console.error('\x1b[31m❌ Failed to start server:\x1b[0m', error);
    process.exit(1);
  }
};
 
startServer();