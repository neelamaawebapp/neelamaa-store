"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }
      // Simple email regex validation fallback
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address.");
      }

      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: any) {
      let errorMessage = "Failed to create account";
      if (err.code === "auth/email-already-in-use") {
        errorMessage = "This email is already in use.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email format.";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Must be at least 6 characters.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
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
          <h1 className="font-bold text-lg text-gray-900">Sign Up</h1>
        </div>

        <div className="p-6 flex-1 flex flex-col">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Account</h2>
            <p className="text-gray-500 text-sm">Join us and start shopping!</p>
          </div>

          <form onSubmit={handleSignup} className="flex flex-col space-y-4 flex-1">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
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
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors text-gray-900"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div className="mt-auto pt-8">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors disabled:opacity-70 flex justify-center items-center"
              >
                {loading ? "CREATING..." : "SIGN UP"}
              </button>
              
              <div className="text-center mt-6">
                <p className="text-gray-600 text-sm">
                  Already have an account?{" "}
                  <Link href="/login" className="text-pink-600 font-bold hover:underline">
                    Login here
                  </Link>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
