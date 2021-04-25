
// TODO: these types can be more specific and pre-validated
export type CardNumber = string;
export type PIN = string;

export default class Card {
  constructor(private readonly cardNumber_: CardNumber) {
  }

  getCardNumber() {
    return this.cardNumber_;
  }
}