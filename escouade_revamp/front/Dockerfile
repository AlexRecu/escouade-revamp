# Front Escouade (dev) — Vite en mode HMR.
FROM node:22
WORKDIR /app

# Dépendances d'abord (cache Docker).
COPY package*.json ./
RUN npm install

# Code source (node_modules / dist exclus via .dockerignore).
COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
