import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { name, email, phone, orderId, amount } = await req.json();

    // 1. Send Email using Nodemailer (requires Gmail App Password in .env)
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, // "App Password" from Google Account
      },
      connectionTimeout: 10000, // 10 seconds timeout
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    const mailOptions = {
      from: `"Craft Style" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Order Confirmation - ${orderId}`,
      text: `Hello ${name},\n\nThank you for your order! We have successfully received order #${orderId}.\n\nTotal Amount: ₹${amount}\n\nWe will notify you once it ships. Thanks for shopping at Craft Style!`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #ec4899;">Thank you for your order, ${name}!</h2>
          <p>We have successfully received your order <strong>#${orderId}</strong>.</p>
          <p>Total Amount: ₹${amount}</p>
          <p>We will notify you once it ships. Thanks for shopping at Craft Style!</p>
        </div>
      `,
    };

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "craftstyle1@gmail.com";
    const adminMailOptions = {
      from: `"Craft Style" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `New Order Received - #${orderId}`,
      text: `New Order Placed!\n\nOrder #${orderId} has been successfully placed by a customer.\n\nCustomer Details:\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nTotal Amount: ₹${amount}\n\nPlease log in to the admin panel to view full details.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #ec4899; margin-top: 0;">New Order Placed!</h2>
          <p>Order <strong>#${orderId}</strong> has been successfully placed by a customer.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          <h3 style="color: #1e293b; margin-top: 0;">Order Details:</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 130px; color: #475569;">Customer Name:</td>
              <td style="padding: 6px 0; color: #0f172a;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #475569;">Customer Email:</td>
              <td style="padding: 6px 0; color: #0f172a;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #475569;">Customer Phone:</td>
              <td style="padding: 6px 0; color: #0f172a;">${phone || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #475569;">Order Total:</td>
              <td style="padding: 6px 0; color: #db2777; font-weight: bold; font-size: 16px;">₹${amount}</td>
            </tr>
          </table>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Log in to the Admin Dashboard to process this order and view the complete invoice details.</p>
        </div>
      `,
    };

    // Attempt to send email, but don't crash if credentials aren't set yet or fail to connect
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail(mailOptions);
      } catch (mailErr) {
        console.error("Customer order confirmation email failed to send:", mailErr);
      }
      try {
        await transporter.sendMail(adminMailOptions);
      } catch (adminMailErr) {
        console.error("Admin order notification email failed to send:", adminMailErr);
      }
    } else {
      console.log("Email skipped: EMAIL_USER or EMAIL_PASS not configured.");
    }

    // 2. Send SMS using Fast2SMS API
    if (process.env.FAST2SMS_API_KEY && phone) {
      const message = `Hi ${name}, your order #${orderId} of ₹${amount} is confirmed at Craft Style! We'll update you when it ships.`;
      
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
