"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeft, Sparkles, ShieldCheck, ShieldAlert, ArrowUpRight, ArrowDownLeft, Wallet, AlertCircle, RefreshCw, Copy, Check, MessageCircle } from "lucide-react";
import Link from "next/link";

// Web Cryptography API helper to compute SHA-256 hash in browser
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function UserWalletPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLedgerSecure, setIsLedgerSecure] = useState<boolean | null>(null);
  const [referralCode, setReferralCode] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaWhatsApp = () => {
    if (!referralCode) return;
    const appName = "Craft Style";
    const referralLink = `${window.location.origin}/signup?ref=${referralCode}`;
    const textMessage = `Hey! 🎁 I’ve been using ${appName} for my shopping, and thought you'd love it.\n\nSign up using my link or use my referral code ${referralCode} to get ₹100 instantly credited to your wallet for your first order!\n\nDownload the app here: ${referralLink}`;
    
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMessage)}`;
    window.open(whatsappUrl, "_blank");
  };

  const loadWalletData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let currentBalance = 0;
      let txns: any[] = [];

      if (user.uid.startsWith("mock_")) {
        const localKey = `craftstyle_mock_wallet_${user.email || "guest"}`;
        const storedWallet = localStorage.getItem(localKey);
        if (storedWallet) {
          const parsed = JSON.parse(storedWallet);
          currentBalance = parsed.balance;
          txns = parsed.transactions || [];
        } else {
          currentBalance = 100;
          txns = [{
            id: `txn_mock_signup_${Date.now()}`,
            walletId: user.uid,
            amount: 100,
            transactionType: "CREDIT",
            source: "SIGNUP_BONUS",
            referenceId: "signup",
            description: "Signup Bonus (Mock User)",
            status: "Active",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
            hash: "mock_genesis_hash"
          }];
          localStorage.setItem(localKey, JSON.stringify({
            balance: currentBalance,
            transactions: txns
          }));
        }
        setBalance(currentBalance);
        setTransactions(txns);
        setIsLedgerSecure(true);
      } else {
        let apiSucceeded = false;
        try {
          const res = await fetch(`/api/wallet/balance?userId=${user.uid}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && (data.balance > 0 || (data.transactions && data.transactions.length > 0))) {
              currentBalance = data.balance;
              txns = data.transactions || [];
              setBalance(currentBalance);
              setTransactions(txns);
              await verifyLedger(txns);
              apiSucceeded = true;
            }
          }
        } catch (apiErr) {
          console.error("API wallet load failed, attempting client-side fallback", apiErr);
        }

        if (!apiSucceeded) {
          const { doc, getDoc, getFirestore, collection, query, where, getDocs, setDoc } = await import("firebase/firestore");
          const { app } = await import("@/lib/firebase");
          const db = getFirestore(app);

          const walletRef = doc(db, "wallets", user.uid);
          let walletSnap = await getDoc(walletRef);

          if (!walletSnap.exists()) {
            const signupBonus = 100;
            const expiryDays = 365;
            const txnRef = doc(collection(db, "wallet_transactions"));

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiryDays);

            const initialTxn = {
              walletId: user.uid,
              amount: signupBonus,
              transactionType: "CREDIT",
              source: "SIGNUP_BONUS",
              referenceId: "signup",
              description: "Signup Bonus",
              status: "Active",
              expiresAt: expiresAt.toISOString(),
              createdAt: new Date().toISOString(),
              hash: "genesis"
            };

            await setDoc(txnRef, initialTxn);
            await setDoc(walletRef, {
              userId: user.uid,
              balance: signupBonus,
              currency: "INR",
              updatedAt: new Date().toISOString(),
              latestTransactionHash: "genesis"
            });

            currentBalance = signupBonus;
            txns = [{ id: txnRef.id, ...initialTxn }];
          } else {
            const wData = walletSnap.data();
            currentBalance = wData.balance || 0;

            const qTxns = query(collection(db, "wallet_transactions"), where("walletId", "==", user.uid));
            const querySnapshot = await getDocs(qTxns);
            txns = querySnapshot.docs.map(d => ({
              id: d.id,
              ...d.data()
            })).sort((a: any, b: any) => {
              return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            });
          }

          setBalance(currentBalance);
          setTransactions(txns);
          await verifyLedger(txns);
        }
      }

      // Fetch referral code from user profile
      const { doc, getDoc, getFirestore, query, collection, where, getDocs, updateDoc } = await import("firebase/firestore");
      const { app } = await import("@/lib/firebase");
      const db = getFirestore(app);
      const userDocSnap = await getDoc(doc(db, "users", user.uid));
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.referralCode) {
          setReferralCode(userData.referralCode);
        } else {
          const generateUniqueCode = async () => {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let code = "";
            let isUnique = false;
            while (!isUnique) {
              let result = "CRAFT-";
              for (let i = 0; i < 6; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              const qCheck = query(collection(db, "users"), where("referralCode", "==", result));
              const snapCheck = await getDocs(qCheck);
              if (snapCheck.empty) {
                code = result;
                isUnique = true;
              }
            }
            return code;
          };
          const ownReferralCode = await generateUniqueCode();
          await updateDoc(doc(db, "users", user.uid), { referralCode: ownReferralCode });
          setReferralCode(ownReferralCode);
        }
      }
    } catch (err) {
      console.error("Failed to load wallet data:", err);
    } finally {
      setLoading(false);
    }
  };

  const verifyLedger = async (txns: any[]) => {
    if (!txns || txns.length === 0) {
      setIsLedgerSecure(true);
      return;
    }

    try {
      // Reverse array to start checking from oldest to newest (genesis chain order)
      const oldestFirst = [...txns].reverse();
      let prevHash = "genesis";
      let isValid = true;

      for (const txn of oldestFirst) {
        // Hashing uses absolute amount magnitude
        const expectedData = `${txn.walletId}_${Math.abs(txn.amount)}_${txn.transactionType}_${prevHash}`;
        const calculatedHash = await sha256(expectedData);

        if (calculatedHash !== txn.hash) {
          console.warn("Tamper detected on transaction:", txn.id, "Expected:", calculatedHash, "Found:", txn.hash);
          isValid = false;
          break;
        }
        prevHash = txn.hash;
      }
      setIsLedgerSecure(isValid);
    } catch (err) {
      console.error("Ledger audit failed:", err);
      setIsLedgerSecure(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?redirect=/profile/wallet");
      return;
    }
    loadWalletData();
  }, [user, authLoading]);

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) + " • " + date.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    } catch (e) {
      return "Recently";
    }
  };

  const formatExpiry = (isoStr?: string | null) => {
    if (!isoStr) return "";
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch (e) {
      return "";
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center w-full max-w-md mx-auto p-6">
        <RefreshCw className="animate-spin text-pink-500 mb-2" size={24} />
        <span className="text-sm text-gray-500 font-medium">Auditing Ledger & Syncing Balance...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-20">
      
      {/* Header */}
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.push("/profile")} className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">My Wallet</h1>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        
        {/* Stylized Card Graphic */}
        <div className="relative rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 p-6 text-white shadow-xl overflow-hidden border border-sky-300/30">
          {/* Decorative shapes */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black text-white tracking-widest uppercase">CRAFT STYLE</span>
              <p className="text-[9px] text-sky-100">Virtual Rewards & Loyalty</p>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/20 text-[9px] font-bold flex items-center gap-1">
              <Sparkles size={10} className="text-amber-300 animate-pulse" />
              <span>PREMIUM</span>
            </div>
          </div>

          {/* Chip Graphic */}
          <div className="mt-8 w-10 h-7 bg-gradient-to-tr from-amber-350 via-yellow-100 to-amber-450 rounded-md relative overflow-hidden shadow-inner flex flex-col justify-between p-1.5 border border-amber-600/20">
            <div className="border-b border-amber-900/10 flex justify-between"><div className="w-1.5 border-r border-amber-900/10 h-1"></div><div className="w-1.5 border-l border-amber-900/10 h-1"></div></div>
            <div className="flex justify-between"><div className="w-2 border-r border-amber-900/10 h-1.5"></div><div className="w-2 border-l border-amber-900/10 h-1.5"></div></div>
          </div>

          <div className="mt-6 flex justify-between items-end relative z-10">
            <div className="space-y-0.5">
              <span className="text-sky-100 text-[9px] uppercase tracking-wider block">Available Balance</span>
              <span className="text-3xl font-black text-white tracking-tight">₹{balance}</span>
            </div>
            <div className="text-right">
              <span className="text-sky-100 text-[8px] uppercase tracking-widest block">Card Member</span>
              <span className="text-xs font-bold text-white uppercase truncate max-w-[120px] block">
                {user?.displayName || user?.email?.split("@")[0] || "Customer"}
              </span>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-white/20 flex justify-between items-center text-[9px] text-sky-100 font-mono">
            <span>•••• •••• •••• {user?.uid ? user.uid.slice(-4).toUpperCase() : "8888"}</span>
            <span>SECURE WALLET</span>
          </div>
        </div>

        {/* Dynamic Security Verification Badge */}
        {isLedgerSecure !== null && (
          <div className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
            isLedgerSecure 
              ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
              : "bg-rose-50 border-rose-100 text-rose-800"
          }`}>
            {isLedgerSecure ? (
              <>
                <ShieldCheck className="text-emerald-600 flex-shrink-0" size={20} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">Secured & Audited</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Transaction history integrity verified using SHA-256 audit chaining.</p>
                </div>
              </>
            ) : (
              <>
                <ShieldAlert className="text-rose-600 flex-shrink-0" size={20} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">Audit Chain Warning</p>
                  <p className="text-[10px] text-rose-600 mt-0.5">Ledger mismatch detected. Some transaction rows could not be verified.</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Referral Program Info */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-2 text-gray-800">
            <Sparkles className="text-pink-500" size={18} />
            <h3 className="font-extrabold text-sm uppercase tracking-wide">Refer & Earn ₹50</h3>
          </div>
          
          <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2 select-none">
            <span className="text-[10px] uppercase font-bold text-sky-600 tracking-wider">Your Referral Code</span>
            <div className="flex items-center space-x-2.5">
              <span className="font-mono text-xl font-black text-blue-900 tracking-wider">{referralCode || "CRAFT50"}</span>
              <button 
                onClick={copyToClipboard}
                className="p-1.5 rounded-lg bg-white shadow-sm border border-gray-200 text-gray-500 hover:text-blue-600 active:scale-95 transition-all"
              >
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
            {copied && <span className="text-[10px] text-green-600 font-bold animate-fade-in">Copied to clipboard!</span>}
          </div>

          <button 
            onClick={shareViaWhatsApp}
            className="w-full bg-[#25D366] hover:bg-[#20ba5a] active:scale-[0.98] font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-white shadow-sm"
          >
            <MessageCircle size={14} className="fill-current" />
            SHARE VIA WHATSAPP
          </button>

          <div className="space-y-3">
            <span className="text-xs font-bold text-gray-700 block">How it works:</span>
            <ul className="space-y-2.5 text-xs text-gray-600">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-pink-100 text-pink-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <span>Share your code with friends who are not registered on Craft Style.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-pink-100 text-pink-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <span>Your friend enters your code in the **Referral Code** field during sign up.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-pink-100 text-pink-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <span>Once signed up, **both you and your friend** instantly receive ₹50 in your wallets!</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Passbook Section */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider">Transaction Passbook</h3>
          
          {transactions.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-500 flex flex-col items-center">
              <Wallet size={36} className="text-gray-300 mb-2" />
              <p className="text-sm font-semibold">No transactions yet</p>
              <p className="text-xs text-gray-400 mt-1">Check back when you receive cashback or place orders.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((txn) => {
                const isCredit = txn.transactionType === "CREDIT";
                const absoluteAmount = Math.abs(txn.amount);
                
                return (
                  <div key={txn.id} className="bg-white border border-gray-150 rounded-xl p-4 flex justify-between items-start shadow-sm group hover:border-gray-300 transition-all select-none">
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isCredit 
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                          : "bg-rose-50 text-rose-600 border border-rose-100"
                      }`}>
                        {isCredit ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                      </div>

                      {/* Details */}
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-bold text-gray-900 leading-tight">{txn.description}</h4>
                        <p className="text-[10px] text-gray-400 font-mono tracking-tight">{formatDate(txn.createdAt)}</p>
                        
                        {txn.source === "CASHBACK" && txn.status === "Active" && txn.expiresAt && (
                          <span className="inline-block text-[9px] bg-amber-50 border border-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-md mt-1 animate-pulse">
                            🎒 Expires: {formatExpiry(txn.expiresAt)}
                          </span>
                        )}
                        {txn.status === "Expired" && (
                          <span className="inline-block text-[9px] bg-gray-100 text-gray-500 font-medium px-2 py-0.5 rounded-md mt-1 uppercase">
                            Expired
                          </span>
                        )}
                        {txn.status === "Used" && (
                          <span className="inline-block text-[9px] bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded-md mt-1 uppercase">
                            Used
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      <span className={`text-sm font-extrabold block ${
                        isCredit ? "text-green-600" : "text-gray-900"
                      }`}>
                        {isCredit ? "+" : "-"} ₹{absoluteAmount}
                      </span>
                      <span className="text-[8px] font-mono text-gray-400 uppercase tracking-widest block mt-1">
                        #{txn.referenceId ? txn.referenceId.slice(-6).toUpperCase() : "TXN"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
