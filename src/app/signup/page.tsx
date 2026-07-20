"use client";

import { useState, Suspense, useEffect } from "react";
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { ChevronLeft, AlertTriangle } from "lucide-react";

function SignupContent() {
  // Auth Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Profile Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState("");
  const [referredByInput, setReferredByInput] = useState("");
  const [birthday, setBirthday] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVercelPreview, setIsVercelPreview] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginAsMockUser, user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host !== "myntra-clone-delta-blue.vercel.app" && host !== "localhost" && host.endsWith(".vercel.app")) {
        setIsVercelPreview(true);
      }
    }
  }, []);

  // Redirect if already logged in / registered
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      alert("You are already registered and logged in!");
      router.push("/profile");
    }
  }, [user, authLoading, router]);

  // Load ref query parameter into referral code input
  useEffect(() => {
    const urlRef = searchParams.get("ref");
    if (urlRef) {
      setReferredByInput(urlRef.toUpperCase());
    }
  }, [searchParams]);

  const redirect = searchParams.get("redirect") || "/";

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

      // Check if mobile number is already registered in Firestore
      const usersRef = collection(db, "users");
      const qPhone = query(usersRef, where("phone", "==", phone.trim()));
      const phoneSnapshot = await getDocs(qPhone);
      if (!phoneSnapshot.empty) {
        throw new Error("This mobile number is already in use by another account.");
      }

      const normalizedEmail = email.toLowerCase().trim();
      const trimmedRefInput = referredByInput.trim().toUpperCase();

      // Validate referral code if entered
      let referrerUserId = "";
      if (trimmedRefInput) {
        const qRef = query(collection(db, "users"), where("referralCode", "==", trimmedRefInput));
        const refSnap = await getDocs(qRef);
        if (refSnap.empty) {
          throw new Error("Invalid referral code. Please check or clear it to proceed.");
        }
        referrerUserId = refSnap.docs[0].id;
      }

      // Generate B's own unique, unguessable referral code
      const generateUniqueCode = async () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "";
        let isUnique = false;
        while (!isUnique) {
          let result = "CRAFT-";
          for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          const qCheck = query(collection(db, "users"), where("referralCode", "==", result));
          const snapCheck = await getDocs(qCheck);
          if (snapCheck.empty) {
            code = result;
            isUnique = true;
          }
        }
        return code;
      };

      const ownReferralCode = await generateUniqueCode();

      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      // 2. Update Auth Profile with Name
      await updateProfile(user, {
        displayName: name
      });

      // 3. Save Extended Profile to Firestore
      const userProfileData: any = {
        name,
        email: normalizedEmail,
        phone,
        street,
        city,
        pin,
        address: `${street}, ${city}, ${pin}`,
        birthday: birthday || "",
        birthdayGiftClaimed: false,
        referralCode: ownReferralCode,
        createdAt: serverTimestamp(),
      };

      if (trimmedRefInput) {
        userProfileData.referredByCode = trimmedRefInput;
        userProfileData.referredByUserId = referrerUserId;
      }

      await setDoc(doc(db, "users", user.uid), userProfileData);

      // 4. Trigger referral credits if valid code entered
      if (trimmedRefInput) {
        try {
          const { getAuthHeaders } = await import("@/lib/api-client");
          const authHeaders = await getAuthHeaders();
          await fetch("/api/wallet/credit-referral", {
            method: "POST",
            headers: { ...authHeaders },
            body: JSON.stringify({
              userId: user.uid,
              referredByCode: trimmedRefInput
            })
          });
        } catch (creditErr) {
          console.error("Failed to credit referral bonus on signup:", creditErr);
        }
      }

      // 5. Trigger birthday reward if date of birth provided
      if (birthday) {
        try {
          const { getAuthHeaders } = await import("@/lib/api-client");
          const authHeaders = await getAuthHeaders();
          await fetch("/api/wallet/claim-birthday", {
            method: "POST",
            headers: { ...authHeaders },
            body: JSON.stringify({
              userId: user.uid,
              birthday: birthday
            })
          });
        } catch (birthdayErr) {
          console.error("Failed to credit birthday reward on signup:", birthdayErr);
        }
      }

      router.push(redirect);
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
      let errorMessage = "Failed to sign up with Google.";
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

  const handleFacebookLogin = async () => {
    setLoading(true);
    setError("");
    localStorage.removeItem("craftstyle_mock_user");

    try {
      const provider = new FacebookAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user) throw new Error("Facebook login failed");

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
      let errorMessage = "Failed to sign up with Facebook.";
      if (err.code === "auth/popup-closed-by-user") {
        errorMessage = "Facebook login popup closed.";
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
        <div className="p-4 flex items-center border-b border-gray-100 sticky top-0 bg-white z-10">
          <button onClick={() => router.back()} className="mr-4">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-lg text-gray-900">Sign Up</h1>
        </div>

        <div className="p-6 flex-1 flex flex-col overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Account</h2>
            <p className="text-gray-500 text-sm">Join Craft Style to track your orders and save details.</p>
          </div>

          <form onSubmit={handleSignup} className="flex flex-col space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            {/* Account Details */}
            <div className="space-y-3 pb-4">
              <h3 className="font-bold text-sm text-pink-600 uppercase tracking-wider">Account Details</h3>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Full Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" placeholder="John Doe" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Mobile Number *</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" placeholder="10-digit number" required minLength={10} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Date of Birth (Optional - Get ₹200 Reward)</label>
                <input 
                  type="date" 
                  value={birthday} 
                  onChange={(e) => setBirthday(e.target.value)} 
                  className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" placeholder="you@example.com" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Password *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" placeholder="Min 6 characters" required minLength={6} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Referral Code (Optional)</label>
                <input type="text" value={referredByInput} onChange={(e) => setReferredByInput(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-gray-900" placeholder="e.g. ABC1234" />
              </div>
            </div>

            {/* Shipping Details */}
            <div className="space-y-3 pb-4">
              <h3 className="font-bold text-sm text-pink-600 uppercase tracking-wider">Shipping Details</h3>
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

              <button
                type="button"
                onClick={handleFacebookLogin}
                disabled={loading}
                className="mt-3 w-full bg-[#1877F2] text-white font-bold py-3.5 rounded-md hover:bg-[#166FE5] transition-all flex justify-center items-center gap-2.5 disabled:opacity-70 shadow-sm"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span>CONTINUE WITH FACEBOOK</span>
              </button>

              {isVercelPreview && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3.5 rounded-xl flex flex-col gap-1.5 mt-3 select-none animate-fade-in">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                    <span>Domain Configuration Warning</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-normal font-medium">
                    Google and Facebook logins require authorized redirect domains. To sign in successfully, please use the main production domain: 
                    <a href="https://myntra-clone-delta-blue.vercel.app" className="underline font-bold text-pink-600 ml-1 hover:text-pink-700">myntra-clone-delta-blue.vercel.app</a>.
                  </p>
                </div>
              )}
              
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
                  Already have an account?{" "}
                  <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="text-pink-600 font-bold hover:underline">
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

export default function Signup() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading Signup...</div>}>
      <SignupContent />
    </Suspense>
  );
}
