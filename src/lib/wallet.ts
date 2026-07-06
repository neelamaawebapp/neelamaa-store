export interface Wallet {
  userId: string;
  balance: number;
  currency: string;
  updatedAt: string;
  latestTransactionHash: string;
}

export interface WalletTransaction {
  id?: string;
  walletId: string;
  amount: number;
  transactionType: "CREDIT" | "DEBIT";
  source: "CASHBACK" | "ORDER_REFUND" | "ORDER_PAYMENT" | "SIGNUP_BONUS" | "EXPIRY";
  referenceId: string;
  description: string;
  status?: "Active" | "Expired" | "Used";
  expiresAt?: string | null;
  createdAt: string;
  hash: string;
}

export interface WalletSettings {
  signupBonus: number;
  cashbackPercent: number;
  maxCashbackLimit: number;
  expiryDays: number;
}

export const DEFAULT_WALLET_SETTINGS: WalletSettings = {
  signupBonus: 50,
  cashbackPercent: 5,
  maxCashbackLimit: 100,
  expiryDays: 365,
};
