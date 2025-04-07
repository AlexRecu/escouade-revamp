import { Element, EonSkill, Skill } from "../classes/Types";
import { Unit } from "../classes/UnitTypes/Unit";

export const ELEMENTAL_MULTIPLIERS: Record<Element, Record<Element, number>> = {
    "": { "Feu": 1, "Glace": 1, "Foudre": 1, "Air": 1, "Terre": 1, "Ténèbre": 0.5, "Sacré": 1, "": 1 },
    "Feu": { "Feu": 0, "Glace": 2, "Foudre": 1, "Air": 2, "Terre": 0.5, "Ténèbre": 1, "Sacré": 1, "": 1 },
    "Glace": { "Feu": 2, "Glace": 0, "Foudre": 1, "Air": 0.5, "Terre": 2, "Ténèbre": 1, "Sacré": 1, "": 1 },
    "Foudre": { "Feu": 1, "Glace": 2, "Foudre": 0, "Air": 2, "Terre": 0, "Ténèbre": 1, "Sacré": 1, "": 1 },
    "Air": { "Feu": 0.5, "Glace": 0.5, "Foudre": 2, "Air": 0, "Terre": 2, "Ténèbre": 1, "Sacré": 1, "": 1 },
    "Terre": { "Feu": 2, "Glace": 1, "Foudre": 2, "Air": 0, "Terre": 0, "Ténèbre": 1, "Sacré": 1, "": 1 },
    "Ténèbre": { "Feu": 2, "Glace": 2, "Foudre": 2, "Air": 1, "Terre": 1, "Ténèbre": 0, "Sacré": 1, "": 1 },
    "Sacré": { "Feu": 1, "Glace": 1, "Foudre": 2, "Air": 2, "Terre": 2, "Ténèbre": 2, "Sacré": 0, "": 1 },
};

/**
 * Fonction qui retourne le multiplicateur de dégâts d'un élément contre un autre.
 * @param attacker L'élément de l'attaque
 * @param defender L'élément de la cible
 * @returns Multiplicateur de dégâts (0, 0.5, 1, 2)
 */
export function getElementalDamageMultiplier(attacker: Element, defender: Element): number {
    return ELEMENTAL_MULTIPLIERS[attacker][defender] || 1;
}

/**
* Renvoie le coefficient multiplicateur d'un élément sur une unité
* @param attacker L'utilisateur de l'attaque
* @param element L'élément de l'attaque
* @param defender La cible de l'attaque
* @returns Le coefficient multiplicateur
*/
export function calculateDamageMultiplier(attacker: Unit, element: string, defender: Unit): number {
    let damageMultiplier = 1;
    if (attacker.status.some(statut => statut.name === "Poings d'acier")) {
        damageMultiplier *= 1.5;
    }
    if (defender.status.some(statut => statut.name === "Faiblesse") && element !== "") {
        damageMultiplier *= 2;
    }
    if (defender.immunity.includes(element)) {
        damageMultiplier *= 0;
    } else if (defender.resistance.includes(element)) {
        damageMultiplier *= 0.5;
    } else if (defender.weakness.includes(element)) {
        damageMultiplier *= 2;
    }
    return damageMultiplier;
}

/**
* Renvoie le message associé au coefficient multiplicateur
* @param damageMultiplier 
* @returns "C'est sans effet !/Ce n'est pas très efficace !/C'est super efficace !"
*/
export function messageDamageMultiplier(damageMultiplier: number): string {
    let message = "";
    switch (damageMultiplier) {
        case 0: {
            message = "C'est sans effet !";
            break;
        }
        case 0.5: {
            message = "Ce n'est pas très efficace !";
            break;
        }
        case 2: {
            message = "C'est super efficace !";
            break;
        }
        case 3: {
            message = "C'est hyper efficace !!";
            break;
        }
        case 4: {
            message = "C'est hyper efficace !!!";
            break;
        }
        case 6: {
            message = "C'est colossal !!!";
            break;
        }
    }
    return message;
}

/***
* Renvoie la liste des Unités ciblables par la compétence
* @param user l'utilisateur d'un skill
* @param skill La compétence
* @param allUnits La liste de toutes les unités
*/
export function getValidTargets(user: Unit, skill: Skill | EonSkill, allUnits: Unit[]): Unit[] {
        const move = ("move" in skill)? skill.move : 0;
        const targetType = ("target" in skill)? skill.target : 'enemy';
        let validTargets = allUnits.filter(unit => {

            //cibles à portée
            const distance = Math.max(
                Math.abs(unit.position.row - user.position.row),
                Math.abs(unit.position.col - user.position.col)
            );
            if (skill.range > 0 && distance > (skill.range + move)) {
                return false;
            }

            if (targetType === 'self') {
                return unit === user;
            }
            if (targetType === 'ally') {
                return unit.type === 'Hero' || unit === user;
            }
            if (targetType === 'enemy') {
                return unit.type === 'Enemy';
            }

            return false;
        });

        // Si le skill est "single", on garde seulement la cible la plus proche
        if (skill.type === "single" && validTargets.length > 0) {
            validTargets = [validTargets[0]];
        }

        return validTargets;
    }