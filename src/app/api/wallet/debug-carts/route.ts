import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { getFirestore, doc, collection, getDocs } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    const usersSnapshot = await getDocs(collection(db, "users"));
    const users = [];

    for (const userDoc of usersSnapshot.docs) {
      const uData = userDoc.data();
      const cartSnap = await getDocs(collection(db, `users/${userDoc.id}/cartItems`));
      const cartItems = cartSnap.docs.map(d => d.data());

      users.push({
        id: userDoc.id,
        name: uData.name || "N/A",
        email: uData.email || "N/A",
        phone: uData.phone || "N/A",
        cartUpdatedAt: uData.cartUpdatedAt || null,
        abandonedCartStage: uData.abandonedCartStage !== undefined ? uData.abandonedCartStage : "undefined",
        cartItemsCount: cartItems.length,
        cartItems: cartItems
      });
    }

    return NextResponse.json({
      totalUsers: users.length,
      users
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
