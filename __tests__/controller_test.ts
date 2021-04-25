import BankService, { AccessToken, ServiceBalanceResult, ServiceDepositResult, ServiceWithdrawResult, ServiceBalanceResultCode, ServiceWithdrawResultCode, ServiceDepositResultCode } from "../src/service";
import Card, { CardNumber, PIN } from "../src/card";
import AtmUI from "../src/gui";
import AtmMachine, { MachineDepositResultCode, MachineWithdrawResultCode } from "../src/machine";
import AtmController from "../src/controller";

const TEST_ACCOUNT = '111222333444';
const TEST_INITIAL_BALANCE = 100;
const TEST_ACCOUNT_ENCRYPTED_PIN = 'FOO';
const TEST_ACCESS_TOKEN = 'SECRET';
const TEST_CARD = new Card(TEST_ACCOUNT);

class MockBankService extends BankService {
  private testAccountBalance_ = TEST_INITIAL_BALANCE;

  validatePIN(cardNumber: CardNumber, encryptedPin: PIN) {
    if (cardNumber === TEST_ACCOUNT && encryptedPin === TEST_ACCOUNT_ENCRYPTED_PIN) {
      return Promise.resolve(TEST_ACCESS_TOKEN);
    }
    return Promise.resolve(null);
  }

  getBalance(accessToken: AccessToken): Promise<ServiceBalanceResult> {
    if (accessToken !== TEST_ACCESS_TOKEN) {
      return Promise.resolve({
        code: ServiceBalanceResultCode.AUTHORIZATION_ERROR
      });
    }
    return Promise.resolve({
      code: ServiceBalanceResultCode.OK,
      balance: this.testAccountBalance_,
    });
  }

  withdraw(accessToken: AccessToken, amount: number): Promise<ServiceWithdrawResult> {
    if (accessToken !== TEST_ACCESS_TOKEN) {
      return Promise.resolve({
        code: ServiceWithdrawResultCode.AUTHORIZATION_ERROR
      });
    }
    if (amount >= this.testAccountBalance_) {
      return Promise.resolve({
        code: ServiceWithdrawResultCode.ERROR_INSUFFICIENT_BALANCE
      });
    }
    this.testAccountBalance_ -= amount;
    return Promise.resolve({
      code: ServiceWithdrawResultCode.OK,
      newBalance: this.testAccountBalance_,
    });
  }

  deposit(accessToken: AccessToken, amount: number): Promise<ServiceDepositResult> {
    if (accessToken !== TEST_ACCESS_TOKEN) {
      return Promise.resolve({
        code: ServiceDepositResultCode.AUTHORIZATION_ERROR
      });
    }
    if (amount < 0) {
      return Promise.resolve({
        code: ServiceDepositResultCode.ERROR_OTHERS
      });
    }
    this.testAccountBalance_ += amount;
    return Promise.resolve({
      code: ServiceDepositResultCode.OK,
      newBalance: this.testAccountBalance_,
    });
  }
}

class MockGUI extends AtmUI {
  private controller_: AtmController | undefined;

  showOptionsScreen() { }

  setController(controller: AtmController) {
    this.controller_ = controller;
  }

  async authorize(): Promise<boolean> {
    if (!this.controller_) {
      throw new Error('missing controller')
    }
    const pin = await this.controller_.readPin();
    return this.controller_.validatePin(pin);
  }
}

class MockMachine extends AtmMachine {
  private card_: Card | null = null;
  private cardInsertedHandler_: ((card: Card) => void) | undefined;
  insertCard(card: Card) {
    if (this.card_) {
      throw new Error('there is already a card in ATM')
    }
    this.card_ = card;
    this.cardInsertedHandler_ && this.cardInsertedHandler_(card);
  }
  getCard(): Card | null {
    return this.card_;
  }
  readPin(): Promise<PIN> {
    return Promise.resolve('1234');
  }
  ejectCard(): void {
    this.card_ = null;
  }
  canWithdraw(amount: number): MachineWithdrawResultCode {
    return MachineWithdrawResultCode.OK;
  }
  canDeposit(amount: number): MachineDepositResultCode {
    return MachineDepositResultCode.OK;
  }
  withdraw(amount: number): Promise<MachineWithdrawResultCode> {
    return Promise.resolve(MachineWithdrawResultCode.OK);
  }
  deposit(amount: number): Promise<MachineDepositResultCode> {
    return Promise.resolve(MachineDepositResultCode.OK);
  }
  onCardInserted(handler: (card: Card) => void): void {
    this.cardInsertedHandler_ = handler;
  }
}

test('Wrong PIN', async () => {
  const atm = new MockMachine();
  const service = new MockBankService();
  const ui = new MockGUI();
  const controller = new AtmController(atm, service, ui);
  ui.setController(controller);
  atm.insertCard(TEST_CARD);

  const mockReadPin = jest.fn<ReturnType<typeof atm.readPin>, Parameters<typeof atm.readPin>>();
  atm.readPin = mockReadPin;

  mockReadPin.mockReturnValueOnce(Promise.resolve('wrongpin'));
  expect(await ui.authorize()).toBeFalsy();
  try {
    await controller.getBalance();
  } catch (e) {
    expect(e.message).toMatch('invalid access token');
  }

  mockReadPin.mockReturnValueOnce(Promise.resolve(TEST_ACCOUNT_ENCRYPTED_PIN));
  expect(await ui.authorize()).toBeTruthy();
});

