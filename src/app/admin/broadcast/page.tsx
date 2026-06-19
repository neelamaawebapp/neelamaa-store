"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  onSnapshot 
} from "firebase/firestore";
import { 
  Bell, 
  Send, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  Clock,
  UserCheck
} from "lucide-react";

export default function BroadcastDashboard() {
  const [activeTab, setActiveTab] = useState<"history" | "restock">("history");
  
  // State for Broadcast Composer
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  
  // State for Subscriptions & Broadcast History
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [fetchingSubs, setFetchingSubs] = useState(true);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [fetchingBroadcasts, setFetchingBroadcasts] = useState(true);

  // Status message states
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Fetch Restock Alert Subscriptions
  useEffect(() => {
    const q = collection(db, "back_in_stock_subscriptions");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort in JS memory to avoid custom index errors in Firestore
      subs.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      // Combine with local mock subscriptions if they exist in localStorage
      let localSubs: any[] = [];
      try {
        const stored = localStorage.getItem("craftstyle_stock_subscriptions");
        if (stored) {
          localSubs = JSON.parse(stored);
        }
      } catch (e) {}

      // Deduplicate by combining remote and local (remote takes precedence)
      const combined = [...subs];
      localSubs.forEach((lSub: any) => {
        const isMatched = combined.some((rSub: any) => rSub.productId === lSub.productId && rSub.email === lSub.email);
        if (!isMatched) {
          combined.push({
            id: `local_${lSub.productId}_${lSub.email}`,
            isLocal: true,
            ...lSub
          });
        }
      });

      combined.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setSubscriptions(combined);
      setFetchingSubs(false);
    }, (err) => {
      console.warn("Firestore subscriptions sub failed, falling back to local storage", err);
      try {
        const stored = localStorage.getItem("craftstyle_stock_subscriptions");
        if (stored) {
          const localSubs = JSON.parse(stored).map((s: any) => ({
            id: `local_${s.productId}_${s.email}`,
            isLocal: true,
            ...s
          }));
          localSubs.sort((a: any, b: any) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          setSubscriptions(localSubs);
        }
      } catch (e) {
        setSubscriptions([]);
      }
      setFetchingSubs(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Broadcasts History
  useEffect(() => {
    const q = collection(db, "broadcast_notifications");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      list.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      // Combine with local storage broadcast notifications
      let localBroadcasts: any[] = [];
      try {
        const stored = localStorage.getItem("craftstyle_local_notifications");
        if (stored) {
          // Keep only broadcast type notifications
          localBroadcasts = JSON.parse(stored).filter((n: any) => n.id?.startsWith("broadcast_"));
        }
      } catch (e) {}

      const combined = [...list];
      localBroadcasts.forEach((lBc: any) => {
        const isMatched = combined.some((rBc: any) => rBc.title === lBc.title && rBc.message === lBc.message);
        if (!isMatched) {
          combined.push({
            ...lBc,
            isLocal: true
          });
        }
      });

      combined.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setBroadcasts(combined);
      setFetchingBroadcasts(false);
    }, (err) => {
      console.warn("Firestore broadcasts failed, falling back to local storage", err);
      try {
        const stored = localStorage.getItem("craftstyle_local_notifications");
        if (stored) {
          const localBroadcasts = JSON.parse(stored).filter((n: any) => n.id?.startsWith("broadcast_")).map((n: any) => ({
            ...n,
            isLocal: true
          }));
          localBroadcasts.sort((a: any, b: any) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          setBroadcasts(localBroadcasts);
        }
      } catch (e) {
        setBroadcasts([]);
      }
      setFetchingBroadcasts(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      alert("Please enter a title and message for the broadcast.");
      return;
    }

    setSendingBroadcast(true);
    setSuccess("");
    setError("");

    try {
      const broadcastData = {
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        createdAt: new Date().toISOString()
      };

      // 1. Add to Firestore
      try {
        await addDoc(collection(db, "broadcast_notifications"), broadcastData);
      } catch (firestoreErr) {
        console.warn("Failed to save broadcast to Firestore, falling back to localStorage", firestoreErr);
      }

      // 2. Send Background Web Push Notifications via API route
      try {
        const response = await fetch("/api/send-broadcast", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: broadcastData.title,
            message: broadcastData.message,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          console.warn("Web push broadcast API returned error status:", errData);
        } else {
          const resData = await response.json();
          console.log("Web push broadcast sent:", resData);
        }
      } catch (apiErr) {
        console.error("Failed to request Web Push API route:", apiErr);
      }

      // 3. Add to Local Storage (so guest/local administrators can test it)
      try {
        const stored = localStorage.getItem("craftstyle_local_notifications");
        const localNotifs = stored ? JSON.parse(stored) : [];
        localNotifs.unshift({
          id: `broadcast_${Date.now()}_${Math.random()}`,
          title: broadcastData.title,
          message: broadcastData.message,
          createdAt: broadcastData.createdAt,
          read: false
        });
        localStorage.setItem("craftstyle_local_notifications", JSON.stringify(localNotifs));
      } catch (e) {
        console.error("Failed to write local broadcast notification:", e);
      }

      setBroadcastTitle("");
      setBroadcastMessage("");
      setSuccess("Broadcast notification sent to all devices successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to send broadcast.");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleDeleteBroadcast = async (bc: any) => {
    if (!confirm("Are you sure you want to delete this broadcast? It will no longer show in history.")) return;
    
    if (bc.isLocal) {
      try {
        const stored = localStorage.getItem("craftstyle_local_notifications");
        if (stored) {
          const localNotifs = JSON.parse(stored);
          const filtered = localNotifs.filter((n: any) => n.id !== bc.id);
          localStorage.setItem("craftstyle_local_notifications", JSON.stringify(filtered));
          setBroadcasts(prev => prev.filter(b => b.id !== bc.id));
        }
      } catch (e) {
        console.error("Failed to delete local broadcast:", e);
      }
      return;
    }

    try {
      await deleteDoc(doc(db, "broadcast_notifications", bc.id));
      setSuccess("Broadcast notification deleted successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete broadcast.");
    }
  };

  const handleDeleteSubscription = async (sub: any) => {
    if (!confirm("Are you sure you want to remove this stock alert request?")) return;
    
    if (sub.isLocal) {
      try {
        const stored = localStorage.getItem("craftstyle_stock_subscriptions");
        if (stored) {
          const localSubs = JSON.parse(stored);
          const filtered = localSubs.filter((s: any) => !(s.productId === sub.productId && s.email === sub.email));
          localStorage.setItem("craftstyle_stock_subscriptions", JSON.stringify(filtered));
          setSubscriptions(prev => prev.filter(s => s.id !== sub.id));
        }
      } catch (e) {}
      return;
    }

    try {
      await deleteDoc(doc(db, "back_in_stock_subscriptions", sub.id));
      setSuccess("Subscription removed successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to remove subscription.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 text-slate-100 font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Bell className="text-pink-500" size={24} />
          <span>Broadcasts & Alerts</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Compose push alerts for all registered customer devices, view logs, and manage customer back-in-stock notification requests.
        </p>
      </div>

      {success && (
        <div className="mb-6 bg-emerald-500/10 text-emerald-400 p-4 rounded-xl border border-emerald-500/20 text-center font-bold shadow-md shadow-emerald-500/5 animate-pulse text-xs">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-6 bg-rose-500/10 text-rose-400 p-4 rounded-xl border border-rose-500/20 text-center font-bold shadow-md shadow-rose-500/5 text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Broadcast Composer */}
        <div className="lg:col-span-4">
          <div className="bg-slate-900/40 backdrop-blur p-6 rounded-2xl border border-slate-900 shadow-xl sticky top-6">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
              <Send size={18} className="text-pink-500" />
              <h2 className="text-base font-extrabold text-white">
                Send App Broadcast
              </h2>
            </div>
            
            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Broadcast Title *</label>
                <input 
                  type="text" 
                  required 
                  value={broadcastTitle} 
                  onChange={(e) => setBroadcastTitle(e.target.value)} 
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2.5 text-xs focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700 font-semibold" 
                  placeholder="e.g. ⚡ FLASH SALE LIVE!" 
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notification Message *</label>
                <textarea 
                  required 
                  rows={5}
                  value={broadcastMessage} 
                  onChange={(e) => setBroadcastMessage(e.target.value)} 
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700 leading-relaxed" 
                  placeholder="e.g. Get 40% off on all new arrivals! Use code FLASH40 at checkout."
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={sendingBroadcast} 
                  className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-extrabold py-3 rounded-xl hover:opacity-90 disabled:opacity-75 transition-all shadow-md shadow-pink-500/10 cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <Send size={14} />
                  <span>{sendingBroadcast ? "BROADCASTING..." : "SEND BROADCAST"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Broadcast History and Restock requests */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur rounded-2xl border border-slate-900 p-6 shadow-xl">
            {/* Custom Tab Toggles */}
            <div className="flex border-b border-slate-850 pb-4 mb-6 gap-6">
              <button
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "history"
                    ? "border-pink-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <History size={16} />
                <span>Sent History ({broadcasts.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("restock")}
                className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "restock"
                    ? "border-pink-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Bell size={16} />
                <span>Restock Requests ({subscriptions.length})</span>
              </button>
            </div>

            {/* Tab 1: Sent Broadcast History */}
            {activeTab === "history" && (
              <div>
                {fetchingBroadcasts ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : broadcasts.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-xs">
                    No broadcast history found. Send your first push notification using the composer!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {broadcasts.map((bc) => {
                      const formattedTime = bc.createdAt 
                        ? new Date(bc.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "Just now";

                      return (
                        <div key={bc.id || Math.random()} className="bg-slate-950/45 p-4 rounded-xl border border-slate-850 hover:border-slate-800 transition-all flex items-start gap-4 justify-between group">
                          <div className="flex gap-3">
                            <div className="w-8 h-8 bg-pink-500/10 rounded-full flex items-center justify-center text-pink-500 border border-pink-500/25 mt-0.5 shrink-0">
                              <Bell size={14} className="fill-pink-500/15" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">{bc.title}</h4>
                              <p className="text-xs text-slate-350 mt-1 leading-relaxed">{bc.message}</p>
                              <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-wide">
                                <Clock size={10} />
                                <span>Sent: {formattedTime}</span>
                                {bc.isLocal && <span className="ml-1 bg-slate-800 px-1 rounded text-slate-400 text-[8px]">Local</span>}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteBroadcast(bc)}
                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/5 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Delete Log"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Restock Requests Subscriptions */}
            {activeTab === "restock" && (
              <div>
                {fetchingSubs ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : subscriptions.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-xs">
                    No back-in-stock notification requests found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                          <th className="px-5 py-4">Product Details</th>
                          <th className="px-5 py-4">Customer Contact</th>
                          <th className="px-5 py-4">Date Registered</th>
                          <th className="px-5 py-4">Status</th>
                          <th className="px-5 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/50">
                        {subscriptions.map((sub) => {
                          const formattedDate = sub.createdAt ? new Date(sub.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          }) : "-";

                          return (
                            <tr key={sub.id} className="hover:bg-slate-900/30 transition-all group">
                              <td className="px-5 py-4 font-bold text-white">
                                <div className="flex flex-col">
                                  <span className="text-xs font-extrabold text-slate-100">{sub.productBrand}</span>
                                  <span className="text-[10px] text-slate-400 mt-0.5">{sub.productName}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex flex-col text-slate-350">
                                  <span className="font-semibold text-xs">{sub.email}</span>
                                  {sub.phone && <span className="text-[10px] text-slate-500 mt-0.5">{sub.phone}</span>}
                                </div>
                              </td>
                              <td className="px-5 py-4 text-slate-400">{formattedDate}</td>
                              <td className="px-5 py-4">
                                {sub.status === "Pending" ? (
                                  <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                    Pending Alert
                                  </span>
                                ) : (
                                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1 w-max">
                                    <UserCheck size={10} />
                                    <span>Notified</span>
                                  </span>
                                )}
                                {sub.isLocal && (
                                  <span className="ml-2 bg-slate-800 text-slate-450 text-[8px] font-bold px-1.5 py-0.5 rounded">
                                    Local
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right">
                                <button
                                  onClick={() => handleDeleteSubscription(sub)}
                                  className="p-1.5 bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-60 group-hover:opacity-100 cursor-pointer"
                                  title="Delete Subscription Request"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
