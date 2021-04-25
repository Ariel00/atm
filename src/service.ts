import { CardNumber, PIN } from "./card";

export type AccessToken = string;

export const enum ServiceBalanceResultCode {
  OK = 0,
  AUTHORIZATION_ERROR,
  ERROR_OTHERS,
};
export const enum ServiceWithdrawResultCode {
  OK = 0,
  AUTHORIZATION_ERROR,
  ERROR_INSUFFICIENT_BALANCE,
  ERROR_OTHERS,
};
export const enum ServiceDepositResultCode {
  OK = 0,
  AUTHORIZATION_ERROR,
  ERROR_OTHERS,
};

export type ServiceBalanceResult = {
  code: ServiceBalanceResultCode,
  balance?: number,
};
export type ServiceWithdrawResult = {
  code: ServiceWithdrawResultCode,
  newBalance?: number,
};
export type ServiceDepositResult = {
  code: ServiceDepositResultCode,
  newBalance?: number,
};

export default abstract class BankService {
  // Returns an access token if validated successfully.
  abstract validatePIN(cardNumber: CardNumber, encryptedPin: PIN): Promise<AccessToken | null>;
  // Gets account balance given valid access token.
  abstract getBalance(accessToken: AccessToken): Promise<ServiceBalanceResult>;
  // Withdraws money from the account.
  abstract withdraw(accessToken: AccessToken, amount: number): Promise<ServiceWithdrawResult>;
  // Deposits money into the account.
  abstract deposit(accessToken: AccessToken, amount: number): Promise<ServiceDepositResult>;
}