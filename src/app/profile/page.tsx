"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ChevronLeft, LogOut, Package, Heart, Settings, UserCircle } from "lucide-react";
import { useEffect } from "react";

export default function ProfilePage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If somehow a non-logged in user reaches here, redirect
    if (user === null) {
      router.push("/login");
    }
  }, [user, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (err) {
      console.error("Failed to log out", err);
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
          <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mb-3">
            <UserCircle size={40} className="text-pink-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{user.email?.split("@")[0]}</h2>
          <p className="text-sm text-gray-500">{user.email}</p>
          
          {isAdmin && (
            <span className="mt-2 bg-pink-100 text-pink-800 text-xs font-bold px-2.5 py-0.5 rounded border border-pink-200">
              Admin Account
            </span>
          )}
        </div>

        {/* Menu Options */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden mb-6">
          <button onClick={() => router.push("/profile/orders")} className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left">
            <div className="flex items-center space-x-3 text-gray-800">
              <Package size={20} className="text-gray-400" />
              <span className="font-medium text-sm">Orders</span>
            </div>
            <ChevronLeft size={16} className="text-gray-400 rotate-180" />
          </button>
          
          <button className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left">
            <div className="flex items-center space-x-3 text-gray-800">
              <Heart size={20} className="text-gray-400" />
              <span className="font-medium text-sm">Wishlist</span>
            </div>
            <ChevronLeft size={16} className="text-gray-400 rotate-180" />
          </button>

          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left">
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
          className="w-full bg-white border border-red-200 text-red-500 font-bold py-3.5 rounded-lg shadow-sm flex items-center justify-center space-x-2 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} />
          <span>LOGOUT</span>
        </button>

      </div>
    </div>
  );
}
