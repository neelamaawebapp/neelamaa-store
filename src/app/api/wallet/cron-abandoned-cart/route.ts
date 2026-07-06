import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { calculateTransactionHash } from "@/lib/wallet-server";

export async function GET(req: Request) {
  try {
    const { getFirestore, doc, collection, getDocs, runTransaction, updateDoc } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

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

    const isEmailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

    // 2. Fetch all users who have had cart updates and haven't fully exhausted the recovery sequence (stage < 3)
    const usersSnapshot = await getDocs(collection(db, "users"));
    const activeCarts = usersSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(u => u.cartUpdatedAt && (u.abandonedCartStage === undefined || u.abandonedCartStage < 3));

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

      // Helper function to send email and simulate whatsapp/notification logs
      const fireNotifications = async (subject: string, text: string, html: string, pushTitle: string, pushBody: string) => {
        // a. Push/In-App Notification
        try {
          const notifRef = collection(db, "notifications");
          await import("firebase/firestore").then(async ({ addDoc }) => {
            await addDoc(notifRef, {
              userId: user.id,
              title: pushTitle,
              body: pushBody,
              type: "CART_ABANDONMENT",
              createdAt: new Date().toISOString(),
              isRead: false
            });
          });
        } catch (e) {
          console.error("Failed to write in-app push notification:", e);
        }

        // b. Email sending
        if (isEmailConfigured && user.email) {
          try {
            await transporter.sendMail({
              from: `"Craft Style" <${process.env.EMAIL_USER}>`,
              to: user.email,
              subject,
              text,
              html
            });
          } catch (mailErr) {
            console.error(`Email delivery failed for user ${user.id}:`, mailErr);
          }
        } else {
          console.log(`[MOCK EMAIL] Sent to ${user.email || 'N/A'}: Subject: ${subject}`);
        }

        // c. Mock WhatsApp SMS push logs
        console.log(`[MOCK WHATSAPP] Sent to ${user.phone || 'N/A'}: ${pushTitle} - ${pushBody}`);
      };

      // Stage 1 (1 hour later) - Friendly Reminder
      if (elapsed >= 1 && elapsed < 24 && currentStage === 0) {
        const subject = "We saved your cart for you!🛒";
        const emailText = `Hi ${user.name || "Customer"},\n\nWe noticed you left a few great items in your shopping cart. We get it—life gets busy!\n\nJust so you know, we’ve safely saved your cart so you don’t have to search for your items all over again.\n\nYour Cart Summary:\n${cartSummaryText}\n\nBest,\nThe Craft Style Team`;
        const emailHtml = `
          <div style="font-family: sans-serif; padding: 25px; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #db2777; margin-top: 0;">Did you forget something? 🤔</h2>
            <p>Hi ${user.name || "Customer"},</p>
            <p>We noticed you left a few great items in your shopping cart. We get it—life gets busy!</p>
            <p>Just so you know, we’ve safely saved your cart so you don’t have to search for it all over again.</p>
            <div style="margin: 20px 0;">
              <a href="https://myntra-clone-delta-blue.vercel.app/bag" style="background-color: #ec4899; color: white; padding: 12px 24px; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block;">👉 Secure Your Items Now</a>
            </div>
            <h3 style="color: #1e293b; margin-top: 25px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Your Cart Summary:</h3>
            ${cartSummaryHtml}
            <p style="font-size: 13px; color: #64748b; margin-top: 25px;">If you have any questions or need help with checkout, simply reply to this email!</p>
            <p style="font-size: 13px; font-weight: bold; color: #475569; margin-bottom: 0;">Best,<br>The Craft Style Team</p>
          </div>
        `;

        await fireNotifications(
          subject, 
          emailText, 
          emailHtml, 
          "Did you forget something? 🤔", 
          "Your items are waiting patiently in your cart. Tap here to finish your order before they disappear!"
        );

        await updateDoc(doc(db, "users", user.id), { abandonedCartStage: 1 });
        processedUsers.push(user.id);
        logs.push(`User ${user.id} transitioned to Stage 1 (Reminder)`);
      }

      // Stage 2 (24 hours later) - Stock Urgency (FOMO)
      else if (elapsed >= 24 && elapsed < 48 && currentStage === 1) {
        const subject = "High demand: Items in your cart might sell out soon";
        const emailText = `Hi ${user.name || "Customer"},\n\nWe wanted to give you a quick heads-up: the items currently sitting in your cart are highly popular, and our stock is running quite low.\n\nWe can't guarantee they'll still be available the next time you log in.\n\nBest,\nThe Craft Style Team`;
        const emailHtml = `
          <div style="font-family: sans-serif; padding: 25px; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #db2777; margin-top: 0;">Low stock alert! 🚨</h2>
            <p>Hi ${user.name || "Customer"},</p>
            <p>We wanted to give you a quick heads-up: the items currently sitting in your cart are highly popular, and our stock is running quite low.</p>
            <p>We can't guarantee they'll still be available the next time you log in. Tap below to complete your checkout securely in under 60 seconds.</p>
            <div style="margin: 20px 0;">
              <a href="https://myntra-clone-delta-blue.vercel.app/bag" style="background-color: #1e293b; color: white; padding: 12px 24px; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block;">🛍️ Complete My Purchase</a>
            </div>
            <h3 style="color: #1e293b; margin-top: 25px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Items Waiting in Your Cart:</h3>
            ${cartSummaryHtml}
            <p style="font-size: 13px; font-weight: bold; color: #475569; margin-top: 25px; margin-bottom: 0;">Best,<br>The Craft Style Team</p>
          </div>
        `;

        await fireNotifications(
          subject, 
          emailText, 
          emailHtml, 
          "Low stock alert! 🚨", 
          "Items in your cart are selling out fast. Complete your purchase now so you don't miss out!"
        );

        await updateDoc(doc(db, "users", user.id), { abandonedCartStage: 2 });
        processedUsers.push(user.id);
        logs.push(`User ${user.id} transitioned to Stage 2 (Urgency)`);
      }

      // Stage 3 (48 hours later) - Wallet Incentive Credit (₹50)
      else if (elapsed >= 48 && currentStage === 2) {
        const walletRef = doc(db, "wallets", user.id);

        // Run transaction: credit ₹50 wallet bonus, write log, set expires_at to 24h from now
        await runTransaction(db, async (transaction) => {
          const walletSnap = await transaction.get(walletRef);
          let currentBalance = 0;
          let prevHash = "genesis";

          if (walletSnap.exists()) {
            const wData = walletSnap.data();
            currentBalance = Number(wData.balance || 0);
            prevHash = wData.latestTransactionHash || "genesis";
          } else {
            transaction.set(walletRef, {
              userId: user.id,
              balance: 0,
              currency: "INR",
              updatedAt: new Date().toISOString(),
              latestTransactionHash: "genesis"
            });
          }

          const newHash = calculateTransactionHash(user.id, 50, "CREDIT", prevHash);
          const txnRef = doc(collection(db, "wallet_transactions"));
          
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours expiry

          // Log in wallet_transactions
          transaction.set(txnRef, {
            walletId: user.id,
            amount: 50,
            transactionType: "CREDIT",
            source: "ABANDONED_CART_BONUS",
            referenceId: `cart_incentive_${user.id.slice(-6)}`,
            description: "Abandoned Cart Reward Bonus",
            status: "Active",
            expiresAt: expiresAt,
            createdAt: new Date().toISOString(),
            hash: newHash
          });

          // Update wallets table
          transaction.update(walletRef, {
            balance: currentBalance + 50,
            latestTransactionHash: newHash,
            updatedAt: new Date().toISOString()
          });
        });

        // Fire notifications after the DB transaction successfully commits
        const subject = "Good news: We’ve credited your Craft Style Wallet! 🎉";
        const emailText = `Hi ${user.name || "Customer"},\n\nWe really want to see you enjoy your items, so we’ve gone ahead and credited ₹50 directly to your Craft Style Wallet!\n\nUse your bonus reward on the items in your cart. This reward bonus will expire in 24 hours.\n\nBest,\nThe Craft Style Team`;
        const emailHtml = `
          <div style="font-family: sans-serif; padding: 25px; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #ec4899; margin-top: 0;">We added ₹50 to your wallet! 🎁</h2>
            <p>Hi ${user.name || "Customer"},</p>
            <p>We really want to see you enjoy your items, so we’ve gone ahead and credited <strong>₹50</strong> directly to your Craft Style Wallet!</p>
            <p>You can apply this balance instantly at checkout to get an extra discount on the items left in your cart.</p>
            <p style="background-color: #fff1f2; border: 1px solid #ffe4e6; color: #be123c; padding: 12px; border-radius: 6px; font-size: 13px; font-weight: bold;">
              ⚠️ Note: This reward bonus is a limited-time campaign and will expire in 24 hours.
            </p>
            <div style="margin: 25px 0;">
              <a href="https://myntra-clone-delta-blue.vercel.app/bag" style="background-color: #ec4899; color: white; padding: 12px 24px; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(236, 72, 153, 0.3);">✨ Claim My Wallet Bonus & Checkout</a>
            </div>
            <h4 style="margin-top: 25px; margin-bottom: 5px; color: #1e293b;">How to use it:</h4>
            <p style="margin-top: 0; font-size: 13px; color: #475569;">At checkout, simply toggle the "Use Wallet Balance" option, and your discount will be applied automatically.</p>
            <h3 style="color: #1e293b; margin-top: 25px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Items Waiting in Your Cart:</h3>
            ${cartSummaryHtml}
            <p style="font-size: 13px; font-weight: bold; color: #475569; margin-top: 25px; margin-bottom: 0;">Happy shopping,<br>The Craft Style Team</p>
          </div>
        `;

        await fireNotifications(
          subject, 
          emailText, 
          emailHtml, 
          "We added ₹50 to your wallet! 🎁", 
          "Use your rewards bonus to checkout the items in your cart. Valid for the next 24 hours only!"
        );

        await updateDoc(doc(db, "users", user.id), { abandonedCartStage: 3 });
        processedUsers.push(user.id);
        logs.push(`User ${user.id} transitioned to Stage 3 (Wallet Incentive)`);
      }
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
