import { Job } from "./Job";
import { AstroCard, Statistics } from "../Types";
import { Scepter } from "../Items/Weapon";
import { Character } from "../UnitTypes/Character";
import { Unit } from "../UnitTypes/Unit";
import { Monster } from "../UnitTypes/Monster";
import cardList from "../../config/astrocards_data.json"

export class WhiteMage extends Job {
    deck: AstroCard[] = this.shuffleDeck(); //Liste des cartes
    hand: AstroCard[] = []; // Pour les cartes à jouer
    handBuffer: AstroCard[] = [];
    sigils: { [key: string]: number }[] = [
        { "solar": 0 },
        { "moon": 0 },
        { "stellar": 0 },
    ];

    constructor() {
        super(
            "Mage Blanc",
            "Classe qui compense sa faible résistance par de la magie de soutien et de soin",
            ['marteau', 'sceptre'],
            [new Scepter("WM_startBatonDeMage", "Bâton de mage", "Un bâton simple mais puissant, taillé dans le bois de l'arbre ancestral. Il canalise la magie comme un lien entre le mage et les arcanes.", 200, 1, 2, "")],
            10,
            [],
            [
                { level: 1, spell: "Soin" },
                { level: 1, spell: "Ruine" },
                { level: 5, spell: "Barrière" },
                { level: 7, spell: "Lumen" },
                { level: 10, spell: "Grâce" },
                { level: 12, spell: "Soin +", },
                { level: 15, spell: "Lumen +" },
                { level: 18, spell: "Grâce +" },
                { level: 18, spell: "Vie" }
            ],
            [
                {
                    name: "Sage Blanc",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "Dual Cast : Peut lancer deux sorts par tour",
                    bonuses: {
                        strength: 0,
                        dexterity: 0,
                        endurance: 0,
                        mana: 2,
                        intelligence: 1,
                        perception: 0,
                        charisma: 0
                    },
                    skills: [],
                    spells: [
                        { level: 20, spell: "Soin X" },
                        { level: 20, spell: "Esuna" },
                        { level: 21, spell: "Lumen X" },
                        { level: 24, spell: "Grâce X" },
                        { level: 24, spell: "Vie +" },
                        { level: 26, spell: "Dissipation" },
                        { level: 28, spell: "Vie X" },
                        { level: 30, spell: "Sidéral" }
                    ]
                },
                {
                    name: "Astromancien",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "",
                    bonuses: {
                        strength: 0,
                        dexterity: 0,
                        endurance: 0,
                        mana: 1,
                        intelligence: 1,
                        perception: 2,
                        charisma: 0
                    },
                    skills: [
                        { level: 20, skill: {         name: "Tirage",
                                formula: "this.job.drawCard();", 
                                target: 'self',
                                type: "single",
                                range: 0,
                                apCost: 1,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "tire une carte",
                                move: 0
                            }
                        },
                        {
                            level: 21, skill: {
                                name: "Arcane Mineure",
                                formula: "this.job.drawMinorArcana();", 
                                target: 'self',
                                type: "single",
                                range: 0,
                                apCost: 2,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "tire un atout immédiatement",
                                move: 0
                            }
                        },
                        {
                            level: 24, skill: {
                                name: "Exaltation",
                                formula: "this.job.exaltation(target);", 
                                target: 'ally',
                                type: "single",
                                range: 0,
                                apCost: 2,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "augmente toutes les statistiques de la cible de 1",
                                move: 0
                            }
                        },
                        {
                            level: 26, skill: {
                                name: "Arcane Majeure",
                                formula: "this.job.drawMajorArcana();", 
                                target: 'self',
                                type: "single",
                                range: 0,
                                apCost: 3,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "récupère jusqu'à 3 sceaux puis tire un atout",
                                move: 0
                            }
                        },
                        {
                            level: 28, skill: {
                                name: "Le Mat",
                                formula: "this.job.drawFoolCard();", 
                                target: 'self',
                                type: "single",
                                range: 0,
                                apCost: 3,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "tire des cartes jusqu'à avoir un atout",
                                move: 0
                            }
                        },
                        {
                            level: 30, skill: {
                                name: "Dévoilement",
                                formula: "this.job.revealFourFirst();", 
                                target: 'self',
                                type: "single",
                                range: 0,
                                apCost: 4,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "permet de regarder et réarranger les 4 prochaines cartes du deck",
                                move: 0
                            }
                        }
                    ],
                    spells: []
                }
            ]
        );
    }

