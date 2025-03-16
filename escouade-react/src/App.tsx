import React, { useState } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

const Home = () => (
  <div className="p-4 text-center">
    <motion.h1 className="text-3xl font-bold" animate={{ opacity: 1 }} initial={{ opacity: 0 }}>
      Bienvenue dans Escouade
    </motion.h1>
    <Button className="mt-4" onClick={() => window.location.href = "/characters"}>Créer un Personnage</Button>
    <Button className="mt-4 ml-2" onClick={() => window.location.href = "/quests"}>Voir les Quêtes</Button>
  </div>
);

const Quest = ({ title, description, reward }) => (
  <Card className="m-4">
    <CardContent>
      <h2 className="text-xl font-bold">{title}</h2>
      <p>{description}</p>
      <p className="text-sm mt-2 text-green-600">Récompense : {reward}</p>
    </CardContent>
  </Card>
);

const Quests = () => (
  <div className="p-4">
    <h1 className="text-2xl font-bold mb-4">Quêtes Disponibles</h1>
    <Quest title="Le Rituel des Arcanes" description="Activez les quatre téléporteurs élémentaires." reward="+100 XP, Grimoire Antique" />
    <Quest title="Survivre au Blizzard" description="Accompagner une caravane jusqu'au Sanctuaire du Nord." reward="+150 XP, Cristal de Glace" />
  </div>
);

const Character = ({ name, classe, level, stats, updateStat }) => (
  <Card className="m-4">
    <CardContent>
      <h2 className="text-xl font-bold">{name}</h2>
      <p>Classe : {classe}</p>
      <p>Niveau : {level}</p>
      <div>
        {Object.keys(stats).map((stat) => (
          <div key={stat} className="flex justify-between items-center">
            <span>{stat} : {stats[stat]}</span>
            <Button onClick={() => updateStat(stat, 1)}>+1</Button>
            <Button onClick={() => updateStat(stat, -1)}>-1</Button>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const Characters = () => {
  const [characters, setCharacters] = useState([]);
  const [name, setName] = useState("");
  const [classe, setClasse] = useState("Guerrier");
  const baseStats = { Force: 5, Dextérité: 5, Endurance: 5, Mana: 5, Intelligence: 5, Perception: 5, Charisme: 5 };

  const addCharacter = () => {
    const newCharacter = { name, classe, level: 1, stats: { ...baseStats } };
    setCharacters([...characters, newCharacter]);
    setName("");
  };

  const updateStat = (index, stat, value) => {
    const newCharacters = [...characters];
    newCharacters[index].stats[stat] += value;
    setCharacters(newCharacters);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Créer un Personnage</h1>
      <input className="border p-2 mb-2 w-full" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="border p-2 mb-4 w-full" value={classe} onChange={(e) => setClasse(e.target.value)}>
        <option>Guerrier</option>
        <option>Voleur</option>
        <option>Moine</option>
        <option>Mage Blanc</option>
        <option>Mage Noir</option>
        <option>Mage Rouge</option>
        <option>Mage Bleu</option>
      </select>
      <Button onClick={addCharacter}>Ajouter</Button>
      {characters.map((char, index) => (
        <Character key={index} {...char} updateStat={(stat, value) => updateStat(index, stat, value)} />
      ))}
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/quests" element={<Quests />} />
        <Route path="/characters" element={<Characters />} />
      </Routes>
    </Router>
  );
}
