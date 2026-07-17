"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, MessageSquare, Wallet, ShoppingBag, TrendingUp, HelpCircle } from "lucide-react";

export default function MascotAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Chatbot conversation states
  const [messages, setMessages] = useState<any[]>([
    {
      id: "init",
      sender: "bot",
      text: "Hi! I am Aarohi, your Craft Style shopping assistant. How can I help you today? Ask me about orders, shipping rules, or rewards!",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

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

  const getBotResponse = (input: string): { text: string; actionPath?: string; actionLabel?: string } => {
    const text = input.toLowerCase();
    
    if (text.includes("order") || text.includes("track") || text.includes("status")) {
      return {
        text: "You can track your active orders and print manifests inside your Profile > Orders tab. Click below to view your order history:",
        actionPath: "/profile/orders",
        actionLabel: "📦 View My Orders"
      };
    }
    
    if (text.includes("wallet") || text.includes("cashback") || text.includes("refer") || text.includes("reward") || text.includes("balance")) {
      return {
        text: "Check your referral bonuses, wallet history, and cashback rewards inside the Profile > Wallet section:",
        actionPath: "/profile/wallet",
        actionLabel: "🎁 View My Wallet"
      };
    }

    if (text.includes("return") || text.includes("refund") || text.includes("cancel")) {
      return {
        text: "Returns are allowed within 7 days of delivery. You can initiate a return directly from the specific order card in your Profile:",
        actionPath: "/profile/orders",
        actionLabel: "📦 Request Return"
      };
    }

    if (text.includes("shipping") || text.includes("charge") || text.includes("delivery") || text.includes("free")) {
      return {
        text: "Shipping is FREE for all orders of ₹500 or above! For orders below ₹500, dynamic courier rates are calculated at checkout, falling back to a flat ₹100 if the connection fails.",
        actionPath: "/customer-care",
        actionLabel: "🚚 View Shipping Policy"
      };
    }

    if (text.includes("care") || text.includes("help") || text.includes("support") || text.includes("contact") || text.includes("chat")) {
      return {
        text: "Need direct assistance? You can query our FAQs or start a 24/7 support ticket on our customer care page:",
        actionPath: "/customer-care",
        actionLabel: "💬 Open Customer Care"
      };
    }

    if (text.includes("hi") || text.includes("hello") || text.includes("hey") || text.includes("aarohi")) {
      return {
        text: "Hello! 😊 I am Aarohi, your virtual companion. Try asking me about 'shipping costs', 'how to track orders', 'refund status', or 'wallet balance'!"
      };
    }

    return {
      text: "I didn't quite catch that. I am a helper bot — try asking about 'orders', 'shipping charges', 'wallet rewards', or 'returns'!"
    };
  };

  const handleSendMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;

    // 1. Add User Message
    const userMsg = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    // 2. Simulate Bot Typing Delay
    setTimeout(() => {
      const response = getBotResponse(textToSend);
      const botMsg = {
        id: `bot_${Date.now()}`,
        sender: "bot",
        text: response.text,
        actionPath: response.actionPath,
        actionLabel: response.actionLabel,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
      
      // Auto scroll chat log to bottom
      const chatLog = document.getElementById("mascot-chat-log");
      if (chatLog) {
        setTimeout(() => {
          chatLog.scrollTop = chatLog.scrollHeight;
        }, 80);
      }
    }, 850);
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
        className="relative w-16 h-16 rounded-full bg-white border-2 border-pink-500 shadow-lg shadow-pink-500/20 hover:border-pink-600 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center overflow-hidden shrink-0 group focus:outline-none"
      >
        <img
          src="/mascot/aarohi_waving.png"
          alt="Aarohi Mascot Assistant"
          className="w-full h-full object-cover object-top scale-[1.3] translate-y-1.5 aarohi-wave-active group-hover:aarohi-wave-hover transition-all duration-300"
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
        <div className="absolute left-0 bottom-20 w-[300px] bg-white/95 backdrop-blur-md border border-pink-100 rounded-3xl shadow-2xl shadow-pink-500/10 p-4 animate-fade-in-up z-50 text-left overflow-hidden flex flex-col h-[380px]">
          {/* Header section with brand colors */}
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-2 mb-2 shrink-0">
            <div className="w-10 h-10 rounded-full border border-pink-400/30 bg-pink-50 overflow-hidden shrink-0 flex items-center justify-center bg-gradient-to-br from-pink-500/10 to-orange-500/10">
              <img
                src="/mascot/aarohi_waving.png"
                alt="Aarohi mascot"
                className="w-full h-full object-cover object-top scale-[1.3] translate-y-1"
              />
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-gray-900 tracking-wide">Aarohi Chatbot</h3>
              <p className="text-[9px] text-green-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1 h-1 bg-green-500 rounded-full inline-block animate-pulse"></span> Online
              </p>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="ml-auto text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Chat Messages Log */}
          <div 
            id="mascot-chat-log"
            className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1 text-xs scrollbar-thin scrollbar-thumb-pink-100"
          >
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col max-w-[85%] ${
                  msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                <div 
                  className={`p-2.5 rounded-2xl leading-normal font-semibold ${
                    msg.sender === "user" 
                      ? "bg-pink-500 text-white rounded-tr-none" 
                      : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/40"
                  }`}
                >
                  <p>{msg.text}</p>
                </div>
                
                {/* Render quick navigation button if returned by bot */}
                {msg.sender === "bot" && msg.actionPath && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      router.push(msg.actionPath);
                    }}
                    className="mt-1 bg-pink-500/10 text-pink-650 hover:bg-pink-500 hover:text-white border border-pink-500/20 hover:border-transparent px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all tracking-wide cursor-pointer w-fit"
                  >
                    {msg.actionLabel || "View Details"}
                  </button>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-1 items-center bg-slate-100 text-slate-500 px-3 py-2 rounded-2xl rounded-tl-none border border-slate-200/40 w-fit animate-pulse">
                <span className="w-1.5 h-1.5 bg-gray-405 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-1.5 h-1.5 bg-gray-405 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-1.5 h-1.5 bg-gray-405 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </div>
            )}
          </div>

          {/* Quick replies scroll list */}
          <div className="flex gap-1.5 overflow-x-auto py-1.5 shrink-0 select-none hide-scrollbar border-t border-gray-50 mt-1">
            <button
              onClick={() => handleSendMessage("track my order")}
              className="bg-slate-50 hover:bg-pink-50 hover:text-pink-600 text-[10px] font-bold text-slate-600 border border-slate-200/60 hover:border-pink-200/60 px-2 py-1 rounded-lg flex-shrink-0 transition-colors cursor-pointer"
            >
              📦 Track Order
            </button>
            <button
              onClick={() => handleSendMessage("referral rewards")}
              className="bg-slate-50 hover:bg-pink-50 hover:text-pink-600 text-[10px] font-bold text-slate-600 border border-slate-200/60 hover:border-pink-200/60 px-2 py-1 rounded-lg flex-shrink-0 transition-colors cursor-pointer"
            >
              🎁 Rewards
            </button>
            <button
              onClick={() => handleSendMessage("shipping charge")}
              className="bg-slate-50 hover:bg-pink-50 hover:text-pink-600 text-[10px] font-bold text-slate-600 border border-slate-200/60 hover:border-pink-200/60 px-2 py-1 rounded-lg flex-shrink-0 transition-colors cursor-pointer"
            >
              🚚 Shipping Rules
            </button>
            <button
              onClick={() => handleSendMessage("refund policy")}
              className="bg-slate-50 hover:bg-pink-50 hover:text-pink-600 text-[10px] font-bold text-slate-600 border border-slate-200/60 hover:border-pink-200/60 px-2 py-1 rounded-lg flex-shrink-0 transition-colors cursor-pointer"
            >
              🔄 Returns
            </button>
            <button
              onClick={() => handleSendMessage("contact care")}
              className="bg-slate-50 hover:bg-pink-50 hover:text-pink-600 text-[10px] font-bold text-slate-600 border border-slate-200/60 hover:border-pink-200/60 px-2 py-1 rounded-lg flex-shrink-0 transition-colors cursor-pointer"
            >
              💬 Support
            </button>
          </div>

          {/* Typing input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-1.5 pt-1 border-t border-gray-100 shrink-0"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-pink-500 transition-all font-semibold outline-none"
              placeholder="Ask Aarohi..."
            />
            <button
              type="submit"
              className="bg-pink-500 hover:bg-pink-600 text-white rounded-xl p-2 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-md shadow-pink-500/10 w-8 h-8"
            >
              <MessageSquare size={14} />
            </button>
          </form>
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
