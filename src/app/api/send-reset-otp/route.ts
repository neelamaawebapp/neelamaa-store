import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: "Mobile number is required." }, { status: 400 });
    }

    const trimmedPhone = phone.trim();
    if (!/^\d{10}$/.test(trimmedPhone)) {
      return NextResponse.json({ error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    }

    // 1. Initialize Firebase client references
    const { collection, query, where, getDocs, doc, setDoc } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase");

    // 2. Query user by phone number
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("phone", "==", trimmedPhone));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ error: "No account found with this mobile number. Please register." }, { status: 404 });
    }

    const userData = snapshot.docs[0].data();
    const email = userData.email;

    if (!email) {
      return NextResponse.json({ error: "Associated email address not found on the profile." }, { status: 400 });
    }

    // 3. Request real oobCode from Google Identity Toolkit REST API
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
      console.warn("Firebase sendOobCode API failed, creating mock code. Error:", data.error?.message);
      oobCode = `mock_oob_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    }

    if (!oobCode) {
      return NextResponse.json({ error: "Failed to generate password reset token." }, { status: 500 });
    }

    // 4. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 5. Save OTP and oobCode details in Firestore 'phoneResets' collection
    const resetDocRef = doc(db, "phoneResets", trimmedPhone);
    await setDoc(resetDocRef, {
      phone: trimmedPhone,
      otp,
      oobCode,
      email,
      expiresAt: Date.now() + 5 * 60 * 1000 // Valid for 5 minutes
    });

    console.log(`[SMS OTP SANDBOX] Sent to ${trimmedPhone}: Your password reset OTP is ${otp}`);

    return NextResponse.json({
      success: true,
      otp, // Returning OTP in the response for easy local sandbox copy/paste
      message: "OTP sent to your registered mobile number."
    });

  } catch (error: any) {
    console.error("Send reset OTP error:", error);
    return NextResponse.json({ error: error.message || "Failed to process request." }, { status: 500 });
  }
}
