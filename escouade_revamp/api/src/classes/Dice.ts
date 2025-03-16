export class Dice {
    rolling: boolean = false;
    diceRoll: number = 0;

    rollDice = (): Promise<number> => new Promise((resolve) => {
        this.rolling = true;
        setTimeout(() => {
          this.diceRoll = Math.floor(Math.random() * 6) + 1;
          this.rolling = false;
          resolve(this.diceRoll);
        }, 1000);
      });
}

