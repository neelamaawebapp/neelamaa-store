"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ChevronLeft, Package, Truck, CheckCircle, XCircle, Clock, X, Upload, AlertTriangle, Camera, Image as ImageIcon, Copy, Edit, Phone, Mail, ExternalLink, MessageSquare, Check, HelpCircle } from "lucide-react";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
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

  // Order Tracking States
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<any>(null);
  const [copiedTrackingId, setCopiedTrackingId] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [showEditAddress, setShowEditAddress] = useState(false);
  const [editAddressText, setEditAddressText] = useState("");
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const getTrackingLink = (company: string, trackingNumber: string) => {
    if (!company || !trackingNumber) return "#";
    let link = `https://www.google.com/search?q=${encodeURIComponent(company + " tracking " + trackingNumber)}`;
    switch (company) {
      case "Delhivery": return `https://www.delhivery.com/track/package/${trackingNumber}`;
      case "BlueDart": return `https://www.bluedart.com/tracking`;
      case "DTDC": return `https://www.dtdc.in/tracking.asp`;
      case "FedEx": return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
      case "XpressBees": return `https://www.xpressbees.com/track?awb=${trackingNumber}`;
      case "Ecom Express": return `https://ecomexpress.in/tracking/?awb=${trackingNumber}`;
      case "India Post": return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
      case "Shadowfax": return `https://track.shadowfax.in/track?order=${trackingNumber}`;
    }
    return link;
  };

  const getOrderTime = (order: any) => {
    if (!order || !order.createdAt) return Date.now();
    if (typeof order.createdAt.toMillis === "function") {
      return order.createdAt.toMillis();
    }
    if (order.createdAt.seconds) {
      return order.createdAt.seconds * 1000;
    }
    const parsed = new Date(order.createdAt).getTime();
    return isNaN(parsed) ? Date.now() : parsed;
  };

  const formatTimelineDate = (dateVal: any) => {
    if (!dateVal) return "";
    let d = new Date();
    if (typeof dateVal.toDate === "function") {
      d = dateVal.toDate();
    } else if (dateVal.seconds) {
      d = new Date(dateVal.seconds * 1000);
    } else {
      const parsed = new Date(dateVal);
      if (isNaN(parsed.getTime())) return "";
      d = parsed;
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getEstimatedDeliveryDate = (createdAt: any, status: string) => {
    if (status === "Cancelled") return "N/A (Cancelled)";
    let orderTime = Date.now();
    if (createdAt) {
      if (typeof createdAt.toMillis === "function") {
        orderTime = createdAt.toMillis();
      } else if (createdAt.seconds) {
        orderTime = createdAt.seconds * 1000;
      } else {
        const parsed = new Date(createdAt).getTime();
        if (!isNaN(parsed)) orderTime = parsed;
      }
    }
    // Pending: 5 days, Shipped: 3 days, Delivered: 0 days
    const addedDays = status === "Pending" ? 5 : status === "Shipped" ? 3 : 0;
    const estDate = new Date(orderTime + addedDays * 24 * 60 * 60 * 1000);
    return estDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!user) return;
    setCancellingOrder(true);
    try {
      if (orderId.startsWith("mock_")) {
        // Mock order in local storage
        const localOrders = JSON.parse(localStorage.getItem("craftstyle_local_orders") || "[]");
        const updatedLocal = localOrders.map((o: any) => {
          if (o.id === orderId) {
            return { ...o, status: "Cancelled" };
          }
          return o;
        });
        localStorage.setItem("craftstyle_local_orders", JSON.stringify(updatedLocal));
      } else {
        // Remote order in Firestore
        await updateDoc(doc(db, "orders", orderId), { status: "Cancelled" });
      }

      // Update local state
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "Cancelled" } : o));
      if (trackingOrder && trackingOrder.id === orderId) {
        setTrackingOrder((prev: any) => ({ ...prev, status: "Cancelled" }));
      }
      setShowCancelConfirm(false);
      alert("Order has been cancelled successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to cancel order. Please try again.");
    } finally {
      setCancellingOrder(false);
    }
  };

  const handleUpdateAddress = async (orderId: string, newAddress: string) => {
    if (!newAddress.trim()) {
      alert("Address cannot be empty.");
      return;
    }
    setUpdatingAddress(true);
    try {
      if (orderId.startsWith("mock_")) {
        // Mock order in local storage
        const localOrders = JSON.parse(localStorage.getItem("craftstyle_local_orders") || "[]");
        const updatedLocal = localOrders.map((o: any) => {
          if (o.id === orderId) {
            return { ...o, address: newAddress };
          }
          return o;
        });
        localStorage.setItem("craftstyle_local_orders", JSON.stringify(updatedLocal));
      } else {
        // Remote order in Firestore
        await updateDoc(doc(db, "orders", orderId), { address: newAddress });
      }

      // Update local state
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, address: newAddress } : o));
      if (trackingOrder && trackingOrder.id === orderId) {
        setTrackingOrder((prev: any) => ({ ...prev, address: newAddress }));
      }
      setShowEditAddress(false);
      alert("Delivery address updated successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to update delivery address. Please try again.");
    } finally {
      setUpdatingAddress(false);
    }
  };

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
    
    if (returnReason === "Damaged/Defective" && !proofUrl) {
      alert("Please upload a photo proof for Damaged or Defective items.");
      return;
    }
    
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
          const localOrders = JSON.parse(localStorage.getItem("craftstyle_local_orders") || "[]");
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
          localStorage.setItem("craftstyle_local_orders", JSON.stringify(updatedLocal));

          // Also save a mock return request in localStorage for Admin Returns Workspace
          const localReturns = JSON.parse(localStorage.getItem("craftstyle_local_return_requests") || "[]");
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
          localStorage.setItem("craftstyle_local_return_requests", JSON.stringify([newLocalReturn, ...localReturns]));
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
          const localOrders = localStorage.getItem("craftstyle_local_orders");
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
                        <div 
                          className="flex items-center space-x-3 cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors"
                          onClick={() => {
                            setTrackingOrder(order);
                            setEditAddressText(order.address || "");
                            setShowTrackingModal(true);
                            setShowCancelConfirm(false);
                            setShowEditAddress(false);
                          }}
                        >
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
                  <div className="border-t border-gray-100 pt-3 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Ordered on: {formatOrderDate(order.createdAt)}</span>
                      <div className="text-right">
                        <span className="text-gray-500 mr-2">Total Amount:</span>
                        <span className="font-bold text-gray-900">₹{order.totalAmount}</span>
                      </div>
                    </div>

                    <div className="flex pt-1">
                      <button
                        onClick={() => {
                          setTrackingOrder(order);
                          setEditAddressText(order.address || "");
                          setShowTrackingModal(true);
                          setShowCancelConfirm(false);
                          setShowEditAddress(false);
                        }}
                        className="w-full bg-pink-500 text-white font-bold py-2.5 rounded-lg hover:bg-pink-600 transition-all text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Truck size={14} />
                        Track Order
                      </button>
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
                  {/* Gallery Button */}
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-pink-500 rounded-xl p-3 w-24 h-20 cursor-pointer transition-all bg-slate-50 text-gray-500 hover:text-pink-500">
                    <ImageIcon size={18} />
                    <span className="text-[9px] font-bold uppercase tracking-wider mt-1.5 text-center">Gallery</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                      disabled={uploadingProof || submittingReturn}
                    />
                  </label>

                  {/* Camera Button */}
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-pink-500 rounded-xl p-3 w-24 h-20 cursor-pointer transition-all bg-slate-50 text-gray-500 hover:text-pink-500">
                    <Camera size={18} />
                    <span className="text-[9px] font-bold uppercase tracking-wider mt-1.5 text-center">Camera</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      onChange={handleImageUpload} 
                      className="hidden" 
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
                    <div className="relative w-24 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm group bg-white">
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

      {/* Order Tracking Modal */}
      {showTrackingModal && trackingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-gray-150 flex flex-col relative max-h-[90vh] animate-scale-in">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="font-bold text-sm text-gray-900 uppercase tracking-wide">Track Your Order</h2>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {trackingOrder.id.slice(-8).toUpperCase()}</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowTrackingModal(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between
                ${trackingOrder.status === 'Pending' ? 'bg-orange-50/70 border-orange-100 text-orange-850' : 
                  trackingOrder.status === 'Shipped' ? 'bg-blue-50/70 border-blue-100 text-blue-850' :
                  trackingOrder.status === 'Delivered' ? 'bg-green-50/70 border-green-100 text-green-850' :
                  'bg-red-50/70 border-red-100 text-red-850'}
              `}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Current Status</p>
                  <h3 className="text-sm font-extrabold uppercase mt-0.5">{trackingOrder.status}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                    {trackingOrder.status === 'Delivered' ? 'Delivered On' : 'Estimated Delivery'}
                  </p>
                  <p className="text-xs font-bold mt-0.5">
                    {getEstimatedDeliveryDate(trackingOrder.createdAt, trackingOrder.status)}
                  </p>
                </div>
              </div>

              {/* Timeline Stepper */}
              {trackingOrder.status !== 'Cancelled' ? (
                <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-100/80 space-y-4">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Delivery Journey</h3>
                  <div className="relative pl-6 border-l-2 border-slate-200 ml-3 space-y-6 font-sans">
                    {/* Step 1: Placed */}
                    <div className="relative">
                      <span className="absolute -left-9 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white border-4 border-white shadow-sm">
                        <Check size={12} className="stroke-[3]" />
                      </span>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-bold text-xs text-gray-900">Order Placed</h4>
                          <p className="text-[10px] text-gray-500 mt-0.5">Your order was registered successfully.</p>
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold bg-white px-1.5 py-0.5 rounded border border-gray-150 shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0 ml-2">
                          {formatTimelineDate(trackingOrder.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Step 2: Confirmed */}
                    <div className="relative">
                      <span className="absolute -left-9 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white border-4 border-white shadow-sm">
                        <Check size={12} className="stroke-[3]" />
                      </span>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-bold text-xs text-gray-900">Order Confirmed</h4>
                          <p className="text-[10px] text-gray-500 mt-0.5">Payment verified. Packing in progress.</p>
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold bg-white px-1.5 py-0.5 rounded border border-gray-150 shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0 ml-2">
                          {formatTimelineDate(trackingOrder.confirmedAt || trackingOrder.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Step 3: Shipped */}
                    <div className="relative">
                      <span className={`absolute -left-9 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white shadow-sm
                        ${(trackingOrder.status === 'Shipped' || trackingOrder.status === 'Delivered') 
                          ? 'bg-green-500 text-white' 
                          : 'bg-slate-200 text-slate-400'}`}
                      >
                        <Check size={12} className="stroke-[3]" />
                      </span>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-bold text-xs text-gray-900 font-sans">Shipped</h4>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {trackingOrder.status === 'Shipped' || trackingOrder.status === 'Delivered' 
                              ? `Handed over to carrier: ${trackingOrder.shippingCompany || 'Courier Service'}`
                              : 'Preparing package for pickup by courier.'}
                          </p>
                        </div>
                        {(trackingOrder.status === 'Shipped' || trackingOrder.status === 'Delivered') && (
                          <span className="text-[10px] text-gray-450 font-bold bg-white px-1.5 py-0.5 rounded border border-gray-150 shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0 ml-2">
                            {trackingOrder.shippedAt 
                              ? formatTimelineDate(trackingOrder.shippedAt) 
                              : formatTimelineDate(new Date(getOrderTime(trackingOrder) + 2 * 24 * 60 * 60 * 1000))}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Step 4: In Transit / On the Way */}
                    <div className="relative">
                      <span className={`absolute -left-9 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white shadow-sm
                        ${(trackingOrder.status === 'Shipped' || trackingOrder.status === 'Delivered') 
                          ? 'bg-green-500 text-white' 
                          : 'bg-slate-200 text-slate-400'}`}
                      >
                        <Check size={12} className="stroke-[3]" />
                      </span>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-bold text-xs text-gray-900 font-sans">On the Way</h4>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {trackingOrder.status === 'Shipped' || trackingOrder.status === 'Delivered' 
                              ? 'Package is in transit. Moving between sorting centers.' 
                              : 'Package will enter transit after shipping.'}
                          </p>
                        </div>
                        {(trackingOrder.status === 'Shipped' || trackingOrder.status === 'Delivered') && (
                          <span className="text-[10px] text-gray-450 font-bold bg-white px-1.5 py-0.5 rounded border border-gray-150 shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0 ml-2">
                            {trackingOrder.shippedAt
                              ? formatTimelineDate(new Date(new Date(trackingOrder.shippedAt).getTime() + 1 * 24 * 60 * 60 * 1000))
                              : formatTimelineDate(new Date(getOrderTime(trackingOrder) + 3 * 24 * 60 * 60 * 1000))}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Step 5: Delivered */}
                    <div className="relative">
                      <span className={`absolute -left-9 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white shadow-sm
                        ${trackingOrder.status === 'Delivered' 
                          ? 'bg-green-500 text-white' 
                          : 'bg-slate-200 text-slate-400'}`}
                      >
                        <Check size={12} className="stroke-[3]" />
                      </span>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-bold text-xs text-gray-900 font-sans">Delivered</h4>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {trackingOrder.status === 'Delivered' 
                              ? 'Package has been delivered to your address.' 
                              : 'Package will be delivered by estimated date.'}
                          </p>
                        </div>
                        {trackingOrder.status === 'Delivered' && (
                          <span className="text-[10px] text-green-750 font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-150 shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0 ml-2">
                            {trackingOrder.deliveredAt
                              ? formatTimelineDate(trackingOrder.deliveredAt)
                              : formatTimelineDate(new Date(getOrderTime(trackingOrder) + 4 * 24 * 60 * 60 * 1000))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50/30 p-6 rounded-xl border border-red-100 flex flex-col items-center justify-center text-center">
                  <XCircle size={36} className="text-red-500 mb-2.5" />
                  <h3 className="font-bold text-sm text-red-900">Order Cancelled</h3>
                  <p className="text-xs text-red-700/80 mt-1 max-w-xs leading-relaxed">This order was cancelled. No delivery attempts will be made. If you need any assistance, please contact support.</p>
                </div>
              )}

              {/* Carrier & Tracking details */}
              {(trackingOrder.status === 'Shipped' || trackingOrder.status === 'Delivered') && trackingOrder.shippingCompany && (
                <div className="bg-white p-4 rounded-xl border border-gray-150 space-y-3 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Shipping Carrier Details</h3>
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Courier Partner</p>
                      <p className="font-bold text-gray-800 mt-0.5">{trackingOrder.shippingCompany}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-sans">Tracking Number</p>
                      <div className="flex items-center space-x-1.5 mt-0.5 justify-end">
                        <span className="font-mono font-bold text-gray-800">{trackingOrder.trackingNumber}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(trackingOrder.trackingNumber || "");
                            setCopiedTrackingId(true);
                            setTimeout(() => setCopiedTrackingId(false), 2000);
                          }}
                          className="text-pink-600 hover:text-pink-700 transition-colors p-1 cursor-pointer"
                          title="Copy Tracking ID"
                        >
                          {copiedTrackingId ? <Check size={14} className="text-green-650 stroke-[3]" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <a
                    href={getTrackingLink(trackingOrder.shippingCompany, trackingOrder.trackingNumber)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full mt-2 bg-slate-900 hover:bg-black text-white text-xs font-bold py-2.5 rounded-lg text-center flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer uppercase tracking-wider"
                  >
                    <ExternalLink size={14} />
                    Track on Courier Portal
                  </a>
                </div>
              )}

              {/* Address Card */}
              <div className="bg-white p-4 rounded-xl border border-gray-150 space-y-2.5 shadow-sm">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Delivery Address</h3>
                  {trackingOrder.status === 'Pending' && !showEditAddress && (
                    <button
                      type="button"
                      onClick={() => setShowEditAddress(true)}
                      className="text-xs font-bold text-pink-655 hover:text-pink-850 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit size={12} />
                      Edit
                    </button>
                  )}
                </div>

                {showEditAddress ? (
                  <div className="space-y-2.5 pt-1">
                    <textarea
                      value={editAddressText}
                      onChange={e => setEditAddressText(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-pink-500 outline-none text-gray-900 resize-none font-medium"
                      placeholder="Enter new delivery address..."
                    />
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditAddress(false);
                          setEditAddressText(trackingOrder.address || "");
                        }}
                        disabled={updatingAddress}
                        className="flex-1 py-2 text-[10px] font-bold text-gray-500 border border-gray-250 rounded-lg hover:bg-slate-50 transition-colors uppercase tracking-wider cursor-pointer text-center"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateAddress(trackingOrder.id, editAddressText)}
                        disabled={updatingAddress}
                        className="flex-1 py-2 text-[10px] font-bold text-white bg-pink-550 hover:bg-pink-650 rounded-lg transition-colors uppercase tracking-wider cursor-pointer text-center"
                      >
                        {updatingAddress ? "Saving..." : "Save Address"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 leading-relaxed font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100/70">{trackingOrder.address || "No address provided."}</p>
                )}
              </div>

              {/* Support & Cancellation Actions */}
              <div className="pt-2 space-y-2.5">
                {trackingOrder.status === 'Pending' && (
                  <>
                    {showCancelConfirm ? (
                      <div className="bg-red-50/70 border border-red-100 rounded-xl p-3.5 space-y-3">
                        <p className="text-xs text-red-800 font-bold leading-relaxed">Are you sure you want to cancel this order? This action is irreversible.</p>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => setShowCancelConfirm(false)}
                            disabled={cancellingOrder}
                            className="flex-1 py-2 text-[10px] font-bold text-gray-500 border border-gray-350 bg-white hover:bg-slate-50 transition-colors uppercase tracking-wider cursor-pointer text-center"
                          >
                            Keep Order
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelOrder(trackingOrder.id)}
                            disabled={cancellingOrder}
                            className="flex-1 py-2 text-[10px] font-bold text-white bg-red-550 hover:bg-red-650 rounded-lg transition-colors uppercase tracking-wider cursor-pointer text-center"
                          >
                            {cancellingOrder ? "Cancelling..." : "Confirm Cancel"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(true)}
                        className="w-full py-3 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100/60 transition-all uppercase tracking-wider cursor-pointer text-center"
                      >
                        Cancel Order
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowSupportModal(true)}
                  className="w-full py-3 text-xs font-bold text-gray-700 bg-slate-100 hover:bg-slate-200 border border-gray-200 rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <MessageSquare size={14} />
                  Need Help? Contact Support
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Support Info Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-gray-150 flex flex-col relative animate-scale-in">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-sm text-gray-900 uppercase tracking-wide">Customer Support</h2>
              <button 
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 text-center">
              <div className="w-12 h-12 bg-pink-50 border border-pink-100 rounded-full flex items-center justify-center mx-auto text-pink-500">
                <MessageSquare size={22} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-800">How can we help you?</h3>
                <p className="text-xs text-gray-500 mt-1">Our support agents are available Mon-Sat, 9AM to 6PM</p>
              </div>

              <div className="space-y-2.5 pt-2">
                <a 
                  href="https://wa.me/919999999999?text=Hi%2C%20I%2520need%2520help%2520with%2520my%2520order"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 bg-green-550 hover:bg-green-650 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider"
                >
                  <MessageSquare size={14} />
                  Chat on WhatsApp
                </a>
                <a 
                  href="mailto:support@craftstyle.com?subject=Order Support Request"
                  className="w-full py-2.5 px-4 bg-white border border-gray-300 hover:bg-slate-50 text-gray-750 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider"
                >
                  <Mail size={14} />
                  Email Support
                </a>
                <a 
                  href="tel:+919999999999"
                  className="w-full py-2.5 px-4 bg-white border border-gray-300 hover:bg-slate-50 text-gray-750 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider"
                >
                  <Phone size={14} />
                  Call Support Helpline
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
