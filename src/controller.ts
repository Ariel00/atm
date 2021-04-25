import Card, { PIN } from "./card";
import AtmUI from "./gui";
import AtmMachine, { MachineDepositResultCode, MachineWithdrawResultCode } from "./machine";
import BankService, { AccessToken, ServiceBalanceResult, ServiceDepositResultCode, ServiceWithdrawResultCode } from "./service";

class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

type WithdrawResult = {
  code: ServiceWithdrawResultCode | MachineWithdrawResultCode,
  newBalance?: number,
};
type DepositResult = {
  code: ServiceDepositResultCode | MachineDepositResultCode,
  newBalance?: number,
};
type BalanceResult = ServiceBalanceResult;


export default class AtmController {
  private accessToken_: AccessToken | null = null;
  constructor(
    private readonly atm_: AtmMachine,
    private readonly service_: BankService,
    private readonly ui_: AtmUI) {
    this.atm_.onCardInserted(this.handleCardInserted_.bind(this));
  }

  private handleCardInserted_(card: Card) {
    this.ui_.showOptionsScreen();
  }

  private validate_(): void {
    if (this.accessToken_ === null) {
      throw new AuthorizationError('invalid access token');
    }
  }

  async readPin(): Promise<PIN> {
    return await this.atm_.readPin();
  }

  async validatePin(pin: PIN): Promise<boolean> {
    const card = this.atm_.getCard();
    if (!card) {
      throw new Error('no card in ATM')
    }
    const accessToken = await this.service_.validatePIN(card.getCardNumber(), pin);
    if (!accessToken) {
      return false;
    }
    this.accessToken_ = accessToken;
    return true;
  }

  async getBalance(): Promise<BalanceResult> {
    this.validate_();
    return await this.service_.getBalance(this.accessToken_!);
  }

  async withdraw(amount: number): Promise<WithdrawResult> {
    this.validate_();
    // See if the machine can fullfill the request first.
    let machineResult = this.atm_.canWithdraw(amount);
    if (machineResult) {
      return {
        code: machineResult,
      }
    }
    const bankServiceResult = await this.service_.withdraw(this.accessToken_!, amount);
    if (bankServiceResult.code) {
      return bankServiceResult;
    }
    machineResult = await this.atm_.withdraw(amount);
    // If machine error happens, UI can suggest customer to contact bank for help.
    return {
      code: machineResult,
      newBalance: bankServiceResult.newBalance,
    }
  }

  async deposit(amount: number): Promise<DepositResult> {
    this.validate_();
    // See if the machine can fullfill the request first.
    let machineResult = this.atm_.canDeposit(amount);
    if (machineResult) {
      return {
        code: machineResult,
      }
    }
    const bankServiceResult = await this.service_.deposit(this.accessToken_!, amount);
    if (bankServiceResult.code) {
      return bankServiceResult;
    }
    machineResult = await this.atm_.deposit(amount);
    // If machine error happens, UI can suggest customer to contact bank for help.
    return {
      code: machineResult,
      newBalance: bankServiceResult.newBalance,
    }
  }

  exit() {
    this.accessToken_ = null;
    this.atm_.ejectCard();
  }
}