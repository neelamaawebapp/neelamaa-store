"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ChevronLeft, Package, Truck, CheckCircle, XCircle, Clock } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function CustomerOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
                  <div className="space-y-3 mb-4">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center space-x-3">
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
    </div>
  );
}
