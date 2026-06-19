import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { name, email, phone, orderId, status } = await req.json();

    if (!email || !email.includes("@") || !status || !orderId) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    const isConfigured = (val?: string) => !!val && val.trim() !== "" && !val.includes("YOUR_");
    const emailSent = isConfigured(process.env.EMAIL_USER) && isConfigured(process.env.EMAIL_PASS);

    if (!emailSent) {
      console.log("Email skipped: EMAIL_USER or EMAIL_PASS not configured.");
      return NextResponse.json({ success: true, emailSent: false, smsSent: false, warning: "SMTP credentials not configured." });
    }

    // 1. Send Email using Nodemailer
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER || 'admincraftstyle@gmail.com', 
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    let subject = "";
    let htmlContent = "";
    const displayOrderId = orderId.slice(-8).toUpperCase();

    if (status === "Delivered") {
      subject = `Your Order #${displayOrderId} has been Delivered!`;
      htmlContent = `
        <div style="font-family: sans-serif; padding: 25px; color: #333; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #ec4899; margin: 0; font-family: serif; font-size: 28px;">Craft Style</h1>
          </div>
          <h2 style="color: #10b981; text-align: center; margin-top: 0;">Order Delivered Successfully!</h2>
          <p>Hello ${name},</p>
          <p>We are pleased to inform you that your order <strong>#${displayOrderId}</strong> has been successfully delivered to your shipping address.</p>
          <p>We hope you love your new purchase! If you have any feedback or need help with a return or refund, please visit your account dashboard.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 0;">Thank you for shopping at Craft Style!</p>
        </div>
      `;
    } else if (status === "Cancelled") {
      subject = `Order Cancellation Confirmation - #${displayOrderId}`;
      htmlContent = `
        <div style="font-family: sans-serif; padding: 25px; color: #333; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #ec4899; margin: 0; font-family: serif; font-size: 28px;">Craft Style</h1>
          </div>
          <h2 style="color: #ef4444; text-align: center; margin-top: 0;">Order Cancelled</h2>
          <p>Hello ${name},</p>
          <p>This email confirms that your order <strong>#${displayOrderId}</strong> has been cancelled.</p>
          <p>If you did not request this cancellation or have any questions regarding a payment refund, please reach out to our customer support team immediately.</p>
          <p style="font-size: 14px; color: #475569;">If any payment was already processed, it will be refunded back to your original payment method in 5-7 business days.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 0;">Need help? Contact support at admincraftstyle@gmail.com</p>
        </div>
      `;
    } else {
      // Fallback status email
      subject = `Update on your Order #${displayOrderId}`;
      htmlContent = `
        <div style="font-family: sans-serif; padding: 25px; color: #333; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #ec4899; margin: 0; font-family: serif; font-size: 28px;">Craft Style</h1>
          </div>
          <h2 style="color: #ec4899; text-align: center; margin-top: 0;">Order Status Update</h2>
          <p>Hello ${name},</p>
          <p>Your order <strong>#${displayOrderId}</strong> has been updated to: <strong>${status}</strong>.</p>
          <p>Please log in to your profile to track your package or view details.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 0;">Thanks for shopping with us!</p>
        </div>
      `;
    }

    const mailOptions = {
      from: `"Craft Style" <${process.env.EMAIL_USER || 'admincraftstyle@gmail.com'}>`,
      to: email,
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    // 2. Send SMS using Fast2SMS if configured and phone is provided
    let smsSent = false;
    if (process.env.FAST2SMS_API_KEY && phone) {
      try {
        let message = "";
        if (status === "Delivered") {
          message = `Hi ${name}, your order #${displayOrderId} has been delivered successfully. We hope you love it! Thanks for shopping at Craft Style.`;
        } else if (status === "Cancelled") {
          message = `Hi ${name}, your order #${displayOrderId} has been cancelled. Refunds (if applicable) take 5-7 business days. Contact support for help.`;
        } else {
          message = `Hi ${name}, your order #${displayOrderId} status has been updated to: ${status}. Track it on the Craft Style portal.`;
        }

        await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            "authorization": process.env.FAST2SMS_API_KEY || "",
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
        smsSent = true;
      } catch (smsErr) {
        console.error("Failed to send status update SMS", smsErr);
      }
    }

    return NextResponse.json({ success: true, emailSent: true, smsSent });

  } catch (error) {
    console.error('Status Update API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
