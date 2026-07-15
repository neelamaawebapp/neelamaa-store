import { NextResponse } from "next/server";
import webpush from "web-push";
import { firestore } from "@/lib/firebaseAdmin";
import { isAbandonedCartDue } from "@/lib/abandoned-cart";

export const runtime = "nodejs";

type PushSubscriptionRecord = {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
};

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@craftstyle.com";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not configured");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    configureWebPush();

    const usersSnapshot = await firestore.collection("users").get();
    const notifiedUsers: string[] = [];
    const failedUsers: string[] = [];

    for (const userDocument of usersSnapshot.docs) {
      const user = userDocument.data();
      if (!isAbandonedCartDue(user.cartUpdatedAt, user.abandonedCartStage)) {
        continue;
      }

      const cartSnapshot = await userDocument.ref.collection("cartItems").get();
      if (cartSnapshot.empty) {
        await userDocument.ref.update({ cartUpdatedAt: null, abandonedCartStage: 0 });
        continue;
      }

      const subscriptionsSnapshot = await firestore
        .collection("push_subscriptions")
        .where("userId", "==", userDocument.id)
        .get();

      if (subscriptionsSnapshot.empty) {
        continue;
      }

      const cartItems = cartSnapshot.docs.map((item) => item.data());
      const firstItem = cartItems[0];
      const payload = JSON.stringify({
        title: "Your items are waiting! 🛍️",
        message: `Hi ${user.name || "Customer"}, you left ${cartItems.length} item(s) in your cart. Complete checkout before they sell out!`,
        image: firstItem?.image || "",
        url: "/bag",
      });

      const deliveries = await Promise.allSettled(
        subscriptionsSnapshot.docs.map(async (subscriptionDocument) => {
          const subscription = subscriptionDocument.data() as PushSubscriptionRecord;
          try {
            await webpush.sendNotification(subscription, payload);
            return true;
          } catch (error: unknown) {
            const statusCode = (error as { statusCode?: number }).statusCode;
            if (statusCode === 404 || statusCode === 410) {
              await subscriptionDocument.ref.delete();
            }
            throw error;
          }
        })
      );

      const delivered = deliveries.some((result) => result.status === "fulfilled");
      if (delivered) {
        await userDocument.ref.update({ abandonedCartStage: 1 });
        notifiedUsers.push(userDocument.id);
      } else {
        failedUsers.push(userDocument.id);
      }
    }

    return NextResponse.json({
      success: true,
      notifiedUsers,
      failedUsers,
    });
  } catch (error: unknown) {
    console.error("Abandoned cart push notification failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send abandoned cart notifications" },
      { status: 500 }
    );
  }
}