    protected initStats(): Statistics {
        return {
            strength: 0,
            dexterity: 0,
            endurance: 1,
            intelligence: 2,
            mana: 3,
            perception: 1,
            charisma: 0
        }
    }

    pattern(): string[] {
        // fuit les ennemis
        // si un ennemi est faible à Sacré
        // Lumen
        // si un ennemi a des attaques avec statuts
        //  Barrière
        // si un allié perd des PV
        //peu de pv => grace
        //sinon soin
        // si un allié n'a plus de PV
        // Vie
        throw new Error("Method not implemented.");
    }

    /**
     * Mélange le paquet de carte
     */
    shuffleDeck(): AstroCard[] {
        const deck = cardList as AstroCard[];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        this.deck = deck;
        return deck;
    }

    /**
     * Tire la première carte du deck et la place dans la main
     * @returns drawnCard: AstroCard, la carte tirée 
     */
    drawCard(): AstroCard {
        if (this.deck.length == 0) {
            this.shuffleDeck();
        }
        const drawnCard = this.deck.splice(0, 1)[0];
        this.hand.push(drawnCard);
        return drawnCard;
    }

    /**
     * Récupère la première carte d'atout disponible
     * @returns aceCard: AstroCard, the first card where isAce === true
     */
    drawMinorArcana(): AstroCard {
        let aceCard = this.deck.find(card => card.isAce);
        if (!aceCard) {
            this.shuffleDeck();
            aceCard = this.deck.find(card => card.isAce);
        }
        if(aceCard){
            this.deck = this.deck.filter(card => card !== aceCard); // On sort la carte du deck
            this.hand.push(aceCard); // On la place dans la main
            return aceCard
        }else{
            throw new Error("No ace card left despite shuffling the deck");
        }
        
    }

    drawMajorArcana(): AstroCard{
        // Ajout d'un sigil de chaque
        this.sigils.forEach(sigil => Object.keys(sigil).forEach(key => {if(sigil[key] < 3){sigil[key]++}}));
        return this.drawMinorArcana();
    }

    drawFoolCard(): AstroCard {
        let drawnCard: AstroCard | null = null;
        while (this.deck.length > 0) {
            drawnCard = this.drawCard();
            if (drawnCard.isAce) {
                return drawnCard;
            }
        }
        // Si aucun atout restait dans le paquet on mélange et on recommence
        this.shuffleDeck();
        return this.drawFoolCard();
    }

    revealFourFirst() {
        if (this.deck.length < 4) {
            this.shuffleDeck();
        }
        this.handBuffer.push(...this.deck.slice(0, 4));
    }

    /**
     * Place une carte du handBuffer au dessus du deck
     * @param topCard 
     * @returns 
     */
    pushOnTopOfDeck(topCard: AstroCard):number {
        const newLength = this.deck.unshift(topCard);
        const topCardIndex = this.handBuffer.findIndex(carte => carte === topCard);
        this.handBuffer.splice(topCardIndex, 1);
        return newLength;
    }

    /**
     * Augmente toutes les statistiques de la cible de 1
     * @param target 
     */
    exaltation(target: Character) {
        const exaltationIndex = target.status.findIndex(statut => statut.name === "Exaltation")
        if (exaltationIndex !== -1) {
            target.stats.strength++;
            target.stats.dexterity++;
            target.stats.endurance++;
            target.stats.mana++;
            target.stats.intelligence++;
            target.stats.perception++;
            target.stats.charisma++;
            target.status.push({ name: "Exaltation", nbTurnEffect: 3 });
        } else {
            target.status[exaltationIndex].nbTurnEffect = 3;
        }
    }

