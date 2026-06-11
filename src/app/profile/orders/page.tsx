"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ChevronLeft, Package, Truck, CheckCircle, XCircle, Clock, X, Upload, AlertTriangle } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function CustomerOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Return & Refund States
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  
  const [returnType, setReturnType] = useState<"Refund" | "Replacement">("Refund");
  const [returnReason, setReturnReason] = useState("Damaged/Defective");
  const [comments, setComments] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const isReturnEligible = (order: any) => {
    if (order.status !== "Delivered") return false;
    
    // Check if within 14 days
    let orderTime = Date.now();
    if (order.createdAt) {
      if (typeof order.createdAt.toMillis === "function") {
        orderTime = order.createdAt.toMillis();
      } else if (order.createdAt.seconds) {
        orderTime = order.createdAt.seconds * 1000;
      } else {
        const parsed = new Date(order.createdAt).getTime();
        if (!isNaN(parsed)) orderTime = parsed;
      }
    }
    
    const elapsed = Date.now() - orderTime;
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    return elapsed <= fourteenDays;
  };

  const openReturnPanel = (order: any, item: any, index: number) => {
    setSelectedOrder(order);
    setSelectedItem(item);
    setSelectedItemIndex(index);
    setReturnType("Refund");
    setReturnReason("Damaged/Defective");
    setComments("");
    setProofUrl("");
    setShowReturnModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      
      const res = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        setProofUrl(data.data.url);
      } else {
        alert("Image upload failed: " + (data.error?.message || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading image");
    } finally {
      setUploadingProof(false);
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !selectedItem || selectedItemIndex === null || !user) return;
    
    setSubmittingReturn(true);
    try {
      const payload = {
        orderId: selectedOrder.id,
        itemIndex: selectedItemIndex,
        userId: user.uid,
        customerName: selectedOrder.customerName || user.displayName || user.email?.split("@")[0] || "Customer",
        customerEmail: selectedOrder.customerEmail || user.email || "",
        requestType: returnType,
        reason: returnReason,
        comments,
        proofUrl
      };

      const res = await fetch("/api/return-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit return request.");
      }

      // Update local state to reflect the change immediately
      const updatedOrders = orders.map(o => {
        if (o.id === selectedOrder.id) {
          const updatedItems = [...(o.items || [])];
          updatedItems[selectedItemIndex] = {
            ...updatedItems[selectedItemIndex],
            returnStatus: "Requested",
            returnRequestType: returnType
          };
          return { ...o, items: updatedItems };
        }
        return o;
      });
      setOrders(updatedOrders);

      // If mock order, save back to localStorage
      if (selectedOrder.id.startsWith("mock_")) {
        try {
          const localOrders = JSON.parse(localStorage.getItem("neelsutra_local_orders") || "[]");
          const updatedLocal = localOrders.map((o: any) => {
            if (o.id === selectedOrder.id) {
              const updatedItems = [...(o.items || [])];
              updatedItems[selectedItemIndex] = {
                ...updatedItems[selectedItemIndex],
                returnStatus: "Requested",
                returnRequestType: returnType
              };
              return { ...o, items: updatedItems };
            }
            return o;
          });
          localStorage.setItem("neelsutra_local_orders", JSON.stringify(updatedLocal));

          // Also save a mock return request in localStorage for Admin Returns Workspace
          const localReturns = JSON.parse(localStorage.getItem("neelsutra_local_return_requests") || "[]");
          const newLocalReturn = {
            id: `mock_return_${Date.now()}`,
            orderId: selectedOrder.id,
            itemIndex: selectedItemIndex,
            userId: user.uid,
            customerName: selectedOrder.customerName || user.displayName || user.email?.split("@")[0] || "Customer",
            customerEmail: selectedOrder.customerEmail || user.email || "",
            requestType: returnType,
            reason: returnReason,
            comments,
            proofUrl,
            status: "Pending",
            createdAt: new Date().toISOString(),
            itemDetails: selectedItem
          };
          localStorage.setItem("neelsutra_local_return_requests", JSON.stringify([newLocalReturn, ...localReturns]));
        } catch (e) {
          console.error("Failed to update local orders in localStorage", e);
        }
      }
      
      alert(`Return/Refund request for "${selectedItem.brand}" submitted successfully!`);
      setShowReturnModal(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error submitting request. Please try again.");
    } finally {
      setSubmittingReturn(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      try {
        // 1. Get local storage orders
        let localOrdersData: any[] = [];
        try {
          const localOrders = localStorage.getItem("neelsutra_local_orders");
          if (localOrders) {
            const parsed = JSON.parse(localOrders);
            localOrdersData = parsed.filter((o: any) => o.userId === user.uid);
          }
        } catch (e) {
          console.error("Failed to parse local orders", e);
        }

        // 2. Fetch from Firestore
        let remoteOrdersData: any[] = [];
        try {
          const q = query(collection(db, "orders"), where("userId", "==", user.uid));
          const querySnapshot = await getDocs(q);
          
          remoteOrdersData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (err) {
          console.error("Error fetching remote orders:", err);
        }

        // 3. Combine and sort
        const allOrders = [...localOrdersData, ...remoteOrdersData];
        
        allOrders.sort((a, b) => {
          let timeA = 0;
          let timeB = 0;

          if (a.createdAt) {
            if (typeof a.createdAt.toMillis === "function") {
              timeA = a.createdAt.toMillis();
            } else if (a.createdAt.seconds) {
              timeA = a.createdAt.seconds * 1000;
            } else {
              const parsedDate = new Date(a.createdAt);
              timeA = isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
            }
          }
          if (b.createdAt) {
            if (typeof b.createdAt.toMillis === "function") {
              timeB = b.createdAt.toMillis();
            } else if (b.createdAt.seconds) {
              timeB = b.createdAt.seconds * 1000;
            } else {
              const parsedDate = new Date(b.createdAt);
              timeB = isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
            }
          }
          return timeB - timeA;
        });

        setOrders(allOrders);
      } catch (err) {
        console.error("Error fetching orders:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  const formatOrderDate = (createdAt: any) => {
    if (!createdAt) return "Recently";
    
    if (typeof createdAt.toDate === "function") {
      return createdAt.toDate().toLocaleDateString();
    }
    
    if (createdAt.seconds) {
      return new Date(createdAt.seconds * 1000).toLocaleDateString();
    }
    
    const dateParsed = new Date(createdAt);
    if (!isNaN(dateParsed.getTime())) {
      return dateParsed.toLocaleDateString();
    }

    return "Recently";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pending": return <Clock size={16} className="text-orange-500" />;
      case "Shipped": return <Truck size={16} className="text-blue-500" />;
      case "Delivered": return <CheckCircle size={16} className="text-green-500" />;
      case "Cancelled": return <XCircle size={16} className="text-red-500" />;
      default: return <Package size={16} className="text-gray-500" />;
    }
  };

  if (!user) {
    return null; // AuthContext redirect will handle this
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-24">
      {/* Header */}
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">My Orders</h1>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center mt-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Package size={28} className="text-gray-400" />
            </div>
            <h2 className="font-bold text-gray-900 mb-2">No orders found</h2>
            <p className="text-sm text-gray-500 mb-6">Looks like you haven't placed an order yet.</p>
            <button 
              onClick={() => router.push("/")}
              className="px-6 py-2 border-2 border-pink-500 text-pink-600 font-bold rounded-md hover:bg-slate-50 transition-colors text-sm"
            >
              START SHOPPING
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                {/* Order Status & ID */}
                <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-500 uppercase">Order ID</span>
                    <span className="text-sm font-mono font-medium text-gray-900">{order.id.slice(-8).toUpperCase()}</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold border
                    ${order.status === 'Pending' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                      order.status === 'Shipped' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      order.status === 'Delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-red-50 text-red-700 border-red-200'}
                  `}>
                    {getStatusIcon(order.status)}
                    <span>{order.status}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="p-4">
                  <div className="space-y-4 mb-4">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                        <div className="flex items-center space-x-3">
                          <img src={item.image} alt={item.brand} className="w-12 h-16 object-cover rounded border border-gray-100" />
                          <div className="flex-1">
                            <h3 className="font-bold text-sm text-gray-900">{item.brand}</h3>
                            <p className="text-xs text-gray-500 truncate w-48">{item.title}</p>
                            <div className="flex space-x-2 mt-1">
                              <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                              {item.size && <p className="text-xs text-gray-500">Size: <span className="font-bold">{item.size}</span></p>}
                            </div>
                          </div>
                          <div className="font-bold text-sm text-gray-900">
                            ₹{item.price}
                          </div>
                        </div>
                        
                        {/* Return/Refund Status and Action */}
                        {order.status === "Delivered" && (
                          <div className="mt-2.5 flex justify-end items-center">
                            {item.returnStatus ? (
                              <div className={`px-2.5 py-1 rounded text-[10px] font-bold border uppercase tracking-wider
                                ${item.returnStatus === 'Requested' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  item.returnStatus === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' :
                                  'bg-red-50 text-red-700 border-red-200'}
                              `}>
                                {item.returnRequestType === 'Refund' ? 'Refund' : 'Replacement'} {item.returnStatus}
                              </div>
                            ) : isReturnEligible(order) ? (
                              <button
                                onClick={() => openReturnPanel(order, item, idx)}
                                className="text-[11px] font-bold text-pink-600 bg-pink-50 hover:bg-pink-100 border border-pink-100 px-3 py-1.5 rounded transition-all cursor-pointer uppercase tracking-wider"
                              >
                                Return or Refund
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Return window closed</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                    <span className="text-sm text-gray-500">Ordered on: {formatOrderDate(order.createdAt)}</span>
                    <div className="text-right">
                      <span className="text-xs text-gray-500 mr-2">Total Amount:</span>
                      <span className="font-bold text-gray-900">₹{order.totalAmount}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Return/Refund Panel Modal */}
      {showReturnModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-gray-150 flex flex-col relative max-h-[90vh] animate-scale-in">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-sm text-gray-900 uppercase tracking-wide">Initiate Return / Refund</h2>
              <button 
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                disabled={submittingReturn}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Product Info Summary */}
              <div className="bg-slate-50 p-3 rounded-xl flex items-center space-x-3 border border-slate-100">
                <img src={selectedItem.image} alt={selectedItem.brand} className="w-10 h-14 object-cover rounded border border-gray-200" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-gray-900 truncate">{selectedItem.brand}</h4>
                  <p className="text-[10px] text-gray-500 truncate">{selectedItem.title}</p>
                  <p className="text-[10px] text-gray-500 mt-1">Price: <span className="font-bold text-gray-800">₹{selectedItem.price}</span> | Size: <span className="font-bold text-gray-800">{selectedItem.size || 'N/A'}</span></p>
                </div>
              </div>

              {/* Request Type */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">What do you request? *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReturnType("Refund")}
                    className={`py-2.5 text-xs font-bold border rounded-lg transition-all cursor-pointer uppercase tracking-wider
                      ${returnType === "Refund" 
                        ? "border-pink-500 bg-pink-50/10 text-pink-600 shadow-sm" 
                        : "border-gray-200 text-gray-500 bg-white hover:border-gray-300"}`}
                  >
                    Return & Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnType("Replacement")}
                    className={`py-2.5 text-xs font-bold border rounded-lg transition-all cursor-pointer uppercase tracking-wider
                      ${returnType === "Replacement" 
                        ? "border-pink-500 bg-pink-50/10 text-pink-600 shadow-sm" 
                        : "border-gray-200 text-gray-500 bg-white hover:border-gray-300"}`}
                  >
                    Replacement
                  </button>
                </div>
              </div>

              {/* Reason for Return */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Reason for Return *</label>
                <select
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs focus:ring-1 focus:ring-pink-500 outline-none text-gray-800 bg-white font-medium cursor-pointer"
                >
                  <option value="Damaged/Defective">Damaged or Defective Item (arrived broken/spoiled)</option>
                  <option value="Buyer Remorse">Buyer Remorse (changed mind, incorrect specs)</option>
                  <option value="Size/Fit">Incorrect Size or Fit</option>
                  <option value="Other">Other Reason</option>
                </select>
              </div>

              {/* Policy-specific Alert Box */}
              <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3.5 flex items-start space-x-2.5">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 leading-relaxed font-medium">
                  {returnReason === "Damaged/Defective" && (
                    <span><strong>Policy Note:</strong> Damaged/defective claims must be reported within 48 hours of delivery. Photographic or video proof is strictly required for merchant-fault approval.</span>
                  )}
                  {returnReason === "Buyer Remorse" && (
                    <span><strong>Policy Note:</strong> For buyer remorse claims, you are responsible for paying all return shipping/freight. A 15% restocking fee will be deducted for heavy/bulk cargo returned items.</span>
                  )}
                  {returnReason !== "Damaged/Defective" && returnReason !== "Buyer Remorse" && (
                    <span><strong>Policy Note:</strong> Items must be returned unused, unaltered, in the original packaging, and within the 14-day window to be eligible for refund.</span>
                  )}
                </div>
              </div>

              {/* Proof Upload (simulated) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  Attach Photo Proof {returnReason === "Damaged/Defective" ? "*" : "(Optional)"}
                </label>
                <div className="flex items-center space-x-3">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-pink-500 rounded-xl p-3 w-28 h-20 cursor-pointer transition-all bg-slate-50 text-gray-500">
                    <Upload size={16} />
                    <span className="text-[9px] font-bold uppercase tracking-wider mt-1 text-center">Choose File</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                      required={returnReason === "Damaged/Defective" && !proofUrl}
                      disabled={uploadingProof || submittingReturn}
                    />
                  </label>

                  {uploadingProof && (
                    <div className="flex items-center space-x-1.5 text-xs text-gray-500 font-medium">
                      <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Uploading...</span>
                    </div>
                  )}

                  {proofUrl && !uploadingProof && (
                    <div className="relative w-24 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm group bg-white">
                      <img src={proofUrl} alt="Upload preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => setProofUrl("")}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors cursor-pointer"
                        title="Remove image"
                        disabled={submittingReturn}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Comments */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Comments & details *</label>
                <textarea
                  required
                  placeholder="Explain why you are returning this product (e.g. details of damage, fit issues)..."
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-pink-500 outline-none text-gray-900 resize-none font-medium"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  disabled={submittingReturn}
                  className="flex-1 py-3 text-xs font-bold text-gray-500 border border-gray-300 rounded-xl hover:bg-slate-50 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReturn || uploadingProof}
                  className="flex-1 py-3 text-xs font-bold text-white bg-pink-500 hover:bg-pink-600 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 uppercase tracking-wider cursor-pointer disabled:opacity-70"
                >
                  {submittingReturn ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
