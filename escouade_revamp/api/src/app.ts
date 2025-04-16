// src/app.ts
import express from "express";
import explorationRoutes from "./routes/exploration.routes";


const app = express();

app.use(express.json());
app.use("/api/exploration", explorationRoutes);

export default app;
