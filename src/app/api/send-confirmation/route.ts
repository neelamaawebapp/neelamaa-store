import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { name, email, phone, orderId, amount } = await req.json();

    // 1. Send Email using Nodemailer (requires Gmail App Password in .env)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, // "App Password" from Google Account
      },
    });

    const mailOptions = {
      from: `"Neelamaa Store" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Order Confirmation - ${orderId}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #ec4899;">Thank you for your order, ${name}!</h2>
          <p>We have successfully received your order <strong>#${orderId}</strong>.</p>
          <p>Total Amount: ₹${amount}</p>
          <p>We will notify you once it ships. Thanks for shopping at Neelamaa!</p>
        </div>
      `,
    };

    // Attempt to send email, but don't crash if credentials aren't set yet
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await transporter.sendMail(mailOptions);
    } else {
      console.log("Email skipped: EMAIL_USER or EMAIL_PASS not configured.");
    }

    // 2. Send SMS using Fast2SMS API
    if (process.env.FAST2SMS_API_KEY && phone) {
      const message = `Hi ${name}, your order #${orderId} of ₹${amount} is confirmed at Neelamaa! We'll update you when it ships.`;
      
      await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          "authorization": process.env.FAST2SMS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          route: "q",
          message: message,
          language: "english",
          flash: 0,
          numbers: phone,
        })
      });
    } else {
      console.log("SMS skipped: FAST2SMS_API_KEY not configured.");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Confirmation error:", error);
    return NextResponse.json({ error: "Failed to send confirmation" }, { status: 500 });
  }
}
