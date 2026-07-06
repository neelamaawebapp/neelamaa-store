import { NextResponse } from "next/server";
import { calculateTransactionHash } from "@/lib/wallet-server";

export async function POST(req: Request) {
  try {
    const { userId, referredByCode } = await req.json();

    if (!userId || !referredByCode) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const normalizedCode = referredByCode.trim().toUpperCase();

    const { getFirestore, doc, getDoc, collection, query, where, getDocs, runTransaction } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    // 1. Double check if B already has a referral signup bonus to prevent multi-triggering
    const txnsRef = collection(db, "wallet_transactions");
    const qCheck = query(
      txnsRef,
      where("walletId", "==", userId),
      where("source", "==", "SIGNUP_BONUS"),
      where("referenceId", "==", "referral_signup")
    );
    const checkSnap = await getDocs(qCheck);
    if (!checkSnap.empty) {
      return NextResponse.json({ success: true, message: "Referral already credited." });
    }

    // 2. Find Referrer A using the code
    const usersRef = collection(db, "users");
    const qReferrer = query(usersRef, where("referralCode", "==", normalizedCode));
    const referrerSnap = await getDocs(qReferrer);

    if (referrerSnap.empty) {
      return NextResponse.json({ error: "Invalid referral code. Referrer not found." }, { status: 404 });
    }

    const referrerUserDoc = referrerSnap.docs[0];
    const referrerId = referrerUserDoc.id;
    const referrerData = referrerUserDoc.data();

    if (referrerId === userId) {
      return NextResponse.json({ error: "You cannot use your own referral code" }, { status: 400 });
    }

    // Fetch Referee B's details to write descriptive log
    const refereeDocRef = doc(db, "users", userId);
    const refereeSnap = await getDoc(refereeDocRef);
    const refereeData = refereeSnap.exists() ? refereeSnap.data() : null;
    const refereeName = refereeData?.name || "A new friend";

    const referrerWalletRef = doc(db, "wallets", referrerId);
    const refereeWalletRef = doc(db, "wallets", userId);

    // 3. Run Firestore ACID Transaction to safely update both wallets and create logs
    await runTransaction(db, async (transaction) => {
      // a. Get/initialize Referrer A's wallet
      const rWalletSnap = await transaction.get(referrerWalletRef);
      let rBalance = 0;
      let rLatestHash = "genesis";
      
      if (rWalletSnap.exists()) {
        const wData = rWalletSnap.data();
        rBalance = Number(wData.balance || 0);
        rLatestHash = wData.latestTransactionHash || "genesis";
      } else {
        // Initialize A's wallet if not exists
        transaction.set(referrerWalletRef, {
          userId: referrerId,
          balance: 0,
          currency: "INR",
          updatedAt: new Date().toISOString(),
          latestTransactionHash: "genesis"
        });
      }

      // b. Get/initialize Referee B's wallet
      const refereeWalletSnap = await transaction.get(refereeWalletRef);
      let bBalance = 0;
      let bLatestHash = "genesis";

      if (refereeWalletSnap.exists()) {
        const wData = refereeWalletSnap.data();
        bBalance = Number(wData.balance || 0);
        bLatestHash = wData.latestTransactionHash || "genesis";
      } else {
        // Initialize B's wallet if not exists
        transaction.set(refereeWalletRef, {
          userId: userId,
          balance: 0,
          currency: "INR",
          updatedAt: new Date().toISOString(),
          latestTransactionHash: "genesis"
        });
      }

      // c. Credit Referrer A (₹50)
      const rNewHash = calculateTransactionHash(referrerId, 50, "CREDIT", rLatestHash);
      const rTxnRef = doc(collection(db, "wallet_transactions"));
      transaction.set(rTxnRef, {
        walletId: referrerId,
        amount: 50,
        transactionType: "CREDIT",
        source: "SIGNUP_BONUS",
        referenceId: `referral_${userId.slice(-6)}`,
        description: `Referral Bonus for inviting ${refereeName}`,
        status: "Active",
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 365 days expiry
        createdAt: new Date().toISOString(),
        hash: rNewHash
      });

      transaction.update(referrerWalletRef, {
        balance: rBalance + 50,
        latestTransactionHash: rNewHash,
        updatedAt: new Date().toISOString()
      });

      // d. Credit Referee B (₹100)
      const bNewHash = calculateTransactionHash(userId, 100, "CREDIT", bLatestHash);
      const bTxnRef = doc(collection(db, "wallet_transactions"));
      transaction.set(bTxnRef, {
        walletId: userId,
        amount: 100,
        transactionType: "CREDIT",
        source: "SIGNUP_BONUS",
        referenceId: "referral_signup",
        description: "Referral signup bonus",
        status: "Active",
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        hash: bNewHash
      });

      transaction.update(refereeWalletRef, {
        balance: bBalance + 100,
        latestTransactionHash: bNewHash,
        updatedAt: new Date().toISOString()
      });

      // e. Update Referee B's user profile with referral logs
      transaction.update(refereeDocRef, {
        referredByCode: normalizedCode,
        referredByUserId: referrerId
      });
    });

    return NextResponse.json({
      success: true,
      message: `Successfully processed referral. ₹50 credited to both users.`
    });

  } catch (error: any) {
    console.error("Credit Referral Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process referral credit" }, { status: 500 });
  }
}
