// src/app.ts
import express from "express";
import explorationRoutes from "./routes/exploration.routes";
import authRoutes from "./routes/auth.routes";
import characterRoutes from "./routes/character.routes";
import gameRoutes from "./routes/game.routes";
import partyRoutes from "./routes/party.routes";
import playerRoutes from "./routes/player.routes";


const app = express();

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/character", characterRoutes);
app.use("/api/exploration", explorationRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/player", playerRoutes);

export default app;
