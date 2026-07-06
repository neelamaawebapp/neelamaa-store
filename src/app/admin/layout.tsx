"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Package, ShoppingCart, Users, LogOut, Store, RotateCcw, Bell, Coins } from "lucide-react";
import Link from "next/link";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    let remotePendingCount = 0;

    const updateCount = () => {
      let localPending = 0;
      if (typeof window !== "undefined") {
        try {
          const localReturns = JSON.parse(localStorage.getItem("craftstyle_local_return_requests") || "[]");
          localPending = localReturns.filter((r: any) => r.status === "Pending").length;
        } catch (e) {}
      }
      setPendingCount(remotePendingCount + localPending);
    };

    const q = query(collection(db, "returnRequests"), where("status", "==", "Pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      remotePendingCount = snapshot.docs.length;
      updateCount();
    }, (err) => {
      console.warn("Firestore count failed, falling back to local storage", err);
      updateCount();
    });

    const interval = setInterval(updateCount, 1500);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push("/");
    }
  }, [user, isAdmin, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f19]">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect in useEffect
  }

  const navItems = [
    { name: "Products", href: "/admin", icon: Package },
    { name: "Orders", href: "/admin/orders", icon: ShoppingCart },
    { name: "Returns", href: "/admin/returns", icon: RotateCcw },
    { name: "Broadcasts", href: "/admin/broadcast", icon: Bell },
    { name: "Wallet Settings", href: "/admin/wallet", icon: Coins },
    { name: "Customers", href: "/admin/customers", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Premium Sidebar */}
      <aside className="w-full md:w-64 bg-slate-950/60 backdrop-blur-md border-b md:border-b-0 md:border-r border-slate-900 flex flex-col justify-between p-6 shrink-0 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div>
          {/* Admin Header */}
          <div className="flex items-center gap-3 mb-8 mt-2 relative z-10">
            <div className="w-9 h-9 bg-gradient-to-tr from-pink-500 to-orange-500 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-pink-500/20">
              M
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight text-white">
                Admin Panel
              </h1>
              <span className="text-[9px] uppercase font-bold tracking-widest text-pink-500 block -mt-0.5">
                Workspace
              </span>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <nav className="space-y-1.5 relative z-10">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 group
                    ${isActive 
                      ? 'bg-gradient-to-r from-pink-500/20 to-orange-500/10 border border-pink-500/30 text-white shadow-sm shadow-pink-500/5' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                    }`}
                >
                  <Icon 
                    size={17} 
                    className={`transition-colors duration-300 
                      ${isActive ? 'text-pink-500' : 'text-slate-500 group-hover:text-slate-300'}`} 
                  />
                  <span>{item.name}</span>
                  {item.name === "Returns" && pendingCount > 0 ? (
                    <span className="ml-auto bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[20px] h-5 shadow-[0_0_8px_rgba(244,63,94,0.4)] animate-pulse">
                      {pendingCount}
                    </span>
                  ) : isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_8px_#ec4899]"></span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Details */}
        <div className="mt-8 pt-5 border-t border-slate-900 relative z-10 space-y-4">
          {/* Profile Card */}
          <div className="flex items-center gap-3 p-2.5 bg-slate-900/40 border border-slate-900 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 font-bold text-xs uppercase">
              {user?.email ? user.email.slice(0, 2) : "AD"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">{user?.displayName || "Store Admin"}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email || "admin@example.com"}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Link
              href="/"
              className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-all"
            >
              <Store size={15} />
              <span>Exit to Store</span>
            </Link>
            <button 
              onClick={async () => {
                await logout();
                router.push("/");
              }} 
              className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-left w-full cursor-pointer"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
      
      {/* Main Workspace Content */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
