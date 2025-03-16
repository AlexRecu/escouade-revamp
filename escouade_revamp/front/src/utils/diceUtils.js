// Utility functions for dice rolls according to the game rules

/**
 * Rolls a d6 die
 * @returns {number} A number between 1 and 6
 */
export const rollD6 = () => Math.floor(Math.random() * 6) + 1;

/**
 * Performs a roll with critical calculation
 * If roll is 6, add 5 and roll again, continuing until not 6
 * @returns {Object} The roll result and critical counter
 */
export const rollWithCritical = () => {
  let roll = rollD6();
  let critCounter = 0;
  let totalRoll = roll;
  
  while (roll === 6) {
    critCounter += 5;
    roll = rollD6();
    totalRoll += roll;
  }
  
  return {
    roll: totalRoll,
    critCounter
  };
};

/**
 * Checks if an action succeeds based on game rules
 * @param {number} roll - The roll result
 * @param {Object} condition - The condition to check (e.g., stat requirements)
 * @returns {boolean} True if action succeeds
 */
export const isActionSuccessful = (roll, condition = {}) => {
  // Basic success: roll > 1
  if (roll <= 1) return false;
  
  // If there are specific conditions
  if (condition.minRoll && roll < condition.minRoll) return false;
  
  // Weapon stat check
  if (condition.weaponStat && condition.mainStat) {
    return roll >= condition.weaponStat - condition.mainStat;
  }
  
  // Magic stat check
  if (condition.spellPower && condition.intelligence) {
    return roll >= condition.spellPower - condition.intelligence;
  }
  
  return true;
};

/**
 * Calculates combat damage based on game rules
 * @param {Object} attacker - The attacking character
 * @param {Object} target - The target character
 * @param {Object} rollResult - The roll result and critical counter
 * @param {boolean} isMagic - Whether it's a magic attack
 * @returns {number} The calculated damage
 */
export const calculateDamage = (attacker, target, rollResult, isMagic = false) => {
  if (isMagic) {
    // Magic attack: ceil(Intelligence + Spell if roll >= Spell-Intelligence) x Weakness + crit
    if (isActionSuccessful(rollResult.roll, {
      spellPower: attacker.activeSpell.power,
      intelligence: attacker.stats.intelligence
    })) {
      const baseDamage = Math.ceil(attacker.stats.intelligence + attacker.activeSpell.power);
      const weakness = target.weaknesses?.[attacker.activeSpell.element] || 1;
      return baseDamage * weakness + rollResult.critCounter;
    }
  } else {
    // Normal attack: ceil(Main stat + Weapon Stat if roll >= Weapon Stat-Mainstat + ½SubStat) + crit
    if (isActionSuccessful(rollResult.roll, {
      weaponStat: attacker.weapon.power,
      mainStat: attacker.stats[attacker.weapon.mainStat]
    })) {
      const subStatBonus = attacker.weapon.subStat ? 
        Math.floor(attacker.stats[attacker.weapon.subStat] / 2) : 0;
      const baseDamage = Math.ceil(
        attacker.stats[attacker.weapon.mainStat] + 
        attacker.weapon.power + 
        subStatBonus
      );
      return baseDamage + rollResult.critCounter;
    }
  }
  
  // Attack missed or failed
  return 0;
};

/**
 * Calculates random encounter based on game rules
 * @param {Object} party - The party of characters
 * @returns {Object} The encounter result
 */
export const calculateRandomEncounter = (party) => {
  const roll = rollD6();
  
  // Find max charisma or dexterity in party
  const maxCharOrDex = Math.max(
    ...party.map(char => Math.max(char.stats.charisma || 0, char.stats.dexterity || 0))
  );
  
  // Calculate repel effect
  const repelEffect = party.some(char => char.effects?.repel) ? 1 : 0;
  
  // Check if encounter happens
  if (maxCharOrDex + repelEffect >= roll) {
    return { hasEncounter: false };
  }
  
  // Otherwise, calculate number and type of enemies
  // This is a simplified version of the complex formula in the document
  const difficultyFactor = roll - (maxCharOrDex + repelEffect);
  
  // Generate enemies based on difficulty factor and current location
  return {
    hasEncounter: true,
    difficultyFactor,
    // The actual enemy generation will be handled by the encounter service
  };
};