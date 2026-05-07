"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Package, Truck, CheckCircle, XCircle, Clock } from "lucide-react";

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update order status.");
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Order Management</h1>

      {orders.length === 0 ? (
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500 shadow-sm">
          No orders have been placed yet.
        </div>
      ) : (
        <div className="grid gap-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Order Header */}
              <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">ORDER ID:</span>
                    <span className="text-sm font-mono font-medium text-gray-900">{order.id}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Placed on: {order.createdAt?.toDate().toLocaleString() || "Just now"}
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold border
                    ${order.status === 'Pending' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                      order.status === 'Shipped' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      order.status === 'Delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-red-50 text-red-700 border-red-200'}
                  `}>
                    {getStatusIcon(order.status)}
                    <span>{order.status}</span>
                  </div>

                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-pink-500 flex-1 sm:flex-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Order Details */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Customer Details</h3>
                  <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
                  <p className="text-sm text-gray-600">{order.customerEmail}</p>
                  <p className="text-sm text-gray-600">{order.phone}</p>
                  <div className="mt-3">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Shipping Address</h3>
                    <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded border border-gray-100">{order.address}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order Summary ({order.items?.length || 0} items)</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center space-x-3 text-sm border-b border-gray-50 pb-2">
                        <img src={item.image} alt={item.brand} className="w-10 h-10 object-cover rounded bg-gray-100" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{item.brand}</p>
                          <p className="text-gray-500 text-xs truncate">{item.title}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">₹{item.price}</p>
                          <p className="text-gray-500 text-xs">Qty: {item.quantity} {item.size && `| Size: ${item.size}`}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-gray-700">Total Amount (COD)</span>
                    <span className="text-lg font-bold text-pink-600">₹{order.totalAmount}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
