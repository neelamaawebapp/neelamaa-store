import { NextResponse } from "next/server";
import { calculateTransactionHash } from "@/lib/wallet-server";

export async function GET() {
  try {
    const { getFirestore, doc, collection, getDocs, runTransaction } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    // 1. Fetch registered users from "users" collection
    const usersSnapshot = await getDocs(collection(db, "users"));
    const usersMap = new Map<string, string>();
    
    usersSnapshot.forEach(d => {
      usersMap.set(d.id, d.data().name || "Customer");
    });

    // 2. Fetch unique user IDs from "orders" collection to catch synthesized users
    try {
      const ordersSnapshot = await getDocs(collection(db, "orders"));
      ordersSnapshot.forEach(d => {
        const data = d.data();
        if (data.userId && data.userId !== "guest" && data.userId !== "COD" && !data.userId.startsWith("mock_")) {
          if (!usersMap.has(data.userId)) {
            usersMap.set(data.userId, data.customerName || "Customer");
          }
        }
      });
    } catch (orderErr) {
      console.error("Migration orders fetch failed (skipping order-level check):", orderErr);
    }

    const usersList = Array.from(usersMap.entries()).map(([uid, name]) => ({
      uid,
      name
    }));

    let processedCount = 0;
    let skippedCount = 0;
    const details: string[] = [];

    // 2. Loop through users and safely run migration transactions
    for (const user of usersList) {
      const walletRef = doc(db, "wallets", user.uid);

      try {
        const result = await runTransaction(db, async (transaction) => {
          const walletSnap = await transaction.get(walletRef);

          if (walletSnap.exists()) {
            const wData = walletSnap.data();
            // Skip if already migrated
            if (wData.migratedSignupBonus === true) {
              return { status: "skipped" };
            }

            const currentBalance = Number(wData.balance || 0);
            const prevHash = wData.latestTransactionHash || "genesis";
            const newHash = calculateTransactionHash(user.uid, 100, "CREDIT", prevHash);

            const txnRef = doc(collection(db, "wallet_transactions"));
            transaction.set(txnRef, {
              walletId: user.uid,
              amount: 100,
              transactionType: "CREDIT",
              source: "SIGNUP_BONUS",
              referenceId: "migration_100",
              description: "Standard Signup Bonus Migration",
              status: "Active",
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date().toISOString(),
              hash: newHash
            });

            transaction.update(walletRef, {
              balance: currentBalance + 100,
              latestTransactionHash: newHash,
              migratedSignupBonus: true,
              updatedAt: new Date().toISOString()
            });

            return { status: "updated", previousBalance: currentBalance };
          } else {
            // If wallet doesn't exist, initialize it with ₹100
            const newHash = calculateTransactionHash(user.uid, 100, "CREDIT", "genesis");
            const txnRef = doc(collection(db, "wallet_transactions"));
            
            transaction.set(txnRef, {
              walletId: user.uid,
              amount: 100,
              transactionType: "CREDIT",
              source: "SIGNUP_BONUS",
              referenceId: "migration_100",
              description: "Standard Signup Bonus Migration",
              status: "Active",
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date().toISOString(),
              hash: newHash
            });

            transaction.set(walletRef, {
              userId: user.uid,
              balance: 100,
              currency: "INR",
              latestTransactionHash: newHash,
              migratedSignupBonus: true,
              updatedAt: new Date().toISOString()
            });

            return { status: "created" };
          }
        });

        if (result.status === "skipped") {
          skippedCount++;
        } else {
          processedCount++;
          details.push(`User ${user.uid} (${user.name}): Status = ${result.status}`);
        }

      } catch (err: any) {
        console.error(`Migration failed for user ${user.uid}:`, err);
        details.push(`User ${user.uid} (${user.name}): Error = ${err.message || err}`);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalUsers: usersList.length,
        migratedOrCreated: processedCount,
        alreadyMigrated: skippedCount
      },
      details
    });

  } catch (error: any) {
    console.error("Migration endpoint error:", error);
    return NextResponse.json({ error: error.message || "Migration failed" }, { status: 500 });
  }
}
