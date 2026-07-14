import { NextResponse } from "next/server";

// Placeholder database driver mapping to PostgreSQL / Prisma clients
const db = {
  query: async (text: string, params: any[]) => {
    // Placeholder database query adapter (e.g. pg pool client / postgres-js)
    console.log(`[SQL Database Query] Executing: ${text} with params:`, params);
    return { rows: [{ id: params[1], fcm_token: params[0] }] };
  },
  user: {
    update: async (params: { where: { id: string }; data: { fcmToken: string } }) => {
      // Placeholder ORM adapter (Prisma client)
      console.log(`[ORM Update User] Updating user: ${params.where.id} with token: ${params.data.fcmToken}`);
      return { id: params.where.id, fcmToken: params.data.fcmToken };
    }
  }
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, fcmToken } = body;

    // Validate incoming payload strings
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      return NextResponse.json({ error: "Invalid or missing userId parameter." }, { status: 400 });
    }

    if (!fcmToken || typeof fcmToken !== "string" || fcmToken.trim() === "") {
      return NextResponse.json({ error: "Invalid or missing fcmToken parameter." }, { status: 400 });
    }

    const trimmedUserId = userId.trim();
    const trimmedToken = fcmToken.trim();

    // PostgreSQL database query placeholder: Update mapped token
    await db.query(
      "UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2",
      [trimmedToken, trimmedUserId]
    );

    // Prisma ORM database update placeholder
    await db.user.update({
      where: { id: trimmedUserId },
      data: { fcmToken: trimmedToken }
    });

    return NextResponse.json({
      success: true,
      message: "FCM push token registered and updated successfully in user record."
    });

  } catch (error: any) {
    console.error("FCM Token Registration API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process token registration request." },
      { status: 500 }
    );
  }
}
