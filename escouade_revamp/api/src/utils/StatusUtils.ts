import { Status } from "../classes/Status";
import { Unit } from "../classes/UnitTypes/Unit";

/**
* Gère l'ajout de statut sur une cible
* @param status Le statut
* @param target La cible visée
* @param roll 
* @param resultArray 
*/
export function applyStatus(user: Unit, status: Status, target: Unit, roll: number, resultArray: string[]): void {
    const index = target.status.findIndex(s => s.name === "Barrière");
    // Si la cible n'est pas sous Barrière, elle peut être affectée par un statut
    if (index == -1 || status.name == "Dissipation") {
        switch (status.name) {
            case 'Mort': {
                if (Math.random() <= 0.2) {
                    target.currentHp = 0;
                    resultArray.push(`${target.name} meurt instantanement`);
                } else {
                    resultArray.push(`${target.name} réchappe à la mort`);
                }
                break;
            } case 'Supplice': {
                if (roll === 6) { // Mort si roll = 6
                    target.currentHp = 0;
                    resultArray.push(`${target.name} meurt instantanement`);
                } else { // Applique le poison
                    target.status.push({ name: 'Poison', nbTurnEffect: null });
                    resultArray.push(`${target.name} est empoisonné`);
                }
                break;
            } case 'Esuna': {
                target.status = target.status.filter(statut => statut.statusType === 'boon');
                resultArray.push(`${target.name} n'est plus affecté par aucun malus`);
                break;
            } case 'Saignée': {
                const drain = target.currentHp * 0.2;
                target.currentHp -= drain;
                const healthRegened = Math.round(drain / 2);
                user.currentHp = Math.max(user.currentHp + healthRegened, user.maxHp);
                resultArray.push(`${target.name} est drainé de ${drain}PV`);
                break;
            } case 'Renvoi': {
                //appliquer l'utilisation de la corde sortie
                resultArray.push('Cela met fin au combat');
                break;
            } case 'Dissipation': {
                let lastStatutIndex: number;
                if (target.type === "Enemy") {
                    lastStatutIndex = target.status.length - 1 - target.status.slice().reverse().findIndex(statut => statut.statusType === 'boon');
                } else {
                    lastStatutIndex = target.status.length - 1 - target.status.slice().reverse().findIndex(statut => statut.statusType === 'curse');
                }
                if (lastStatutIndex !== -1) {
                    const statut = target.status[lastStatutIndex];
                    target.status.splice(lastStatutIndex, 1); // Supprime le dernier statut bonus ou malus suivant le type de cible
                    resultArray.push(`Enlève le statut "${statut}" de ${target.name}`);
                }
                break;
            } default: {
                // Si le statut affecte déjà la cible, on réinitialise son compteur sinon on ajoute le statut
                const index = target.status.findIndex(s => s.name === status.name);
                if (index !== -1) {
                    target.status[index].nbTurnEffect = status.nbTurnEffect;
                } else {
                    target.status.push({ name: status.name, statusType: status.statusType, counterItem: status.counterItem, nbTurnEffect: status.nbTurnEffect });
                }
            }
        }
    } else {
        resultArray.push(`Une barrière protège ${target.name} des statuts`);
    }
}

/**
 * Pour la gestion des status sur l'unité en début de phase
 * (Sommeil, Fossile, Mutisme, Paralysie, Aveuglement, Confusion, Célérité, Fureur et Rage)
 * @param unit 
 * @returns 
 */