    /**
     * Joue une carte en main et applique ses effet sur la cible 
     * @param card 
     * @param target 
     * @param allUnits 
     */
    playCard(card: AstroCard, target: Unit, allUnits: Unit[]) {
        if (card.sigil) {
            this.incrementSigil(card.sigil);
            if (card.bonus) {
                target.stats.strength += card.bonus.strength;
                target.stats.dexterity += card.bonus.dexterity;
                target.stats.endurance += card.bonus.endurance;
                target.stats.mana += card.bonus.mana;
                target.stats.intelligence += card.bonus.intelligence;
                target.stats.perception += card.bonus.perception;
                target.stats.charisma += card.bonus.charisma;
                if (target instanceof Monster) {
                    target.atk += card.bonus.strength;
                }
            } else if (card.status) { // La Flèche
                const statusIndex = target.status.findIndex(statut => statut.name === card.status?.name)
                if (statusIndex !== -1) {
                    target.status.push(card.status);
                } else {
                    target.status[statusIndex].nbTurnEffect = card.status.nbTurnEffect;
                }
            } else if (!card.isAce) { //Le Tronc
                target.currentHp = Math.min(target.currentHp + 7, target.maxHp);
            }
        } else if (card.power) { //Le Roi des couronnes
            //count sigils of each type "solar" | "moon" | "stellar"
            let damageMultiplier = 1;
            this.sigils.forEach(sigil => {
                const key = Object.keys(sigil)[0]; // On récupère la clé (type du sigil)
                switch (sigil[key]) {
                    case 0:
                        damageMultiplier *= 1;
                        break;
                    case 1:
                        damageMultiplier *= 1.2;
                        break;
                    case 2:
                        damageMultiplier *= 1.5;
                        break;
                    case 3:
                        damageMultiplier *= 2;
                        break;
                }
            });
            const kingDamage = (Math.pow(card.power, 2) / 2) * damageMultiplier;
            for (const enemy of allUnits.filter(unit => unit.type === "Enemy")) {
                enemy.currentHp = Math.max(enemy.currentHp - kingDamage, 0);
            }
            this.resetSigils();
        } else { // La Reine des couronnes
            let queenHeal = 0;
            //count sigils
            this.sigils.forEach(sigil => {
                const key = Object.keys(sigil)[0]; // On récupère la clé (type du sigil)
                switch (sigil[key]) {
                    case 0:
                        queenHeal = 3;
                        break;
                    case 1:
                        queenHeal = 5;
                        break;
                    case 2:
                        queenHeal = 7;
                        break;
                    case 3:
                        queenHeal = 15;
                        break;
                    default:
                        queenHeal = 30;
                }
            });
            for (const ally of allUnits.filter(unit => unit.type === "Hero")) {
                ally.currentHp = Math.min(ally.currentHp + queenHeal, ally.maxHp);
            }
            this.resetSigils();
        }
        const cardIndex = this.hand.findIndex(carte => carte === card);
        this.hand.splice(cardIndex,1);
    }

    // Méthode pour incrémenter un sigil du type spécifié
    incrementSigil(type: string): void {
        const sigil = this.sigils.find(s => s.hasOwnProperty(type)); // Trouver l'objet contenant ce type
        if (sigil) {
            sigil[type]++; // Incrémenter la valeur du sigil trouvé
        }
    }

    // Méthode pour remettre à zéro tous les sigils
    resetSigils(): void {
        this.sigils.forEach(sigil => {
            const key = Object.keys(sigil)[0]; // On récupère la clé (type du sigil)
            sigil[key] = 0; // On remet la valeur de ce sigil à zéro
        });
    }
}
