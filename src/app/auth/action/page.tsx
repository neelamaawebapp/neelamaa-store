"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const code = searchParams.get("oobCode");
    const mode = searchParams.get("mode");

    if (mode === "resetPassword" && code) {
      setOobCode(code);
      verifyPasswordResetCode(auth, code)
        .then((email) => {
          setEmail(email);
          setVerifying(false);
        })
        .catch((err) => {
          setError("Invalid or expired password reset link.");
          setVerifying(false);
        });
    } else {
      setError("Invalid request.");
      setVerifying(false);
    }
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;
    
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setMessage("Password has been reset successfully!");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pt-8 px-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Password</h2>
        {email ? (
          <p className="text-gray-500 text-sm">For {email}</p>
        ) : null}
      </div>

      {error ? (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
          {error}
        </div>
      ) : message ? (
        <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm mb-4">
          {message}
          <br/>
          Redirecting to login...
        </div>
      ) : (
        <form onSubmit={handleReset} className="flex flex-col space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors text-gray-900"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors disabled:opacity-70 flex justify-center items-center"
            >
              {loading ? "SAVING..." : "RESET PASSWORD"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center w-full">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative shadow-md border-x border-gray-200">
        <div className="p-4 flex items-center border-b border-gray-100 justify-center">
          <h1 className="font-bold text-lg text-pink-600 tracking-widest">MYNTRA</h1>
        </div>
        
        <Suspense fallback={<div className="p-10 text-center text-gray-500">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
