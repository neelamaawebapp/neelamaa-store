"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function Signup() {
  // Auth Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Profile Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState("");

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
      if (phone.length < 10) {
        throw new Error("Please enter a valid 10-digit mobile number.");
      }

      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Update Auth Profile with Name
      await updateProfile(user, {
        displayName: name
      });

      // 3. Save Extended Profile to Firestore
      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
        phone,
        street,
        city,
        pin,
        address: `${street}, ${city}, ${pin}`,
        createdAt: serverTimestamp(),
      });

      router.push("/");
    } catch (err: any) {
      console.error(err);
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
        <div className="p-4 flex items-center border-b border-gray-100 sticky top-0 bg-white z-10">
          <button onClick={() => router.back()} className="mr-4">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-lg text-gray-900">Sign Up</h1>
        </div>

        <div className="p-6 flex-1 flex flex-col overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Account</h2>
            <p className="text-gray-500 text-sm">Join Neelamaa to track your orders and save details.</p>
          </div>

          <form onSubmit={handleSignup} className="flex flex-col space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            {/* Account Details */}
            <div className="space-y-3 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-sm text-pink-600 uppercase tracking-wider">Account Details</h3>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" placeholder="you@example.com" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Password *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" placeholder="Min 6 characters" required minLength={6} />
              </div>
            </div>

            {/* Personal Details */}
            <div className="space-y-3 pb-4">
              <h3 className="font-bold text-sm text-pink-600 uppercase tracking-wider">Contact & Shipping</h3>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Full Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" placeholder="John Doe" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Mobile Number *</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" placeholder="10-digit number" required minLength={10} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Street Address *</label>
                <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" placeholder="House/Flat No., Building Name, Street" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">City *</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Pincode *</label>
                  <input type="text" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" required />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors disabled:opacity-70 flex justify-center items-center"
              >
                {loading ? "CREATING PROFILE..." : "CREATE ACCOUNT"}
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
