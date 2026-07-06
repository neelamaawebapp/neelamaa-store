import { NextResponse } from "next/server";
import { DEFAULT_WALLET_SETTINGS } from "@/lib/wallet";
import { calculateTransactionHash } from "@/lib/wallet-server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }

    // 1. Initialize Firestore (using full SDK for transactions)
    const { getFirestore, doc, getDoc, collection, query, where, orderBy, getDocs, runTransaction } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    const walletRef = doc(db, "wallets", userId);
    let walletSnap = await getDoc(walletRef);
    let balance = 0;

    // 2. Auto-initialize wallet if it doesn't exist
    if (!walletSnap.exists()) {
      try {
        await runTransaction(db, async (transaction) => {
          const wSnap = await transaction.get(walletRef);
          if (wSnap.exists()) return; // Already created in a race condition

          // Read campaign rules from settings/wallet, fallback to defaults
          const settingsRef = doc(db, "settings", "wallet");
          const settingsSnap = await transaction.get(settingsRef);
          const rules = settingsSnap.exists() 
            ? { ...DEFAULT_WALLET_SETTINGS, ...settingsSnap.data() } 
            : DEFAULT_WALLET_SETTINGS;

          const signupBonus = Number(rules.signupBonus || 0);
          const expiryDays = Number(rules.expiryDays || 365);
          
          let latestHash = "genesis";
          let initialBalance = 0;

          if (signupBonus > 0) {
            initialBalance = signupBonus;
            const txnRef = doc(collection(db, "wallet_transactions"));
            latestHash = calculateTransactionHash(userId, signupBonus, "CREDIT", "genesis");
            
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiryDays);

            transaction.set(txnRef, {
              walletId: userId,
              amount: signupBonus,
              transactionType: "CREDIT",
              source: "SIGNUP_BONUS",
              referenceId: "signup",
              description: "Signup Bonus",
              status: "Active",
              expiresAt: expiresAt.toISOString(),
              createdAt: new Date().toISOString(),
              hash: latestHash
            });
          }

          transaction.set(walletRef, {
            userId,
            balance: initialBalance,
            currency: "INR",
            updatedAt: new Date().toISOString(),
            latestTransactionHash: latestHash
          });
        });

        // Re-fetch after transaction creation
        walletSnap = await getDoc(walletRef);
      } catch (txErr: any) {
        console.error("Wallet auto-initialization transaction failed:", txErr);
        // Fallback: If transaction failed, try to read one more time
        walletSnap = await getDoc(walletRef);
      }
    }

    if (walletSnap.exists()) {
      balance = walletSnap.data().balance;
    }

    // 3. Fetch Transactions
    const txnsRef = collection(db, "wallet_transactions");
    const qTxns = query(txnsRef, where("walletId", "==", userId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(qTxns);
    const transactions = querySnapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    return NextResponse.json({
      success: true,
      balance,
      transactions
    });

  } catch (error: any) {
    console.error("Wallet Balance GET Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load wallet" }, { status: 500 });
  }
}
