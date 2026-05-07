"use client";

import { MapPin, ChevronDown, Search, Bell, Heart, User, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

export default function Header() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    } else if (e.key === "Enter" && !searchQuery.trim()) {
      router.push(`/`);
    }
  };

  return (
    <header className="bg-[#fff0f0] pt-4 pb-2 px-4 sticky top-0 z-50">
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
          <div className="flex items-center justify-center w-6 h-6 bg-pink-100 text-pink-600 rounded-full mr-2 font-bold text-xs">
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
            <Bell size={22} className="hover:text-pink-500 transition-colors" />
          </Link>
          <Link href="/wishlist">
            <Heart size={22} className="hover:text-pink-500 transition-colors" />
          </Link>
          <Link href={isAdmin ? "/admin" : user ? "/profile" : "/login"}>
            <User size={22} className={user ? "text-pink-600" : ""} />
          </Link>
        </div>
      </div>
    </header>
  );
}
