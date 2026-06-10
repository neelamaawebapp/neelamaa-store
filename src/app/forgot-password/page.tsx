"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function ForgotPassword() {
  const [resetMethod, setResetMethod] = useState<"email" | "mobile">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [sandboxOtp, setSandboxOtp] = useState("");
  
  const [message, setMessage] = useState("");
  const [demoResetLink, setDemoResetLink] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setDemoResetLink("");

    const normalizedEmail = email.toLowerCase().trim();
    const isMockEmail = normalizedEmail.endsWith("@example.com");

    if (isMockEmail) {
      // Demo/Guest Mock User Sandbox Flow
      const mockCode = `mock_oob_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
      const mockLink = `${window.location.origin}/reset-password?oobCode=${mockCode}&email=${encodeURIComponent(normalizedEmail)}`;
      setDemoResetLink(mockLink);
      setMessage("Demo Mode: Reset link generated successfully. Please click the button below.");
      setLoading(false);
      return;
    }

    // Real Firebase User Reset Flow
    try {
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      
      let exists = false;

      // 1. Check admin email whitelist
      if (normalizedEmail === "neelsutra1@gmail.com" || normalizedEmail === "admin@neelsutra.com") {
        exists = true;
      }

      // 2. Check users collection
      if (!exists) {
        const usersRef = collection(db, "users");
        const qUsers = query(usersRef, where("email", "==", normalizedEmail));
        const usersSnapshot = await getDocs(qUsers);
        if (!usersSnapshot.empty) {
          exists = true;
        }
      }

      // 3. Check orders collection (fallback where customer details are stored)
      if (!exists) {
        const ordersRef = collection(db, "orders");
        const qOrders = query(ordersRef, where("customerEmail", "==", normalizedEmail));
        const ordersSnapshot = await getDocs(qOrders);
        if (!ordersSnapshot.empty) {
          exists = true;
        }
      }

      if (!exists) {
        setError("No account found with this email. Please verify the spelling or sign up.");
        setLoading(false);
        return;
      }

      const { sendPasswordResetEmail } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      await sendPasswordResetEmail(auth, normalizedEmail);
      setMessage("A password reset link has been successfully sent to your email inbox.");
      setEmail("");
    } catch (err: any) {
      console.error(err);
      let errMsg = "Failed to send reset email.";
      if (err.code === "auth/user-not-found" || (err.message && err.message.includes("EMAIL_NOT_FOUND"))) {
        errMsg = "No account found with this email.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Invalid email format.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setSandboxOtp("");

    try {
      const res = await fetch("/api/send-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP.");
      }

      setSandboxOtp(data.otp);
      setMessage("A 6-digit OTP has been sent to your registered mobile number (Demo Mode: See sandbox below).");
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "Failed to request reset OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify OTP.");
      }

      router.push(`/reset-password?oobCode=${data.oobCode}&email=${encodeURIComponent(data.email)}`);
    } catch (err: any) {
      setError(err.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (resetMethod === "email") {
      handleReset(e);
    } else if (step === "request") {
      handleSendOtp(e);
    } else {
      handleVerifyOtp(e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center w-full">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative shadow-md border-x border-gray-200">
        <div className="p-4 flex items-center border-b border-gray-100 sticky top-0 bg-white z-10">
          <button onClick={() => router.back()} className="mr-4">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-lg text-gray-900">Forgot Password</h1>
        </div>

        <div className="p-6 flex-1 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h2>
            <p className="text-gray-500 text-sm">
              {resetMethod === "email" 
                ? "Enter the email associated with your account and we'll send you a link to reset your password."
                : step === "request"
                  ? "Enter the mobile number associated with your account and we'll send a 6-digit OTP to reset your password."
                  : "Enter the 6-digit verification code sent to your registered mobile number."
              }
            </p>
          </div>

          {/* Reset Method Toggle */}
          {step === "request" && !demoResetLink && (
            <div className="flex bg-gray-100 p-1.5 rounded-lg mb-8">
              <button
                type="button"
                onClick={() => { setResetMethod("email"); setError(""); setMessage(""); }}
                className={`flex-1 text-center py-2.5 text-xs font-bold rounded-md transition-all uppercase tracking-wide cursor-pointer
                  ${resetMethod === "email" ? "bg-white text-pink-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
              >
                Reset via Email
              </button>
              <button
                type="button"
                onClick={() => { setResetMethod("mobile"); setError(""); setMessage(""); }}
                className={`flex-1 text-center py-2.5 text-xs font-bold rounded-md transition-all uppercase tracking-wide cursor-pointer
                  ${resetMethod === "mobile" ? "bg-white text-pink-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
              >
                Reset via Mobile
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium animate-fade-in">
                {error}
              </div>
            )}
            
            {message && (
              <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm font-medium animate-fade-in">
                {message}
              </div>
            )}

            {demoResetLink && (
              <div className="bg-pink-50 border border-pink-100 p-4 rounded-xl text-center shadow-sm">
                <p className="text-[10px] text-pink-700 font-bold mb-2 uppercase tracking-wide">Developer Sandbox Reset Action</p>
                <a 
                  href={demoResetLink}
                  className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-2.5 px-6 rounded-md text-xs inline-block shadow transition-all cursor-pointer"
                >
                  RESET PASSWORD DIRECTLY
                </a>
              </div>
            )}
            
            {!demoResetLink && (
              resetMethod === "email" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-gray-300 px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors text-gray-900"
                      placeholder="you@example.com"
                      required
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors disabled:opacity-70 flex justify-center items-center text-sm cursor-pointer shadow-md"
                    >
                      {loading ? "SENDING..." : "SEND RESET LINK"}
                    </button>
                  </div>
                </>
              ) : (
                step === "request" ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Mobile Number</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full border border-gray-300 px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors text-gray-900 font-mono text-sm"
                        placeholder="10-digit registered number"
                        required
                        minLength={10}
                        maxLength={10}
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors disabled:opacity-70 flex justify-center items-center text-sm cursor-pointer shadow-md"
                      >
                        {loading ? "SENDING OTP..." : "SEND OTP CODE"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Verification OTP Code</label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full border border-gray-300 px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors text-gray-900 tracking-widest text-center text-lg font-black"
                        placeholder="••••••"
                        required
                        minLength={6}
                        maxLength={6}
                      />
                    </div>

                    {sandboxOtp && (
                      <div className="bg-pink-50 border border-pink-100 p-4 rounded-xl text-center shadow-sm animate-pulse-subtle">
                        <p className="text-[10px] text-pink-700 font-bold mb-2 uppercase tracking-wide">Developer Sandbox SMS Simulation</p>
                        <p className="text-gray-800 text-sm mb-2">
                          SMS sent to <span className="font-bold">+91 {phone}</span>: 
                        </p>
                        <p className="bg-white border border-pink-150 rounded py-2 px-4 font-mono font-bold text-lg text-pink-600 tracking-widest inline-block select-all cursor-pointer shadow-inner" title="Click to select">
                          {sandboxOtp}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-2">Copy and enter the 6-digit OTP code above.</p>
                      </div>
                    )}

                    <div className="pt-4 space-y-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors disabled:opacity-70 flex justify-center items-center text-sm cursor-pointer shadow-md"
                      >
                        {loading ? "VERIFYING..." : "VERIFY OTP & CONTINUE"}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => { setStep("request"); setOtp(""); setSandboxOtp(""); setMessage(""); setError(""); }}
                        className="w-full text-center text-xs font-bold text-gray-500 hover:text-pink-600 py-2 hover:underline transition-all cursor-pointer"
                      >
                        Change Mobile Number
                      </button>
                    </div>
                  </>
                )
              )
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
