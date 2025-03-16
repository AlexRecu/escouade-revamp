// Data for character classes based on the game document

export const classes = {
    warrior: {
      name: "Guerrier",
      evolutions: {
        paladin: {
          name: "Paladin",
          requirements: { level: 20 },
          bonuses: { mana: 3 },
          specialAbility: "Protection divine: Double les rolls de protection"
        },
        berserker: {
          name: "Berseker",
          requirements: { level: 20 },
          bonuses: { intelligence: -1, mana: 2 },
          specialAbility: "Armement furieux: Plus de bouclier, toutes les armes de portée = 1 ont leur attaque doublée"
        }
      },
      baseStats: {
        force: 2,
        dexterite: 1,
        endurance: 3,
        mana: 0,
        intelligence: 0,
        perception: 1,
        charisme: 1
      },
      weapons: ["epees", "katanas", "lances", "marteaux", "masses"],
      skillProgression: [
        { level: 1, skill: "Bouclier impénétrable", apCost: 1, description: "(+3 endu/3 tours) permet les rolls de protection si actif" },
        { level: 5, skill: "Cri de guerre", apCost: 1, description: "(Aggro 5 tours)" },
        { level: 7, skill: "Percée", apCost: 1, description: "(dégât d'arme seul x2 et garanti)" },
        { level: 10, skill: "Allonge", apCost: 1, description: "(2 cases)" },
        { level: 12, skill: "Frappe tournoyante", apCost: 2, description: "(AOE) dégât d'arme -2" },
        { level: 15, skill: "Rétribution", apCost: 3, description: "(Main stat + endurance)" },
        { level: 18, skill: "Frappe mystique", apCost: 1, description: "+2xMana post cond." },
        { level: 20, skill: "Soin+", evolution: "paladin" },
        { level: 20, skill: "Double armement", evolution: "berserker" },
        { level: 21, skill: "Lumen", evolution: "paladin" },
        { level: 21, skill: "Marque du démon", evolution: "berserker", description: "(-1PV = +2 tokens)" },
        { level: 24, skill: "Garde", evolution: "paladin" },
        { level: 24, skill: "Saignée", evolution: "berserker", description: "(1 Mana, +p/-a Endu)" },
        { level: 26, skill: "Grâce +", evolution: "paladin" },
        { level: 26, skill: "Rage",