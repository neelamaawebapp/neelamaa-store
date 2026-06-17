"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  RotateCcw, CheckCircle, XCircle, Clock, Search, X, 
  User, Mail, AlertCircle, RefreshCw, Eye 
} from "lucide-react";

export default function AdminReturns() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"All" | "Pending" | "Approved" | "Rejected">("Pending");
  
  // Image Preview Lightbox
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Subscribe to remote return requests from Firestore
    const q = query(collection(db, "returnRequests"), orderBy("createdAt", "desc"));
    const unsubscribeRequests = onSnapshot(q, (snapshot) => {
      const dbRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 2. Fetch local returns from localStorage
      let allRequests = [...dbRequests];
      if (typeof window !== "undefined") {
        try {
          const localReturnsStr = localStorage.getItem("craftstyle_local_return_requests");
          if (localReturnsStr) {
            const localRequests = JSON.parse(localReturnsStr);
            allRequests = [...localRequests, ...allRequests];
          }
        } catch (e) {
          console.error("Failed to parse local return requests", e);
        }
      }

      // Sort combined lists by createdAt desc
      allRequests.sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setRequests(allRequests);
      setLoading(false);
    }, (error) => {
      console.warn("Firestore returnRequests snapshot failed, checking local storage", error);
      // Fallback to local returns only
      if (typeof window !== "undefined") {
        try {
          const localReturnsStr = localStorage.getItem("craftstyle_local_return_requests");
          if (localReturnsStr) {
            const localRequests = JSON.parse(localReturnsStr);
            localRequests.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setRequests(localRequests);
          } else {
            setRequests([]);
          }
        } catch (e) {
          setRequests([]);
        }
      }
      setLoading(false);
    });

    return () => unsubscribeRequests();
  }, []);

  const handleAction = async (requestId: string, newStatus: "Approved" | "Rejected") => {
    if (!confirm(`Are you sure you want to mark this request as ${newStatus.toLowerCase()}?`)) return;

    setActionLoadingId(requestId);
    try {
      // Check if it's a mock request
      if (requestId.startsWith("mock_")) {
        // Handle mock request update in localStorage
        const localReturnsStr = localStorage.getItem("craftstyle_local_return_requests");
        if (localReturnsStr) {
          const localReturns = JSON.parse(localReturnsStr);
          let targetOrder: string = "";
          let targetIndex: number = -1;
          
          const updatedReturns = localReturns.map((r: any) => {
            if (r.id === requestId) {
              targetOrder = r.orderId;
              targetIndex = r.itemIndex;
              return { ...r, status: newStatus };
            }
            return r;
          });
          localStorage.setItem("craftstyle_local_return_requests", JSON.stringify(updatedReturns));

          // Also update the return status in local orders
          const localOrdersStr = localStorage.getItem("craftstyle_local_orders");
          if (localOrdersStr && targetOrder && targetIndex !== -1) {
            const localOrders = JSON.parse(localOrdersStr);
            const updatedOrders = localOrders.map((o: any) => {
              if (o.id === targetOrder) {
                const items = [...(o.items || [])];
                if (items[targetIndex]) {
                  items[targetIndex] = {
                    ...items[targetIndex],
                    returnStatus: newStatus
                  };
                }
                return { ...o, items };
              }
              return o;
            });
            localStorage.setItem("craftstyle_local_orders", JSON.stringify(updatedOrders));
          }

          // Trigger local state reload
          setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
          alert(`Return request successfully ${newStatus.toLowerCase()}!`);
        }
      } else {
        // Send actual PATCH request to Firestore API
        const res = await fetch("/api/return-refund", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnRequestId: requestId, status: newStatus })
        });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || "Failed to update return request.");
        }
        
        // Trigger local state reload
        setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
        alert(`Return request successfully ${newStatus.toLowerCase()}!`);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error processing status update.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pending": return <Clock size={14} className="text-orange-400" />;
      case "Approved": return <CheckCircle size={14} className="text-emerald-400" />;
      case "Rejected": return <XCircle size={14} className="text-rose-400" />;
      default: return null;
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "Pending": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "Approved": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Rejected": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default: return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const filteredRequests = requests.filter(req => {
    // 1. Search Query filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      req.id.toLowerCase().includes(searchLower) ||
      req.orderId.toLowerCase().includes(searchLower) ||
      req.customerName.toLowerCase().includes(searchLower) ||
      req.customerEmail.toLowerCase().includes(searchLower) ||
      (req.itemDetails?.brand && req.itemDetails.brand.toLowerCase().includes(searchLower)) ||
      (req.itemDetails?.title && req.itemDetails.title.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;

    // 2. Tab Filter
    if (filterTab === "All") return true;
    return req.status === filterTab;
  });

  return (
    <div className="max-w-6xl mx-auto text-slate-100 font-sans pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <RotateCcw className="text-pink-500" />
            <span>Returns & Refunds Workspace</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-semibold">
            Manage customer return requests, inspect item details, and approve replacements or refunds.
          </p>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 bg-slate-900/20 p-4 rounded-2xl border border-slate-900 justify-between items-center">
        {/* Tab List */}
        <div className="flex bg-slate-950/85 p-1 rounded-xl border border-slate-850 w-full md:w-auto overflow-x-auto">
          {(["Pending", "Approved", "Rejected", "All"] as const).map(tab => {
            const count = requests.filter(r => tab === "All" || r.status === tab).length;
            const isSelected = filterTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5
                  ${isSelected 
                    ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/15" 
                    : "text-slate-400 hover:text-slate-200"}`}
              >
                <span>{tab}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black
                  ${isSelected ? "bg-white/20 text-white" : "bg-slate-900 text-slate-500"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search returns, customer, order..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 pl-9 text-xs text-white focus:border-pink-500 outline-none font-medium placeholder-slate-500"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <Search size={14} />
          </div>
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Requests Display */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-slate-900/40 p-12 rounded-2xl border border-slate-900 text-center text-slate-500 shadow-md">
          No return requests found.
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredRequests.map((req) => (
            <div key={req.id} className="bg-slate-900/40 backdrop-blur rounded-2xl border border-slate-900 overflow-hidden shadow-lg hover:border-slate-800 transition-all flex flex-col">
              
              {/* Card Header */}
              <div className="bg-slate-950/60 p-4 border-b border-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex-shrink-0">REQUEST ID:</span>
                  <span className="text-xs font-mono font-bold text-white bg-slate-950 border border-slate-850 px-2 py-0.5 rounded uppercase truncate max-w-[120px]">{req.id}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex-shrink-0 ml-2">ORDER ID:</span>
                  <a href={`/admin/orders`} className="text-xs font-mono font-bold text-pink-400 hover:underline bg-slate-950 border border-slate-850 px-2 py-0.5 rounded uppercase truncate max-w-[120px]">{req.orderId}</a>
                  {req.id.startsWith("mock_") && (
                    <span className="text-[8px] bg-slate-800 text-slate-400 border border-slate-700 font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase ml-1">Sandbox Mock</span>
                  )}
                </div>
                <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end flex-shrink-0">
                  <span className="text-[10px] text-slate-500 font-semibold">
                    Submitted: {new Date(req.createdAt).toLocaleString()}
                  </span>
                  <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusStyles(req.status)}`}>
                    {getStatusIcon(req.status)}
                    <span className="uppercase tracking-wider text-[9px]">{req.status}</span>
                  </div>
                </div>
              </div>

              {/* Card Details Body */}
              <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                
                {/* Column 1: Customer Profile (4 cols) */}
                <div className="lg:col-span-4 flex flex-col space-y-3.5">
                  <div>
                    <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Customer Profile</h3>
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-900 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                        <User size={13} className="text-slate-500" />
                        <span>{req.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
                        <Mail size={13} className="text-slate-500" />
                        <span className="truncate">{req.customerEmail}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Claim Settings</h3>
                    <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Request Type:</span>
                        <span className="font-extrabold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20 text-[10px] uppercase tracking-wider">{req.requestType}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Reason:</span>
                        <span className="font-bold text-slate-300">{req.reason}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Product Specifications (4 cols) */}
                <div className="lg:col-span-4 flex flex-col">
                  <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Returned Product</h3>
                  {req.itemDetails ? (
                    <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 flex items-center space-x-3.5 flex-1">
                      <img src={req.itemDetails.image} alt={req.itemDetails.brand} className="w-12 h-16 object-cover rounded bg-slate-950 border border-slate-800 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-xs text-slate-100 truncate">{req.itemDetails.brand}</p>
                        <p className="text-slate-500 text-[10px] truncate mt-0.5">{req.itemDetails.title}</p>
                        <p className="text-slate-400 font-semibold text-[10px] mt-1.5">₹{req.itemDetails.price} | Qty: {req.itemDetails.quantity} {req.itemDetails.size && `| Size: ${req.itemDetails.size}`}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 flex items-center justify-center text-xs text-slate-500 italic flex-1">
                      <AlertCircle size={14} className="mr-1" />
                      <span>Item details not stored. Look up in order details.</span>
                    </div>
                  )}
                </div>

                {/* Column 3: Comments & Evidence (4 cols) */}
                <div className="lg:col-span-4 flex flex-col space-y-3">
                  <div>
                    <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Customer Comments</h3>
                    <p className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-900 leading-relaxed min-h-[50px] font-medium max-h-24 overflow-y-auto italic">
                      "{req.comments || "No explanation commented."}"
                    </p>
                  </div>
                  
                  {req.proofUrl && (
                    <div>
                      <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Photo Evidence / Proof</h3>
                      <div className="flex items-center gap-2">
                        <div 
                          onClick={() => setPreviewImage(req.proofUrl)}
                          className="relative w-16 h-12 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 cursor-pointer group hover:border-pink-500 transition-all flex-shrink-0 shadow-sm"
                          title="Click to preview evidence"
                        >
                          <img src={req.proofUrl} alt="Evidence thumbnail" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye size={12} />
                          </div>
                        </div>
                        <a 
                          href={req.proofUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] font-extrabold text-pink-400 hover:text-pink-300 transition-all uppercase tracking-wider flex items-center gap-1 hover:underline"
                        >
                          View Fullscreen
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Section Footer */}
              {req.status === "Pending" && (
                <div className="bg-slate-950/40 border-t border-slate-900 p-4 flex justify-end gap-3">
                  <button
                    onClick={() => handleAction(req.id, "Rejected")}
                    disabled={actionLoadingId !== null}
                    className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20 hover:border-rose-500/40 font-extrabold py-2 px-4 rounded-lg text-xs transition-all cursor-pointer uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Reject Request
                  </button>
                  <button
                    onClick={() => handleAction(req.id, "Approved")}
                    disabled={actionLoadingId !== null}
                    className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-extrabold py-2 px-4 rounded-lg text-xs transition-all cursor-pointer uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                  >
                    {actionLoadingId === req.id ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle size={14} />
                    )}
                    Approve Request
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Evidence Image Lightbox Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative max-w-3xl w-full max-h-[85vh] flex flex-col items-center bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 animate-scale-in">
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-black/70 hover:bg-black/90 text-white rounded-full p-2 border border-slate-800 transition-colors z-50 cursor-pointer"
            >
              <X size={20} />
            </button>
            <div className="w-full h-[75vh] flex justify-center items-center p-2">
              <img src={previewImage} alt="Return Evidence Fullscreen" className="max-w-full max-h-full object-contain rounded-lg border border-slate-900" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
