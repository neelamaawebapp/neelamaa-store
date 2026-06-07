"use client";

import { useState, Suspense } from "react";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ShieldAlert, CheckCircle } from "lucide-react";
import Link from "next/link";

function ResetPasswordContent() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const email = searchParams.get("email");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oobCode) {
      setError("Invalid or expired password reset link.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    if (oobCode.startsWith("mock_oob_")) {
      setTimeout(() => {
        setSuccess(true);
        setLoading(false);
      }, 1000);
      return;
    }

    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
    } catch (err: any) {
      console.error("Firebase confirmPasswordReset error:", err);
      let errMsg = "Failed to reset password. The link might have expired or been used already.";
      if (err.code === "auth/expired-action-code") {
        errMsg = "This password reset link has expired.";
      } else if (err.code === "auth/invalid-action-code") {
        errMsg = "This password reset link is invalid.";
      } else if (err.code === "auth/user-disabled") {
        errMsg = "This user account has been disabled.";
      } else if (err.code === "auth/user-not-found") {
        errMsg = "User account not found.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "Password is too weak. Please use a stronger password.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center w-full max-w-md mx-auto p-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600">
          <CheckCircle size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful!</h1>
        <p className="text-gray-500 mb-8">Your password has been successfully updated. You can now log in with your new password.</p>
        <button 
          onClick={() => router.push("/login")}
          className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors shadow-md cursor-pointer"
        >
          LOG IN NOW
        </button>
      </div>
    );
  }

  if (!oobCode) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center w-full">
        <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative shadow-md border-x border-gray-200 p-6 text-center justify-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
          <p className="text-gray-500 text-sm mb-6">This password reset link is invalid or has expired. Please request a new password reset email.</p>
          <button 
            onClick={() => router.push("/forgot-password")}
            className="w-full bg-pink-500 text-white font-bold py-3 rounded-md hover:bg-pink-600 transition-colors shadow"
          >
            REQUEST NEW LINK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center w-full">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative shadow-md border-x border-gray-200">
        {/* Header */}
        <div className="p-4 flex items-center border-b border-gray-100 sticky top-0 bg-white z-10">
          <button onClick={() => router.push("/login")} className="mr-4">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-lg text-gray-900">Reset Password</h1>
        </div>

        <div className="p-6 flex-1 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose New Password</h2>
            {email && (
              <p className="text-xs font-semibold text-pink-600 bg-pink-50 border border-pink-100 rounded px-2.5 py-1.5 mb-3 inline-block">
                For: {email}
              </p>
            )}
            <p className="text-gray-500 text-sm">Enter your new secure password below to update your account credential.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">New Password</label>
              <input
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-gray-900 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-gray-900 font-mono text-sm"
              />
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors disabled:opacity-70 flex justify-center items-center cursor-pointer shadow-md hover:shadow-lg text-sm"
              >
                {loading ? "RESETTING PASSWORD..." : "UPDATE PASSWORD"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading reset password form...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
