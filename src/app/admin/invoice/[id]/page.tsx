"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export default function InvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/");
    }
  }, [isAdmin, authLoading, router]);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!isAdmin || !id) return;
      try {
        const docRef = doc(db, "orders", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Firestore invoice fetch failed, falling back to local storage", err);
      }

      // Check localStorage fallback
      if (typeof window !== "undefined") {
        const localOrdersStr = localStorage.getItem("craftstyle_local_orders");
        if (localOrdersStr) {
          try {
            const localOrders = JSON.parse(localOrdersStr);
            const found = localOrders.find((o: any) => o.id === id);
            if (found) {
              setOrder({
                ...found,
                createdAt: {
                  toDate: () => new Date(),
                  toLocaleDateString: () => new Date().toLocaleDateString()
                }
              });
            }
          } catch (e) {
            console.error("Failed to parse local orders in invoice", e);
          }
        }
      }
      setLoading(false);
    };
    fetchOrder();
  }, [id, isAdmin]);

  if (authLoading || loading) {
    return <div className="p-8 text-center text-gray-500">Loading Invoice...</div>;
  }

  if (!order) {
    return <div className="p-8 text-center text-red-500">Invoice not found.</div>;
  }

  const discountPercent = typeof order.discountPercent === "number" ? order.discountPercent : (
    order.subtotal && order.subtotal > order.totalAmount ? 
      Math.round(((order.subtotal + (order.totalGst || 0) - order.totalAmount) / (order.subtotal + (order.totalGst || 0))) * 100) : 0
  );

  const originalTotal = order.items?.reduce((sum: number, it: any) => sum + (it.price * it.quantity), 0) || order.totalAmount;
  const discountAmount = typeof order.discountAmount === "number" ? order.discountAmount : Math.round(originalTotal * (discountPercent / 100));
  const finalGrandTotal = order.totalAmount || (originalTotal - discountAmount);

  let calculatedTaxableSubtotal = 0;
  let calculatedTotalGst = 0;

  if (order.items && order.items.length > 0) {
    order.items.forEach((item: any) => {
      const rate = typeof item.gstRate === 'number' ? item.gstRate : 18;
      const discountedPrice = item.price * (1 - discountPercent / 100);
      const basePrice = discountedPrice / (1 + (rate / 100));
      const gstAmount = discountedPrice - basePrice;
      calculatedTaxableSubtotal += (basePrice * item.quantity);
      calculatedTotalGst += (gstAmount * item.quantity);
    });
  } else {
    calculatedTotalGst = order.totalGst || 0;
    calculatedTaxableSubtotal = order.subtotal || (finalGrandTotal - calculatedTotalGst);
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 print:p-0 print:bg-white flex flex-col items-center">
      
      <div className="mb-6 print:hidden w-full max-w-4xl flex justify-between">
        <button onClick={() => router.back()} className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-bold text-sm">
          Back
        </button>
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded font-bold text-sm shadow">
          Print Invoice
        </button>
      </div>

      <div className="bg-white w-full max-w-4xl p-10 shadow-lg print:shadow-none print:max-w-full text-sm text-gray-800">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight uppercase">Tax Invoice</h1>
            <p className="text-gray-500 mt-1">Invoice / Receipt for your purchase</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-900">Neelamaa Enterprises</h2>
            <p className="text-gray-600">11/680, Chopasni Housing Board,</p>
            <p className="text-gray-600">Jodhpur (Rajasthan) - 342008 - India</p>
            <p className="text-gray-600 mt-1"><span className="font-bold">GSTIN:</span> 08APQPG8105D1ZY</p>
          </div>
        </div>

        {/* Order Info & Billing */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-gray-900 uppercase border-b border-gray-200 pb-1 mb-2">Billed To</h3>
            <p className="font-bold">{order.customerName}</p>
            <p>{order.address}</p>
            <p className="mt-1"><span className="font-medium">Phone:</span> {order.phone}</p>
            <p><span className="font-medium">Email:</span> {order.customerEmail}</p>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 uppercase border-b border-gray-200 pb-1 mb-2">Order Details</h3>
            <table className="w-full text-left">
              <tbody>
                <tr><th className="py-1 font-medium text-gray-600">Invoice No:</th><td className="font-mono font-bold text-gray-900">{order.invoiceNo || `INV-${order.id}`}</td></tr>
                <tr><th className="py-1 font-medium text-gray-600">Invoice Date:</th><td>{order.invoiceDate ? formatOrderDate(order.invoiceDate) : formatOrderDate(order.createdAt)}</td></tr>
                <tr><th className="py-1 font-medium text-gray-600">Order ID:</th><td className="font-mono text-xs">{order.id}</td></tr>
                <tr><th className="py-1 font-medium text-gray-600">Order Date:</th><td>{formatOrderDate(order.createdAt)}</td></tr>
                <tr><th className="py-1 font-medium text-gray-600">Payment Mode:</th><td>{order.paymentMethod || 'Cash on Delivery'}</td></tr>
                {order.paymentId && order.paymentId !== "COD" && (
                  <tr><th className="py-1 font-medium text-gray-600">Transaction ID:</th><td className="font-mono text-xs">{order.paymentId}</td></tr>
                )}
                <tr><th className="py-1 font-medium text-gray-600">Order Status:</th><td className="font-bold">{order.status}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-800 uppercase tracking-wider text-xs">
                <th className="border border-gray-300 p-3 text-left w-10">#</th>
                <th className="border border-gray-300 p-3 text-left">Description</th>
                <th className="border border-gray-300 p-3 text-center">Qty</th>
                <th className="border border-gray-300 p-3 text-right">Original Price</th>
                <th className="border border-gray-300 p-3 text-right">Discount</th>
                <th className="border border-gray-300 p-3 text-right">Taxable Value</th>
                <th className="border border-gray-300 p-3 text-right">GST Rate</th>
                <th className="border border-gray-300 p-3 text-right">GST Amt</th>
                <th className="border border-gray-300 p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item: any, idx: number) => {
                const rate = typeof item.gstRate === 'number' ? item.gstRate : 18;
                const originalPrice = item.price;
                const discountedPrice = originalPrice * (1 - discountPercent / 100);
                const basePrice = discountedPrice / (1 + (rate / 100));
                const gstAmount = discountedPrice - basePrice;

                return (
                  <tr key={idx} className="border-b border-gray-300">
                    <td className="border border-gray-300 p-3 text-center text-gray-600">{idx + 1}</td>
                    <td className="border border-gray-300 p-3">
                      <p className="font-bold text-gray-900">{item.brand}</p>
                      <p className="text-xs text-gray-600">{item.title} {item.size ? `(Size: ${item.size})` : ''}</p>
                    </td>
                    <td className="border border-gray-300 p-3 text-center">{item.quantity}</td>
                    <td className="border border-gray-300 p-3 text-right">₹{originalPrice.toFixed(2)}</td>
                    <td className="border border-gray-300 p-3 text-right text-pink-600 font-semibold">{discountPercent}%</td>
                    <td className="border border-gray-300 p-3 text-right">₹{basePrice.toFixed(2)}</td>
                    <td className="border border-gray-300 p-3 text-right text-gray-600">{rate}%</td>
                    <td className="border border-gray-300 p-3 text-right text-gray-600">₹{(gstAmount * item.quantity).toFixed(2)}</td>
                    <td className="border border-gray-300 p-3 text-right font-bold">₹{(discountedPrice * item.quantity).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-12">
          <div className="w-80">
            <table className="w-full text-right border-collapse">
              <tbody>
                <tr className="text-gray-600">
                  <td className="py-1.5 pr-4">Original Subtotal:</td>
                  <td className="py-1.5 font-mono">₹{originalTotal.toFixed(2)}</td>
                </tr>
                {discountAmount > 0 && (
                  <tr className="text-pink-600 font-semibold">
                    <td className="py-1.5 pr-4">Discount ({discountPercent}%):</td>
                    <td className="py-1.5 font-mono">-₹{discountAmount.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="text-gray-600 border-t border-gray-200">
                  <td className="py-1.5 pr-4">Taxable Subtotal:</td>
                  <td className="py-1.5 font-mono">₹{calculatedTaxableSubtotal.toFixed(2)}</td>
                </tr>
                <tr className="text-gray-600 border-b border-gray-200">
                  <td className="py-1.5 pr-4">Total GST:</td>
                  <td className="py-1.5 font-mono">₹{calculatedTotalGst.toFixed(2)}</td>
                </tr>
                <tr className="text-lg font-bold text-gray-900">
                  <td className="py-2.5 pr-4">Grand Total:</td>
                  <td className="py-2.5 font-mono text-xl text-pink-600">₹{finalGrandTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 pt-6 text-xs text-gray-500 text-center">
          <p>This is a computer generated invoice and does not require a physical signature.</p>
          <p className="mt-1">Thank you for shopping with Craft Style!</p>
        </div>
      </div>
    </div>
  );
}
