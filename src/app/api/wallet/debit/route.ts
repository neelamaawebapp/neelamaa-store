import { NextResponse } from "next/server";
import { calculateTransactionHash } from "@/lib/wallet-server";

export async function POST(req: Request) {
  try {
    const { userId, orderId, amount } = await req.json();

    if (!userId || !orderId || amount === undefined || amount <= 0) {
      return NextResponse.json({ error: "Missing required fields or invalid amount" }, { status: 400 });
    }

    const { getFirestore, doc, collection, runTransaction } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    const walletRef = doc(db, "wallets", userId);

    await runTransaction(db, async (transaction) => {
      // 1. Fetch wallet
      const walletSnap = await transaction.get(walletRef);
      if (!walletSnap.exists()) {
        throw new Error("Wallet not found.");
      }

      const walletData = walletSnap.data();
      const currentBalance = Number(walletData.balance || 0);

      // 2. Validate balance
      if (currentBalance < amount) {
        throw new Error(`Insufficient wallet balance. Available: ₹${currentBalance}, Requested: ₹${amount}`);
      }

      // 3. Cryptographic hash chain
      const previousHash = walletData.latestTransactionHash || "genesis";
      const newHash = calculateTransactionHash(userId, amount, "DEBIT", previousHash);

      const txnRef = doc(collection(db, "wallet_transactions"));

      // 4. Create DEBIT transaction (amount is logged as negative for debit)
      transaction.set(txnRef, {
        walletId: userId,
        amount: -amount,
        transactionType: "DEBIT",
        source: "ORDER_PAYMENT",
        referenceId: orderId,
        description: `Paid for Order #${orderId.slice(-8).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        hash: newHash
      });

      // 5. Deduct from wallet balance
      transaction.update(walletRef, {
        balance: currentBalance - amount,
        latestTransactionHash: newHash,
        updatedAt: new Date().toISOString()
      });
    });

    return NextResponse.json({
      success: true,
      message: `Successfully debited ₹${amount} from wallet.`
    });

  } catch (error: any) {
    console.error("Wallet Debit Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process wallet payment" }, { status: 500 });
  }
}
