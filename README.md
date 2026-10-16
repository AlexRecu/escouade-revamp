# ⚔️ Escouade

> JDR de rôle fantasy en temps réel, inspiré de Final Fantasy.
> Architecture front / back séparés, moteur de jeu en TypeScript, persistance MongoDB, interactions temps réel via Socket.IO.

**Real-time fantasy RPG** (Final Fantasy–inspired). Separated front / back architecture, TypeScript game engine, MongoDB persistence, real-time interactions over Socket.IO.

---

## 🇬🇧 English

### What is it?

Escouade is a turn-based / real-time hybrid RPG where a party of heroes explores a
procedurally generated world, fights encounters, levels up, evolves their jobs,
and manages a shared gold pot in towns. The whole game loop — exploration,
combat, loot, progression, quests — runs on a deterministic, unit-tested
TypeScript engine; the browser is a thin real-time client.

### ✨ Features

- **Combat engine** — AP/MP, turn phases ordered by speed, enemy AI, criticals,
  statuses (boons & curses), double attacks, protection, flee.
- **Jobs & evolutions** — 7 base jobs (Warrior, Thief, White Mage, Black Mage,
  Blue Mage, Red Mage, Monk) with level-20 evolutions (Samurai, Paladin,
  Black Knight, Astrologian).
- **Special mechanics** — demon summoning (Summoner), Eon possession (Blue
  Mage), Samurai combos (Bushido), Astrology card deck (Astrologian).
- **Rogue-like world** — procedurally generated graph of towns & dungeons,
  fog of war, dynamic world level that scales with completed zones.
- **Towns (Hubs)** — shop (buy/sell/equip), inn, sanctuary, quest board.
- **Progression** — XP, job evolution, loot, quest chain, campfire.
- **Persistence & auth** — JWT auth, Mongoose (one active game per player),
  Swagger API docs.
- **340+ Jest tests** covering the engine (combat, exploration, progression,
  persistence, hub).

### 🛠️ Tech stack

| Layer     | Tech |
|-----------|------|
| Language  | TypeScript 5.8 (strict, CommonJS) |
| Runtime   | Node.js 22 |
| API       | Express 4, Socket.IO 4 |
| DB        | MongoDB 7 + Mongoose 8 |
| Auth      | JWT + bcrypt |
| Docs      | swagger-jsdoc + swagger-ui (`/api-docs`) |
| Frontend  | React 18 + Vite 6 + socket.io-client |
| Tests     | Jest 30 + ts-jest |
| Dev env   | Docker Compose (mongo + backend + frontend) |

### 📂 Project structure

```
escouade_revamp/
├─ api/                      # Backend (Express + Socket.IO + Mongoose)
│  ├─ src/
│  │  ├─ classes/            # Game engine (pure logic, unit-tested)
│  │  │  ├─ Combat/          #   BattleManager, CombatState, PhaseSystem
│  │  │  ├─ Exploration/     #   EncounterEngine, ExplorationState, Party
│  │  │  ├─ Items/           #   Weapon, Consumable, Tools, Monstronomicon
│  │  │  ├─ Jobs/            #   Job + 7 implementations
│  │  │  ├─ Progression/     #   Campfire, LootEngine, QuestSystem
│  │  │  ├─ UnitTypes/       #   Unit, Character, Monster, Demon, Eon
│  │  │  └─ World/           #   WorldMap, Hub, Zone, Dungeon
│  │  ├─ config/             # JSON data (items, spells, bestiary, quests…)
│  │  ├─ controllers/        # REST controllers
│  │  ├─ middleware/         # auth middleware (JWT)
│  │  ├─ models/             # Mongoose models (player, game, save)
│  │  ├─ routes/             # REST routes (+ Swagger annotations)
│  │  ├─ services/           # Battle, dungeon, exploration, factory, Hub, World
│  │  ├─ utils/              # Damage, Position, Status, TileMap, Random…
│  │  ├─ server.ts           # Express + Socket.IO bootstrap
│  │  └─ socket.ts           # Real-time handlers (hub:*, auth)
│  ├─ tests/                 # Jest suites (combat, exploration, hub, …)
│  ├─ Dockerfile
│  └─ package.json
├─ front/                    # Frontend (React + Vite)
│  ├─ src/
│  │  ├─ api/                # REST + Socket.IO clients
│  │  ├─ components/         # AuthScreen, WorldTree, City, CityPanels, PartySidebar
│  │  ├─ game/               # useGame hook, pathfinding, force layout
│  │  ├─ types/              # Shared TS types (mirrors backend)
│  │  └─ assets/             # tokens, maps, ui
│  ├─ Dockerfile
│  └─ package.json
├─ docker-compose.yml        # mongo + backend + frontend
├─ .env-example              # dev values for docker compose
└─ ROADMAP.md                # detailed feature log & roadmap
```

### 🚀 Getting started

**Prerequisites:** Docker (recommended) or Node.js 22 + a local MongoDB.

#### Option A — Docker (recommended)

```bash
cd escouade_revamp
cp .env-example .env        # fill MONGO_USER / MONGO_PASS / JWT_SECRET
docker compose up --build
```

- Frontend → http://localhost:5173
- API → http://localhost:5000/api
- Swagger → http://localhost:5000/api-docs
- MongoDB → localhost:27027

Stop with `docker compose down` (keeps data) or `docker compose down -v` (reset DB).

#### Option B — Native dev

```bash
# 1. Start MongoDB (or use the Docker mongo service on port 27027)

# 2. Backend
cd escouade_revamp/api
npm install
# .env.local is provided with dev values (MONGODB_URI / JWT_SECRET) — adjust if needed
npm run dev                          # ts-node-dev HMR on :5000

# 3. Frontend (new terminal)
cd escouade_revamp/front
npm install
npm run dev                          # Vite on :5173 (proxies /api + /socket.io)
```

