Hello you, développeur ou développeuse qui tombe sur ce projet ou qui souhaite avoir une base pour un RPG.

Voici l'arborescence du projet : 
Api
|-src
  |-classes
    |-Items (Consumables, Weapons, ...)
    |-Jobs (WhiteMage, Warrior, Thief, ...)
    |-UnitTypes (Unit, Character, Monster, ...)
  |-config (json files with all the initial data, to minimize requesting DB)
  |-controllers (Controller Layer)
  |-middleware
  |-models (DAO Layer)
  |-routes
  |-services (Service Layer)
  |-utils (Utils function and static classes) 
|-tests
  |-jobs
  |-unitTypes
Front
