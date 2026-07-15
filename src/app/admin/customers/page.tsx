"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, deleteDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, Mail, Phone, MapPin, Package, Calendar, Tag, ChevronDown, ChevronUp, Search, X, Trash2, ShoppingCart } from "lucide-react";

const getCustomerTime = (createdAt: any): number => {
  if (!createdAt) return 0;
  if (typeof createdAt.toDate === "function") {
    return createdAt.toDate().getTime();
  }
  if (createdAt.seconds) {
    return createdAt.seconds * 1000;
  }
  const dateParsed = new Date(createdAt);
  if (!isNaN(dateParsed.getTime())) {
    return dateParsed.getTime();
  }
  return 0;
};

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Cart & Recovery States
  const [userCarts, setUserCarts] = useState<Record<string, any[]>>({});
  const [loadingCarts, setLoadingCarts] = useState<Record<string, boolean>>({});
  const [sendingRecovery, setSendingRecovery] = useState<Record<string, boolean>>({});

  // Search & Sorting States
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");

  const filteredAndSortedCustomers = customers
    .filter(customer => {
      const q = searchQuery.toLowerCase();
      return (
        (customer.name && customer.name.toLowerCase().includes(q)) ||
        (customer.email && customer.email.toLowerCase().includes(q)) ||
        (customer.phone && customer.phone.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "name-asc") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "name-desc") {
        return (b.name || "").localeCompare(a.name || "");
      }
      if (sortBy === "date-desc") {
        return getCustomerTime(b.createdAt) - getCustomerTime(a.createdAt);
      }
      if (sortBy === "date-asc") {
        return getCustomerTime(a.createdAt) - getCustomerTime(b.createdAt);
      }
      
      const ordersA = orders.filter(o => o.userId === a.id || (o.customerEmail && o.customerEmail === a.email)).length;
      const ordersB = orders.filter(o => o.userId === b.id || (o.customerEmail && o.customerEmail === b.email)).length;
      
      if (sortBy === "orders-desc") {
        return ordersB - ordersA;
      }
      if (sortBy === "orders-asc") {
        return ordersA - ordersB;
      }
      return 0;
    });

  useEffect(() => {
    const fetchCustomersAndOrders = async () => {
      try {
        // 1. Fetch remote users
        let remoteUsers: any[] = [];
        try {
          const usersSnap = await getDocs(collection(db, "users"));
          remoteUsers = usersSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (e) {
          console.error("Failed to fetch remote users", e);
        }

        // 1b. Fetch deleted customer accounts list to filter them out
        let deletedUserIds: string[] = [];
        try {
          const deletedSnap = await getDocs(collection(db, "deletedCustomers"));
          deletedUserIds = deletedSnap.docs.map(doc => doc.id);
        } catch (e) {
          console.error("Failed to fetch deleted customers list", e);
        }

        if (typeof window !== "undefined") {
          try {
            const localDeleted = JSON.parse(localStorage.getItem("craftstyle_deleted_customers") || "[]");
            localDeleted.forEach((id: string) => {
              if (!deletedUserIds.includes(id)) {
                deletedUserIds.push(id);
              }
            });
          } catch (e) {}
        }

        // Filter remoteUsers
        remoteUsers = remoteUsers.filter(u => !deletedUserIds.includes(u.id));

        // 2. Fetch remote orders
        let remoteOrders: any[] = [];
        try {
          const ordersSnap = await getDocs(collection(db, "orders"));
          remoteOrders = ordersSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (e) {
          console.error("Failed to fetch remote orders", e);
        }

        // 3. Load local storage fallback
        let localOrders: any[] = [];
        if (typeof window !== "undefined") {
          try {
            const localOrdersStr = localStorage.getItem("craftstyle_local_orders");
            if (localOrdersStr) {
              localOrders = JSON.parse(localOrdersStr);
            }
          } catch (e) {
            console.error("Failed to parse local orders", e);
          }
        }

        const allOrders = [...localOrders, ...remoteOrders];

        // 4. Synthesize users from orders if they don't exist in the users list
        const mergedUsers = [...remoteUsers];
        
        allOrders.forEach((order: any) => {
          if (!order.userId || order.userId === "guest") return;
          if (deletedUserIds.includes(order.userId)) return;
          if (order.customerEmail && deletedUserIds.some(id => id.toLowerCase() === order.customerEmail.toLowerCase())) return;
          
          const userIndex = mergedUsers.findIndex(u => u.id === order.userId || (u.email && u.email.toLowerCase() === order.customerEmail?.toLowerCase()));
          if (userIndex === -1) {
            mergedUsers.push({
              id: order.userId,
              name: order.customerName || "Guest Customer",
              email: order.customerEmail || "",
              phone: order.phone || "",
              address: order.address || "",
              street: order.address?.split(",")[0] || "",
              city: order.address?.split(",")[1] || "",
              pin: order.address?.split(",")[2] || "",
              createdAt: order.createdAt
            });
          } else {
            // Update address/phone if missing in the profile doc
            const u = mergedUsers[userIndex];
            if (!u.phone && order.phone) {
              u.phone = order.phone;
            }
            if (!u.address && order.address) {
              u.address = order.address;
              u.street = order.address.split(",")[0] || "";
              u.city = order.address.split(",")[1] || "";
              u.pin = order.address.split(",")[2] || "";
            }
            if ((!u.name || u.name === "Customer" || u.name === u.email?.split("@")[0]) && order.customerName) {
              u.name = order.customerName;
            }
            // Update/synthesize createdAt using the earliest order's createdAt
            if (order.createdAt) {
              if (!u.createdAt) {
                u.createdAt = order.createdAt;
              } else if (getCustomerTime(order.createdAt) < getCustomerTime(u.createdAt)) {
                u.createdAt = order.createdAt;
              }
            }
          }
        });

        // Also add mock user
        if (typeof window !== "undefined") {
          const mockAddr = localStorage.getItem("craftstyle_mock_user_address");
          const mockUser = localStorage.getItem("craftstyle_mock_user");
          if (mockUser) {
            try {
              const parsedUser = JSON.parse(mockUser);
              if (!deletedUserIds.includes(parsedUser.uid)) {
                const exists = mergedUsers.some(u => u.email === parsedUser.email);
                if (!exists) {
                  let parsedAddr = { street: "", city: "", pin: "", phone: "" };
                  if (mockAddr) {
                    parsedAddr = JSON.parse(mockAddr);
                  }
                  mergedUsers.push({
                    id: parsedUser.uid,
                    name: parsedUser.displayName || parsedUser.email.split("@")[0],
                    email: parsedUser.email,
                    phone: parsedAddr.phone || "",
                    address: mockAddr ? `${parsedAddr.street}, ${parsedAddr.city}, ${parsedAddr.pin}` : "",
                    street: parsedAddr.street,
                    city: parsedAddr.city,
                    pin: parsedAddr.pin,
                    createdAt: parsedUser.metadata?.createdAt || new Date().toISOString()
                  });
                }
              }
            } catch (e) {
              console.error(e);
            }
          }
        }

        setCustomers(mergedUsers);
        setOrders(allOrders);
      } catch (err) {
        console.error("Error loading admin customer data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomersAndOrders();
  }, []);

  const handleDeleteCustomer = async (e: React.MouseEvent, customer: any) => {
    e.stopPropagation();

    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete the customer account for ${customer.name || customer.email}?`
    );
    if (!confirmDelete) return;

    try {
      // 1. Delete user doc from Firestore
      try {
        await deleteDoc(doc(db, "users", customer.id));
      } catch (err) {
        console.error("Failed to delete user profile from Firestore:", err);
      }

      // 2. Track in Firestore deletedCustomers collection
      try {
        await setDoc(doc(db, "deletedCustomers", customer.id), {
          id: customer.id,
          email: customer.email || "",
          deletedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to set deleted customer record:", err);
      }

      // 3. Update localStorage deleted list & remove mock user if it matches
      if (typeof window !== "undefined") {
        try {
          const localDeleted = JSON.parse(localStorage.getItem("craftstyle_deleted_customers") || "[]");
          if (!localDeleted.includes(customer.id)) {
            localDeleted.push(customer.id);
            localStorage.setItem("craftstyle_deleted_customers", JSON.stringify(localDeleted));
          }

          // If deleting the active mock user, clear it from localStorage
          const mockUserStr = localStorage.getItem("craftstyle_mock_user");
          if (mockUserStr) {
            const parsedMock = JSON.parse(mockUserStr);
            if (parsedMock.uid === customer.id || parsedMock.email === customer.email) {
              localStorage.removeItem("craftstyle_mock_user");
              localStorage.removeItem("craftstyle_mock_user_address");
            }
          }
        } catch (e) {
          console.error("Failed to access local storage for deletion updates", e);
        }
      }

      // 4. Update state to reflect change instantly
      setCustomers(prev => prev.filter(c => c.id !== customer.id));
      alert("Customer account successfully deleted.");
    } catch (err) {
      console.error("Deletion error:", err);
      alert("Error occurred while deleting account.");
    }
  };

  const getCustomerOrders = (userId: string, email: string) => {
    return orders.filter(order => order.userId === userId || (order.customerEmail && order.customerEmail === email));
  };

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

  const toggleExpand = async (userId: string) => {
    const isExpanding = expandedUser !== userId;
    setExpandedUser(prev => prev === userId ? null : userId);
    
    if (isExpanding && !userCarts[userId] && !loadingCarts[userId]) {
      setLoadingCarts(prev => ({ ...prev, [userId]: true }));
      try {
        const cartSnap = await getDocs(collection(db, `users/${userId}/cartItems`));
        const items = cartSnap.docs.map(doc => doc.data());
        setUserCarts(prev => ({ ...prev, [userId]: items }));
      } catch (err) {
        console.error(`Failed to fetch cart items for user ${userId}:`, err);
      } finally {
        setLoadingCarts(prev => ({ ...prev, [userId]: false }));
      }
    }
  };

  const handleSendCartRecovery = async (userId: string) => {
    setSendingRecovery(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/wallet/cron-abandoned-cart?userId=${userId}&forceSend=true`);
      const data = await res.json();
      if (data.success) {
        alert("Cart recovery notification successfully triggered for this customer!");
      } else {
        alert("Failed to send notification: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setSendingRecovery(prev => ({ ...prev, [userId]: false }));
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
      <h1 className="text-2xl font-black text-white mb-8">Customer Directory</h1>

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-slate-900/20 p-4 rounded-2xl border border-slate-900">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by name, email or phone..."
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
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="orders-desc">Orders (High to Low)</option>
            <option value="orders-asc">Orders (Low to High)</option>
            <option value="date-desc">New to Old</option>
            <option value="date-asc">Old to New</option>
          </select>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="bg-slate-900/40 p-12 rounded-2xl border border-slate-900 text-center text-slate-500 shadow-md">
          No registered customer accounts found.
        </div>
      ) : (
        <>
          {filteredAndSortedCustomers.length === 0 ? (
            <div className="bg-slate-900/40 p-12 rounded-2xl border border-slate-900 text-center text-slate-500 shadow-md">
              No customers found matching your search.
            </div>
          ) : (
            <div className="space-y-4.5">
              {filteredAndSortedCustomers.map((customer) => {
            const customerOrders = getCustomerOrders(customer.id, customer.email);
            const isExpanded = expandedUser === customer.id;
            
            return (
              <div key={customer.id} className="bg-slate-900/40 backdrop-blur rounded-2xl border border-slate-900 overflow-hidden shadow-lg hover:border-slate-800 transition-all">
                {/* Customer Row */}
                <div 
                  onClick={() => toggleExpand(customer.id)}
                  className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-slate-950/20 transition-all"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-pink-500/10 border border-pink-500/20 rounded-full flex items-center justify-center text-pink-400 font-extrabold text-base">
                      {customer.name ? customer.name.charAt(0).toUpperCase() : <User size={18} />}
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-white">{customer.name || "Customer Account"}</h2>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Mail size={13} className="text-slate-500" />
                          {customer.email}
                        </span>
                        {customer.phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone size={13} className="text-slate-500" />
                            {customer.phone}
                          </span>
                        )}
                        {customer.createdAt && (
                          <span className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-500" />
                            Joined: {formatOrderDate(customer.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4.5 w-full md:w-auto justify-between md:justify-end" onClick={(e) => e.stopPropagation()}>
                    <span className="bg-slate-950 text-slate-300 text-[10px] font-bold px-3 py-1.5 rounded-xl border border-slate-850">
                      {customerOrders.length} {customerOrders.length === 1 ? "Order" : "Orders"}
                    </span>
                    <button 
                      onClick={(e) => handleDeleteCustomer(e, customer)}
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-2 rounded-xl transition-all border border-transparent hover:border-rose-500/20 cursor-pointer"
                      title="Delete Customer Account"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      onClick={() => toggleExpand(customer.id)}
                      className="text-slate-400 hover:text-slate-200 transition-colors p-2 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-900/60 bg-slate-950/35 p-6 space-y-6">
                    {/* Address block */}
                    <div>
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                        <MapPin size={13} /> Contact Address Info
                      </h3>
                      {customer.address ? (
                        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-900 shadow-inner max-w-xl text-xs text-slate-300 space-y-1">
                          <p className="font-extrabold text-slate-100">{customer.name}</p>
                          <p>{customer.address}</p>
                          {customer.phone && <p className="pt-1.5"><span className="font-bold text-slate-400">Phone:</span> {customer.phone}</p>}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No saved delivery address details for this profile yet.</p>
                      )}
                    </div>

                    {/* Shopping Cart Items & Recovery Action */}
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <ShoppingCart size={13} /> Active Shopping Cart items
                        </h3>
                        {userCarts[customer.id] && userCarts[customer.id].length > 0 && (
                          <button
                            onClick={() => handleSendCartRecovery(customer.id)}
                            disabled={sendingRecovery[customer.id]}
                            className="bg-pink-600 hover:bg-pink-700 disabled:bg-pink-850 text-white font-extrabold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl border border-pink-500/25 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-pink-600/10 disabled:opacity-50"
                          >
                            {sendingRecovery[customer.id] ? (
                              <>
                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                Sending...
                              </>
                            ) : (
                              "Send Recovery Notification"
                            )}
                          </button>
                        )}
                      </div>
                      
                      {loadingCarts[customer.id] ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500 italic py-2">
                          <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                          Loading cart contents...
                        </div>
                      ) : userCarts[customer.id] && userCarts[customer.id].length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                          {userCarts[customer.id].map((item: any, idx: number) => (
                            <div key={idx} className="bg-slate-950/60 rounded-xl border border-slate-900 p-3 shadow-inner flex items-center gap-3 text-xs">
                              {item.image && (
                                <div className="w-12 h-16 bg-slate-900 rounded overflow-hidden flex-shrink-0 relative">
                                  <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-extrabold text-slate-100 truncate">{item.title}</p>
                                <p className="text-[10px] text-slate-500 truncate">{item.brand}</p>
                                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                  Qty: <span className="font-bold text-slate-200">{item.quantity}</span>
                                  {item.size && <span className="ml-2">Size: <span className="font-bold text-slate-200">{item.size}</span></span>}
                                  <span className="ml-2.5 text-pink-500 font-bold">₹{item.price * item.quantity}</span>
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No active items in cart.</p>
                      )}
                    </div>

                    {/* Order history */}
                    <div>
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                        <Package size={13} /> Order History ({customerOrders.length})
                      </h3>
                      {customerOrders.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">This customer profile has no placement history yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {customerOrders.map((order) => (
                            <div key={order.id} className="bg-slate-950/60 rounded-xl border border-slate-900 p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2.5">
                                  <span className="font-mono font-bold text-slate-300 uppercase">ORDER ID: {order.id.slice(-8).toUpperCase()}</span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border
                                    ${order.status === 'Pending' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                                      order.status === 'Shipped' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                                      order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                      'bg-rose-500/10 text-rose-400 border-rose-500/20'}
                                  `}>
                                    {order.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-x-4 text-[10px] text-slate-500">
                                  <span className="flex items-center gap-1"><Calendar size={11} /> {formatOrderDate(order.createdAt)}</span>
                                  <span className="flex items-center gap-1"><Tag size={11} /> {order.paymentMethod || "COD"}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                                <div className="text-left md:text-right">
                                  <p className="text-[10px] text-slate-500">Grand Total</p>
                                  <p className="font-bold text-pink-500 text-sm">₹{order.totalAmount}</p>
                                </div>
                                <a 
                                  href={`/admin/invoice/${order.id}`} 
                                  target="_blank" 
                                  className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-bold px-3.5 py-1.5 rounded-lg transition-all shadow-sm"
                                >
                                  View Invoice
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
