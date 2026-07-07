"use client";

import { useState, useEffect } from "react";
import { Coins, HelpCircle, Save, ShieldAlert, Sparkles, RefreshCw, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function AdminWalletSettings() {
  const { user } = useAuth();
  
  // Rules Config State
  const [signupBonus, setSignupBonus] = useState(100);
  const [referralBonus, setReferralBonus] = useState(50);
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

  // Ledger Auditing State
  const [users, setUsers] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerForAudit, setSelectedCustomerForAudit] = useState<any | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/wallet/admin-settings");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setSignupBonus(data.settings.signupBonus);
          setReferralBonus(data.settings.referralBonus !== undefined ? data.settings.referralBonus : 50);
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
      const walletsList: any[] = [];
      let circulation = 0;
      walletsSnap.forEach(doc => {
        const data = doc.data();
        circulation += (data.balance || 0);
        walletsList.push({
          id: doc.id,
          ...data
        });
      });
      setWallets(walletsList);
      setTotalCirculation(circulation);

      // Summarize transactions
      const txnsSnap = await getDocs(collection(db, "wallet_transactions"));
      const txnsList: any[] = [];
      let credited = 0;
      let debited = 0;
      let expired = 0;

      txnsSnap.forEach(doc => {
        const data = doc.data();
        const amt = Number(data.amount || 0);
        txnsList.push({
          id: doc.id,
          ...data
        });
        if (data.transactionType === "CREDIT") {
          credited += amt;
        } else if (data.transactionType === "DEBIT") {
          debited += Math.abs(amt);
          if (data.source === "EXPIRY") {
            expired += Math.abs(amt);
          }
        }
      });
      setTransactions(txnsList);
      setTotalCredited(credited);
      setTotalDebited(debited);
      setTotalExpired(expired);

      // Fetch users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersList: any[] = [];
      usersSnap.forEach(doc => {
        usersList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setUsers(usersList);
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
          referralBonus,
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

  // Combine users, wallets and transactions
  const getMappedLedger = () => {
    const customersList: any[] = users.map(u => {
      const wallet = wallets.find(w => w.id === u.id);
      const userTxns = transactions.filter(t => t.walletId === u.id);
      
      const sortedTxns = [...userTxns].sort((a, b) => {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      const totalCredit = userTxns
        .filter(t => t.transactionType === "CREDIT")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const totalDebit = userTxns
        .filter(t => t.transactionType === "DEBIT")
        .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

      return {
        id: u.id,
        name: u.name || "Customer",
        email: u.email || "",
        balance: wallet?.balance || 0,
        totalCredit,
        totalDebit,
        transactions: sortedTxns,
      };
    });

    // Check for orphan wallets
    wallets.forEach(w => {
      const exists = customersList.some(c => c.id === w.id);
      if (!exists) {
        const userTxns = transactions.filter(t => t.walletId === w.id);
        const sortedTxns = [...userTxns].sort((a, b) => {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

        const totalCredit = userTxns
          .filter(t => t.transactionType === "CREDIT")
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        const totalDebit = userTxns
          .filter(t => t.transactionType === "DEBIT")
          .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

        customersList.push({
          id: w.id,
          name: "Unknown / Guest User",
          email: w.id,
          balance: w.balance || 0,
          totalCredit,
          totalDebit,
          transactions: sortedTxns,
        });
      }
    });

    return customersList;
  };

  const filteredCustomers = getMappedLedger().filter(cust => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      cust.name.toLowerCase().includes(q) ||
      cust.email.toLowerCase().includes(q) ||
      cust.id.toLowerCase().includes(q)
    );
  });

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
                  <span title="Credited automatically when a user opens their wallet for the first time.">
                    <HelpCircle size={12} className="text-slate-500 cursor-help" />
                  </span>
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

              {/* Referral Bonus */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  Referral Reward Amount (₹)
                  <span title="Credited to the referrer when a new customer registers with their referral code.">
                    <HelpCircle size={12} className="text-slate-500 cursor-help" />
                  </span>
                </label>
                <input 
                  type="number"
                  min={0}
                  value={referralBonus}
                  onChange={e => setReferralBonus(Number(e.target.value))}
                  className="w-full bg-slate-900/60 border border-slate-800 focus:border-pink-500 outline-none px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-white"
                  required
                />
                <span className="text-[10px] text-slate-500 block">Reward issued to the referring customer.</span>
              </div>

              {/* Cashback Percent */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  Order Cashback Percentage (%)
                  <span title="The percentage of order total to reward as cashback points when the order becomes Delivered.">
                    <HelpCircle size={12} className="text-slate-500 cursor-help" />
                  </span>
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
                  <span title="The maximum cashback amount that can be earned in a single transaction, regardless of order total.">
                    <HelpCircle size={12} className="text-slate-500 cursor-help" />
                  </span>
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
                  <span title="Number of days before credit rewards expire. Expiry check runs daily.">
                    <HelpCircle size={12} className="text-slate-500 cursor-help" />
                  </span>
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

      {/* Customer Wallet Balances and Ledger Section */}
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-900 pb-4">
          <div>
            <h2 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
              <Coins className="text-pink-500" size={16} />
              Customer Wallet Ledger
            </h2>
            <p className="text-slate-400 text-[10px] mt-0.5">
              Detailed points breakdown, ledger auditing, and issue/expiry logs for individual customers.
            </p>
          </div>
          <div className="w-full md:w-72 relative">
            <input 
              type="text"
              placeholder="Search by customer name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 focus:border-pink-500 outline-none pl-9 pr-4 py-2.5 rounded-xl text-xs font-semibold text-white placeholder-slate-500"
            />
            <div className="absolute left-3 top-3 text-slate-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Customer Wallets Table */}
        {statsLoading ? (
          <div className="flex justify-center items-center py-12 text-slate-400">
            <RefreshCw className="animate-spin text-pink-500 mr-2" size={18} />
            <span className="text-xs">Loading ledger details...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 uppercase text-[9px] font-bold tracking-wider">
                  <th className="pb-3 pl-2">Customer Info</th>
                  <th className="pb-3 text-right">Points Balance</th>
                  <th className="pb-3 text-right">Total Credited</th>
                  <th className="pb-3 text-right">Total Debited</th>
                  <th className="pb-3 text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No customers found matching "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(cust => (
                    <tr key={cust.id} className="border-b border-slate-900/50 hover:bg-slate-900/10 transition-colors">
                      <td className="py-3.5 pl-2">
                        <div className="font-bold text-slate-200">{cust.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{cust.email}</div>
                      </td>
                      <td className="py-3.5 text-right font-black text-white">
                        ₹{cust.balance}
                      </td>
                      <td className="py-3.5 text-right text-emerald-400 font-semibold">
                        +₹{cust.totalCredit}
                      </td>
                      <td className="py-3.5 text-right text-rose-400/80 font-semibold">
                        -₹{cust.totalDebit}
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForAudit(cust)}
                          className="bg-slate-900 hover:bg-slate-800 text-pink-500 hover:text-pink-400 border border-slate-800 font-extrabold text-[10px] px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          AUDIT HISTORY
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Audit Modal */}
      {selectedCustomerForAudit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-900 w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-scale-in max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-900 flex justify-between items-center bg-slate-950">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Audit Ledger: {selectedCustomerForAudit.name}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{selectedCustomerForAudit.email}</p>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedCustomerForAudit(null)}
                className="text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 p-1.5 rounded-lg transition-all cursor-pointer border border-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Stats Summary */}
            <div className="grid grid-cols-3 bg-slate-900/30 border-b border-slate-900 p-4 text-center">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Current Balance</span>
                <span className="text-sm font-black text-white block mt-1">₹{selectedCustomerForAudit.balance}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Total Credited</span>
                <span className="text-sm font-bold text-emerald-400 block mt-1">+₹{selectedCustomerForAudit.totalCredit}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Total Debited</span>
                <span className="text-sm font-bold text-rose-400 block mt-1">-₹{selectedCustomerForAudit.totalDebit}</span>
              </div>
            </div>

            {/* Modal Body: Transactions list */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {selectedCustomerForAudit.transactions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No point transactions recorded for this customer.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCustomerForAudit.transactions.map((txn: any) => (
                    <div key={txn.id} className="bg-slate-950 border border-slate-900 p-4 rounded-xl flex justify-between items-center gap-4 hover:border-slate-800 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md tracking-wide uppercase ${
                            txn.transactionType === "CREDIT" 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}>
                            {txn.transactionType}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {txn.source}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-semibold">{txn.description || "No description provided."}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-500">
                          <span>Created: {new Date(txn.createdAt).toLocaleString()}</span>
                          {txn.expiresAt && (
                            <span className={txn.status === "Expired" ? "text-rose-500/70" : "text-amber-500/80"}>
                              Expires: {new Date(txn.expiresAt).toLocaleDateString()} {txn.status === "Expired" && "(Lapsed)"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black ${
                          txn.transactionType === "CREDIT" ? "text-emerald-400" : "text-rose-400"
                        }`}>
                          {txn.transactionType === "CREDIT" ? "+" : "-"}₹{Math.abs(txn.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
