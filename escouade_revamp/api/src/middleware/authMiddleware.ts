import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { Socket } from 'socket.io'
 
export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const now = new Date()
  const dateTime = now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
  console.log('\x1b[32m%s\x1b[0m', `[${dateTime}] 🔒  Démarrage de l'authentification`)
  const authHeader = req.headers.authorization
  if (!authHeader) {
    console.log('\x1b[31m%s\x1b[0m', `[${dateTime}] ❌  Aucun token fourni`)
    res.status(403).json({ message: 'Accès interdit, aucun token fourni' })
    return
  }
  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { playerId: string }
    req.body.playerId = decoded.playerId
    console.log('\x1b[35m%s\x1b[0m', `[${dateTime}] 🔑  Token décodé pour le joueur : ${decoded.playerId}`)
    next()
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', `[${dateTime}] ❌  Erreur de vérification du jeton:`, err)
    res.status(403).json({ message: 'Accès interdit, token invalide' })
    return
  }
}
 
export const authMiddlewareSocket = async (socket: Socket, next: (err?: any) => void): Promise<void> => {
  const now = new Date()
  const dateTime = now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
  console.log('\x1b[32m%s\x1b[0m', `[${dateTime}] 🔒  Démarrage de l'authentification (Socket)`)
  const token = socket.handshake.auth.token
  if (!token) {
    console.log('\x1b[31m%s\x1b[0m', `[${dateTime}] ❌  Aucun token fourni pour Socket`)
    return next(new Error('Authentication error: No token provided'))
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { playerId: string }
    socket.data.playerId = decoded.playerId
    console.log('\x1b[35m%s\x1b[0m', `[${dateTime}] 🔑  Token décodé pour le joueur (Socket): ${decoded.playerId}`)
    next()
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', `[${dateTime}] ❌  Erreur de vérification du jeton (Socket):`, err)
    return next(new Error('Authentication error: Invalid token'))
  }
}