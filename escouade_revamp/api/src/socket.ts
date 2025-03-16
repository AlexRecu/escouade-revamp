import { Server, Socket } from 'socket.io';
import { authMiddlewareSocket } from './middleware/authMiddleware';
import { PlayerModel } from './models/player.model';
 
export const initializeSocket = (io: Server) => {
  io.use(authMiddlewareSocket);
 
  io.on('connection', async (socket: Socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);
 
    const playerId = socket.data.playerId;
 
    const sendPlayerData = async () => {
      const player = await PlayerModel.findById(playerId).select(
        '-password -__v -lastUpdate -email -username'
      );
      if (!player) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }

      const playerData = {
      };
 
      socket.emit('playerData', playerData);
    };
 
    await sendPlayerData();
 
    const intervalId = setInterval(async () => {
      await sendPlayerData();
    }, 1000);
 
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      clearInterval(intervalId);
    });
  });
};