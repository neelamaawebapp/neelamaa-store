import { NextResponse } from "next/server";
import { calculateTransactionHash } from "@/lib/wallet-server";

export async function GET(req: Request) {
  return handleCronExpire(req);
}

export async function POST(req: Request) {
  return handleCronExpire(req);
}

async function handleCronExpire(req: Request) {
  try {
    const { verifyAdminRequest } = await import("@/lib/auth-server");
    await verifyAdminRequest(req);

    const { getFirestore, doc, collection, query, where, getDocs, runTransaction } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    const nowStr = new Date().toISOString();

    // 1. Find all active credit transactions that have expired
    const txnsRef = collection(db, "wallet_transactions");
    const qExpired = query(
      txnsRef,
      where("transactionType", "==", "CREDIT"),
      where("status", "==", "Active"),
      where("expiresAt", "<", nowStr)
    );

    const expiredSnap = await getDocs(qExpired);
    let expiredCount = 0;
    let totalDebitedAmount = 0;

    // 2. Process each expired credit transaction in a separate ACID transaction
    for (const txnDoc of expiredSnap.docs) {
      const txnData = txnDoc.data();
      const userId = txnData.walletId;
      const creditAmount = Number(txnData.amount || 0);
      const txnId = txnDoc.id;

      try {
        await runTransaction(db, async (transaction) => {
          const wRef = doc(db, "wallets", userId);
          const wSnap = await transaction.get(wRef);
          
          if (!wSnap.exists()) return;

          const wData = wSnap.data();
          const currentBalance = Number(wData.balance || 0);

          // Get fresh state of the transaction to verify it hasn't been modified
          const freshTxnRef = doc(db, "wallet_transactions", txnId);
          const freshTxnSnap = await transaction.get(freshTxnRef);
          if (!freshTxnSnap.exists() || freshTxnSnap.data().status !== "Active") return;

          // Debit only what is currently available, capping at original credit amount
          const debitAmount = Math.min(currentBalance, creditAmount);

          if (debitAmount > 0) {
            const previousHash = wData.latestTransactionHash || "genesis";
            const newHash = calculateTransactionHash(userId, debitAmount, "DEBIT", previousHash);

            const newTxnRef = doc(collection(db, "wallet_transactions"));

            // Create EXPIRY debit transaction
            transaction.set(newTxnRef, {
              walletId: userId,
              amount: -debitAmount,
              transactionType: "DEBIT",
              source: "EXPIRY",
              referenceId: txnId,
              description: `Cashback Expired (${txnData.description || "Credit"})`,
              createdAt: new Date().toISOString(),
              hash: newHash
            });

            // Update user balance
            transaction.update(wRef, {
              balance: currentBalance - debitAmount,
              latestTransactionHash: newHash,
              updatedAt: new Date().toISOString()
            });

            totalDebitedAmount += debitAmount;
          }

          // Mark the original credit transaction as Expired
          transaction.update(freshTxnRef, {
            status: "Expired"
          });
        });

        expiredCount++;
      } catch (txErr) {
        console.error(`Failed to process expiry for transaction ${txnId}:`, txErr);
      }
    }

    return NextResponse.json({
      success: true,
      processedTransactions: expiredCount,
      totalExpiredPointsDebited: totalDebitedAmount,
      message: `Processed ${expiredCount} expired credits, debited total of ₹${totalDebitedAmount} points.`
    });

  } catch (error: any) {
    console.error("Cron Expire Error:", error);
    return NextResponse.json({ error: error.message || "Failed to run cron points expiry" }, { status: 500 });
  }
}
