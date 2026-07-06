import { NextResponse } from "next/server";
import { DEFAULT_WALLET_SETTINGS } from "@/lib/wallet";

export async function GET(req: Request) {
  try {
    const { getFirestore, doc, getDoc } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    const settingsRef = doc(db, "settings", "wallet");
    const settingsSnap = await getDoc(settingsRef);

    const rules = settingsSnap.exists()
      ? { ...DEFAULT_WALLET_SETTINGS, ...settingsSnap.data() }
      : DEFAULT_WALLET_SETTINGS;

    return NextResponse.json({ success: true, settings: rules });

  } catch (error: any) {
    console.error("GET Admin Settings Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load wallet settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { signupBonus, cashbackPercent, maxCashbackLimit, expiryDays } = body;

    const { getFirestore, doc, setDoc } = await import("firebase/firestore");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    const settingsRef = doc(db, "settings", "wallet");
    const updatedSettings = {
      signupBonus: Number(signupBonus !== undefined ? signupBonus : DEFAULT_WALLET_SETTINGS.signupBonus),
      cashbackPercent: Number(cashbackPercent !== undefined ? cashbackPercent : DEFAULT_WALLET_SETTINGS.cashbackPercent),
      maxCashbackLimit: Number(maxCashbackLimit !== undefined ? maxCashbackLimit : DEFAULT_WALLET_SETTINGS.maxCashbackLimit),
      expiryDays: Number(expiryDays !== undefined ? expiryDays : DEFAULT_WALLET_SETTINGS.expiryDays),
      updatedAt: new Date().toISOString()
    };

    await setDoc(settingsRef, updatedSettings, { merge: true });

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
      message: "Wallet campaign settings updated successfully."
    });

  } catch (error: any) {
    console.error("POST Admin Settings Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update wallet settings" }, { status: 500 });
  }
}
