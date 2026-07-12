import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json({ error: "Identifier and OTP are required." }, { status: 400 });
    }

    const trimmedIdentifier = phone.trim(); // The parameter was named 'phone' in the previous API, we'll keep the key name for client compatibility or accept it as 'phone'
    const trimmedOtp = otp.trim();

    // 1. Initialize Firebase references
    const { getFirestore, doc, getDoc, deleteDoc } = await import("firebase/firestore/lite");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    // 2. Fetch reset document from generalized 'passwordResets' collection
    const resetDocRef = doc(db, "passwordResets", trimmedIdentifier);
    const resetSnapshot = await getDoc(resetDocRef);

    if (!resetSnapshot.exists()) {
      return NextResponse.json({ error: "No active password reset request found." }, { status: 400 });
    }

    const resetData = resetSnapshot.data();

    // 3. Verify expiration
    if (Date.now() > resetData.expiresAt) {
      // Clean up expired record
      await deleteDoc(resetDocRef);
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    // 4. Verify OTP code
    const attempts = Number(resetData.attempts || 0) + 1;
    if (attempts >= 5) {
      await deleteDoc(resetDocRef);
      return NextResponse.json({ error: "Too many failed attempts. This OTP has been invalidated. Please request a new one." }, { status: 400 });
    }

    if (resetData.otp !== trimmedOtp) {
      const { updateDoc } = await import("firebase/firestore/lite");
      await updateDoc(resetDocRef, { attempts });
      return NextResponse.json({ error: `Invalid OTP code. You have ${5 - attempts} attempts remaining.` }, { status: 400 });
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
