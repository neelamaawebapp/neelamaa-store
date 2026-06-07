"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, Mail, Phone, MapPin, Package, Calendar, Tag, ChevronDown, ChevronUp } from "lucide-react";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

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

        // 3. Load local storage fallback (for mock/demo sessions)
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
        // This ensures mock/demo users or guests who placed orders also appear in the customer dashboard
        const mergedUsers = [...remoteUsers];
        
        allOrders.forEach((order: any) => {
          if (!order.userId || order.userId === "guest") return;
          
          const exists = mergedUsers.some(u => u.id === order.userId || u.email === order.customerEmail);
          if (!exists) {
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
          }
        });

        // Also add the default mock user if they have saved an address locally
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
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Customer Directory</h1>

      {customers.length === 0 ? (
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500 shadow-sm">
          No customers registered yet.
        </div>
      ) : (
        <div className="space-y-4">
          {customers.map((customer) => {
            const customerOrders = getCustomerOrders(customer.id, customer.email);
            const isExpanded = expandedUser === customer.id;
            
            return (
              <div key={customer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all">
                {/* Customer Info Row */}
                <div 
                  onClick={() => toggleExpand(customer.id)}
                  className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 font-bold text-lg">
                      {customer.name ? customer.name.charAt(0).toUpperCase() : <User size={20} />}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">{customer.name || "Customer"}</h2>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Mail size={14} className="text-gray-400" />
                          {customer.email}
                        </span>
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={14} className="text-gray-400" />
                            {customer.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200">
                      {customerOrders.length} {customerOrders.length === 1 ? "Order" : "Orders"}
                    </span>
                    <button className="text-gray-400 hover:text-gray-600">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="border-t border-gray-150 bg-slate-50/50 p-6 space-y-6">
                    {/* Saved Billing / Delivery Address */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <MapPin size={14} /> Saved Address & Contact Details
                      </h3>
                      {customer.address ? (
                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm max-w-xl text-sm text-gray-800 space-y-1">
                          <p className="font-semibold text-gray-900">{customer.name}</p>
                          <p>{customer.address}</p>
                          {customer.phone && <p className="pt-1"><span className="font-semibold text-gray-700">Phone:</span> {customer.phone}</p>}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No saved delivery address details for this profile yet.</p>
                      )}
                    </div>

                    {/* Order History */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Package size={14} /> Order History ({customerOrders.length})
                      </h3>
                      {customerOrders.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">This customer has not placed any orders yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {customerOrders.map((order) => (
                            <div key={order.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-sm">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-gray-800 uppercase text-xs">ORDER ID: {order.id.slice(-8).toUpperCase()}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border
                                    ${order.status === 'Pending' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                                      order.status === 'Shipped' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      order.status === 'Delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                                      'bg-red-50 text-red-700 border-red-200'}
                                  `}>
                                    {order.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-x-4 text-xs text-gray-500">
                                  <span className="flex items-center gap-1"><Calendar size={12} /> {formatOrderDate(order.createdAt)}</span>
                                  <span className="flex items-center gap-1"><Tag size={12} /> {order.paymentMethod || "COD"}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                                <div className="text-left md:text-right">
                                  <p className="text-xs text-gray-500">Grand Total</p>
                                  <p className="font-bold text-pink-600 text-base">₹{order.totalAmount}</p>
                                </div>
                                <a 
                                  href={`/admin/invoice/${order.id}`} 
                                  target="_blank" 
                                  className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold px-3.5 py-1.5 rounded text-xs transition-colors shadow-sm"
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
    </div>
  );
}
