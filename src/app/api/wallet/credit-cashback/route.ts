import { NextResponse } from "next/server";
import { DEFAULT_WALLET_SETTINGS } from "@/lib/wallet";
import { calculateTransactionHash } from "@/lib/wallet-server";

export async function POST(req: Request) {
  try {
    const { authenticateRequest } = await import("@/lib/auth-server");
    const user = await authenticateRequest(req);

    const { orderId, userId, mockOrderTotal } = await req.json();

    if (!orderId || !userId) {
      return NextResponse.json({ error: "Missing orderId or userId parameters" }, { status: 400 });
    }

    if (user.uid !== userId) {
      return NextResponse.json({ error: "Forbidden: You can only request cashback for your own account." }, { status: 403 });
    }

    const isMock = orderId.startsWith("mock_");
    const isDev = process.env.NODE_ENV === "development";

    if (isMock && !isDev) {
      return NextResponse.json({ error: "Forbidden: Mock orders are not permitted in production." }, { status: 403 });
    }

    const { getFirestore, doc, getDoc, collection, query, where, getDocs, runTransaction } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    // 1. If it's a mock order, do a pre-query to ensure we haven't already credited it.
    if (isMock) {
      const txnsRef = collection(db, "wallet_transactions");
      const qCheck = query(
        txnsRef, 
        where("walletId", "==", userId), 
        where("referenceId", "==", orderId), 
        where("source", "==", "CASHBACK")
      );
      const snap = await getDocs(qCheck);
      if (!snap.empty) {
        return NextResponse.json({ success: true, message: "Cashback already credited for this mock order." });
      }
    }

    const walletRef = doc(db, "wallets", userId);
    const orderRef = isMock ? null : doc(db, "orders", orderId);

    let cashbackAmount = 0;
    let message = "";

    await runTransaction(db, async (transaction) => {
      // Fetch user's wallet
      const walletSnap = await transaction.get(walletRef);
      if (!walletSnap.exists()) {
        throw new Error("Wallet not found. Please initialize the wallet first.");
      }
      const walletData = walletSnap.data();

      // Read rules
      const settingsRef = doc(db, "settings", "wallet");
      const settingsSnap = await transaction.get(settingsRef);
      const rules = settingsSnap.exists()
        ? { ...DEFAULT_WALLET_SETTINGS, ...settingsSnap.data() }
        : DEFAULT_WALLET_SETTINGS;

      const percent = Number(rules.cashbackPercent || 5);
      const maxLimit = Number(rules.maxCashbackLimit || 100);
      const expiryDays = Number(rules.expiryDays || 365);

      let orderTotal = 0;

      if (isMock) {
        orderTotal = Number(mockOrderTotal || 0);
      } else if (orderRef) {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) {
          throw new Error("Order not found in database.");
        }
        const orderData = orderSnap.data();
        if (orderData.status !== "Delivered") {
          throw new Error("Order status must be Delivered to receive cashback.");
        }
        if (orderData.cashbackCredited === true) {
          message = "Cashback already credited for this order.";
          return;
        }
        orderTotal = Number(orderData.totalAmount || 0);
      }

      // Calculate Cashback
      cashbackAmount = Math.min(Math.round(orderTotal * (percent / 100)), maxLimit);

      if (cashbackAmount <= 0) {
        message = "Cashback amount is zero. No transaction created.";
        return;
      }

      // Cryptographic Hash Chain
      const previousHash = walletData.latestTransactionHash || "genesis";
      const newHash = calculateTransactionHash(userId, cashbackAmount, "CREDIT", previousHash);

      const txnRef = doc(collection(db, "wallet_transactions"));
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      // Create CREDIT transaction
      transaction.set(txnRef, {
        walletId: userId,
        amount: cashbackAmount,
        transactionType: "CREDIT",
        source: "CASHBACK",
        referenceId: orderId,
        description: `Cashback for Order #${orderId.slice(-8).toUpperCase()}`,
        status: "Active",
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
        hash: newHash
      });

      // Update wallets table
      transaction.update(walletRef, {
        balance: (walletData.balance || 0) + cashbackAmount,
        latestTransactionHash: newHash,
        updatedAt: new Date().toISOString()
      });

      // Update order status if not mock
      if (!isMock && orderRef) {
        transaction.update(orderRef, {
          cashbackCredited: true,
          cashbackAmount: cashbackAmount
        });
      }
    });

    if (message) {
      return NextResponse.json({ success: true, message });
    }

    return NextResponse.json({
      success: true,
      cashbackAmount,
      message: `Successfully credited ₹${cashbackAmount} cashback.`
    });

  } catch (error: any) {
    console.error("Credit Cashback Error:", error);
    return NextResponse.json({ error: error.message || "Failed to credit cashback" }, { status: 500 });
  }
}
