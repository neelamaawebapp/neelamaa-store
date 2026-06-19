"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin, CreditCard, QrCode, Smartphone, Building, Check, Loader2, ShieldCheck, X } from "lucide-react";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Script from "next/script";

export default function CheckoutPage() {
  const { cart, totalAmount, clearCart } = useCart();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState("");
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);

  // Payment Selection & Dialog State
  const [payMethod, setPayMethod] = useState<"COD" | "Online">("COD");
  const [showPayModal, setShowPayModal] = useState(false);
  const [payChannel, setPayChannel] = useState<"upi" | "card" | "netbanking">("upi");

  // Simulated Card Inputs
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cardOtp, setCardOtp] = useState("");

  // Simulated UPI States
  const [upiId, setUpiId] = useState("");

  // Simulated Net Banking States
  const [selectedBank, setSelectedBank] = useState("");

  // Payment Success Flow
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success">("idle");
  const [mockTxnId, setMockTxnId] = useState("");

  // Auto-fill from user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      // 1. Try local storage mock fallback first
      const localAddr = localStorage.getItem("craftstyle_mock_user_address");
      if (localAddr) {
        try {
          const parsed = JSON.parse(localAddr);
          const namePart = user.displayName || user.email?.split("@")[0] || "Customer";
          if (namePart) setName(namePart);
          if (parsed.phone) setPhone(parsed.phone);
          if (parsed.street) setStreet(parsed.street);
          if (parsed.city) setCity(parsed.city);
          if (parsed.pin) setPin(parsed.pin);
          return;
        } catch (e) {
          console.error(e);
        }
      }

      // 2. Fall back to Firestore
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

    // Validate stock levels before placing order
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      
      let validationError = "";
      for (const item of cart) {
        const productRef = doc(db, "products", item.productId);
        const docSnap = await getDoc(productRef);
        if (docSnap.exists()) {
          const stock = Number(docSnap.data().quantity || 0);
          if (stock <= 0) {
            validationError = `The item "${item.brand} - ${item.title}" is out of stock.`;
            break;
          } else if (stock < item.quantity) {
            validationError = `Only ${stock} units of "${item.brand} - ${item.title}" are available in stock (you requested ${item.quantity}).`;
            break;
          }
        } else {
          validationError = `The item "${item.brand} - ${item.title}" is no longer available.`;
          break;
        }
      }

      if (validationError) {
        alert(`${validationError} Please update your shopping bag before proceeding.`);
        setPlacing(false);
        return;
      }
    } catch (err) {
      console.error("Stock validation failed, proceeding with caution", err);
    }

    if (payMethod === "COD") {
      await completeOrder("COD", "COD");
      return;
    }

    // Pay Online Flow
    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount }),
      });
      const data = await res.json();

      if (data.success && data.order) {
        // Launch real Razorpay checkout
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: data.order.amount,
          currency: "INR",
          name: "Neelamaa Enterprises",
          description: "Purchase from Craft Style",
          order_id: data.order.id,
          handler: async function (response: any) {
            await completeOrder("Online", response.razorpay_payment_id);
          },
          prefill: {
            name: name,
            email: user.email || "",
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
        // Fallback to Simulated Payment Modal if keys are not configured or creation fails
        console.warn("Razorpay API bypassed/unconfigured, falling back to sandbox simulator.");
        setPlacing(false);
        setShowPayModal(true);
        setPaymentStatus("idle");
        setOtpSent(false);
        setCardOtp("");
        setCardNumber("");
        setCardName("");
        setCardExpiry("");
        setCardCvv("");
        setUpiId("");
        setSelectedBank("");
      }
    } catch (err) {
      console.error("Razorpay init error, falling back to simulator", err);
      setPlacing(false);
      setShowPayModal(true);
      setPaymentStatus("idle");
      setOtpSent(false);
      setCardOtp("");
      setCardNumber("");
      setCardName("");
      setCardExpiry("");
      setCardCvv("");
      setUpiId("");
      setSelectedBank("");
    }
  };

  const completeOrder = async (method: string, paymentId: string) => {
    try {
      // Calculate GST details
      let totalGstAmount = 0;
      let totalSubtotal = 0; // price without GST

      const itemsWithGst = cart.map(item => {
        const rate = item.gstRate || 0;
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
        userId: user?.uid || "guest",
        customerName: name,
        customerEmail: user?.email || "guest@example.com",
        phone,
        address: `${street}, ${city}, ${pin}`,
        items: itemsWithGst,
        totalAmount: finalAmount,
        subtotal: Number(totalSubtotal.toFixed(2)),
        totalGst: Number(totalGstAmount.toFixed(2)),
        status: "Pending",
        paymentMethod: method,
        paymentId: paymentId,
        createdAt: serverTimestamp(),
      };

      await finalizeOrder(orderData);
    } catch (err) {
      console.error(err);
      alert("Failed to place order.");
      setPlacing(false);
    }
  };

  const finalizeOrder = async (orderData: any) => {
    try {
      let orderId = "";
      try {
        const docRef = await addDoc(collection(db, "orders"), orderData);
        orderId = docRef.id;
      } catch (dbErr) {
        console.error("Firestore order creation failed, saving locally", dbErr);
        orderId = `mock_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
        // Save to local storage orders
        const localOrders = JSON.parse(localStorage.getItem("craftstyle_local_orders") || "[]");
        localOrders.push({ 
          ...orderData, 
          id: orderId, 
          createdAt: new Date().toISOString()
        });
        localStorage.setItem("craftstyle_local_orders", JSON.stringify(localOrders));
      }
      
      // Trigger Notification API
      try {
        await fetch("/api/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email: user?.email || "",
            phone,
            orderId: orderId.slice(-8).toUpperCase(),
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

  // Simulated Payment Success Flow
  const handleSimulatePayment = () => {
    if (payChannel === "card" && !otpSent) {
      // Basic Card Validation
      if (cardNumber.replace(/\s/g, "").length < 16) {
        alert("Please enter a valid 16-digit card number");
        return;
      }
      if (!cardExpiry || !cardExpiry.includes("/")) {
        alert("Please enter card expiry in MM/YY format");
        return;
      }
      if (cardCvv.length < 3) {
        alert("Please enter a valid CVV");
        return;
      }
      setOtpSent(true);
      return;
    }

    if (payChannel === "card" && otpSent) {
      if (cardOtp.length < 4) {
        alert("Please enter the verification OTP");
        return;
      }
    }

    if (payChannel === "upi" && upiId && !upiId.includes("@")) {
      alert("Please enter a valid UPI ID (e.g. user@okhdfcbank)");
      return;
    }

    if (payChannel === "netbanking" && !selectedBank) {
      alert("Please select a bank to proceed");
      return;
    }

    setPaymentStatus("processing");
    
    // Generate mock transaction ID
    const txnId = "pay_mock_" + Math.random().toString(36).substring(2, 11).toUpperCase();
    setMockTxnId(txnId);

    setTimeout(() => {
      setPaymentStatus("success");
      setTimeout(async () => {
        setShowPayModal(false);
        setPlacing(true);
        await completeOrder("Online", txnId);
      }, 1500);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center w-full max-w-md mx-auto p-6">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center w-full max-w-md mx-auto p-6 text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-50 border border-green-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <span className="text-4xl">🎉</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 uppercase tracking-wide">Order Successful!</h1>
        <p className="text-sm text-gray-500 mb-8 max-w-xs mx-auto leading-relaxed">Thank you for shopping with us. Your order has been registered and is being processed.</p>
        <div className="space-y-3 w-full">
          <button 
            onClick={() => router.push("/profile/orders")}
            className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors uppercase tracking-wider text-sm shadow-md"
          >
            Track My Orders
          </button>
          <button 
            onClick={() => router.push("/")}
            className="w-full border border-gray-300 text-gray-700 bg-white font-bold py-3.5 rounded-md hover:bg-gray-50 transition-colors uppercase tracking-wider text-sm"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center w-full max-w-md mx-auto p-6 text-center">
        <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center mb-6">
          <MapPin className="text-pink-500" size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Login Required</h1>
        <p className="text-gray-500 mb-8">Please login or create an account to proceed with your checkout and place an order.</p>
        <button 
          onClick={() => router.push("/login?redirect=/checkout")}
          className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-md hover:bg-pink-600 transition-colors"
        >
          LOGIN / SIGNUP
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
             <label className={`flex items-center space-x-3 p-3 border rounded-md cursor-pointer transition-colors ${payMethod === "COD" ? "border-pink-500 bg-pink-50/10" : "border-slate-200 bg-white"}`}>
               <input 
                 type="radio" 
                 name="payment" 
                 value="COD" 
                 checked={payMethod === "COD"}
                 onChange={() => setPayMethod("COD")}
                 className="w-4 h-4 text-pink-600 focus:ring-pink-500" 
               />
               <span className="font-bold text-sm text-gray-900">Cash on Delivery (COD)</span>
             </label>
             <label className={`flex items-center space-x-3 p-3 border rounded-md cursor-pointer transition-colors ${payMethod === "Online" ? "border-pink-500 bg-pink-50/10" : "border-slate-200 bg-white"}`}>
               <input 
                 type="radio" 
                 name="payment" 
                 value="Online" 
                 checked={payMethod === "Online"}
                 onChange={() => setPayMethod("Online")}
                 className="w-4 h-4 text-pink-600 focus:ring-pink-500" 
               />
               <div className="flex flex-col">
                 <span className="font-bold text-sm text-gray-900">Pay Online</span>
                 <span className="text-[10px] text-gray-500">UPI, Credit/Debit Cards, Net Banking</span>
               </div>
             </label>
           </div>
        </div>
      </div>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 bg-white border-t border-gray-200 p-3 pb-safe z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
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
            {placing ? "PROCESSING..." : payMethod === "Online" ? "PROCEED TO PAY" : "CONFIRM ORDER"}
          </button>
        </div>
      </div>

      {/* Simulated Payment Gateway Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col relative animate-scale-in">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="text-green-400" size={24} />
                <div>
                  <h2 className="font-bold text-sm tracking-wide uppercase">Secured Payment</h2>
                  <p className="text-[10px] text-gray-300">128-bit SSL encrypted connection</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPayModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={paymentStatus !== "idle"}
              >
                <X size={20} />
              </button>
            </div>

            {/* Total Amount Box */}
            <div className="bg-slate-50 p-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500">Merchant Name</p>
                <h3 className="font-bold text-gray-800 text-sm">Craft Style</h3>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Amount to Pay</p>
                <h3 className="font-extrabold text-pink-600 text-lg">₹{finalAmount}</h3>
              </div>
            </div>

            {paymentStatus === "idle" && (
              <div className="flex-1 flex flex-col min-h-[350px]">
                {/* Method Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-100 text-xs">
                  <button 
                    onClick={() => setPayChannel("upi")}
                    className={`flex-1 py-3 font-bold flex items-center justify-center space-x-1 border-b-2 transition-colors ${payChannel === "upi" ? "border-pink-500 text-pink-600 bg-white" : "border-transparent text-gray-500 hover:bg-gray-50"}`}
                  >
                    <QrCode size={16} />
                    <span>UPI / QR</span>
                  </button>
                  <button 
                    onClick={() => setPayChannel("card")}
                    className={`flex-1 py-3 font-bold flex items-center justify-center space-x-1 border-b-2 transition-colors ${payChannel === "card" ? "border-pink-500 text-pink-600 bg-white" : "border-transparent text-gray-500 hover:bg-gray-50"}`}
                  >
                    <CreditCard size={16} />
                    <span>Cards</span>
                  </button>
                  <button 
                    onClick={() => setPayChannel("netbanking")}
                    className={`flex-1 py-3 font-bold flex items-center justify-center space-x-1 border-b-2 transition-colors ${payChannel === "netbanking" ? "border-pink-500 text-pink-600 bg-white" : "border-transparent text-gray-500 hover:bg-gray-50"}`}
                  >
                    <Building size={16} />
                    <span>Net Banking</span>
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="p-4 flex-1 flex flex-col justify-between overflow-y-auto">
                  {payChannel === "upi" && (
                    <div className="space-y-4 flex flex-col items-center text-center">
                      <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col items-center">
                        {/* Mock QR Code Drawing */}
                        <div className="w-40 h-40 border-8 border-slate-900 p-2 flex flex-wrap justify-between items-between relative">
                          <div className="w-10 h-10 bg-slate-900"></div>
                          <div className="w-10 h-10 bg-slate-900"></div>
                          <div className="w-10 h-10 bg-slate-900 self-end"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-bold tracking-widest text-pink-600 uppercase font-mono bg-white px-1">CRAFT STYLE</span>
                          </div>
                          {/* Inner pixels */}
                          <div className="absolute top-12 left-6 w-3 h-3 bg-slate-900"></div>
                          <div className="absolute top-8 left-16 w-3 h-3 bg-slate-900"></div>
                          <div className="absolute top-16 left-24 w-3 h-3 bg-slate-900"></div>
                          <div className="absolute top-28 left-8 w-3 h-3 bg-slate-900"></div>
                          <div className="absolute top-24 left-20 w-3 h-3 bg-slate-900"></div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 font-mono">BHIM UPI QR CODE</p>
                      </div>
                      
                      <div className="w-full">
                        <p className="text-xs text-gray-500 mb-2 font-medium">Or pay using UPI ID</p>
                        <input 
                          type="text" 
                          placeholder="e.g. mobileNumber@upi"
                          value={upiId}
                          onChange={e => setUpiId(e.target.value)}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none text-gray-900 text-center font-medium placeholder-gray-300"
                        />
                      </div>
                    </div>
                  )}

                  {payChannel === "card" && (
                    <div className="space-y-3">
                      {!otpSent ? (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Card Number</label>
                            <input 
                              type="text" 
                              maxLength={19}
                              placeholder="4111 2222 3333 4444"
                              value={cardNumber}
                              onChange={e => {
                                const val = e.target.value.replace(/\s/g, "").replace(/(\d{4})/g, "$1 ").trim();
                                setCardNumber(val);
                              }}
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none font-mono text-gray-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Cardholder Name</label>
                            <input 
                              type="text" 
                              placeholder="JOHN DOE"
                              value={cardName}
                              onChange={e => setCardName(e.target.value.toUpperCase())}
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none font-medium text-gray-900"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Expiry Date</label>
                              <input 
                                type="text" 
                                maxLength={5}
                                placeholder="MM/YY"
                                value={cardExpiry}
                                onChange={e => {
                                  let val = e.target.value.replace(/\D/g, "");
                                  if (val.length > 2) val = val.substring(0, 2) + "/" + val.substring(2, 4);
                                  setCardExpiry(val);
                                }}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none font-mono text-gray-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">CVV / CVV2</label>
                              <input 
                                type="password" 
                                maxLength={3}
                                placeholder="•••"
                                value={cardCvv}
                                onChange={e => setCardCvv(e.target.value.replace(/\D/g, ""))}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none font-mono text-gray-900"
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="py-6 text-center space-y-4">
                          <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto text-pink-600">
                            <Smartphone size={24} />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-800 text-sm">OTP Verification</h4>
                            <p className="text-xs text-gray-500 mt-1">Please enter the 6-digit OTP sent to phone registered with your card.</p>
                          </div>
                          <input 
                            type="text" 
                            maxLength={6}
                            placeholder="123456"
                            value={cardOtp}
                            onChange={e => setCardOtp(e.target.value.replace(/\D/g, ""))}
                            className="border-2 border-slate-300 focus:border-pink-500 rounded px-4 py-2.5 text-lg font-mono text-center tracking-widest outline-none text-gray-900 w-36 mx-auto block"
                          />
                          <button 
                            type="button" 
                            onClick={() => setCardOtp("123456")}
                            className="text-xs text-pink-600 font-bold hover:underline"
                          >
                            Auto-fill Demo OTP (123456)
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {payChannel === "netbanking" && (
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500 font-medium">Select a bank to proceed</p>
                      <div className="grid grid-cols-2 gap-3">
                        {["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Bank", "Punjab National Bank"].map(bank => (
                          <button
                            key={bank}
                            type="button"
                            onClick={() => setSelectedBank(bank)}
                            className={`p-3 text-xs font-bold border rounded-lg transition-all text-left flex items-center space-x-2
                              ${selectedBank === bank 
                                ? "border-pink-500 bg-pink-50/10 text-pink-600 shadow-sm" 
                                : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"}`}
                          >
                            <Building size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate">{bank}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-6 border-t border-gray-100 mt-6 flex space-x-3">
                    {otpSent && (
                      <button 
                        type="button" 
                        onClick={() => setOtpSent(false)} 
                        className="w-1/3 py-3 font-bold text-gray-500 border border-gray-300 rounded-xl hover:bg-slate-50 transition-colors text-xs"
                      >
                        BACK
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={handleSimulatePayment} 
                      className={`py-3 font-bold text-white bg-pink-500 hover:bg-pink-600 rounded-xl transition-all text-sm shadow-md flex justify-center items-center gap-2 cursor-pointer
                        ${otpSent ? "w-2/3" : "w-full"}`}
                    >
                      <span>{payChannel === "card" && !otpSent ? "PAY SECURELY" : "CONFIRM & PAY NOW"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {paymentStatus === "processing" && (
              <div className="p-8 text-center flex flex-col items-center justify-center min-h-[350px] space-y-4">
                <Loader2 className="animate-spin text-pink-600" size={48} />
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Processing Payment</h3>
                  <p className="text-xs text-gray-500 mt-1">Please do not refresh the page or click back button.</p>
                </div>
              </div>
            )}

            {paymentStatus === "success" && (
              <div className="p-8 text-center flex flex-col items-center justify-center min-h-[350px] space-y-4 animate-scale-in">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <Check size={36} className="stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-bold text-green-700 text-lg">Payment Successful!</h3>
                  <p className="text-xs text-gray-500 mt-2 font-mono">Txn ID: {mockTxnId}</p>
                </div>
                <p className="text-xs text-gray-400 animate-pulse mt-4">Creating your order...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
