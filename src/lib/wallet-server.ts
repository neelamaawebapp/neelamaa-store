import { createHash } from "crypto";

/**
 * Calculates a SHA-256 hash for a wallet transaction block to enforce audit-chain tamper proofing.
 * hash = SHA256(walletId + amount + type + previousHash)
 */
export function calculateTransactionHash(
  walletId: string,
  amount: number,
  type: string,
  previousHash: string
): string {
  const data = `${walletId}_${amount}_${type}_${previousHash}`;
  return createHash("sha256").update(data).digest("hex");
}
