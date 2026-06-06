"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect } from "react";
import Script from "next/script";

export default function CheckoutPage() {
  const { cart, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState("");
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Online"); // Default to Online Payment

  // Auto-fill from user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.name) setName(data.name);
          if (data.phone) setPhone(data.phone);
          if (data.street) setStreet(data.street);
          if (data.city) setCity(data.city);
          if (data.pin) setPin(data.pin);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    fetchUserProfile();
  }, [user]);

  const discount = Math.round(totalAmount * 0.33);
  const finalAmount = totalAmount - discount;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please log in to place an order");
      return;
    }
    
    setPlacing(true);

    try {
      // Calculate GST details secretly
      let totalGstAmount = 0;
      let totalSubtotal = 0; // price without GST

      const itemsWithGst = cart.map(item => {
        const rate = item.gstRate || 0;
        // if item.price = 118, and rate is 18%, base price = 118 / 1.18 = 100, gst = 18
        const basePrice = item.price / (1 + (rate / 100));
        const gstAmount = item.price - basePrice;
        
        totalGstAmount += (gstAmount * item.quantity);
        totalSubtotal += (basePrice * item.quantity);

        return {
          ...item,
          gstRate: rate,
          gstAmount: Number(gstAmount.toFixed(2)),
          basePrice: Number(basePrice.toFixed(2))
        };
      });

      const orderData = {
        userId: user.uid,
        customerName: name,
        customerEmail: user.email,
        phone,
        address: `${street}, ${city}, ${pin}`,
        items: itemsWithGst,
        totalAmount: finalAmount,
        subtotal: Number(totalSubtotal.toFixed(2)),
        totalGst: Number(totalGstAmount.toFixed(2)),
        status: "Pending",
        paymentMethod: paymentMethod,
        paymentId: "COD",
        createdAt: serverTimestamp(),
      };

      if (paymentMethod === "Online") {
        // Init Razorpay
        const res = await fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: finalAmount }),
        });
        const data = await res.json();
        
        if (!data.success) {
          throw new Error("Could not create Razorpay order");
        }

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: data.order.amount,
          currency: "INR",
          name: "Neelamaa Enterprises",
          description: "Purchase from NeelSutra",
          order_id: data.order.id,
          handler: async function (response: any) {
            orderData.paymentId = response.razorpay_payment_id;
            orderData.status = "Paid Online";
            await finalizeOrder(orderData);
          },
          prefill: {
            name: name,
            email: user.email,
            contact: phone,
          },
          theme: { color: "#ec4899" },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
          alert("Payment Failed: " + response.error.description);
          setPlacing(false);
        });
        rzp.open();
      } else {
        // COD Workflow
        await finalizeOrder(orderData);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to place order.");
      setPlacing(false);
    }
  };

  const finalizeOrder = async (orderData: any) => {
    try {
      const docRef = await addDoc(collection(db, "orders"), orderData);
      
      // Trigger Notification API
      try {
        await fetch("/api/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email: user?.email || "",
            phone,
            orderId: docRef.id.slice(-8).toUpperCase(),
            amount: finalAmount
          })
        });
      } catch (e) {
        console.error("Notification trigger failed", e);
      }

      await clearCart();
      setSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Failed to finalize order to database.");
      setPlacing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center w-full max-w-md mx-auto p-6 text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-5xl">🎉</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Successful!</h1>
        <p className="text-gray-500 mb-8">Thank you for shopping with us. Your order will be delivered soon.</p>
        <button 
          onClick={() => router.push("/")}
          className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors"
        >
          CONTINUE SHOPPING
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-32">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      {/* Header */}
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Checkout</h1>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-gray-100 text-gray-800">
            <MapPin size={20} className="text-pink-600" />
            <h2 className="font-bold text-sm uppercase tracking-wide">Delivery Address</h2>
          </div>
          
          <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none text-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Mobile Number *</label>
              <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none text-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Street Address *</label>
              <input type="text" required value={street} onChange={e => setStreet(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none text-gray-900" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">City *</label>
                <input type="text" required value={city} onChange={e => setCity(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none text-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Pincode *</label>
                <input type="text" required value={pin} onChange={e => setPin(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none text-gray-900" />
              </div>
            </div>
          </form>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
           <h2 className="font-bold text-sm uppercase tracking-wide mb-3 text-gray-800 border-b border-gray-100 pb-2">Payment Method</h2>
           <div className="space-y-3">
             <label className="flex items-center space-x-3 p-3 border border-slate-200 bg-slate-50 rounded-md cursor-pointer">
               <input 
                 type="radio" 
                 name="payment" 
                 value="Online" 
                 checked={paymentMethod === "Online"}
                 onChange={(e) => setPaymentMethod(e.target.value)}
                 className="w-4 h-4 text-pink-600 focus:ring-pink-500" 
               />
               <span className="font-bold text-sm text-gray-900">Pay Online (Razorpay Test)</span>
             </label>
             <label className="flex items-center space-x-3 p-3 border border-slate-200 bg-white rounded-md cursor-pointer">
               <input 
                 type="radio" 
                 name="payment" 
                 value="COD" 
                 checked={paymentMethod === "COD"}
                 onChange={(e) => setPaymentMethod(e.target.value)}
                 className="w-4 h-4 text-pink-600 focus:ring-pink-500" 
               />
               <span className="font-bold text-sm text-gray-900">Cash on Delivery (COD)</span>
             </label>
           </div>
        </div>
      </div>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 p-3 pb-safe z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900">₹{finalAmount}</span>
            <a href="#" className="text-xs text-pink-600 font-bold uppercase tracking-wide">Total to pay</a>
          </div>
          <button 
            type="submit"
            form="checkout-form"
            disabled={placing}
            className="bg-pink-500 text-white font-bold py-3.5 px-8 rounded-md hover:bg-pink-600 transition-colors disabled:opacity-70 flex justify-center items-center w-[60%]"
          >
            {placing ? "PROCESSING..." : "CONFIRM ORDER"}
          </button>
        </div>
      </div>
    </div>
  );
}
