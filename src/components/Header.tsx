"use client";

import { MapPin, ChevronDown, Search, Bell, Heart, User, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const DEFAULT_PROMOS = [
  "⚡ Mid-Season Sale: FLAT 50% OFF! Code: CRAFTSTYLE50 ⚡",
  "✨ Explore Craft Style's New Arrivals: Fresh Styles Daily ✨",
  "💫 CRAFT STYLE: Indulge in Premium Luxury Fashion 💫"
];

export default function Header() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [promoMessages, setPromoMessages] = useState<string[]>(DEFAULT_PROMOS);
  const [promoIndex, setPromoIndex] = useState(0);
  const [fadeClass, setFadeClass] = useState("opacity-100 translate-y-0");

  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "promoTicker"));
        if (snap.exists() && snap.data().messages && Array.isArray(snap.data().messages) && snap.data().messages.length > 0) {
          setPromoMessages(snap.data().messages);
        }
      } catch (err) {
        console.error("Error fetching promo ticker:", err);
      }
    };
    fetchPromos();
  }, []);

  useEffect(() => {
    if (promoMessages.length <= 1) {
      setPromoIndex(0);
      return;
    }

    const interval = setInterval(() => {
      // Fade out and slide down slightly
      setFadeClass("opacity-0 translate-y-1");

      setTimeout(() => {
        setPromoIndex((prev) => (prev + 1) % promoMessages.length);
        // Position it off-screen top before fading back in
        setFadeClass("opacity-0 -translate-y-1");

        setTimeout(() => {
          setFadeClass("opacity-100 translate-y-0");
        }, 50);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, [promoMessages]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    } else if (e.key === "Enter" && !searchQuery.trim()) {
      router.push(`/`);
    }
  };

  return (
    <header className="bg-[#f9f9f9] sticky top-0 z-50 border-b border-gray-100">
      {/* Dynamic Promo Ticker Strip */}
      <div className="bg-gradient-to-r from-pink-600 via-rose-500 to-orange-500 text-white text-center py-2 px-4 text-[10px] font-black uppercase tracking-widest select-none min-h-[30px] flex items-center justify-center overflow-hidden shadow-inner">
        <div className={`transition-all duration-300 ease-out transform ${fadeClass} text-center`}>
          {promoMessages[promoIndex]}
        </div>
      </div>

      <div className="pt-3 pb-2 px-4">
        {/* Top Row: Location & Rewards */}
        <div className="flex justify-between items-center mb-3 text-sm">
          <div className="flex items-center space-x-1 text-gray-800 font-medium overflow-hidden whitespace-nowrap">
            <MapPin size={16} className="text-gray-700" />
            <span className="truncate max-w-[220px]">
              Deliver to {user?.displayName || user?.email?.split('@')[0] || "Guest"} - India
            </span>
            <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
          </div>
          <div className="flex items-center bg-[#eaffea] text-green-700 px-2 py-0.5 rounded-full text-xs font-bold border border-green-200">
            <span className="mr-1">₹0</span>
            <div className="bg-green-600 text-white rounded-full p-0.5">
              <Sparkles size={10} />
            </div>
          </div>
        </div>

        {/* Second Row: Search & Icons */}
        <div className="flex items-center space-x-3">
          {/* Search Bar */}
          <div className="flex-1 bg-white rounded-full flex items-center px-3 py-2 shadow-sm border border-gray-100">
            <div className="flex items-center justify-center w-6 h-6 bg-slate-100 text-pink-600 rounded-full mr-2 font-bold text-xs">
              M
            </div>
            <input
              type="text"
              placeholder="Search for products, brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
            />
            <Search size={18} className="text-gray-400 cursor-pointer" onClick={() => searchQuery.trim() ? router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`) : router.push('/')} />
          </div>

          {/* Action Icons */}
          <div className="flex items-center space-x-4 text-gray-700">
            <Link href="/notifications">
              <Bell size={22} className="hover:text-pink-600 transition-colors" />
            </Link>
            <Link href="/wishlist">
              <Heart size={22} className="hover:text-pink-600 transition-colors" />
            </Link>
            <Link href={isAdmin ? "/admin" : user ? "/profile" : "/login"}>
              <User size={22} className={user ? "text-pink-600" : ""} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
