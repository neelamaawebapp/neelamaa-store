"use client";

import { useState, Suspense } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

function LoginContent() {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginAsMockUser } = useAuth();

  const redirect = searchParams.get("redirect") || "/";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const input = emailOrPhone.trim();
    const isPhone = /^\d{10}$/.test(input);

    try {
      let loginEmail = input;

      if (isPhone) {
        // Query Firestore to find the email associated with this phone number
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("phone", "==", input));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          throw new Error("No account found with this mobile number.");
        }
        
        loginEmail = querySnapshot.docs[0].data().email;
      }

      await signInWithEmailAndPassword(auth, loginEmail.toLowerCase().trim(), password);
      router.push(redirect);
    } catch (err: any) {
      let errorMessage = "Failed to log in";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        errorMessage = "Invalid credentials.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email format.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    localStorage.removeItem("craftstyle_mock_user");

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user) throw new Error("Google login failed");

      // Check if user exists in Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        // Generate a unique referral code
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let referralCode = "";
        let isUnique = false;
        while (!isUnique) {
          let resultStr = "CRAFT-";
          for (let i = 0; i < 6; i++) {
            resultStr += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          const qCheck = query(collection(db, "users"), where("referralCode", "==", resultStr));
          const snapCheck = await getDocs(qCheck);
          if (snapCheck.empty) {
            referralCode = resultStr;
            isUnique = true;
          }
        }

        await setDoc(userDocRef, {
          name: user.displayName || user.email?.split("@")[0] || "Customer",
          email: user.email?.toLowerCase().trim() || "",
          phone: "",
          street: "",
          city: "",
          pin: "",
          address: "",
          referralCode,
          createdAt: serverTimestamp(),
        });
      }

      router.push(redirect);
    } catch (err: any) {
      console.error(err);
      let errorMessage = "Failed to log in with Google.";
      if (err.code === "auth/popup-closed-by-user") {
        errorMessage = "Google login popup closed.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    loginAsMockUser("demo.customer@example.com", "Demo Customer");
    window.location.href = redirect;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center w-full">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative shadow-md border-x border-gray-200">
        <div className="p-4 flex items-center border-b border-gray-100">
          <button onClick={() => router.back()} className="mr-4">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-lg text-gray-900">Login</h1>
        </div>

        <div className="p-6 flex-1 flex flex-col">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-gray-500 text-sm">Login to your account to continue shopping</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col space-y-4 flex-1">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Email or Mobile Number</label>
              <input
                type="text"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                className="w-full border border-gray-300 px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors text-gray-900"
                placeholder="you@example.com or 10-digit mobile"
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
              />
            </div>

            <div className="flex justify-end mt-2">
              <Link href="/forgot-password" className="text-sm font-bold text-pink-600 hover:underline">Forgot Password?</Link>
            </div>

            <div className="mt-auto pt-8">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors disabled:opacity-70 flex justify-center items-center animate-pulse-subtle"
              >
                {loading ? "LOGGING IN..." : "LOGIN"}
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="mt-3 w-full bg-white text-gray-700 font-bold py-3.5 rounded-md border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all flex justify-center items-center gap-2.5 disabled:opacity-70 shadow-sm"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>CONTINUE WITH GOOGLE</span>
              </button>
              
              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-xs font-bold uppercase tracking-wider">or</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <button
                type="button"
                onClick={handleDemoLogin}
                className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-md hover:bg-slate-800 transition-colors flex justify-center items-center gap-2 shadow-md hover:shadow-lg"
              >
                <span>🚀 DEMO / GUEST LOGIN</span>
              </button>

              <div className="text-center mt-6">
                <p className="text-gray-600 text-sm">
                  New to Craft Style?{" "}
                  <Link href={`/signup?redirect=${encodeURIComponent(redirect)}`} className="text-pink-600 font-bold hover:underline">
                    Create an account
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

export default function Login() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading Login...</div>}>
      <LoginContent />
    </Suspense>
  );
}
