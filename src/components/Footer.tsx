"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-8 px-4 text-center pb-24 w-full max-w-md mx-auto">
      <div className="flex justify-center space-x-6 text-sm mb-6 text-gray-600 font-medium">
        <Link href="/privacy" className="hover:text-pink-600 transition-colors">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-pink-600 transition-colors">Terms of Service</Link>
        <Link href="/shipping" className="hover:text-pink-600 transition-colors">Shipping & Refunds</Link>
      </div>
      <div className="flex justify-center items-center space-x-2 mb-4">
        <span className="font-bold text-lg text-pink-600 tracking-widest">NEELAMAA</span>
      </div>
      <p className="text-xs text-gray-400">© 2026 Neelamaa. All rights reserved.</p>
    </footer>
  );
}
