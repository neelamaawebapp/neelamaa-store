import { NextResponse } from "next/server";
import { calculateTransactionHash } from "@/lib/wallet-server";

export async function POST(req: Request) {
  try {
    const { userId, orderId, amount, itemIndex } = await req.json();

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

      // 2. Cryptographic hash chain
      const previousHash = walletData.latestTransactionHash || "genesis";
      const newHash = calculateTransactionHash(userId, amount, "CREDIT", previousHash);

      const txnRef = doc(collection(db, "wallet_transactions"));
      const itemDesc = itemIndex !== undefined ? ` Item #${itemIndex + 1}` : "";

      // 3. Create CREDIT transaction
      transaction.set(txnRef, {
        walletId: userId,
        amount: amount,
        transactionType: "CREDIT",
        source: "ORDER_REFUND",
        referenceId: orderId,
        description: `Refund for Order #${orderId.slice(-8).toUpperCase()}${itemDesc}`,
        createdAt: new Date().toISOString(),
        hash: newHash
      });

      // 4. Update wallet balance
      transaction.update(walletRef, {
        balance: currentBalance + amount,
        latestTransactionHash: newHash,
        updatedAt: new Date().toISOString()
      });
    });

    return NextResponse.json({
      success: true,
      message: `Successfully refunded ₹${amount} to wallet.`
    });

  } catch (error: any) {
    console.error("Wallet Refund Error:", error);
    return NextResponse.json({ error: error.message || "Failed to refund to wallet" }, { status: 500 });
  }
}