describe('Authorized', () => {
  let atm: MockMachine;
  let service: BankService;
  let ui: MockGUI;
  let controller: AtmController;

  beforeEach(async () => {
    atm = new MockMachine();
    service = new MockBankService();
    ui = new MockGUI();
    controller = new AtmController(atm, service, ui);
    ui.setController(controller);
    atm.insertCard(TEST_CARD);
    const mockReadPin = jest.fn<ReturnType<typeof atm.readPin>, Parameters<typeof atm.readPin>>();
    atm.readPin = mockReadPin;
    mockReadPin.mockReturnValueOnce(Promise.resolve(TEST_ACCOUNT_ENCRYPTED_PIN));
    expect(await ui.authorize()).toBeTruthy();
  })


  test('A normal sequence', async () => {
    let b = await controller.getBalance();
    expect(b.code).toEqual(ServiceBalanceResultCode.OK);
    expect(b.balance).toEqual(100);

    const w = await controller.withdraw(12);
    expect(w.code).toEqual(ServiceWithdrawResultCode.OK);
    expect(w.newBalance).toEqual(88);

    const d = await controller.deposit(23);
    expect(d.code).toEqual(ServiceDepositResultCode.OK);
    expect(d.newBalance).toEqual(111);

    b = await controller.getBalance();
    expect(b.code).toEqual(ServiceBalanceResultCode.OK);
    expect(b.balance).toEqual(111);
  });

  test('Bank insufficient balance', async () => {
    let b = await controller.getBalance();
    expect(b.code).toEqual(ServiceBalanceResultCode.OK);
    expect(b.balance).toEqual(100);

    const d = await controller.deposit(23);
    expect(d.code).toEqual(ServiceDepositResultCode.OK);
    expect(d.newBalance).toEqual(123);

    const w = await controller.withdraw(200);
    expect(w.code).toEqual(ServiceWithdrawResultCode.ERROR_INSUFFICIENT_BALANCE);

    b = await controller.getBalance();
    expect(b.code).toEqual(ServiceBalanceResultCode.OK);
    expect(b.balance).toEqual(123);
  });

  test('Machine insufficient cash', async () => {
    let b = await controller.getBalance();
    expect(b.code).toEqual(ServiceBalanceResultCode.OK);
    expect(b.balance).toEqual(100);

    const mockCanWithdraw = jest.fn();
    mockCanWithdraw.mockReturnValueOnce(MachineWithdrawResultCode.ERROR_CASH_BIN_INSUFFICENT_FUND);
    atm.canWithdraw = mockCanWithdraw;
    atm.withdraw = jest.fn();
    service.withdraw = jest.fn();

    const w = await controller.withdraw(12);
    expect(w.code).toEqual(MachineWithdrawResultCode.ERROR_CASH_BIN_INSUFFICENT_FUND);
    expect(atm.withdraw).not.toBeCalled();
    expect(service.withdraw).not.toBeCalled();

    // balance not changed
    b = await controller.getBalance();
    expect(b.code).toEqual(ServiceBalanceResultCode.OK);
    expect(b.balance).toEqual(100);
  });

  test('Machine cash full', async () => {
    let b = await controller.getBalance();
    expect(b.code).toEqual(ServiceBalanceResultCode.OK);
    expect(b.balance).toEqual(100);

    const mockCanDeposit = jest.fn();
    mockCanDeposit.mockReturnValueOnce(MachineDepositResultCode.ERROR_CASH_BIN_FULL);
    atm.canDeposit = mockCanDeposit;
    atm.deposit = jest.fn();
    service.deposit = jest.fn();

    const d = await controller.deposit(23);
    expect(d.code).toEqual(MachineDepositResultCode.ERROR_CASH_BIN_FULL);
    expect(atm.deposit).not.toBeCalled();
    expect(service.deposit).not.toBeCalled();

    // balance not changed
    b = await controller.getBalance();
    expect(b.code).toEqual(ServiceBalanceResultCode.OK);
    expect(b.balance).toEqual(100);
  });

  test('Machine mechanical error, fund was deducted, contact customer service', async () => {
    let b = await controller.getBalance();
    expect(b.code).toEqual(ServiceBalanceResultCode.OK);
    expect(b.balance).toEqual(100);

    const mockAtmWithdraw = jest.fn();
    mockAtmWithdraw.mockReturnValueOnce(MachineWithdrawResultCode.ERROR_MECHANICAL);
    atm.withdraw = mockAtmWithdraw;
    const spyServiceWithdraw = jest.spyOn(service, 'withdraw');

    const w = await controller.withdraw(12);
    expect(w.code).toEqual(MachineWithdrawResultCode.ERROR_MECHANICAL);
    expect(w.newBalance).toEqual(88);
    expect(atm.withdraw).toBeCalled();
    expect(spyServiceWithdraw).toBeCalled();

    // balance changed
    b = await controller.getBalance();
    expect(b.code).toEqual(ServiceBalanceResultCode.OK);
    expect(b.balance).toEqual(88);
  });

  test('Exit', async () => {
    const spyEjectCard = jest.spyOn(atm, 'ejectCard');
    controller.exit();
    expect(spyEjectCard).toBeCalled();
    expect(atm.getCard()).toBe(null);
    try {
      await controller.getBalance();
    } catch (e) {
      expect(e.message).toMatch('invalid access token');
    }
  });
})