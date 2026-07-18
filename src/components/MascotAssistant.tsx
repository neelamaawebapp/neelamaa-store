"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, MessageSquare, Wallet, ShoppingBag, TrendingUp, HelpCircle, Gift, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, collection, runTransaction } from "firebase/firestore";

const triggerConfetti = () => {
  if (typeof window === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "99999";
  document.body.appendChild(canvas);
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const particles: any[] = [];
  const colors = ["#FF3366", "#003bb3", "#ffd200", "#2e7d32", "#FF9900", "#CC33FF"];
  
  for (let i = 0; i < 150; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height * 0.6,
      vx: (Math.random() - 0.5) * 18,
      vy: -Math.random() * 16 - 6,
      radius: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: Math.random() * 0.015 + 0.01
    });
  }
  
  function animate() {
    if (particles.length === 0) {
      canvas.remove();
      return;
    }
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // Gravity
      p.vx *= 0.98; // Drag
      p.alpha -= p.decay;
      
      ctx!.save();
      ctx!.globalAlpha = Math.max(0, p.alpha);
      ctx!.fillStyle = p.color;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();
      
      if (p.alpha <= 0 || p.y > canvas.height) {
        particles.splice(i, 1);
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
};

export default function MascotAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Chatbot conversation states
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Video / Wallet / Birthday States
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [birthdayGiftClaimed, setBirthdayGiftClaimed] = useState(false);
  const [birthdayVal, setBirthdayVal] = useState("");
  const [claimingBirthday, setClaimingBirthday] = useState(false);
  const [claimingStatus, setClaimingStatus] = useState("");
  const [showBirthdaySuccess, setShowBirthdaySuccess] = useState(false);
  const [birthdayInput, setBirthdayInput] = useState("");
  const [tooltipText, setTooltipText] = useState("Hi! Need help tracking your orders or claiming rewards? Tap me! 😊");

  // 1. Listen for real-time Wallet and Birthday details
  useEffect(() => {
    if (!user) {
      setWalletBalance(null);
      setBirthdayGiftClaimed(false);
      setBirthdayVal("");
      return;
    }

    // Subscribe to Wallet
    const walletRef = doc(db, "wallets", user.uid);
    const unsubWallet = onSnapshot(walletRef, (snap) => {
      if (snap.exists()) {
        setWalletBalance(snap.data().balance);
      } else {
        setWalletBalance(0);
      }
    }, (err) => {
      console.warn("Mascot failed to load wallet details", err);
    });

    // Subscribe to User profile
    const userRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBirthdayVal(data.birthday || "");
        setBirthdayGiftClaimed(data.birthdayGiftClaimed || false);
      }
    }, (err) => {
      console.warn("Mascot failed to load user profile details", err);
    });

    return () => {
      unsubWallet();
      unsubUser();
    };
  }, [user]);

  // 2. Dynamically set first welcome message
  useEffect(() => {
    let greetingText = "Hi! I am Aarohi, your Craft Style shopping assistant. How can I help you today? Ask me about orders, shipping rules, or rewards!";
    
    if (user) {
      const name = user.displayName || user.email?.split("@")[0] || "friend";
      if (walletBalance !== null) {
        if (walletBalance > 0) {
          greetingText = `Welcome back, ${name}! You have ₹${walletBalance} in wallet credits available. How can I help you today? 😊`;
        } else {
          greetingText = `Welcome back, ${name}! I am Aarohi, your shopping assistant. How can I help you today? Ask me about 'shipping costs', 'orders', or 'returns'! 😊`;
        }
      }
    }
    
    setMessages([
      {
        id: "init",
        sender: "bot",
        text: greetingText,
        timestamp: new Date()
      }
    ]);
  }, [user, walletBalance]);

  // 3. Dynamically update floating hover speech bubble tooltip
  useEffect(() => {
    if (user) {
      const name = user.displayName || user.email?.split("@")[0] || "friend";
      if (walletBalance !== null && walletBalance > 0) {
        setTooltipText(`Hey ${name}! You have ₹${walletBalance} credits waiting. Tap me to check! 🎁`);
      } else if (!birthdayVal && !birthdayGiftClaimed) {
        setTooltipText(`Hey ${name}! Claim your ₹200 birthday reward today. Tap me! 🎂`);
      } else {
        setTooltipText(`Welcome back, ${name}! Tap me if you need help shopping! 😊`);
      }
    } else {
      setTooltipText("Hi! Need help tracking your orders or claiming rewards? Tap me! 😊");
    }
  }, [user, walletBalance, birthdayVal, birthdayGiftClaimed]);

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

  const handleClaimBirthday = async () => {
    if (!user || !birthdayInput) return;
    setClaimingBirthday(true);
    setClaimingStatus("");
    
    try {
      const userRef = doc(db, "users", user.uid);
      const walletRef = doc(db, "wallets", user.uid);
      const txnRef = doc(db, "wallet_transactions", `birthday_${user.uid}`);
      
      await runTransaction(db, async (transaction) => {
        // Read user profile
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists() && userSnap.data().birthdayGiftClaimed) {
          throw new Error("Birthday gift already claimed!");
        }
        
        // Read wallet
        const walletSnap = await transaction.get(walletRef);
        let currentBalance = 0;
        if (walletSnap.exists()) {
          currentBalance = walletSnap.data().balance || 0;
        }
        
        // Update User
        transaction.update(userRef, {
          birthday: birthdayInput,
          birthdayGiftClaimed: true
        });
        
        // Update Wallet
        if (walletSnap.exists()) {
          transaction.update(walletRef, {
            balance: currentBalance + 200,
            updatedAt: new Date().toISOString()
          });
        } else {
          throw new Error("Wallet not found. Please click the wallet badge in the header first to initialize your account.");
        }
        
        // Write transaction ledger doc
        transaction.set(txnRef, {
          walletId: user.uid,
          amount: 200,
          transactionType: "CREDIT",
          source: "BIRTHDAY_GIFT",
          referenceId: "birthday",
          description: `Birthday Gift Reward (DOB: ${birthdayInput})`,
          status: "Active",
          createdAt: new Date().toISOString()
        });
      });
      
      setShowBirthdaySuccess(true);
      triggerConfetti();
      
      // Update local states
      setBirthdayVal(birthdayInput);
      setBirthdayGiftClaimed(true);
      
      // Emit update event to refresh other components
      window.dispatchEvent(new Event("wallet-update"));
      
      setTimeout(() => {
        setShowBirthdaySuccess(false);
      }, 5000);
      
    } catch (err: any) {
      console.error("Birthday Claim Error:", err);
      setClaimingStatus(err.message || "Failed to claim birthday gift.");
    } finally {
      setClaimingBirthday(false);
    }
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
        className="relative w-16 h-16 rounded-full bg-white border-2 border-pink-500 shadow-lg shadow-pink-500/20 hover:border-pink-600 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center overflow-hidden shrink-0 group focus:outline-none animate-bob"
      >
        {/* Pulsating Ring Glow */}
        {((walletBalance !== null && walletBalance > 0) || (!birthdayVal && !birthdayGiftClaimed && user)) && (
          <span className="absolute inset-0 rounded-full bg-pink-500/25 animate-ping pointer-events-none"></span>
        )}
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
            {tooltipText}
          </p>
          {/* Speech bubble arrow point */}
          <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-l border-b border-pink-100 rotate-45"></div>
        </div>
      )}

      {/* 3. Interactive Glassmorphism Assistant Card */}
      {isOpen && (
        <div className="absolute left-0 bottom-20 w-[300px] bg-white/95 backdrop-blur-md border border-pink-100 rounded-3xl shadow-2xl shadow-pink-500/10 p-4 animate-fade-in-up z-50 text-left overflow-hidden flex flex-col h-auto max-h-[440px]">
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
            {/* Speaker Button for Text-To-Speech greetings */}
            <button 
              type="button"
              onClick={() => {
                const initMsg = messages.find(m => m.id === "init");
                if (initMsg) {
                  if ("speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(initMsg.text);
                    utterance.rate = 0.95;
                    utterance.pitch = 1.05;
                    window.speechSynthesis.speak(utterance);
                  }
                }
              }}
              className="ml-auto text-pink-600 hover:text-pink-705 hover:bg-pink-50 p-1.5 rounded-full transition-colors cursor-pointer mr-0.5 flex items-center justify-center"
              title="Listen to Aarohi's greeting"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75V5.25L7.75 9.5H4.5v5h3.25L12 18.75z" />
              </svg>
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Chat Messages Log */}
          <div 
            id="mascot-chat-log"
            className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1 text-xs scrollbar-thin scrollbar-thumb-pink-100 min-h-[140px] max-h-[220px]"
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

          {/* Persistent Birthday Claim Banner inside Aarohi Card */}
          {user && !birthdayVal && !birthdayGiftClaimed && (
            <div className="mx-0.5 my-1.5 p-2 rounded-xl bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-orange-500/10 border border-pink-100/60 shrink-0 select-none animate-fade-in flex flex-col gap-1.5 relative">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <Gift size={12} className="text-pink-600 animate-bounce" />
                  <span className="text-[9px] font-black text-pink-700 uppercase tracking-wider">₹200 Birthday Gift!</span>
                </div>
              </div>
              <p className="text-[8px] text-slate-650 font-semibold leading-normal">
                Enter your birthday to instantly claim ₹200 wallet credits!
              </p>
              
              {showBirthdaySuccess ? (
                <div className="flex items-center gap-1 text-[8px] text-green-700 font-bold bg-green-50 p-1 rounded-lg border border-green-200">
                  <Sparkles size={10} className="text-green-600" />
                  <span>Success! ₹200 credited to your wallet! 🎉</span>
                </div>
              ) : (
                <div className="flex gap-1 items-center">
                  <input
                    type="date"
                    value={birthdayInput}
                    onChange={(e) => setBirthdayInput(e.target.value)}
                    className="flex-1 border border-pink-200 rounded-lg px-2 py-0.5 text-[9px] text-gray-900 bg-white outline-none focus:ring-1 focus:ring-pink-500"
                    disabled={claimingBirthday}
                  />
                  <button
                    type="button"
                    onClick={handleClaimBirthday}
                    disabled={claimingBirthday || !birthdayInput}
                    className="bg-pink-500 hover:bg-pink-600 text-white font-extrabold px-2 py-0.5 rounded-lg text-[8px] uppercase tracking-wide cursor-pointer flex-shrink-0 disabled:opacity-50"
                  >
                    {claimingBirthday ? "Claiming..." : "Claim"}
                  </button>
                </div>
              )}

              {claimingStatus && (
                <span className="text-[8px] font-bold text-red-500 uppercase tracking-wide">
                  {claimingStatus}
                </span>
              )}
            </div>
          )}

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
