# 🎮 RPG Base Project

Hello you, développeur ou développeuse 👋  
Tu es tombé(e) sur ce projet et tu souhaites avoir une **base solide pour un RPG** ?  
Ce dépôt est fait pour toi ! 🚀  

Il fournit une architecture organisée pour séparer les responsabilités (API & Front), tout en permettant une évolution facile du projet.

---

## 📂 Arborescence du projet

```

Api
├─ src
│  ├─ classes
│  │  ├─ Items (Consumables, Weapons, …)
│  │  ├─ Jobs (WhiteMage, Warrior, Thief, …)
│  │  └─ UnitTypes (Unit, Character, Monster, …)
│  ├─ config        # JSON files with initial data (minimize DB requests)
│  ├─ controllers   # Controller Layer
│  ├─ middleware
│  ├─ models        # DAO Layer
│  ├─ routes
│  ├─ services      # Service Layer
│  └─ utils         # Utils functions & static classes
│
├─ tests
│  ├─ jobs
│  └─ unitTypes
│
└─ Front

````

---

## 🛠️ Technologies & Concepts

- **Architecture en couches** (Controllers, Services, DAO, Utils)  
- **Gestion des entités RPG** : Jobs, Items, Characters, Monsters  
- **Config JSON** pour limiter les appels DB  
- **Tests unitaires** pour fiabiliser le développement  
- **Séparation API / Front** pour évoluer vers une application complète  

---

## 🚀 Comment démarrer

1. **Clone le repo**
   ```bash
   git clone https://github.com/ton-utilisateur/ton-projet.git

2. **Installe les dépendances**

   ```bash
   cd Api
   npm install
   ```

3. **Lance le serveur**

   ```bash
   npm run start
   ```

4. **Lance les tests**

   ```bash
   npm run test
   ```

---

## 📌 Roadmap

* [ ] Gestion d’inventaire plus poussée (stack d’objets, rareté, etc.)
* [ ] Ajout d’un système de quêtes
* [ ] Création d’une interface graphique pour le Front
* [ ] Documentation des endpoints de l’API

---

## 🤝 Contribuer

Les contributions sont **les bienvenues** ! 🎉
N’hésite pas à proposer des idées, ouvrir des issues, ou soumettre des PRs.

---

## 📜 Licence

Ce projet est distribué sous la licence **MIT**.
Tu es libre de l’utiliser, le modifier et le partager.

---

