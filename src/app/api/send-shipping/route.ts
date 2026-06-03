import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { name, email, phone, orderId, shippingCompany, trackingNumber } = await req.json();

    // 1. Send Email using Nodemailer (requires Gmail App Password in .env)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, // "App Password" from Google Account
      },
    });

    // Determine direct tracking link based on courier company
    let trackingLink = `https://www.google.com/search?q=${encodeURIComponent(shippingCompany + " tracking " + trackingNumber)}`;
    
    switch (shippingCompany) {
      case "Delhivery":
        trackingLink = `https://www.delhivery.com/track/package/${trackingNumber}`;
        break;
      case "BlueDart":
        trackingLink = `https://www.bluedart.com/tracking`; // Direct query links are protected, redirect to tracking portal
        break;
      case "DTDC":
        trackingLink = `https://www.dtdc.in/tracking.asp`; 
        break;
      case "XpressBees":
        trackingLink = `https://www.xpressbees.com/track?awb=${trackingNumber}`;
        break;
      case "Ecom Express":
        trackingLink = `https://ecomexpress.in/tracking/?awb=${trackingNumber}`;
        break;
      case "India Post":
        trackingLink = `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
        break;
      case "Shadowfax":
        trackingLink = `https://track.shadowfax.in/track?order=${trackingNumber}`;
        break;
      // "Other" falls back to the Google search
    }

    const mailOptions = {
      from: `"NeelSutra" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Your Order #${orderId} has Shipped!`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-w: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #ec4899; text-align: center;">Great news, ${name}!</h2>
          <p style="text-align: center; font-size: 16px;">Your order <strong>#${orderId}</strong> is on its way.</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #555;">Shipping Details</h3>
            <p style="margin: 5px 0;"><strong>Carrier:</strong> ${shippingCompany}</p>
            <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${trackingLink}" style="background-color: #ec4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Track Your Package
            </a>
          </div>
          
          <p style="font-size: 14px; color: #777; text-align: center;">Thanks for shopping at NeelSutra!</p>
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
      const message = `Hi ${name}, your order #${orderId} has shipped via ${shippingCompany}. Tracking: ${trackingNumber}. Thanks!`;
      
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
    console.error("Shipping notification error:", error);
    return NextResponse.json({ error: "Failed to send shipping notification" }, { status: 500 });
  }
}