export function manageStatusBeforePhase(unit: Unit): string[] {
    let newStatusList: Status[] = [];
    let resultArray: string[] = [];
    unit.canAct = true;
    for (let status of unit.status) {
        switch (status.name) {
            case "Sommeil":
            case "Fossile":
                unit.canAct = false;
                resultArray.push(`${unit.name} est incapable d'agir.`);
                newStatusList.push(status);
                break;
            case "Mutisme":
                resultArray.push(`${unit.name} ne peut plus lancer de magie.`);
                newStatusList.push(status);
                break;
            case "Paralysie":
                if (Math.random() < 0.3) {
                    unit.canAct = false;
                    resultArray.push(`${unit.name} est paralysé et ne peut pas agir.`);
                }
                if (Math.random() < 0.5) {
                    unit.canAct = true;
                    resultArray.push(`${unit.name} se libère de la paralysie.`);
                } else {
                    newStatusList.push(status);
                }
                break;
            case "Aveuglement":
                if (Math.random() < 0.3) {
                    unit.accuracyModifier = 0.7; // Réduction de la précision
                    resultArray.push(`${unit.name} a du mal à voir et risque de rater son attaque.`);
                }
                newStatusList.push(status);
                break;
            case "Confusion":
                resultArray.push(`${unit.name} est confus.`);
                if (Math.random() < 0.3) {
                    const selfDamage = Math.floor(unit.maxHp / 20);
                    unit.currentHp = Math.max(1, unit.currentHp - selfDamage);
                    unit.canAct = false;
                    resultArray.push(`Sa folie lui inflige ${selfDamage} PV.`);
                }
                if (Math.random() < 0.5) {
                    unit.canAct = true;
                    resultArray.push(`${unit.name} n'est plus confus.`);
                } else {
                    newStatusList.push(status);
                }
                break;
            case "Célérité":
                unit.extraActions = 1; // Ajoute une action supplémentaire
                resultArray.push(`${unit.name} peut effectuer deux actions ce tour.`);
                newStatusList.push(status);
                break;
            case "Fureur":
                unit.stats.strength += 2;
                resultArray.push(`${unit.name} est en fureur, sa Force augmente.`);
                newStatusList.push(status);
                break;
            case "Rage":
                unit.stats.strength += 1;
                resultArray.push(`${unit.name} est enragé, sa Force augmente légèrement.`);
                newStatusList.push(status);
                break;
            default:
                resultArray.push(`${unit.name} est sous statut ${status.name}.`);
                newStatusList.push(status);
                break;
        }
    }
    // On repousse les statuts toujours actifs
    unit.status = newStatusList;
    return resultArray;
}

export function manageStatusAfterPhase(unit: Unit): string[] {
    let newStatusList: Status[] = [];
    let resultArray: string[] = [];

    for (let status of unit.status) {
        if (!unit.isDead()) {
            switch (status.name) {
                case "Poison":
                    const poisonDamage = Math.floor(unit.maxHp / 16);
                    unit.currentHp = Math.max(1, unit.currentHp - poisonDamage);
                    resultArray.push(`${unit.name} subit ${poisonDamage} dégâts de poison.`);
                    break;
                case "Provoque":
                    unit.isTargeted = true;
                    resultArray.push(`${unit.name} attire toute l'attention des ennemis.`);
                    break;
                case "Grâce":
                    unit.currentHp = Math.min(unit.maxHp, unit.currentHp + 2);
                    resultArray.push(`${unit.name} récupère 2 PV grâce à Grâce.`);
                    break;
                case "Grâce +":
                    unit.currentHp = Math.min(unit.maxHp, unit.currentHp + 4);
                    resultArray.push(`${unit.name} récupère 4 PV grâce à Grâce +.`);
                    break;
                case "Grâce X":
                    unit.currentHp = Math.min(unit.maxHp, unit.currentHp + 5);
                    resultArray.push(`${unit.name} récupère 5 PV grâce à Grâce X.`);
                    break;
            }
            // Gestion de la durée du statut
            if (status.nbTurnEffect !== null) {
                status.nbTurnEffect--;
                if (status.nbTurnEffect > 0) {
                    newStatusList.push(status);
                } else {
                    // RAZ des attributs modifiés par les statuts
                    switch (status.name) {
                        case "Aveuglement":
                            unit.accuracyModifier = 1; // RAZ de la précision
                            break;
                        case "Fureur":
                            unit.stats.strength -= 2; // RAZ de la force
                            break;
                        case "Rage":
                            unit.stats.strength -= 1; // RAZ de la force
                            break;
                        case "Provoque":
                            unit.isTargeted = false; // RAZ du isTargeted
                            break;
                    }
                    resultArray.push(`${unit.name} n'est plus affecté par ${status.name}.`);
                }
            }
        }
    }
    // Mettre à jour les statuts restants
    unit.status = newStatusList;
    return resultArray;
}