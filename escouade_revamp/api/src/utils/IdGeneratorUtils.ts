export class IdGenerator {
    static INITIAL_JOBS: Record<string,string> = {
        "Mage noir": "BlkM",
        "Mage rouge": "RM",
        "Mage blanc": "WM",
        "Mage bleu": "BluM",
        "Voleur": "Thf",
        "Guerrier": "W",
        "Moine": "M" 
    }

    static generateId(): string {
        const timestamp = Date.now().toString(36); // Encodage base 36 de l'horodatage
        const randomPart = Math.random().toString(36).substring(2, 9); // Partie aléatoire
        return (timestamp + randomPart).substring(0, 13); // Tronquer à 13 caractères
    }

    static generate(name:string): string {
        return (this.INITIAL_JOBS[name] || name)+"_"+this.generateId();
    }

    
}
