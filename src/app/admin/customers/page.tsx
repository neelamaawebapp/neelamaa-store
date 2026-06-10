"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, Mail, Phone, MapPin, Package, Calendar, Tag, ChevronDown, ChevronUp, Search, X } from "lucide-react";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

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
            const localOrdersStr = localStorage.getItem("neelsutra_local_orders");
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
              pin: order.address?.split(",")[2] || ""
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
          }
        });

        // Also add mock user
        if (typeof window !== "undefined") {
          const mockAddr = localStorage.getItem("neelsutra_mock_user_address");
          const mockUser = localStorage.getItem("neelsutra_mock_user");
          if (mockUser) {
            try {
              const parsedUser = JSON.parse(mockUser);
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
                  pin: parsedAddr.pin
                });
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

  const toggleExpand = (userId: string) => {
    setExpandedUser(prev => prev === userId ? null : userId);
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
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4.5 w-full md:w-auto justify-between md:justify-end">
                    <span className="bg-slate-950 text-slate-300 text-[10px] font-bold px-3 py-1.5 rounded-xl border border-slate-850">
                      {customerOrders.length} {customerOrders.length === 1 ? "Order" : "Orders"}
                    </span>
                    <button className="text-slate-400 hover:text-slate-200 transition-colors">
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
