"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) return null;

  // Determine bottom padding dynamically to avoid overlapping fixed navigation or action bars
  let pbClass = "pb-24";
  if (pathname?.startsWith("/product/")) {
    pbClass = "pb-40";
  } else if (pathname === "/bag" || pathname === "/checkout") {
    pbClass = "pb-28";
  }

  return (
    <footer className={`bg-gray-50 border-t border-gray-200 py-8 px-4 text-center ${pbClass} w-full max-w-md mx-auto`}>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm mb-6 text-gray-600 font-medium px-4">
        <Link href="/privacy" className="hover:text-pink-600 transition-colors">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-pink-600 transition-colors">Terms & Conditions</Link>
        <Link href="/shipping" className="hover:text-pink-600 transition-colors">Shipping & Delivery</Link>
        <Link href="/cancellation" className="hover:text-pink-600 transition-colors">Cancellation & Refund</Link>
      </div>
      <div className="flex justify-center items-center space-x-2 mb-4">
        <span className="font-bold text-lg text-pink-600 tracking-widest">NEELSUTRA</span>
      </div>
      <p className="text-xs text-gray-400">© 2026 NeelSutra. All rights reserved.</p>
    </footer>
  );
}
