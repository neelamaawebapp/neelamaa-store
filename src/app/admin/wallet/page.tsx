"use client";

import { useState, useEffect } from "react";
import { Coins, HelpCircle, Save, ShieldAlert, Sparkles, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function AdminWalletSettings() {
  const { user } = useAuth();
  
  // Rules Config State
  const [signupBonus, setSignupBonus] = useState(50);
  const [cashbackPercent, setCashbackPercent] = useState(5);
  const [maxCashbackLimit, setMaxCashbackLimit] = useState(100);
  const [expiryDays, setExpiryDays] = useState(365);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // System Stats State
  const [totalCirculation, setTotalCirculation] = useState(0);
  const [totalCredited, setTotalCredited] = useState(0);
  const [totalDebited, setTotalDebited] = useState(0);
  const [totalExpired, setTotalExpired] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // Manual Expiry Run State
  const [cronRunning, setCronRunning] = useState(false);
  const [cronResult, setCronResult] = useState<any>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/wallet/admin-settings");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setSignupBonus(data.settings.signupBonus);
          setCashbackPercent(data.settings.cashbackPercent);
          setMaxCashbackLimit(data.settings.maxCashbackLimit);
          setExpiryDays(data.settings.expiryDays);
        }
      }
    } catch (err) {
      console.error("Error loading rules:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { getFirestore, collection, getDocs } = await import("firebase/firestore");
      const { app } = await import("@/lib/firebase");
      const db = getFirestore(app);

      // Sum all wallet balances
      const walletsSnap = await getDocs(collection(db, "wallets"));
      let circulation = 0;
      walletsSnap.forEach(doc => {
        circulation += (doc.data().balance || 0);
      });
      setTotalCirculation(circulation);

      // Summarize transactions
      const txnsSnap = await getDocs(collection(db, "wallet_transactions"));
      let credited = 0;
      let debited = 0;
      let expired = 0;

      txnsSnap.forEach(doc => {
        const data = doc.data();
        const amt = Number(data.amount || 0);
        if (data.transactionType === "CREDIT") {
          credited += amt;
        } else if (data.transactionType === "DEBIT") {
          debited += Math.abs(amt);
          if (data.source === "EXPIRY") {
            expired += Math.abs(amt);
          }
        }
      });

      setTotalCredited(credited);
      setTotalDebited(debited);
      setTotalExpired(expired);
    } catch (err) {
      console.error("Failed to load statistics:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchStats();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch("/api/wallet/admin-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupBonus,
          cashbackPercent,
          maxCashbackLimit,
          expiryDays
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || "Settings updated successfully!");
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        setErrorMsg(data.error || "Failed to update settings");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleRunExpiryCheck = async () => {
    setCronRunning(true);
    setCronResult(null);
    try {
      const res = await fetch("/api/wallet/cron-expire", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setCronResult(data);
        fetchStats(); // Refresh stats after changes
      } else {
        alert("Failed to run check: " + data.error);
      }
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setCronRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <RefreshCw className="animate-spin text-pink-500 mr-2" size={20} />
        <span>Loading Campaign Rules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl animate-fade-in text-slate-100">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Coins className="text-pink-500" size={26} />
            WALLET CAMPAIGN ENGINE
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Configure rules for virtual currency, signup bonuses, cashback thresholds, and points expiry cycles.
          </p>
        </div>
        <button 
          onClick={fetchStats}
          disabled={statsLoading}
          className="bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer text-slate-200"
        >
          <RefreshCw size={14} className={statsLoading ? "animate-spin text-pink-500" : ""} />
          REFRESH SYSTEM STATS
        </button>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-950/40 border border-slate-900 p-4.5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-pink-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">System Points Circulation</span>
          <span className="text-2xl font-black text-white mt-1.5 block">₹{statsLoading ? "..." : totalCirculation}</span>
          <span className="text-[9px] text-pink-400 font-medium mt-1 block">Active wallet balances</span>
        </div>
        <div className="bg-slate-950/40 border border-slate-900 p-4.5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Total Credit Issued</span>
          <span className="text-2xl font-black text-emerald-400 mt-1.5 block">₹{statsLoading ? "..." : totalCredited}</span>
          <span className="text-[9px] text-slate-500 font-medium mt-1 block">Signup bonus + Cashback</span>
        </div>
        <div className="bg-slate-950/40 border border-slate-900 p-4.5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Total Debit Redeemed</span>
          <span className="text-2xl font-black text-white mt-1.5 block">₹{statsLoading ? "..." : totalDebited}</span>
          <span className="text-[9px] text-slate-500 font-medium mt-1 block">Deducted for orders + expired</span>
        </div>
        <div className="bg-slate-950/40 border border-slate-900 p-4.5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Total Points Expired</span>
          <span className="text-2xl font-black text-rose-400 mt-1.5 block">₹{statsLoading ? "..." : totalExpired}</span>
          <span className="text-[9px] text-rose-500/70 font-medium mt-1 block">Debited automatically on expiry</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Rules Config Form */}
        <div className="lg:col-span-2 bg-slate-950/40 border border-slate-900 rounded-2xl p-6 relative">
          <h2 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2 mb-6">
            <Sparkles size={16} className="text-pink-500" />
            CAMPAIGN CONFIGURATION RULES
          </h2>

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-lg flex items-center gap-2 mb-6">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-3 rounded-lg flex items-center gap-2 mb-6">
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Signup Bonus */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  Verified Signup Bonus (₹)
                  <HelpCircle size={12} className="text-slate-500 cursor-help" title="Credited automatically when a user opens their wallet for the first time." />
                </label>
                <input 
                  type="number"
                  min={0}
                  value={signupBonus}
                  onChange={e => setSignupBonus(Number(e.target.value))}
                  className="w-full bg-slate-900/60 border border-slate-800 focus:border-pink-500 outline-none px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-white"
                  required
                />
                <span className="text-[10px] text-slate-500 block">Initial reward credited to new registrants.</span>
              </div>

              {/* Cashback Percent */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  Order Cashback Percentage (%)
                  <HelpCircle size={12} className="text-slate-500 cursor-help" title="The percentage of order total to reward as cashback points when the order becomes Delivered." />
                </label>
                <input 
                  type="number"
                  min={0}
                  max={100}
                  value={cashbackPercent}
                  onChange={e => setCashbackPercent(Number(e.target.value))}
                  className="w-full bg-slate-900/60 border border-slate-800 focus:border-pink-500 outline-none px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-white"
                  required
                />
                <span className="text-[10px] text-slate-500 block">Applied on successful delivery.</span>
              </div>

              {/* Max Cashback Limit */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  Max Cashback Limit per Order (₹)
                  <HelpCircle size={12} className="text-slate-500 cursor-help" title="The maximum cashback amount that can be earned in a single transaction, regardless of order total." />
                </label>
                <input 
                  type="number"
                  min={1}
                  value={maxCashbackLimit}
                  onChange={e => setMaxCashbackLimit(Number(e.target.value))}
                  className="w-full bg-slate-900/60 border border-slate-800 focus:border-pink-500 outline-none px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-white"
                  required
                />
                <span className="text-[10px] text-slate-500 block">Capping limit to protect system margins.</span>
              </div>

              {/* Expiry Days */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  Reward Expiry Cycle (Days)
                  <HelpCircle size={12} className="text-slate-500 cursor-help" title="Number of days before credit rewards expire. Expiry check runs daily." />
                </label>
                <input 
                  type="number"
                  min={1}
                  value={expiryDays}
                  onChange={e => setExpiryDays(Number(e.target.value))}
                  className="w-full bg-slate-900/60 border border-slate-800 focus:border-pink-500 outline-none px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-white"
                  required
                />
                <span className="text-[10px] text-slate-500 block">Points lapse after this duration.</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-900 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md shadow-pink-500/10 flex items-center gap-2 cursor-pointer text-white disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "SAVING..." : "SAVE CAMPAIGN CONFIG"}
              </button>
            </div>
          </form>
        </div>

        {/* Expiry Control Center */}
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
              <ShieldAlert size={16} className="text-orange-500" />
              SYSTEM CRON TASKS
            </h2>
            <p className="text-slate-400 text-xs leading-normal">
              Credits earned from cashback have expiry timelines. The system utilizes a daily points cleaner. You can manually force an audit search and expire points now.
            </p>

            <div className="bg-slate-900/60 border border-slate-800 p-4.5 rounded-xl text-xs space-y-1 text-slate-300">
              <p className="font-semibold text-slate-200">Daily Cron URL:</p>
              <code className="text-pink-400 block font-mono break-all py-1 select-all">/api/wallet/cron-expire</code>
              <p className="text-[10px] text-slate-500 mt-1">Can be scheduled using GitHub Actions, Vercel Cron, or any scheduling software.</p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-900/80 mt-6 space-y-4">
            {cronResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 animate-scale-in">
                <p className="font-bold text-emerald-400">Task Completed Successfully</p>
                <div className="mt-2 space-y-1">
                  <p>Transactions expired: <strong className="text-white">{cronResult.processedTransactions}</strong></p>
                  <p>Wallet points debited: <strong className="text-white">₹{cronResult.totalExpiredPointsDebited}</strong></p>
                </div>
              </div>
            )}

            <button
              onClick={handleRunExpiryCheck}
              disabled={cronRunning}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 font-bold text-xs py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 cursor-pointer text-slate-200 disabled:opacity-50"
            >
              <RefreshCw size={14} className={cronRunning ? "animate-spin text-pink-500" : ""} />
              {cronRunning ? "AUDITING LEDGER..." : "RUN EXPIRED POINTS CHECK"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
