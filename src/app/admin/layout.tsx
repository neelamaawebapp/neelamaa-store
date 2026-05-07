"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push("/");
    }
  }, [user, isAdmin, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Admin Sidebar (Desktop) / Topbar (Mobile) */}
      <div className="w-full md:w-64 bg-[#2a2a3c] text-white p-4 shadow-lg flex flex-col">
        <div className="text-xl font-bold text-pink-500 mb-8 mt-2 flex items-center gap-2">
           <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-orange-400 rounded-md flex items-center justify-center text-white font-bold">
            M
          </div>
          Admin Panel
        </div>
        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto hide-scrollbar">
          <a href="/admin" className="px-4 py-2 hover:bg-white/10 rounded-md text-pink-300 font-medium whitespace-nowrap">Products</a>
          <a href="/admin/orders" className="px-4 py-2 hover:bg-white/10 rounded-md text-gray-300 font-medium whitespace-nowrap">Orders</a>
          <a href="#" className="px-4 py-2 hover:bg-white/10 rounded-md text-gray-300 font-medium whitespace-nowrap">Customers</a>
          <a href="/" className="px-4 py-2 hover:bg-white/10 rounded-md text-gray-400 font-medium mt-auto whitespace-nowrap">Exit to Store</a>
          <button 
            onClick={async () => {
              const { signOut } = await import("firebase/auth");
              const { auth } = await import("@/lib/firebase");
              await signOut(auth);
              router.push("/");
            }} 
            className="px-4 py-2 hover:bg-red-500/20 rounded-md text-red-400 font-medium whitespace-nowrap text-left"
          >
            Logout
          </button>
        </nav>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
