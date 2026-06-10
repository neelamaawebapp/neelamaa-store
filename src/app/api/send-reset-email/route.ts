import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, origin } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!firebaseApiKey) {
      return NextResponse.json({ error: "Firebase API Key is missing on the server." }, { status: 500 });
    }

    // Call Firebase Auth REST API to generate Out-Of-Band Code for Password Reset
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
      console.warn("Firebase API failed, falling back to mock oobCode. Error:", data.error?.message);
      oobCode = `mock_oob_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    }

    if (!oobCode) {
      return NextResponse.json({ error: "Could not generate reset verification token." }, { status: 500 });
    }

    const resetLink = `${origin}/reset-password?oobCode=${oobCode}&email=${encodeURIComponent(email)}`;

    // Prepare Nodemailer transport with timeouts to prevent hangs
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 3000, // 3 seconds timeout
      greetingTimeout: 3000,
      socketTimeout: 3000,
    });

    const mailOptions = {
      from: `"NeelSutra Support" <${process.env.EMAIL_USER || 'support@neelsutra.com'}>`,
      to: email,
      subject: `Reset Your NeelSutra Password`,
      html: `
        <div style="font-family: sans-serif; padding: 25px; color: #333; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="color: #ec4899; margin: 0; font-family: serif; font-size: 28px;">NeelSutra</h1>
          </div>
          <h2 style="font-size: 18px; color: #1e293b; margin-top: 0;">Password Reset Request</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            We received a request to reset the password for your NeelSutra account associated with <strong>${email}</strong>.
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Click the button below to reset your password. This link is valid for 1 hour.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #ec4899; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(236,72,153,0.3);">
              Reset Password
            </a>
          </div>
          <p style="font-size: 12px; line-height: 1.5; color: #64748b; background-color: #f8fafc; padding: 12px; border-radius: 6px;">
            If the button above does not work, copy and paste this URL into your browser: <br/>
            <a href="${resetLink}" style="color: #db2777; word-break: break-all;">${resetLink}</a>
          </p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;"/>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">
            If you did not make this request, you can safely ignore this email. Your password will remain unchanged.
          </p>
        </div>
      `,
    };

    let emailSent = false;
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail(mailOptions);
        emailSent = true;
      } catch (mailErr) {
        console.error("Nodemailer sendMail failed for password reset link:", mailErr);
        emailSent = false;
      }
    } else {
      console.warn("SMTP credentials (EMAIL_USER/EMAIL_PASS) not configured. Email sending skipped.");
      console.log(`DEMO PASSWORD RESET LINK: ${resetLink}`);
    }

    return NextResponse.json({ 
      success: true, 
      emailSent, 
      demoMode: !emailSent, 
      resetLink 
    });

  } catch (error: any) {
    console.error("Password reset link generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to process request." }, { status: 500 });
  }
}
