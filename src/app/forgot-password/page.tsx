"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
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
      const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!firebaseApiKey) {
        throw new Error("Firebase configuration is missing.");
      }

      const checkUrl = `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${firebaseApiKey}`;
      const checkResponse = await fetch(checkUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: normalizedEmail,
          continueUri: window.location.origin
        }),
      });

      if (!checkResponse.ok) {
        throw new Error("Failed to verify email registration.");
      }

      const checkData = await checkResponse.json();
      if (!checkData.registered) {
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

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center w-full">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative shadow-md border-x border-gray-200">
        <div className="p-4 flex items-center border-b border-gray-100">
          <button onClick={() => router.back()} className="mr-4">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-lg text-gray-900">Forgot Password</h1>
        </div>

        <div className="p-6 flex-1 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h2>
            <p className="text-gray-500 text-sm">Enter the email associated with your account and we'll send you a link to reset your password.</p>
          </div>

          <form onSubmit={handleReset} className="flex flex-col space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium">
                {error}
              </div>
            )}
            
            {message && (
              <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm font-medium">
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
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
