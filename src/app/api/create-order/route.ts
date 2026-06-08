import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(req: Request) {
  try {
    const { amount } = await req.json();

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret || keyId.includes("YOUR_KEY") || keySecret.includes("YOUR_SECRET")) {
      return NextResponse.json({ 
        success: false, 
        message: "Razorpay credentials not fully configured. Please use local sandbox simulation." 
      });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const options = {
      amount: Math.round(amount * 100), // amount in smallest currency unit (paise)
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("Razorpay Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create order" }, { status: 500 });
  }
}
