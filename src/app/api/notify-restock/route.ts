import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { productId, brand, title, quantity } = await req.json();

    if (!productId || !brand || !title || quantity === undefined) {
      return NextResponse.json({ error: "Missing required product details for notification." }, { status: 400 });
    }

    // If quantity is not > 0, we shouldn't notify (could be a bulk edit setting stock to 0)
    if (Number(quantity) <= 0) {
      return NextResponse.json({ success: true, count: 0, message: "Product is still out of stock." });
    }

    // 1. Initialize Firestore Lite
    const { getFirestore, collection, query, where, getDocs, doc, updateDoc, addDoc } = await import("firebase/firestore/lite");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    // 2. Fetch pending subscriptions for this product
    const subsRef = collection(db, "back_in_stock_subscriptions");
    const q = query(subsRef, where("productId", "==", productId), where("status", "==", "Pending"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ success: true, count: 0, message: "No pending subscriptions for this product." });
    }

    const subscriptions = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    // 3. Setup Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 3000,
    });

    const isEmailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    let emailSuccessCount = 0;
    let notificationSuccessCount = 0;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // 4. Send notifications and update subscriptions
    for (const sub of subscriptions) {
      // Send Email if configured
      if (isEmailConfigured && sub.email) {
        try {
          const mailOptions = {
            from: `"NeelSutra Notifications" <${process.env.EMAIL_USER}>`,
            to: sub.email,
            subject: `Back in stock: ${brand} - ${title} is available now! 🌟`,
            html: `
              <div style="font-family: sans-serif; padding: 25px; color: #333; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 25px;">
                  <h1 style="color: #ec4899; margin: 0; font-family: serif; font-size: 28px;">NeelSutra</h1>
                </div>
                
                <h2 style="font-size: 18px; color: #1e293b; margin-top: 0; text-align: center;">
                  Item is Back in Stock! 🎉
                </h2>
                
                <p style="font-size: 14px; line-height: 1.6; color: #475569; text-align: center;">
                  Great news! The item you requested stock alerts for, <strong>${brand} - ${title}</strong>, is available again.
                </p>
                
                <div style="text-align: center; margin: 25px 0;">
                  <a href="${appUrl}/product/${productId}" style="background-color: #ec4899; color: white; padding: 12px 24px; font-weight: bold; border-radius: 8px; text-decoration: none; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(236,72,153,0.2);">
                    SHOP NOW
                  </a>
                </div>
                
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;"/>
                <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">
                  You received this email because you subscribed to be notified when this item becomes available.
                </p>
              </div>
            `,
          };
          await transporter.sendMail(mailOptions);
          emailSuccessCount++;
        } catch (mailErr) {
          console.error(`Failed to send restock email to ${sub.email}:`, mailErr);
        }
      } else {
        console.log(`[RESTOCK] Email skipped for ${sub.email} (credentials not configured)`);
      }

      // Add in-app notification if user is logged in
      if (sub.userId) {
        try {
          const notificationsRef = collection(db, "notifications");
          await addDoc(notificationsRef, {
            userId: sub.userId,
            title: "Back in Stock! 🌟",
            message: `The "${brand} - ${title}" you were looking for is available now!`,
            productId: productId,
            createdAt: new Date().toISOString(),
            read: false
          });
          notificationSuccessCount++;
        } catch (dbErr) {
          console.error(`Failed to write Firestore notification for user ${sub.userId}:`, dbErr);
        }
      }

      // Update subscription status in Firestore
      try {
        const subDocRef = doc(db, "back_in_stock_subscriptions", sub.id);
        await updateDoc(subDocRef, {
          status: "Notified",
          notifiedAt: new Date().toISOString()
        });
      } catch (dbErr) {
        console.error(`Failed to update subscription status in Firestore for ${sub.id}:`, dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      count: subscriptions.length,
      emailsSent: emailSuccessCount,
      inAppNotificationsCreated: notificationSuccessCount,
      message: `Notified ${subscriptions.length} customer(s).`
    });

  } catch (error: any) {
    console.error("Notify restock API error:", error);
    return NextResponse.json({ error: error.message || "Failed to notify restock." }, { status: 500 });
  }
}
