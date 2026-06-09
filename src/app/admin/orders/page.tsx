"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Package, Truck, CheckCircle, XCircle, Clock, FileText, AlertTriangle, HelpCircle } from "lucide-react";

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingData, setShippingData] = useState<Record<string, { company: string, tracking: string }>>({});

  const formatOrderDate = (createdAt: any) => {
    if (!createdAt) return "Just now";
    
    if (typeof createdAt.toDate === "function") {
      return createdAt.toDate().toLocaleString();
    }
    
    if (createdAt.seconds) {
      return new Date(createdAt.seconds * 1000).toLocaleString();
    }
    
    const dateParsed = new Date(createdAt);
    if (!isNaN(dateParsed.getTime())) {
      return dateParsed.toLocaleString();
    }

    return "Just now";
  };

  useEffect(() => {
    // 1. Subscribe to orders
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      let allOrders = [...ordersData];
      if (typeof window !== "undefined") {
        const localOrdersStr = localStorage.getItem("neelsutra_local_orders");
        if (localOrdersStr) {
          try {
            const localOrders = JSON.parse(localOrdersStr);
            const formattedLocal = localOrders.map((o: any) => ({
              ...o,
              createdAt: {
                toDate: () => new Date(),
                toLocaleString: () => new Date().toLocaleString()
              }
            }));
            allOrders = [...formattedLocal, ...allOrders];
          } catch (e) {
            console.error("Failed to parse local orders", e);
          }
        }
      }

      setOrders(allOrders);
      setLoading(false);
    }, (error) => {
      console.error("Firestore orders failed, falling back to localStorage", error);
      if (typeof window !== "undefined") {
        const localOrdersStr = localStorage.getItem("neelsutra_local_orders");
        if (localOrdersStr) {
          try {
            const localOrders = JSON.parse(localOrdersStr);
            const formattedLocal = localOrders.map((o: any) => ({
              ...o,
              createdAt: {
                toDate: () => new Date(),
                toLocaleString: () => new Date().toLocaleString()
              }
            }));
            setOrders(formattedLocal);
          } catch (e) {
            setOrders([]);
          }
        } else {
          setOrders([]);
        }
      }
      setLoading(false);
    });

    // 2. Subscribe to products for real-time stock levels
    const unsubscribeProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        alert("Order not found");
        return;
      }

      const wasDeducted = order.inventoryDeducted === true;

      if (newStatus === "Shipped" && !wasDeducted) {
        // Deduct inventory when shipping
        if (order.items && order.items.length > 0) {
          const { increment } = await import("firebase/firestore");
          for (const item of order.items) {
            if (item.productId) {
              const productRef = doc(db, "products", item.productId);
              await updateDoc(productRef, {
                quantity: increment(-Number(item.quantity || 1))
              });
            }
          }
        }
        await updateDoc(doc(db, "orders", orderId), { 
          status: newStatus,
          inventoryDeducted: true 
        });
      } else if (newStatus !== "Shipped" && wasDeducted) {
        // Return items to inventory if reverted from Shipped
        if (order.items && order.items.length > 0) {
          const { increment } = await import("firebase/firestore");
          for (const item of order.items) {
            if (item.productId) {
              const productRef = doc(db, "products", item.productId);
              await updateDoc(productRef, {
                quantity: increment(Number(item.quantity || 1))
              });
            }
          }
        }
        await updateDoc(doc(db, "orders", orderId), { 
          status: newStatus,
          inventoryDeducted: false 
        });
      } else {
        // Standard update
        await updateDoc(doc(db, "orders", orderId), { status: newStatus });
      }
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update order status.");
    }
  };

  const handleShippingChange = (orderId: string, field: 'company' | 'tracking', value: string) => {
    setShippingData(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value
      }
    }));
  };

  const saveShippingAndNotify = async (order: any) => {
    const data = shippingData[order.id] || { company: order.shippingCompany || "", tracking: order.trackingNumber || "" };
    if (!data.company || !data.tracking) {
      alert("Please provide both shipping company and tracking number");
      return;
    }

    try {
      // 1. Save to DB
      await updateDoc(doc(db, "orders", order.id), {
        shippingCompany: data.company,
        trackingNumber: data.tracking
      });

      // 2. Notify User
      const res = await fetch("/api/send-shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: order.customerName,
          email: order.customerEmail,
          phone: order.phone,
          orderId: order.id,
          shippingCompany: data.company,
          trackingNumber: data.tracking
        })
      });

      if (res.ok) {
        alert("Shipping details saved and customer notified!");
      } else {
        alert("Saved to DB, but failed to send email notification.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save and notify.");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pending": return <Clock size={15} className="text-orange-400" />;
      case "Shipped": return <Truck size={15} className="text-pink-400" />;
      case "Delivered": return <CheckCircle size={15} className="text-emerald-400" />;
      case "Cancelled": return <XCircle size={15} className="text-rose-400" />;
      default: return <Package size={15} className="text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto text-slate-100 font-sans">
      <h1 className="text-2xl font-black text-white mb-8">Order Workspace</h1>

      {orders.length === 0 ? (
        <div className="bg-slate-900/40 p-12 rounded-2xl border border-slate-900 text-center text-slate-500 shadow-md">
          No customer orders found in the database.
        </div>
      ) : (
        <div className="grid gap-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-slate-900/40 backdrop-blur rounded-2xl border border-slate-900 overflow-hidden shadow-lg hover:border-slate-800 transition-all">
              {/* Order Header */}
              <div className="bg-slate-950/60 p-4.5 border-b border-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ORDER ID:</span>
                    <span className="text-xs font-mono font-bold text-white bg-slate-950 border border-slate-850 px-2 py-0.5 rounded">{order.id}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                    Placed on: {formatOrderDate(order.createdAt)}
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border
                    ${order.status === 'Pending' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                      order.status === 'Shipped' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                      order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'}
                  `}>
                    {getStatusIcon(order.status)}
                    <span>{order.status}</span>
                  </div>

                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="bg-slate-950 border border-slate-850 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-pink-500 outline-none flex-1 sm:flex-none font-semibold cursor-pointer"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                  <a href={`/admin/invoice/${order.id}`} target="_blank" className="bg-slate-950 border border-slate-850 hover:bg-slate-900 rounded-lg px-3 py-1.5 text-xs font-extrabold text-slate-300 hover:text-white focus:outline-none flex items-center gap-1.5 shadow-sm transition-all">
                    <FileText size={14} />
                    Invoice
                  </a>
                </div>
              </div>

              {/* Order Details */}
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer column */}
                <div>
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Customer Profile</h3>
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 space-y-1">
                    <p className="text-xs font-bold text-slate-200">{order.customerName}</p>
                    <p className="text-xs text-slate-400">{order.customerEmail}</p>
                    <p className="text-xs text-slate-400 font-semibold">{order.phone}</p>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Delivery Address</h3>
                    <p className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-900 leading-relaxed">{order.address}</p>
                  </div>
                </div>

                {/* Items column with stock indicators */}
                <div>
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Order items ({order.items?.length || 0})</h3>
                  <div className="space-y-3.5 max-h-48 overflow-y-auto pr-1 bg-slate-950/10 p-3 border border-slate-900/60 rounded-xl">
                    {order.items?.map((item: any, idx: number) => {
                      // Find inventory status for this product
                      const matchedProd = products.find(p => p.id === item.productId);
                      const currentStock = matchedProd ? matchedProd.quantity : null;

                      return (
                        <div key={idx} className="flex items-center space-x-3 text-xs border-b border-slate-900/40 pb-2.5 last:border-b-0 last:pb-0">
                          <img src={item.image} alt={item.brand} className="w-9 h-11 object-cover rounded bg-slate-950 border border-slate-900" />
                          <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-slate-100 truncate">{item.brand}</p>
                            <p className="text-slate-500 text-[10px] truncate">{item.title}</p>
                            
                            {/* Stock Indicator */}
                            <div className="mt-1 flex items-center gap-1.5">
                              {currentStock === null || currentStock === undefined ? (
                                <span className="text-[9px] text-slate-500 font-bold flex items-center gap-0.5">
                                  <HelpCircle size={10} /> Stock N/A
                                </span>
                              ) : currentStock <= 0 ? (
                                <span className="text-[9px] text-rose-400 font-bold flex items-center gap-0.5 animate-pulse">
                                  <AlertTriangle size={10} /> Out of stock!
                                </span>
                              ) : currentStock < Number(item.quantity || 1) ? (
                                <span className="text-[9px] text-orange-400 font-bold flex items-center gap-0.5">
                                  <AlertTriangle size={10} /> Under-stocked ({currentStock} left)
                                </span>
                              ) : (
                                <span className="text-[9px] text-emerald-400 font-bold">
                                  ✓ Stock ok ({currentStock} available)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-white">₹{item.price}</p>
                            <p className="text-slate-500 text-[10px] mt-0.5">Qty: {item.quantity} {item.size && `| Size: ${item.size}`}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 pt-3.5 border-t border-slate-900 flex flex-col">
                    {order.paymentMethod === "Online" ? (
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1.5 font-mono">
                        <span>Paid online via Razorpay</span>
                        <span className="bg-slate-950 px-1.5 py-0.5 border border-slate-850 rounded">{order.paymentId}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1.5">
                        <span>Payment Method</span>
                        <span className="font-bold text-slate-300">{order.paymentMethod || "Cash on Delivery"}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-bold text-slate-400 text-xs">Total Charged</span>
                      <span className="text-base font-black text-pink-500">₹{order.totalAmount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping Details Box */}
              {order.status === 'Shipped' && (
                <div className="bg-[#e11d48]/5 border-t border-slate-900 p-4.5">
                  <h3 className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-3.5 flex items-center gap-2">
                    <Truck size={14} /> Provide Courier Shipping Info
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-[9px] font-bold text-slate-400 mb-1.5">SHIPPING COMPANY</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:border-pink-500 outline-none" 
                        value={shippingData[order.id]?.company ?? order.shippingCompany ?? ""} 
                        onChange={(e) => handleShippingChange(order.id, 'company', e.target.value)} 
                      >
                        <option value="" disabled>Select Courier</option>
                        <option value="Delhivery">Delhivery</option>
                        <option value="BlueDart">BlueDart</option>
                        <option value="DTDC">DTDC</option>
                        <option value="XpressBees">XpressBees</option>
                        <option value="Ecom Express">Ecom Express</option>
                        <option value="India Post">India Post</option>
                        <option value="Shadowfax">Shadowfax</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-[9px] font-bold text-slate-400 mb-1.5">TRACKING ID / REF</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:border-pink-500 outline-none" 
                        placeholder="e.g. 123456789" 
                        value={shippingData[order.id]?.tracking ?? order.trackingNumber ?? ""} 
                        onChange={(e) => handleShippingChange(order.id, 'tracking', e.target.value)} 
                      />
                    </div>
                    <button 
                      onClick={() => saveShippingAndNotify(order)} 
                      className="bg-gradient-to-r from-pink-500 to-orange-500 text-white font-extrabold py-2.5 px-5 rounded-lg text-xs hover:opacity-90 transition-all w-full sm:w-auto flex-shrink-0 cursor-pointer shadow-md shadow-pink-500/10 uppercase tracking-wider"
                    >
                      Save & Notify
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
