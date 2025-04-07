export class IdGenerator {
    static generate(): string {
        const timestamp = Date.now().toString(36); // Encodage base 36 de l'horodatage
        const randomPart = Math.random().toString(36).substring(2, 9); // Partie aléatoire
        return (timestamp + randomPart).substring(0, 13); // Tronquer à 13 caractères
    }
}
