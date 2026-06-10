import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json({ error: "Mobile number and OTP are required." }, { status: 400 });
    }

    const trimmedPhone = phone.trim();
    const trimmedOtp = otp.trim();

    // 1. Initialize Firebase references
    const { doc, getDoc, deleteDoc } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase");

    // 2. Fetch reset document
    const resetDocRef = doc(db, "phoneResets", trimmedPhone);
    const resetSnapshot = await getDoc(resetDocRef);

    if (!resetSnapshot.exists()) {
      return NextResponse.json({ error: "No active password reset request found for this mobile number." }, { status: 400 });
    }

    const resetData = resetSnapshot.data();

    // 3. Verify expiration
    if (Date.now() > resetData.expiresAt) {
      // Clean up expired record
      await deleteDoc(resetDocRef);
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    // 4. Verify OTP code
    if (resetData.otp !== trimmedOtp) {
      return NextResponse.json({ error: "Invalid OTP code. Please try again." }, { status: 400 });
    }

    // 5. Clean up successfully verified record
    await deleteDoc(resetDocRef);

    return NextResponse.json({
      success: true,
      oobCode: resetData.oobCode,
      email: resetData.email,
      message: "OTP verified successfully."
    });

  } catch (error: any) {
    console.error("Verify reset OTP error:", error);
    return NextResponse.json({ error: error.message || "Failed to process request." }, { status: 500 });
  }
}
