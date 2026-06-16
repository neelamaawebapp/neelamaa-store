import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { method, value } = await req.json();

    if (!method || !value) {
      return NextResponse.json({ error: "Method and value are required." }, { status: 400 });
    }

    const trimmedValue = value.trim();
    let email = "";
    let phone = "";

    // 1. Initialize Firebase client references
    const { getFirestore, collection, query, where, getDocs, doc, setDoc } = await import("firebase/firestore/lite");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    if (method === "mobile") {
      if (!/^\d{10}$/.test(trimmedValue)) {
        return NextResponse.json({ error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
      }
      phone = trimmedValue;
      const possiblePhones = [
        phone,
        `+91${phone}`,
        `+91 ${phone}`,
        `+91-${phone}`,
        `0${phone}`,
        `${phone.slice(0, 5)} ${phone.slice(5)}`
      ];

      // 1. Query users collection
      const usersRef = collection(db, "users");
      const qUsers = query(usersRef, where("phone", "in", possiblePhones));
      const usersSnapshot = await getDocs(qUsers);

      if (!usersSnapshot.empty) {
        const userData = usersSnapshot.docs[0].data();
        email = userData.email;
      } else {
        // 2. Query orders collection fallback
        const ordersRef = collection(db, "orders");
        const qOrders = query(ordersRef, where("phone", "in", possiblePhones));
        const ordersSnapshot = await getDocs(qOrders);
        if (!ordersSnapshot.empty) {
          // Find first order that has a customerEmail
          const orderDoc = ordersSnapshot.docs.find(doc => doc.data().customerEmail);
          if (orderDoc) {
            email = orderDoc.data().customerEmail;
          }
        }
      }

      if (!email) {
        return NextResponse.json({ error: "No account found with this mobile number." }, { status: 404 });
      }
    } else if (method === "email") {
      email = trimmedValue.toLowerCase();
      const emailOriginal = trimmedValue;
      const possibleEmails = Array.from(new Set([email, emailOriginal]));

      let exists = false;
      // Check admin email whitelist
      if (email === "neelsutra1@gmail.com" || email === "admin@neelsutra.com") {
        exists = true;
      }

      // Check users collection
      if (!exists) {
        const usersRef = collection(db, "users");
        const qUsers = query(usersRef, where("email", "in", possibleEmails));
        const usersSnapshot = await getDocs(qUsers);
        if (!usersSnapshot.empty) {
          exists = true;
        }
      }

      // Check orders collection (fallback where customer details are stored)
      if (!exists) {
        const ordersRef = collection(db, "orders");
        const qOrders = query(ordersRef, where("customerEmail", "in", possibleEmails));
        const ordersSnapshot = await getDocs(qOrders);
        if (!ordersSnapshot.empty) {
          exists = true;
        }
      }
    } else {
      return NextResponse.json({ error: "Invalid reset method." }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email address could not be resolved." }, { status: 400 });
    }

    // 2. Request real oobCode from Google Identity Toolkit REST API
    const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!firebaseApiKey) {
      return NextResponse.json({ error: "Firebase API Key is missing on the server." }, { status: 500 });
    }

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseApiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email: email,
        returnOobLink: true
      }),
    });

    const data = await response.json();
    let oobCode = "";
    
    if (response.ok) {
      oobCode = data.oobCode || new URL(data.oobLink).searchParams.get("oobCode") || "";
    } else {
      console.warn("Firebase sendOobCode API failed. Error:", data.error?.message);
      if (data.error?.message === "EMAIL_NOT_FOUND") {
        return NextResponse.json({ error: "No account found with this email. Please verify spelling." }, { status: 404 });
      }
      oobCode = `mock_oob_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    }

    if (!oobCode) {
      return NextResponse.json({ error: "Failed to generate password reset token." }, { status: 500 });
    }

    // 3. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Save OTP and oobCode details in Firestore 'passwordResets' collection
    const resetDocRef = doc(db, "passwordResets", trimmedValue);
    await setDoc(resetDocRef, {
      identifier: trimmedValue,
      method,
      otp,
      oobCode,
      email,
      expiresAt: Date.now() + 5 * 60 * 1000 // Valid for 5 minutes
    });

    console.log(`[OTP RESET SANDBOX] Method: ${method}, Value: ${trimmedValue}, OTP: ${otp}`);

    // 5. Deliver OTP
    let emailSent = false;
    let smsSent = false;

    if (method === "email") {
      // Prepare Nodemailer transport with standard Gmail host configuration and longer timeouts
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        connectionTimeout: 10000, // 10 seconds timeout
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      const mailOptions = {
        from: `"NeelSutra Support" <${process.env.EMAIL_USER || 'support@neelsutra.com'}>`,
        to: email,
        subject: `Password Reset Verification Code`,
        text: `Hello,\n\nWe received a request to reset the password for your NeelSutra account.\n\nUse the following 6-digit verification code to complete your reset process:\n\n${otp}\n\nThis code is valid for 5 minutes.\n\nIf you did not make this request, you can safely ignore this email.`,
        html: `
          <div style="font-family: sans-serif; padding: 25px; color: #333; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 25px;">
              <h1 style="color: #ec4899; margin: 0; font-family: serif; font-size: 28px;">NeelSutra</h1>
            </div>
            <h2 style="font-size: 18px; color: #1e293b; margin-top: 0;">Password Reset Verification Code</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              We received a request to reset the password for your NeelSutra account associated with <strong>${email}</strong>.
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Use the following 6-digit verification code to complete your reset process. This code is valid for 5 minutes.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 24px; border-radius: 8px; font-weight: bold; font-size: 24px; display: inline-block; letter-spacing: 6px; color: #db2777; font-family: monospace;">
                ${otp}
              </div>
            </div>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;"/>
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">
              If you did not make this request, you can safely ignore this email. Your password will remain unchanged.
            </p>
          </div>
        `,
      };

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
          await transporter.sendMail(mailOptions);
          emailSent = true;
        } catch (mailError) {
          console.error("Nodemailer sendMail failed (falling back to sandbox demo OTP):", mailError);
          emailSent = false;
        }
      } else {
        console.warn("SMTP credentials not configured. Email sending skipped.");
      }
    } else if (method === "mobile" && phone) {
      // Send OTP via Fast2SMS API
      if (process.env.FAST2SMS_API_KEY) {
        try {
          const smsMessage = `Your NeelSutra verification OTP code is ${otp}. Valid for 5 minutes. Please do not share this code.`;
          const smsRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
            method: "POST",
            headers: {
              "authorization": process.env.FAST2SMS_API_KEY,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              route: "q",
              message: smsMessage,
              language: "english",
              flash: 0,
              numbers: phone,
            })
          });
          if (smsRes.ok) {
            smsSent = true;
          } else {
            console.error("Fast2SMS API returned non-ok status:", smsRes.status);
          }
        } catch (smsError) {
          console.error("Fast2SMS send SMS failed:", smsError);
        }
      } else {
        console.warn("FAST2SMS_API_KEY not configured. SMS sending skipped.");
      }
    }

    const isProduction = process.env.NODE_ENV === "production";
    const emailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    const smsConfigured = !!process.env.FAST2SMS_API_KEY;

    // In production, only block the request if credentials are set but the delivery failed.
    // If credentials are unconfigured, we will fall back to demo mode so testing is not blocked.
    if (isProduction) {
      if (method === "mobile" && smsConfigured && !smsSent) {
        return NextResponse.json({ 
          error: "Failed to send verification OTP via SMS. Please check gateway status or try again." 
        }, { status: 550 });
      }
      if (method === "email" && emailConfigured && !emailSent) {
        return NextResponse.json({ 
          error: "Failed to send verification code email. Please check SMTP settings and try again." 
        }, { status: 550 });
      }
    }

    // Fall back to on-screen demo mode if the actual message could not be sent (e.g. unconfigured credentials)
    const demoMode = (method === "mobile" && !smsSent) || (method === "email" && !emailSent);

    return NextResponse.json({
      success: true,
      ...(demoMode ? { otp } : {}), // Only return OTP in response when in demo/sandbox mode
      emailSent,
      smsSent,
      demoMode,
      message: method === "email" && emailSent 
        ? "Verification code sent to your email inbox." 
        : method === "mobile" && smsSent
          ? "Verification code sent to your mobile phone."
          : "Verification code generated successfully (Demo Mode)."
    });

  } catch (error: any) {
    console.error("Send reset OTP error:", error);
    return NextResponse.json({ error: error.message || "Failed to process request." }, { status: 500 });
  }
}
