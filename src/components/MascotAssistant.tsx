"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, MessageSquare, Wallet, ShoppingBag, TrendingUp, HelpCircle } from "lucide-react";

export default function MascotAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Hide assistant in admin panel
    if (pathname?.startsWith("/admin")) {
      return;
    }

    // Check if the user has dismissed the welcome tooltip in the current session
    const isDismissed = sessionStorage.getItem("aarohi_tooltip_dismissed");
    if (!isDismissed) {
      const timer = setTimeout(() => {
        setShowTooltip(true);
      }, 3000); // Show tooltip after 3 seconds on page load
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  if (pathname?.startsWith("/admin")) return null;

  const handleActionClick = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  const closeTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(false);
    sessionStorage.setItem("aarohi_tooltip_dismissed", "true");
  };

  const isCartOrCheckout = pathname === "/bag" || pathname === "/checkout";
  const isProductPage = pathname?.startsWith("/product/");

  return (
    <div 
      className={`fixed left-4 z-50 transition-all duration-300
        ${isProductPage ? 'bottom-36' : isCartOrCheckout ? 'bottom-24' : 'bottom-20'}`}
      style={{
        // On desktop, align near the left edge of the max-w-md center column
        transform: "translateX(calc(max(0px, 224px - 50vw + 16px)))"
      }}
    >
      {/* 1. Main Floating Mascot Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowTooltip(false);
          sessionStorage.setItem("aarohi_tooltip_dismissed", "true");
        }}
        className="relative w-16 h-16 rounded-full bg-white border-2 border-pink-500 shadow-lg shadow-pink-500/20 hover:border-pink-600 hover:scale-110 active:scale-95 transition-all duration-300 p-1.5 flex items-center justify-center overflow-hidden shrink-0 group focus:outline-none"
      >
        <img
          src="/mascot/aarohi_waving.png"
          alt="Aarohi Mascot Assistant"
          className="w-full h-full object-contain object-center aarohi-wave-active group-hover:aarohi-wave-hover transition-all duration-300"
        />
        {/* Subtle pulsating online indicator */}
        <span className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse"></span>
      </button>

      {/* 2. Welcome Tooltip Speech Bubble */}
      {showTooltip && !isOpen && (
        <div 
          onClick={() => {
            setIsOpen(true);
            setShowTooltip(false);
            sessionStorage.setItem("aarohi_tooltip_dismissed", "true");
          }}
          className="absolute left-16 top-1/2 -translate-y-1/2 w-48 bg-white border border-pink-100 rounded-2xl shadow-xl shadow-gray-200/50 p-3 text-left cursor-pointer animate-fade-in-left select-none z-50 flex flex-col gap-1 hover:bg-pink-50/20 group"
        >
          {/* Dismiss button */}
          <button 
            onClick={closeTooltip}
            className="absolute top-1.5 right-1.5 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100/80"
          >
            <X size={12} />
          </button>
          <span className="text-[10px] text-pink-500 font-extrabold uppercase tracking-wide">Aarohi says:</span>
          <p className="text-xs text-gray-700 font-semibold leading-snug pr-3">
            Hi! Need help tracking your orders or claiming rewards? Tap me! 😊
          </p>
          {/* Speech bubble arrow point */}
          <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-l border-b border-pink-100 rotate-45"></div>
        </div>
      )}

      {/* 3. Interactive Glassmorphism Assistant Card */}
      {isOpen && (
        <div className="absolute left-0 bottom-16 w-[280px] bg-white/95 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl shadow-pink-500/10 p-5 animate-fade-in-up z-50 text-left overflow-hidden">
          {/* Header section with brand colors */}
          <div className="flex items-center gap-3 border-bottom border-gray-100 pb-3 mb-3.5">
            <div className="w-12 h-12 rounded-full border border-pink-400/30 bg-pink-50 overflow-hidden shrink-0 p-1 flex items-center justify-center bg-gradient-to-br from-pink-500/10 to-orange-500/10">
              <img
                src="/mascot/aarohi_waving.png"
                alt="Aarohi mascot"
                className="w-full h-full object-contain object-center"
              />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 tracking-wide">Aarohi Assistant</h3>
              <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse"></span> Online & Ready
              </p>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="ml-auto text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-xs text-gray-600 font-medium leading-relaxed mb-4">
            Welcome to **Craft Style**! I am your companion here. Pick a shortcut below to guide you:
          </p>

          {/* Quick Actions List */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => handleActionClick("/profile/orders")}
              className="w-full flex items-center gap-3 p-3 bg-pink-50/50 hover:bg-pink-50 border border-pink-100/50 rounded-2xl text-left text-xs font-semibold text-gray-800 transition-all hover:scale-[1.02]"
            >
              <ShoppingBag size={16} className="text-pink-500" />
              <span>📦 Track My Orders</span>
            </button>

            <button
              onClick={() => handleActionClick("/profile/wallet")}
              className="w-full flex items-center gap-3 p-3 bg-pink-50/50 hover:bg-pink-50 border border-pink-100/50 rounded-2xl text-left text-xs font-semibold text-gray-800 transition-all hover:scale-[1.02]"
            >
              <Wallet size={16} className="text-pink-500" />
              <span>🎁 Wallet & Referral Rewards</span>
            </button>

            <button
              onClick={() => handleActionClick("/customer-care")}
              className="w-full flex items-center gap-3 p-3 bg-pink-50/50 hover:bg-pink-50 border border-pink-100/50 rounded-2xl text-left text-xs font-semibold text-gray-800 transition-all hover:scale-[1.02]"
            >
              <HelpCircle size={16} className="text-pink-500" />
              <span>💬 24/7 Customer Care Chat</span>
            </button>

            <button
              onClick={() => handleActionClick("/")}
              className="w-full flex items-center gap-3 p-3 bg-pink-50/50 hover:bg-pink-50 border border-pink-100/50 rounded-2xl text-left text-xs font-semibold text-gray-800 transition-all hover:scale-[1.02]"
            >
              <TrendingUp size={16} className="text-pink-500" />
              <span>🔥 Shop Trending Collection</span>
            </button>
          </div>
        </div>
      )}
      <style>{`
      @keyframes aarohi-wave {
        0%, 80%, 100% { transform: rotate(0deg); }
        83% { transform: rotate(-7deg); }
        86% { transform: rotate(5deg); }
        89% { transform: rotate(-5deg); }
        92% { transform: rotate(4deg); }
      }
      @keyframes aarohi-wave-fast {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-9deg); }
        50% { transform: rotate(7deg); }
        75% { transform: rotate(-7deg); }
      }
      .aarohi-wave-active {
        animation: aarohi-wave 6s ease-in-out infinite;
        transform-origin: bottom center;
      }
      .group:hover .aarohi-wave-hover {
        animation: aarohi-wave-fast 1.2s ease-in-out infinite;
        transform-origin: bottom center;
      }
    `}</style>
    </div>
  );
}
