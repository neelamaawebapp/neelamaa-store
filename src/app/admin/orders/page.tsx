"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Package, Truck, CheckCircle, XCircle, Clock, FileText, AlertTriangle, HelpCircle, Search, X, Printer } from "lucide-react";

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingData, setShippingData] = useState<Record<string, { company: string, tracking: string }>>({});
  const [editingDiscountOrderId, setEditingDiscountOrderId] = useState<string | null>(null);
  const [tempDiscountPercent, setTempDiscountPercent] = useState<number>(0);

  // Search & Sorting States
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");

  const getOrderTime = (order: any) => {
    if (!order.createdAt) return 0;
    if (typeof order.createdAt.toMillis === "function") return order.createdAt.toMillis();
    if (order.createdAt.seconds) return order.createdAt.seconds * 1000;
    const parsed = new Date(order.createdAt).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  const getFinancialYear = (dateInput?: any) => {
    if (!dateInput) return "25-26";
    const d = typeof dateInput.toDate === "function" ? dateInput.toDate() : new Date(dateInput);
    const date = isNaN(d.getTime()) ? new Date() : d;
    const year = date.getFullYear();
    const month = date.getMonth();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;
    const startYY = String(startYear).substring(2);
    const endYY = String(endYear).substring(2);
    return `${startYY}-${endYY}`;
  };

  const getInvoiceNo = (order: any) => {
    if (order.invoiceNo) return order.invoiceNo;
    const idStr = order.id || "";
    const cleanId = idStr.startsWith("mock_") ? idStr.replace("mock_", "") : idStr;
    const shortId = cleanId.substring(0, 5).toUpperCase();
    return `CS-${shortId}/${getFinancialYear(order.createdAt)}`;
  };

  const statusPriority: Record<string, number> = {
    "Pending": 1,
    "Shipped": 2,
    "Delivered": 3,
    "Cancelled": 4
  };

  const filteredAndSortedOrders = orders
    .filter(order => {
      const q = searchQuery.toLowerCase();
      const invoiceNo = getInvoiceNo(order).toLowerCase();
      return (
        order.id.toLowerCase().includes(q) ||
        invoiceNo.includes(q) ||
        (order.customerName && order.customerName.toLowerCase().includes(q)) ||
        (order.customerEmail && order.customerEmail.toLowerCase().includes(q)) ||
        (order.phone && order.phone.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "date-desc") {
        return getOrderTime(b) - getOrderTime(a);
      }
      if (sortBy === "date-asc") {
        return getOrderTime(a) - getOrderTime(b);
      }
      if (sortBy === "name-asc") {
        return (a.customerName || "").localeCompare(b.customerName || "");
      }
      if (sortBy === "name-desc") {
        return (b.customerName || "").localeCompare(a.customerName || "");
      }
      if (sortBy === "amount-desc") {
        return b.totalAmount - a.totalAmount;
      }
      if (sortBy === "amount-asc") {
        return a.totalAmount - b.totalAmount;
      }
      if (sortBy === "status-asc") {
        const priorityA = statusPriority[a.status] || 5;
        const priorityB = statusPriority[b.status] || 5;
        return priorityA - priorityB;
      }
      return 0;
    });

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
        const localOrdersStr = localStorage.getItem("craftstyle_local_orders");
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
        const localOrdersStr = localStorage.getItem("craftstyle_local_orders");
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
      const isMock = orderId.startsWith("mock_");

      const extraFields: any = { status: newStatus };
      if (newStatus === "Shipped") {
        extraFields.shippedAt = new Date().toISOString();
      } else if (newStatus === "Delivered") {
        extraFields.deliveredAt = new Date().toISOString();
        if (!order.shippedAt) {
          extraFields.shippedAt = new Date(getOrderTime(order) + 2 * 24 * 60 * 60 * 1000).toISOString();
        }
      } else if (newStatus === "Cancelled") {
        extraFields.cancelledAt = new Date().toISOString();
      }

      if (isMock) {
        // Mock order in local storage
        const localOrders = JSON.parse(localStorage.getItem("craftstyle_local_orders") || "[]");
        const updatedLocal = localOrders.map((o: any) => {
          if (o.id === orderId) {
            return { 
              ...o, 
              ...extraFields,
              inventoryDeducted: newStatus === "Shipped" ? true : (newStatus !== "Shipped" && o.inventoryDeducted ? false : o.inventoryDeducted)
            };
          }
          return o;
        });
        localStorage.setItem("craftstyle_local_orders", JSON.stringify(updatedLocal));
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...extraFields, inventoryDeducted: newStatus === "Shipped" ? true : (newStatus !== "Shipped" && o.inventoryDeducted ? false : o.inventoryDeducted) } : o));
      } else {
        // Firestore update
        const fieldsToUpdate: any = { 
          status: newStatus,
          ...extraFields
        };

        if (newStatus === "Shipped" && !wasDeducted) {
          // Deduct inventory when shipping
          if (order.items && order.items.length > 0) {
            const { increment, getDoc } = await import("firebase/firestore");
            for (const item of order.items) {
              if (item.productId) {
                const productRef = doc(db, "products", item.productId);
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                  const prodData = productSnap.data();
                  const isFashion = prodData.category?.toLowerCase() === "fashion" || prodData.category?.toLowerCase() === "lifestyle & fashion";
                  if (isFashion && item.size && prodData.sizesInventory) {
                    await updateDoc(productRef, {
                      [`sizesInventory.${item.size}`]: increment(-Number(item.quantity || 1)),
                      quantity: increment(-Number(item.quantity || 1))
                    });
                  } else {
                    await updateDoc(productRef, {
                      quantity: increment(-Number(item.quantity || 1))
                    });
                  }
                }
              }
            }
          }
          fieldsToUpdate.inventoryDeducted = true;
        } else if (newStatus !== "Shipped" && wasDeducted) {
          // Return items to inventory if reverted from Shipped
          if (order.items && order.items.length > 0) {
            const { increment, getDoc } = await import("firebase/firestore");
            for (const item of order.items) {
              if (item.productId) {
                const productRef = doc(db, "products", item.productId);
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                  const prodData = productSnap.data();
                  const isFashion = prodData.category?.toLowerCase() === "fashion" || prodData.category?.toLowerCase() === "lifestyle & fashion";
                  if (isFashion && item.size && prodData.sizesInventory) {
                    await updateDoc(productRef, {
                      [`sizesInventory.${item.size}`]: increment(Number(item.quantity || 1)),
                      quantity: increment(Number(item.quantity || 1))
                    });
                  } else {
                    await updateDoc(productRef, {
                      quantity: increment(Number(item.quantity || 1))
                    });
                  }
                }
              }
            }
          }
          fieldsToUpdate.inventoryDeducted = false;
        }

        await updateDoc(doc(db, "orders", orderId), fieldsToUpdate);
      }

      // Trigger cashback on Delivered
      if (newStatus === "Delivered") {
        try {
          const { getAuthHeaders } = await import("@/lib/api-client");
          const authHeaders = await getAuthHeaders();
          await fetch("/api/wallet/credit-cashback", {
            method: "POST",
            headers: { ...authHeaders },
            body: JSON.stringify({
              orderId: orderId,
              userId: order.userId || "guest",
              mockOrderTotal: order.totalAmount || 0
            })
          });
        } catch (cbErr) {
          console.error("Failed to trigger cashback:", cbErr);
        }
      }

      // 3. Trigger customer status update notification (Delivered or Cancelled)
      if (newStatus === "Delivered" || newStatus === "Cancelled") {
        try {
          const { getAuthHeaders } = await import("@/lib/api-client");
          const authHeaders = await getAuthHeaders();
          const res = await fetch("/api/send-status-update", {
            method: "POST",
            headers: { ...authHeaders },
            body: JSON.stringify({
              name: order.customerName || "Customer",
              email: order.customerEmail || order.email || "",
              phone: order.phone || "",
              orderId: order.id,
              status: newStatus
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && !data.emailSent) {
              console.log("Status update notification email skipped (SMTP credentials not configured).");
            }
          }
        } catch (notifyErr) {
          console.error("Failed to send status update notification", notifyErr);
        }
      }
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update order status.");
    }
  };

  const startEditingOrderDiscount = (order: any) => {
    const currentPercent = typeof order.discountPercent === "number" ? order.discountPercent : (
      order.subtotal && order.subtotal > order.totalAmount ? 
        Math.round(((order.subtotal + (order.totalGst || 0) - order.totalAmount) / (order.subtotal + (order.totalGst || 0))) * 100) : 0
    );
    setEditingDiscountOrderId(order.id);
    setTempDiscountPercent(currentPercent);
  };

  const saveOrderDiscount = async (order: any) => {
    try {
      const originalTotal = order.items?.reduce((sum: number, it: any) => sum + (it.price * it.quantity), 0) || order.totalAmount;
      const newDiscountPercent = Number(tempDiscountPercent);
      const newDiscountAmount = Math.round(originalTotal * (newDiscountPercent / 100));
      const discountedItemsTotal = originalTotal - newDiscountAmount;
      const courierCharges = discountedItemsTotal < 500 && discountedItemsTotal > 0 ? 100 : 0;
      const newTotalAmount = discountedItemsTotal + courierCharges;

      let totalGstAmount = 0;
      let totalSubtotal = 0;
      const updatedItems = order.items.map((item: any) => {
        const rate = typeof item.gstRate === 'number' ? item.gstRate : 18;
        const discountedPrice = item.price * (1 - newDiscountPercent / 100);
        const basePrice = discountedPrice / (1 + rate / 100);
        const gstAmount = discountedPrice - basePrice;
        
        totalGstAmount += (gstAmount * item.quantity);
        totalSubtotal += (basePrice * item.quantity);
        
        return {
          ...item,
          basePrice: Number(basePrice.toFixed(2)),
          gstAmount: Number(gstAmount.toFixed(2))
        };
      });

      const fieldsToUpdate = {
        discountPercent: newDiscountPercent,
        discountAmount: newDiscountAmount,
        totalAmount: newTotalAmount,
        courierCharges: courierCharges,
        subtotal: Number(totalSubtotal.toFixed(2)),
        totalGst: Number(totalGstAmount.toFixed(2)),
        items: updatedItems
      };

      const isMock = order.id.startsWith("mock_");
      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("craftstyle_local_orders") || "[]");
        const updatedLocal = localOrders.map((o: any) => {
          if (o.id === order.id) {
            return {
              ...o,
              ...fieldsToUpdate
            };
          }
          return o;
        });
        localStorage.setItem("craftstyle_local_orders", JSON.stringify(updatedLocal));
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...fieldsToUpdate } : o));
      } else {
        await updateDoc(doc(db, "orders", order.id), fieldsToUpdate);
      }

      setEditingDiscountOrderId(null);
      alert("Discount and totals updated successfully!");
    } catch (err) {
      console.error("Failed to save order discount:", err);
      alert("Failed to save discount.");
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

    const customerEmail = order.customerEmail || order.email || "";
    if (!customerEmail || !customerEmail.includes("@")) {
      alert("Error: Cannot notify customer via email because their email address is missing or invalid on this order.");
      return;
    }

    const isMock = order.id.startsWith("mock_");
    try {
      // 1. Save to DB
      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("craftstyle_local_orders") || "[]");
        const updatedLocal = localOrders.map((o: any) => {
          if (o.id === order.id) {
            return {
              ...o,
              shippingCompany: data.company,
              trackingNumber: data.tracking
            };
          }
          return o;
        });
        localStorage.setItem("craftstyle_local_orders", JSON.stringify(updatedLocal));
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, shippingCompany: data.company, trackingNumber: data.tracking } : o));
      } else {
        await updateDoc(doc(db, "orders", order.id), {
          shippingCompany: data.company,
          trackingNumber: data.tracking
        });
      }

      // 2. Notify User
      const { getAuthHeaders } = await import("@/lib/api-client");
      const authHeaders = await getAuthHeaders();
      const res = await fetch("/api/send-shipping", {
        method: "POST",
        headers: { ...authHeaders },
        body: JSON.stringify({
          name: order.customerName || "Customer",
          email: customerEmail,
          phone: order.phone || "",
          orderId: order.id,
          shippingCompany: data.company,
          trackingNumber: data.tracking
        })
      });

      if (res.ok) {
        const resData = await res.json();
        if (resData.success) {
          if (resData.warning) {
            alert(`Shipping details saved to database. Warning: ${resData.warning}`);
          } else if (!resData.emailSent) {
            alert("Shipping details saved to database. Warning: Email notification was skipped because SMTP credentials (EMAIL_USER/EMAIL_PASS) are not configured.");
          } else {
            alert("Shipping details saved and customer notified successfully!");
          }
        } else {
          alert("Shipping details saved, but notification server returned an error.");
        }
      } else {
        alert("Saved to DB, but failed to contact notification server.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save and notify.");
    }
  };

  const [printingManifestId, setPrintingManifestId] = useState<string | null>(null);

  const handlePrintManifest = async (order: any) => {
    if (!order.trackingNumber) {
      alert("Please assign a tracking number first.");
      return;
    }
    
    if (order.id.startsWith("mock_")) {
      alert("Opening mock manifest print URL in development mode...");
      window.open("https://shiprocket-manifests.s3.amazonaws.com/mock_manifest.pdf", "_blank");
      return;
    }

    setPrintingManifestId(order.id);
    try {
      const { getAuthHeaders } = await import("@/lib/api-client");
      const authHeaders = await getAuthHeaders();
      const res = await fetch("/api/print-manifest", {
        method: "POST",
        headers: { ...authHeaders },
        body: JSON.stringify({
          trackingNumber: order.trackingNumber,
          shipmentId: order.shipmentId || null
        })
      });
      const data = await res.json();
      if (data.success && data.manifestUrl) {
        window.open(data.manifestUrl, "_blank");
      } else {
        alert("Error: " + (data.error || "Failed to generate print manifest. Ensure Shiprocket credentials are correct."));
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to print manifest: " + err.message);
    } finally {
      setPrintingManifestId(null);
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

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-slate-900/20 p-4 rounded-2xl border border-slate-900">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by order ID, name, email or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 pl-10 text-xs text-white focus:border-pink-500 outline-none font-medium placeholder-slate-500"
          />
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
            <Search size={15} />
          </div>
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-850 text-slate-200 rounded-xl px-3 py-2.5 text-xs focus:border-pink-500 outline-none font-semibold cursor-pointer min-w-[150px]"
          >
            <option value="date-desc">Order Date (Newest)</option>
            <option value="date-asc">Order Date (Oldest)</option>
            <option value="name-asc">Customer Name (A-Z)</option>
            <option value="name-desc">Customer Name (Z-A)</option>
            <option value="amount-desc">Total Amount (High to Low)</option>
            <option value="amount-asc">Total Amount (Low to High)</option>
            <option value="status-asc">Status</option>
          </select>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-slate-900/40 p-12 rounded-2xl border border-slate-900 text-center text-slate-500 shadow-md">
          No customer orders found in the database.
        </div>
      ) : (
        <>
          {filteredAndSortedOrders.length === 0 ? (
            <div className="bg-slate-900/40 p-12 rounded-2xl border border-slate-900 text-center text-slate-500 shadow-md">
              No orders found matching your search.
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredAndSortedOrders.map((order) => (
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
                  {(order.status === 'Shipped' || order.status === 'Delivered') && order.trackingNumber && (
                    <button
                      onClick={() => handlePrintManifest(order)}
                      disabled={printingManifestId === order.id}
                      className="bg-slate-950 border border-slate-850 hover:bg-slate-900 rounded-lg px-3 py-1.5 text-xs font-extrabold text-slate-300 hover:text-white focus:outline-none flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Printer size={14} />
                      {printingManifestId === order.id ? "Printing..." : "Manifest"}
                    </button>
                  )}
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
                            <p className="font-extrabold text-slate-100 truncate">{item.title}</p>
                            <p className="text-slate-500 text-[10px] truncate">{item.brand}</p>
                            
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
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1.5 font-semibold">
                      <span>Invoice Number</span>
                      <span className="font-mono bg-slate-950 px-1.5 py-0.5 border border-slate-850 rounded text-slate-300">
                        {getInvoiceNo(order)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1.5">
                      <span>Subtotal (Before Discount)</span>
                      <span className="font-bold text-slate-300">
                        ₹{order.items?.reduce((sum: number, it: any) => sum + (it.price * it.quantity), 0) || order.subtotal || order.totalAmount}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1.5">
                      <span>Discount Applied</span>
                      {editingDiscountOrderId === order.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-12 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-center text-white text-[10px] focus:border-pink-500 outline-none"
                            value={tempDiscountPercent}
                            onChange={(e) => setTempDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                          />
                          <span className="text-slate-400">%</span>
                          <button
                            onClick={() => saveOrderDiscount(order)}
                            className="bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded hover:bg-emerald-600 text-[9px] transition-all cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingDiscountOrderId(null)}
                            className="bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded hover:bg-slate-700 text-[9px] transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-pink-400">
                            {typeof order.discountPercent === "number" ? `${order.discountPercent}%` : "0%"}
                          </span>
                          <button
                            onClick={() => startEditingOrderDiscount(order)}
                            className="text-[9px] text-pink-500 font-bold hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>

                    {order.couponCode && (
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1.5 border-t border-slate-850 pt-1.5">
                        <span>Coupon Discount ({order.couponCode})</span>
                        <span className="font-bold text-emerald-400">
                          -₹{order.couponDiscountAmount || 0} ({order.couponDiscountPercent || 0}% OFF)
                        </span>
                      </div>
                    )}

                    {order.courierCharges !== undefined && order.courierCharges > 0 && (
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1.5">
                        <span>Courier Charges</span>
                        <span className="font-bold text-slate-300">
                          ₹{order.courierCharges}
                        </span>
                      </div>
                    )}

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
                        <option value="Shiprocket">Shiprocket (Real-time)</option>
                        <option value="Delhivery">Delhivery</option>
                        <option value="BlueDart">BlueDart</option>
                        <option value="DTDC">DTDC</option>
                        <option value="FedEx">FedEx</option>
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
        </>
      )}
    </div>
  );
}
