import Card, { PIN } from "./card";

export const enum MachineWithdrawResultCode {
  OK = 0,
  ERROR_CASH_BIN_INSUFFICENT_FUND,
  ERROR_MECHANICAL,
  ERROR_OTHERS,
};

export const enum MachineDepositResultCode {
  OK = 0,
  ERROR_CASH_BIN_FULL,
  ERROR_MECHANICAL,
  ERROR_OTHERS,
};

export default abstract class AtmMachine {
  // Gets current inserted card if any.
  abstract getCard(): Card | null;
  // Reads PIN from user.
  abstract readPin(): Promise<PIN>;
  // Ejects card from the machine.
  abstract ejectCard(): void;
  // Whether the amount can be withdrawn from this machine.
  abstract canWithdraw(amount: number): MachineWithdrawResultCode;
  // Whether the amount can be deposited to this machine, e.g. cash bin not full.
  abstract canDeposit(amount: number): MachineDepositResultCode;
  // Withdraws money from the cash bin.
  abstract withdraw(amount: number): Promise<MachineWithdrawResultCode>;
  // Deposits money to the cash bin.
  abstract deposit(amount: number): Promise<MachineDepositResultCode>;
  // Add handler function which is called when a card is inserted.
  abstract onCardInserted(handler: (card: Card) => void): void;
}