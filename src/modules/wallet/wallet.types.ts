export interface WalletDTO {
  balance: number;
}

export interface WalletTransactionDTO {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}
