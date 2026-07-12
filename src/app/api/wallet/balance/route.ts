import { NextResponse } from "next/server";
import { DEFAULT_WALLET_SETTINGS } from "@/lib/wallet";
import { calculateTransactionHash } from "@/lib/wallet-server";

export async function GET(req: Request) {
  try {
    const { authenticateRequest } = await import("@/lib/auth-server");
    const user = await authenticateRequest(req);

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admincraftstyle@gmail.com";
    const isCallerAdmin = user.email === adminEmail || user.email === "admin@craftstyle.com";

    if (user.uid !== userId && !isCallerAdmin) {
      return NextResponse.json({ error: "Forbidden: You cannot view another user's balance." }, { status: 403 });
    }

    // 1. Initialize Firestore (using full SDK for transactions)
    const { getFirestore, doc, getDoc, collection, query, where, orderBy, getDocs, setDoc } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    const walletRef = doc(db, "wallets", userId);
    let walletSnap = await getDoc(walletRef);
    let balance = 0;

    // 2. Auto-initialize wallet if it doesn't exist
    if (!walletSnap.exists()) {
      try {
        // Read campaign rules from settings/wallet, fallback to defaults
        const settingsRef = doc(db, "settings", "wallet");
        const settingsSnap = await getDoc(settingsRef);
        const rules = settingsSnap.exists() 
          ? { ...DEFAULT_WALLET_SETTINGS, ...settingsSnap.data() } 
          : DEFAULT_WALLET_SETTINGS;

        const signupBonus = Number(rules.signupBonus || 100);
        const expiryDays = Number(rules.expiryDays || 365);
        
        let latestHash = "genesis";
        let initialBalance = 0;

        if (signupBonus > 0) {
          initialBalance = signupBonus;
          const txnRef = doc(collection(db, "wallet_transactions"));
          latestHash = calculateTransactionHash(userId, signupBonus, "CREDIT", "genesis");
          
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expiryDays);

          await setDoc(txnRef, {
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

        await setDoc(walletRef, {
          userId,
          balance: initialBalance,
          currency: "INR",
          updatedAt: new Date().toISOString(),
          latestTransactionHash: latestHash
        });

        // Re-fetch after creation
        walletSnap = await getDoc(walletRef);
      } catch (txErr: any) {
        console.error("Wallet auto-initialization failed:", txErr);
        // Fallback: Try to read one more time
        walletSnap = await getDoc(walletRef);
      }
    }

    if (walletSnap.exists()) {
      balance = walletSnap.data().balance;
    }

    // 3. Fetch Transactions
    const txnsRef = collection(db, "wallet_transactions");
    const qTxns = query(txnsRef, where("walletId", "==", userId));
    const querySnapshot = await getDocs(qTxns);
    let transactions = querySnapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    // Auto-credit signup bonus if wallet exists with 0 balance and no transactions
    if (walletSnap.exists() && walletSnap.data().balance === 0 && transactions.length === 0) {
      try {
        const settingsRef = doc(db, "settings", "wallet");
        const settingsSnap = await getDoc(settingsRef);
        const rules = settingsSnap.exists() 
          ? { ...DEFAULT_WALLET_SETTINGS, ...settingsSnap.data() } 
          : DEFAULT_WALLET_SETTINGS;

        const signupBonus = Number(rules.signupBonus || 100);
        const expiryDays = Number(rules.expiryDays || 365);

        if (signupBonus > 0) {
          const txnRef = doc(collection(db, "wallet_transactions"));
          const latestHash = calculateTransactionHash(userId, signupBonus, "CREDIT", "genesis");
          
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expiryDays);

          const newTxn = {
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
          };

          await setDoc(txnRef, newTxn);
          await setDoc(walletRef, {
            userId,
            balance: signupBonus,
            currency: "INR",
            updatedAt: new Date().toISOString(),
            latestTransactionHash: latestHash
          });

          balance = signupBonus;
          transactions = [{ id: txnRef.id, ...newTxn }];
        }
      } catch (fixErr) {
        console.error("Failed to apply missing credit fix:", fixErr);
      }
    }

    transactions.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

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
