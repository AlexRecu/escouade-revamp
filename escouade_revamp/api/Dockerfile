# API Escouade (dev) — Node 22 (Debian/glibc : prébuilds bcrypt dispo, pas de compile).
FROM node:22
WORKDIR /app

# Dépendances d'abord (exploite le cache Docker : ne se réinstalle que si package*.json change).
COPY package*.json ./
RUN npm install

# Code source (node_modules / dist / .env* exclus via .dockerignore).
COPY . .

EXPOSE 5000
CMD ["npm", "run", "dev"]
