import { NextResponse } from "next/server";
import { calculateTransactionHash } from "@/lib/wallet-server";

export async function POST(req: Request) {
  try {
    const { authenticateRequest } = await import("@/lib/auth-server");
    const user = await authenticateRequest(req);

    const { userId, birthday } = await req.json();

    if (!userId || !birthday) {
      return NextResponse.json({ error: "Missing required parameters: userId and birthday" }, { status: 400 });
    }

    if (user.uid !== userId) {
      return NextResponse.json({ error: "Forbidden: You can only claim rewards for your own account." }, { status: 403 });
    }

    const trimmedBirthday = String(birthday).trim();
    if (!trimmedBirthday) {
      return NextResponse.json({ error: "Invalid date of birth provided." }, { status: 400 });
    }

    const { getFirestore, doc, collection, runTransaction } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    const userRef = doc(db, "users", userId);
    const walletRef = doc(db, "wallets", userId);
    const txnRef = doc(db, "wallet_transactions", `birthday_${userId}`);

    await runTransaction(db, async (transaction) => {
      // 1. Read User Profile
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.birthdayGiftClaimed === true || (userData.birthday && userData.birthdayLocked === true)) {
          throw new Error("Birthday gift reward has already been claimed for this account.");
        }
      }

      // 2. Read Wallet
      const walletSnap = await transaction.get(walletRef);
      let currentBalance = 0;
      let latestHash = "genesis";

      if (walletSnap.exists()) {
        const wData = walletSnap.data();
        currentBalance = Number(wData.balance || 0);
        latestHash = wData.latestTransactionHash || "genesis";
      } else {
        // Create wallet if not yet created
        transaction.set(walletRef, {
          userId,
          balance: 0,
          currency: "INR",
          updatedAt: new Date().toISOString(),
          latestTransactionHash: "genesis"
        });
      }

      const rewardAmount = 200;
      const newHash = calculateTransactionHash(userId, rewardAmount, "CREDIT", latestHash);

      // 3. Update User Document - Permanently mark claimed & locked
      if (userSnap.exists()) {
        transaction.update(userRef, {
          birthday: trimmedBirthday,
          birthdayGiftClaimed: true,
          birthdayLocked: true,
          updatedAt: new Date().toISOString()
        });
      } else {
        transaction.set(userRef, {
          birthday: trimmedBirthday,
          birthdayGiftClaimed: true,
          birthdayLocked: true,
          createdAt: new Date().toISOString()
        });
      }

      // 4. Update Wallet Document
      transaction.update(walletRef, {
        balance: currentBalance + rewardAmount,
        latestTransactionHash: newHash,
        updatedAt: new Date().toISOString()
      });

      // 5. Write Wallet Transaction Ledger
      transaction.set(txnRef, {
        walletId: userId,
        amount: rewardAmount,
        transactionType: "CREDIT",
        source: "BIRTHDAY_GIFT",
        referenceId: "birthday",
        description: `Birthday Gift Reward (DOB: ${trimmedBirthday})`,
        status: "Active",
        createdAt: new Date().toISOString(),
        hash: newHash
      });
    });

    return NextResponse.json({
      success: true,
      message: "Successfully claimed ₹200 Birthday Gift reward!"
    });

  } catch (error: any) {
    console.error("Claim Birthday Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to claim birthday gift." },
      { status: 500 }
    );
  }
}
