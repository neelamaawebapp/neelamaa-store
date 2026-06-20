"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut, Package, Heart, Settings, UserCircle, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const { user, isAdmin, logout } = useAuth();
  const router = useRouter();

  // Address States
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    // If somehow a non-logged in user reaches here, redirect
    if (user === null) {
      router.push("/login");
    }
  }, [user, router]);

  // Fetch address on mount
  useEffect(() => {
    if (!user) return;

    const fetchAddress = async () => {
      // 1. Check local storage mock fallback first
      const localAddr = localStorage.getItem("craftstyle_mock_user_address");
      if (localAddr) {
        try {
          const parsed = JSON.parse(localAddr);
          if (parsed.street) setStreet(parsed.street);
          if (parsed.city) setCity(parsed.city);
          if (parsed.pin) setPin(parsed.pin);
          if (parsed.phone) setPhone(parsed.phone);
          return;
        } catch (e) {
          console.error(e);
        }
      }

      // 2. Fetch from Firestore
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.street) setStreet(data.street);
          if (data.city) setCity(data.city);
          if (data.pin) setPin(data.pin);
          if (data.phone) setPhone(data.phone);
        }
      } catch (err) {
        console.error("Failed to load user address", err);
      }
    };

    fetchAddress();
  }, [user]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingAddress(true);

    const addressData = { street, city, pin, phone };
    
    // Save locally
    localStorage.setItem("craftstyle_mock_user_address", JSON.stringify(addressData));

    // Save to Firestore
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName || user.email?.split("@")[0] || "Customer",
        email: user.email,
        phone,
        street,
        city,
        pin,
        address: `${street}, ${city}, ${pin}`,
      }, { merge: true });
      setIsEditingAddress(false);
    } catch (err) {
      console.error("Failed to save address to Firestore, fallback is active", err);
      setIsEditingAddress(false);
    } finally {
      setSavingAddress(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("Failed to log out", err);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete your account? This action is irreversible and all your profile and address data will be erased.");
    if (!confirmDelete) return;

    setDeletingAccount(true);
    try {
      if (user) {
        const { doc, deleteDoc } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        await deleteDoc(doc(db, "users", user.uid));
        
        if (user.delete && typeof user.delete === "function") {
          await user.delete();
        }
      }
      
      localStorage.removeItem("craftstyle_mock_user");
      localStorage.removeItem("craftstyle_mock_user_address");
      
      await logout();
      alert("Your account has been deleted successfully.");
      router.push("/");
    } catch (err: any) {
      console.error("Account deletion error:", err);
      if (err.code === "auth/requires-recent-login") {
        alert("For security reasons, please log out, log back in, and try deleting your account again.");
      } else {
        localStorage.removeItem("craftstyle_mock_user");
        localStorage.removeItem("craftstyle_mock_user_address");
        await logout();
        alert("Your profile has been removed from local storage and you have been logged out.");
        router.push("/");
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-24">
      {/* Header */}
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.push("/")} className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Profile</h1>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        
        {/* User Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center mb-6">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <UserCircle size={40} className="text-pink-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{user.displayName || user.email?.split("@")[0]}</h2>
          <p className="text-sm text-gray-500">{user.email}</p>
          
          {isAdmin && (
            <span className="mt-2 bg-slate-100 text-pink-800 text-xs font-bold px-2.5 py-0.5 rounded border border-slate-200">
              Admin Account
            </span>
          )}
        </div>

        {/* Address Card */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-2 mb-3">
            <MapPin size={18} className="text-pink-600" />
            <h3 className="font-bold text-xs text-gray-850 uppercase tracking-wide">Delivery & Billing Address</h3>
          </div>
          {isEditingAddress ? (
            <form onSubmit={handleSaveAddress} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Street Address</label>
                <input 
                  type="text" 
                  value={street} 
                  onChange={e => setStreet(e.target.value)} 
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none text-gray-900 focus:border-pink-500 transition-colors" 
                  placeholder="House No., Building, Street Name"
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">City</label>
                  <input 
                    type="text" 
                    value={city} 
                    onChange={e => setCity(e.target.value)} 
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none text-gray-900 focus:border-pink-500 transition-colors" 
                    placeholder="e.g. Jodhpur"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Pincode</label>
                  <input 
                    type="text" 
                    value={pin} 
                    onChange={e => setPin(e.target.value)} 
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none text-gray-900 focus:border-pink-500 transition-colors" 
                    placeholder="6-digit PIN"
                    required 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Contact Phone Number</label>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none text-gray-900 focus:border-pink-500 transition-colors" 
                  placeholder="10-digit mobile number"
                  required 
                />
              </div>
              <div className="flex space-x-2 pt-2">
                <button 
                  type="submit" 
                  disabled={savingAddress}
                  className="flex-grow bg-pink-500 text-white font-bold py-2 rounded text-xs hover:bg-pink-600 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {savingAddress ? "SAVING..." : "SAVE ADDRESS"}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsEditingAddress(false)} 
                  className="flex-grow bg-gray-100 text-gray-700 font-bold py-2 rounded text-xs hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </form>
          ) : (
            <div className="text-sm text-gray-600 space-y-1">
              {street ? (
                <>
                  <p className="font-semibold text-gray-900">{user.displayName || user.email?.split("@")[0]}</p>
                  <p>{street}</p>
                  <p>{city} - {pin}</p>
                  <p className="pt-1"><span className="font-semibold text-gray-800">Phone:</span> {phone}</p>
                  <div className="pt-3">
                    <button 
                      onClick={() => setIsEditingAddress(true)} 
                      className="text-pink-600 font-bold text-xs uppercase hover:underline cursor-pointer"
                    >
                      EDIT ADDRESS
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-2 text-center">
                  <p className="text-gray-500 italic text-xs mb-2">No billing address saved yet.</p>
                  <button 
                    onClick={() => setIsEditingAddress(true)} 
                    className="bg-slate-50 border border-slate-200 text-pink-600 font-bold text-xs px-4 py-2 rounded-md hover:bg-slate-100 transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    + Add Address
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Menu Options */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden mb-6">
          <button onClick={() => router.push("/profile/orders")} className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left cursor-pointer">
            <div className="flex items-center space-x-3 text-gray-800">
              <Package size={20} className="text-gray-400" />
              <span className="font-medium text-sm">Orders</span>
            </div>
            <ChevronLeft size={16} className="text-gray-400 rotate-180" />
          </button>
          
          <button className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left cursor-pointer">
            <div className="flex items-center space-x-3 text-gray-800">
              <Heart size={20} className="text-gray-400" />
              <span className="font-medium text-sm">Wishlist</span>
            </div>
            <ChevronLeft size={16} className="text-gray-400 rotate-180" />
          </button>
 
          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left cursor-pointer">
            <div className="flex items-center space-x-3 text-gray-800">
              <Settings size={20} className="text-gray-400" />
              <span className="font-medium text-sm">Settings</span>
            </div>
            <ChevronLeft size={16} className="text-gray-400 rotate-180" />
          </button>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="w-full bg-white border border-red-200 text-red-500 font-bold py-3.5 rounded-lg shadow-sm flex items-center justify-center space-x-2 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut size={18} />
          <span>LOGOUT</span>
        </button>

        {/* Account Deletion (Google Play Compliance) */}
        <div className="mt-8 border-t border-gray-200 pt-6 text-center">
          <p className="text-xs text-gray-400 mb-2">Want to close your account? This will permanently delete your user profile and address details.</p>
          <button 
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
            className="text-xs text-red-600 font-bold hover:underline tracking-wide uppercase disabled:opacity-50 cursor-pointer"
          >
            {deletingAccount ? "Deleting Account..." : "Delete Account"}
          </button>
        </div>

      </div>
    </div>
  );
}
