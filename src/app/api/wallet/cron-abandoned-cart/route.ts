import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { calculateTransactionHash } from "@/lib/wallet-server";

export async function GET(req: Request) {
  try {
    const { getFirestore, doc, collection, getDocs, runTransaction, updateDoc, addDoc } = await import("firebase/firestore");
    const { app, auth } = await import("@/lib/firebase");
    const db = getFirestore(app);

    // Authenticate as Admin programmatically to bypass Firestore security rules on the server
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admincraftstyle@gmail.com";
    const adminPassword = process.env.SHIPROCKET_PASSWORD;

    if (adminEmail && adminPassword) {
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      } catch (authErr) {
        console.error("Cron failed to authenticate as Admin:", authErr);
      }
    }

    const url = new URL(req.url);
    const simulateMin = url.searchParams.get("simulateMin") === "true";
    const scale = simulateMin ? (1000 * 60) : (1000 * 60 * 60); // minutes vs hours

    // 1. Setup email transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    const isEmailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_PASS !== "YOUR_GMAIL_APP_PASSWORD");

    // 2. Fetch all users who have had cart updates and haven't completed the recovery sequence (stage < 1)
    const usersSnapshot = await getDocs(collection(db, "users"));
    const activeCarts = usersSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(u => u.cartUpdatedAt && (u.abandonedCartStage === undefined || u.abandonedCartStage < 1));

    const processedUsers: string[] = [];
    const logs: string[] = [];

    for (const user of activeCarts) {
      // Confirm the user actually has items in their cart subcollection
      const cartSnap = await getDocs(collection(db, `users/${user.id}/cartItems`));
      if (cartSnap.empty) {
        // Safe check: if cart is empty, clean up stale tracker
        await updateDoc(doc(db, "users", user.id), {
          cartUpdatedAt: null,
          abandonedCartStage: 0
        });
        continue;
      }

      const cartItems = cartSnap.docs.map(d => d.data());
      const elapsed = (Date.now() - new Date(user.cartUpdatedAt).getTime()) / scale;
      const currentStage = user.abandonedCartStage || 0;

      // Construct cart items list for emails
      const cartSummaryText = cartItems.map(item => `${item.brand} - ${item.title} (Size: ${item.size || 'N/A'}) - ₹${item.price} x ${item.quantity}`).join("\n");
      const cartSummaryHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 15px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #e2e8f0; text-align: left;">
              <th style="padding: 8px 0; color: #475569;">Item</th>
              <th style="padding: 8px 0; color: #475569; text-align: center;">Qty</th>
              <th style="padding: 8px 0; color: #475569; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${cartItems.map(item => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; font-weight: bold; color: #0f172a;">
                  ${item.brand} - ${item.title} <span style="font-size: 11px; font-weight: normal; color: #64748b;">(Size: ${item.size || 'N/A'})</span>
                </td>
                <td style="padding: 10px 0; text-align: center; color: #334155;">${item.quantity}</td>
                <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #0f172a;">₹${item.price}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;

      // Single Stage Recovery: Send Email after 1 hour of cart updates
      if (elapsed >= 1 && currentStage === 0) {
        const subject = "Your Craft Style shopping cart is waiting for you! 🛒";
        const emailText = `Hi ${user.name || "Customer"},\n\nWe noticed you left some great items in your shopping cart. They are still reserved and waiting for you to complete your checkout!\n\nYour Cart Summary:\n${cartSummaryText}\n\nCheckout now: https://myntra-clone-delta-blue.vercel.app/bag\n\nBest,\nThe Craft Style Team`;
        const emailHtml = `
          <div style="font-family: sans-serif; padding: 25px; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="https://myntra-clone-delta-blue.vercel.app/icon.png" alt="Craft Style Logo" style="width: 64px; height: 64px; border-radius: 12px;" />
            </div>
            <h2 style="color: #db2777; margin-top: 0; text-align: center;">Did you forget something? 🤔</h2>
            <p>Hi ${user.name || "Customer"},</p>
            <p>We noticed you left some great items in your shopping cart. We’ve safely saved them so you can complete your purchase easily!</p>
            <div style="margin: 25px 0; text-align: center;">
              <a href="https://myntra-clone-delta-blue.vercel.app/bag" style="background-color: #ec4899; color: white; padding: 12px 24px; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(236, 72, 153, 0.3);">🛍️ Complete Your Checkout</a>
            </div>
            <h3 style="color: #1e293b; margin-top: 25px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Items Waiting in Your Cart:</h3>
            ${cartSummaryHtml}
            <p style="font-size: 13px; color: #64748b; margin-top: 25px;">If you have any questions or need help with checkout, simply reply to this email!</p>
            <p style="font-size: 13px; font-weight: bold; color: #475569; margin-bottom: 0;">Best,<br>The Craft Style Team</p>
          </div>
        `;

        if (isEmailConfigured && user.email) {
          try {
            await transporter.sendMail({
              from: `"Craft Style" <${process.env.EMAIL_USER}>`,
              to: user.email,
              subject,
              text: emailText,
              html: emailHtml
            });
          } catch (mailErr) {
            console.error(`Email delivery failed for user ${user.id}:`, mailErr);
          }
        } else {
          console.log(`[MOCK EMAIL] Sent to ${user.email || 'N/A'}: Subject: ${subject}`);
        }

        try {
          const notifRef = collection(db, "notifications");
          await addDoc(notifRef, {
            userId: user.id,
            title: "Cart Recovery Email Sent ✉️",
            message: "We've sent an email to remind you of the items waiting in your cart.",
            type: "CART_ABANDONMENT",
            createdAt: new Date().toISOString(),
            read: false
          });
        } catch (e) {
          console.error("Failed to write in-app push notification:", e);
        }

        await updateDoc(doc(db, "users", user.id), { abandonedCartStage: 1 });
        processedUsers.push(user.id);
        logs.push(`User ${user.id} recovery email sent. stage completed.`);
      }
    }

    try {
      const { signOut } = await import("firebase/auth");
      await signOut(auth);
    } catch (signOutErr) {
      console.error("Cron failed to sign out Admin:", signOutErr);
    }

    return NextResponse.json({
      success: true,
      summary: {
        scannedCarts: activeCarts.length,
        processedUsers: processedUsers.length
      },
      logs
    });

  } catch (error: any) {
    console.error("Cron Abandoned Cart Error:", error);
    return NextResponse.json({ error: error.message || "Failed to run cart recovery" }, { status: 500 });
  }
}