### 🧪 Tests

```bash
cd escouade_revamp/api
npm test                 # full suite (340+ tests)
npm run test:debug       # single-threaded (easier debugging)
```

### 📄 API documentation

Interactive Swagger UI is served at **`/api-docs`** (raw spec at `/api-docs.json`).
Real-time (Socket.IO) events are documented in `api/src/socket.ts`.

### 📌 Roadmap

See **[ROADMAP.md](escouade_revamp/ROADMAP.md)** for the full, dated feature log.
Next up: wire dungeon exploration to the frontend (real encounters, per-entry map
regeneration, dynamic floor count).

### 🤝 Contributing

Contributions are **welcome**! 🎉 Feel free to suggest ideas, open issues, or
submit pull requests.

### 📜 License

Distributed under the **MIT License**. Free to use, modify, and share.

---

## 🇫🇷 Français

### C'est quoi ?

Escouade est un JDR de rôle fantasy (hybride tour par tour / temps réel) où une
escouade de héros explore un monde généré procéduralement, affronte des
rencontres, monte de niveau, fait évoluer ses classes et gère un pot commun d'or
en ville. Toute la boucle de jeu — exploration, combat, butin, progression,
quêtes — tourne sur un moteur TypeScript déterministe et unit-testé ; le
navigateur n'est qu'un client temps réel fin.

### ✨ Fonctionnalités

- **Moteur de combat** — AP/MP, phases de tour ordonnées par vitesse, IA
  ennemie, critiques, statuts (avantages & malus), double attaque, protection,
  fuite.
- **Classes & évolutions** — 7 classes de base (Guerrier, Voleur, Mage Blanc,
  Mage Noir, Mage Bleu, Mage Rouge, Moine) avec évolutions au niveau 20
  (Samouraï, Paladin, Chevalier Noir, Astromancien).
- **Mécaniques spéciales** — invocation de démons (Démoniste), possession d'Eon
  (Mage Bleu), combos de Samouraï (Bushido), jeu de cartes d'Astromancie
  (Astromancien).
- **Monde rogue-like** — graphe procédural de villes & donjons, brouillard de
  guerre, niveau de monde dynamique qui scale avec les zones complétées.
- **Villes (Hubs)** — boutique (acheter/revendre/équiper), auberge, sanctuaire,
  tableau des quêtes.
- **Progression** — XP, évolution de classe, butin, chaîne de quêtes, feu de camp.
- **Persistance & auth** — auth JWT, Mongoose (une partie active par joueur),
  docs API Swagger.
- **340+ tests Jest** couvrant le moteur (combat, exploration, progression,
  persistance, hub).

### 🛠️ Stack technique

| Couche    | Tech |
|-----------|------|
| Langage   | TypeScript 5.8 (strict, CommonJS) |
| Runtime   | Node.js 22 |
| API       | Express 4, Socket.IO 4 |
| BDD       | MongoDB 7 + Mongoose 8 |
| Auth      | JWT + bcrypt |
| Docs      | swagger-jsdoc + swagger-ui (`/api-docs`) |
| Frontend  | React 18 + Vite 6 + socket.io-client |
| Tests     | Jest 30 + ts-jest |
| Env dev   | Docker Compose (mongo + backend + frontend) |

### 📂 Arborescence

Voir le bloc « Project structure » ci-dessus (identique).

### 🚀 Démarrage

**Prérequis :** Docker (recommandé) ou Node.js 22 + un MongoDB local.

#### Option A — Docker (recommandé)

```bash
cd escouade_revamp
cp .env-example .env        # renseigner MONGO_USER / MONGO_PASS / JWT_SECRET
docker compose up --build
```

- Frontend → http://localhost:5173
- API → http://localhost:5000/api
- Swagger → http://localhost:5000/api-docs
- MongoDB → localhost:27027

Arrêt : `docker compose down` (garde les données) ou `docker compose down -v`
(reset de la BDD).

#### Option B — Dev natif

```bash
# 1. Démarrer MongoDB (ou utiliser le service mongo Docker sur le port 27027)

# 2. Backend
cd escouade_revamp/api
npm install
# .env.local est fourni avec des valeurs de dev (MONGODB_URI / JWT_SECRET) — à ajuster si besoin
npm run dev                          # ts-node-dev HMR sur :5000

# 3. Frontend (nouveau terminal)
cd escouade_revamp/front
npm install
npm run dev                          # Vite sur :5173 (proxy /api + /socket.io)
```

### 🧪 Tests

```bash
cd escouade_revamp/api
npm test                 # suite complète (340+ tests)
npm run test:debug       # mono-thread (debug plus simple)
```

### 📄 Documentation API

L'UI Swagger interactive est servie sur **`/api-docs`** (spec brute sur
`/api-docs.json`). Les événements temps réel (Socket.IO) sont documentés dans
`api/src/socket.ts`.

### 📌 Roadmap

Voir **[ROADMAP.md](escouade_revamp/ROADMAP.md)** pour le journal détaillé et daté
des fonctionnalités. À suivre : brancher l'exploration des donjons au front
(rencontres réelles, régénération des maps à chaque entrée, nb d'étages dynamique).

### 🤝 Contribuer

Les contributions sont **les bienvenues** ! 🎉 N'hésite pas à proposer des idées,
ouvrir des issues, ou soumettre des PRs.

### 📜 Licence

Distribué sous licence **MIT**. Libre de l'utiliser, le modifier et le partager.
