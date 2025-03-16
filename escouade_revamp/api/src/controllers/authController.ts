import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { PlayerModel } from '../models/player.model'
 
export const register = async (req: Request, res: Response): Promise<void> => {
  const { username, email, password, rememberMe } = req.body
  const existingPlayer = await PlayerModel.findOne({ email })
  if (existingPlayer) {
    res.status(400).json({ message: 'Player already exists' })
    return
  }
  const hashedPassword = await bcrypt.hash(password, 10)
  const newPlayer = new PlayerModel({
    username,
    email,
    password: hashedPassword,
    lastUpdate: new Date()
  })
  await newPlayer.save()
  const expiresIn = rememberMe ? '7d' : '1h'
  const token = jwt.sign({ playerId: newPlayer._id }, process.env.JWT_SECRET!, { expiresIn })
  res.status(201).json({ token, username: newPlayer.username })
}
 
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password, rememberMe } = req.body
  const player = await PlayerModel.findOne({ email })
  if (!player) {
    res.status(400).json({ message: 'Invalid email or password' })
    return
  }
  const isMatch = await bcrypt.compare(password, player.password)
  if (!isMatch) {
    res.status(400).json({ message: 'Invalid email or password' })
    return
  }
  const expiresIn = rememberMe ? '7d' : '1h'
  const token = jwt.sign({ playerId: player._id }, process.env.JWT_SECRET!, { expiresIn })
  res.status(200).json({ token, username: player.username })
}