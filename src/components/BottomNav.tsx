"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { cart } = useCart();
  
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/checkout") || pathname === "/bag") {
    return null;
  }

  const navItems = [
    { name: "Home", icon: Home, path: "/" },
    { name: "Categories", icon: LayoutGrid, path: "/categories" },
    { name: "Bag", icon: ShoppingBag, path: "/bag", count: cart.length },
    { name: "Profile", icon: User, path: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 bg-slate-950/90 backdrop-blur-md border-t border-slate-900 px-6 h-16 pb-safe z-[100] shadow-[0_-10px_25px_-3px_rgba(0,0,0,0.3)]">
      <div className="flex justify-between items-center h-full">
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== "/" && pathname?.startsWith(item.path));
          
          return (
            <Link href={item.path} key={item.name} className="flex flex-col items-center relative group">
              <div className={`p-1.5 rounded-full transition-colors ${isActive ? 'bg-slate-900 text-pink-500' : 'text-slate-400 group-hover:text-pink-500 group-hover:bg-slate-900'}`}>
                <item.icon size={22} className={isActive ? "fill-pink-950/30" : ""} />
              </div>
              <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-pink-500 font-bold' : 'text-slate-400'}`}>
                {item.name}
              </span>
              {item.count ? (
                <span className="absolute top-0 right-1 bg-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center transform translate-x-1/2 -translate-y-1/2">
                  {item.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
