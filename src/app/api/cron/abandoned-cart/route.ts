import { NextResponse } from "next/server";

// Placeholder database driver interface (e.g. Prisma client or node-postgres client)
const db = {
  query: async (text: string, params: any[]) => {
    console.log(`[SQL Database Query] Executing: ${text} with params:`, params);
    // Returns dummy rows matching the expected SQL structure
    return {
      rows: [
        {
          cart_id: "cart_abc123",
          user_id: "user_xyz789",
          fcm_token: "mock_fcm_token_device_unique_key_1",
          name: "Mukesh"
        },
        {
          cart_id: "cart_def456",
          user_id: "user_ijk012",
          fcm_token: "mock_fcm_token_device_unique_key_2",
          name: "Guest Shopper"
        }
      ]
    };
  },
  cart: {
    findMany: async (params: any) => {
      console.log(`[ORM prisma.cart.findMany] Querying active carts matching:`, JSON.stringify(params));
      return [
        {
          id: "cart_abc123",
          userId: "user_xyz789",
          status: "active",
          lastUpdated: new Date(Date.now() - 50 * 60 * 1000), // 50 mins ago
          user: {
            id: "user_xyz789",
            name: "Mukesh",
            fcmToken: "mock_fcm_token_device_unique_key_1"
          }
        }
      ];
    },
    update: async (params: { where: { id: string }; data: { status: string } }) => {
      console.log(`[ORM prisma.cart.update] Updating cart: ${params.where.id} to status: ${params.data.status}`);
      return { id: params.where.id, status: params.data.status };
    }
  }
};

export async function GET(req: Request) {
  try {
    // 1. Protection Header Verification (Bearer CRON_SECRET)
    const authHeader = req.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized access: Invalid or missing token." }, { status: 401 });
    }

    // 2. Query Postgres database for active carts abandoned between 45 and 60 minutes ago
    // Option A: Raw PostgreSQL template query
    const sqlQuery = `
      SELECT c.id as cart_id, c.user_id, u.fcm_token, u.name 
      FROM carts c
      JOIN users u ON c.user_id = u.id
      WHERE c.status = 'active'
        AND u.fcm_token IS NOT NULL
        AND c.last_updated >= NOW() - INTERVAL '60 minutes'
        AND c.last_updated <= NOW() - INTERVAL '45 minutes'
    `;
    const pgResult = await db.query(sqlQuery, []);
    const matchingCartsRaw = pgResult.rows;

    // Option B: Prisma ORM database lookup parameters mapping
    const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000);
    const sixtyMinsAgo = new Date(Date.now() - 60 * 60 * 1000);
    const matchingCartsORM = await db.cart.findMany({
      where: {
        status: "active",
        lastUpdated: {
          gte: sixtyMinsAgo,
          lte: fortyFiveMinsAgo
        },
        user: {
          fcmToken: { not: null }
        }
      },
      include: { user: true }
    });

    // 3. Initialize Firebase Admin Messaging instance dynamically
    const { messaging } = await import("@/lib/firebaseAdmin");

    const successes: string[] = [];
    const failures: Array<{ cartId: string; error: string }> = [];

    // 4. Iterate and dispatch notifications individually to handle single token failures gracefully
    // Note: We use the Prisma ORM object arrays mapping for FCM processing loop
    for (const cart of matchingCartsORM) {
      const fcmToken = cart.user.fcmToken;
      const userName = cart.user.name || "Customer";

      try {
        // Build FCM payload
        const fcmPayload = {
          token: fcmToken,
          notification: {
            title: "Your items are waiting! 🛍️",
            body: `Hi ${userName}, complete your checkout now before your reserved stock sells out!`
          },
          data: {
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
            urlPath: "/bag",
            cartId: cart.id
          }
        };

        // Dispatch FCM
        await messaging.send(fcmPayload);

        // Update database cart status immediately to prevent double-delivery loops
        // Option A: Raw SQL Update
        await db.query(
          "UPDATE carts SET status = 'notified', last_updated = NOW() WHERE id = $1",
          [cart.id]
        );

        // Option B: ORM Update
        await db.cart.update({
          where: { id: cart.id },
          data: { status: "notified" }
        });

        successes.push(cart.id);
      } catch (fcmError: any) {
        console.error(`FCM dispatch failed for cart ${cart.id}:`, fcmError);
        failures.push({
          cartId: cart.id,
          error: fcmError.message || "Unknown FCM transmission error"
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: {
        scanned: matchingCartsORM.length,
        sent: successes.length,
        failed: failures.length
      },
      sentCartIds: successes,
      fcmErrors: failures
    });

  } catch (error: any) {
    console.error("Cron Abandoned Cart FCM Engine Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Cron Server Error" },
      { status: 500 }
    );
  }
}
