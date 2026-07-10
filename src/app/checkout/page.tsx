"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin, CreditCard, QrCode, Smartphone, Building, Check, Loader2, ShieldCheck, X, AlertTriangle, Tag, Coins } from "lucide-react";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Script from "next/script";

export default function CheckoutPage() {
  const { cart, totalAmount, clearCart, couponCode, couponDiscountPercent, applyCouponCode, removeCouponCode } = useCart();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("craftstyle_checked_cart_ids");
      if (stored) {
        setCheckedIds(JSON.parse(stored));
      }
    }
  }, []);

  const checkoutItems = checkedIds.length > 0 ? cart.filter(item => checkedIds.includes(item.id)) : cart;

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

  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);

  // Checkout Coupons State
  const [checkoutCouponInput, setCheckoutCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const handleApplyCheckoutCoupon = async () => {
    if (!checkoutCouponInput.trim()) {
      setCouponError("Please enter a coupon code.");
      setCouponSuccess("");
      return;
    }
    setApplyingCoupon(true);
    setCouponError("");
    setCouponSuccess("");
    try {
      const res = await applyCouponCode(checkoutCouponInput);
      if (res.success) {
        setCouponSuccess(res.message);
        setCheckoutCouponInput("");
      } else {
        setCouponError(res.message);
      }
    } catch (err: any) {
      setCouponError(err.message || "Failed to apply coupon.");
    } finally {
      setApplyingCoupon(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetchWallet = async () => {
      try {
        let currentBalance = 0;

        if (user.uid.startsWith("mock_")) {
          const localKey = `craftstyle_mock_wallet_${user.email || "guest"}`;
          const storedWallet = localStorage.getItem(localKey);
          if (storedWallet) {
            const parsed = JSON.parse(storedWallet);
            currentBalance = parsed.balance;
          } else {
            currentBalance = 100;
            const txns = [{
              id: `txn_mock_signup_${Date.now()}`,
              walletId: user.uid,
              amount: 100,
              transactionType: "CREDIT",
              source: "SIGNUP_BONUS",
              referenceId: "signup",
              description: "Signup Bonus (Mock User)",
              status: "Active",
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
              hash: "mock_genesis_hash"
            }];
            localStorage.setItem(localKey, JSON.stringify({
              balance: currentBalance,
              transactions: txns
            }));
          }
          setWalletBalance(currentBalance);
        } else {
          let apiSucceeded = false;
          try {
            const res = await fetch(`/api/wallet/balance?userId=${user.uid}`);
            if (res.ok) {
              const data = await res.json();
              if (data.success && (data.balance > 0 || (data.transactions && data.transactions.length > 0))) {
                currentBalance = data.balance;
                setWalletBalance(currentBalance);
                apiSucceeded = true;
              }
            }
          } catch (err) {
            console.error("Failed to load checkout wallet balance via API", err);
          }

          if (!apiSucceeded) {
            const { doc, getDoc, getFirestore, collection, query, where, getDocs, setDoc } = await import("firebase/firestore");
            const { app } = await import("@/lib/firebase");
            const db = getFirestore(app);

            const walletRef = doc(db, "wallets", user.uid);
            let walletSnap = await getDoc(walletRef);

            if (!walletSnap.exists()) {
              const signupBonus = 100;
              const expiryDays = 365;
              const txnRef = doc(collection(db, "wallet_transactions"));

              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + expiryDays);

              const initialTxn = {
                walletId: user.uid,
                amount: signupBonus,
                transactionType: "CREDIT",
                source: "SIGNUP_BONUS",
                referenceId: "signup",
                description: "Signup Bonus",
                status: "Active",
                expiresAt: expiresAt.toISOString(),
                createdAt: new Date().toISOString(),
                hash: "genesis"
              };

              await setDoc(txnRef, initialTxn);
              await setDoc(walletRef, {
                userId: user.uid,
                balance: signupBonus,
                currency: "INR",
                updatedAt: new Date().toISOString(),
                latestTransactionHash: "genesis"
              });

              currentBalance = signupBonus;
            } else {
              currentBalance = walletSnap.data().balance || 0;
            }
            setWalletBalance(currentBalance);
          }
        }
      } catch (err) {
        console.error("Failed to load checkout wallet balance", err);
      }
    };
    fetchWallet();
  }, [user]);

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

  const [discountPercent, setDiscountPercent] = useState(0);

  useEffect(() => {
    getDoc(doc(db, "settings", "discount")).then((snap) => {
      if (snap.exists() && typeof snap.data().percent === "number") {
        setDiscountPercent(snap.data().percent);
      }
    });
  }, []);

  const totalMRP = checkoutItems.reduce((sum, item) => sum + (item.mrp || Math.round(item.price * 1.5)) * item.quantity, 0);
  const totalSellingPrice = checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const productDiscountAmount = totalMRP - totalSellingPrice;
  const storeDiscountAmount = Math.round(totalSellingPrice * (discountPercent / 100));
  
  // Coupon Discount
  const couponDiscountAmount = Math.round(totalSellingPrice * (couponDiscountPercent / 100));
  
  const totalDiscountAmount = productDiscountAmount + storeDiscountAmount + couponDiscountAmount;
  const calculatedDiscountPercent = totalMRP > 0 ? Math.round((totalDiscountAmount / totalMRP) * 100) : 0;

  const discount = storeDiscountAmount;
  const finalAmount = Math.max(0, totalMRP - totalDiscountAmount);
  const courierCharges = finalAmount < 500 && finalAmount > 0 ? 100 : 0;
  const totalToPay = finalAmount + courierCharges;

  const walletDiscount = useWallet ? Math.min(totalToPay, walletBalance, 50) : 0;
  const remainingToPay = totalToPay - walletDiscount;

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
      for (const item of checkoutItems) {
        const productRef = doc(db, "products", item.productId);
        const docSnap = await getDoc(productRef);
        if (docSnap.exists()) {
          const prodData = docSnap.data();
          const isFashion = prodData.category?.toLowerCase() === "fashion" || prodData.category?.toLowerCase() === "lifestyle & fashion";
          if (isFashion) {
            const sizesInv = prodData.sizesInventory || {};
            const selectedSize = item.size || "";
            const sizeStock = Number(sizesInv[selectedSize] || 0);
            if (sizeStock <= 0) {
              validationError = `The item "${item.brand} - ${item.title}" is out of stock for size ${selectedSize}.`;
              break;
            } else if (sizeStock < item.quantity) {
              validationError = `Only ${sizeStock} units of "${item.brand} - ${item.title}" in size ${selectedSize} are available in stock (you requested ${item.quantity}).`;
              break;
            }
          } else {
            const stock = Number(prodData.quantity || 0);
            if (stock <= 0) {
              validationError = `The item "${item.brand} - ${item.title}" is out of stock.`;
              break;
            } else if (stock < item.quantity) {
              validationError = `Only ${stock} units of "${item.brand} - ${item.title}" are available in stock (you requested ${item.quantity}).`;
              break;
            }
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

    if (remainingToPay === 0) {
      await completeOrder("Wallet", "Wallet");
      return;
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
        body: JSON.stringify({ amount: remainingToPay }),
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
      
      const totalDiscountPercent = discountPercent + couponDiscountPercent;

      const itemsWithGst = checkoutItems.map(item => {
        const rate = typeof item.gstRate === 'number' ? item.gstRate : 18;
        const discountedPrice = item.price * (1 - totalDiscountPercent / 100);
        const basePrice = discountedPrice / (1 + (rate / 100));
        const gstAmount = discountedPrice - basePrice;
        
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
        totalAmount: totalToPay,
        subtotal: Number(totalSubtotal.toFixed(2)),
        totalGst: Number(totalGstAmount.toFixed(2)),
        discountPercent: discountPercent,
        discountAmount: discount,
        couponCode: couponCode || "",
        couponDiscountPercent: couponDiscountPercent || 0,
        couponDiscountAmount: couponDiscountAmount || 0,
        courierCharges: courierCharges,
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
        const { doc, setDoc, collection, runTransaction } = await import("firebase/firestore");
        const docRef = doc(collection(db, "orders"));
        orderId = docRef.id;

        const getFinancialYear = (date: Date = new Date()) => {
          const year = date.getFullYear();
          const month = date.getMonth();
          const startYear = month >= 3 ? year : year - 1;
          const endYear = startYear + 1;
          const startYY = String(startYear).substring(2);
          const endYY = String(endYear).substring(2);
          return `${startYY}-${endYY}`;
        };

        let generatedInvoiceNo = `CS-${orderId.substring(0, 5).toUpperCase()}/${getFinancialYear()}`;
        try {
          const counterRef = doc(db, "settings", "counters");
          await runTransaction(db, async (transaction) => {
            const counterSnap = await transaction.get(counterRef);
            let nextSeq = 1;
            if (counterSnap.exists()) {
              const data = counterSnap.data();
              if (typeof data.invoiceSeq === "number") {
                nextSeq = data.invoiceSeq + 1;
              }
            }
            transaction.set(counterRef, { invoiceSeq: nextSeq }, { merge: true });
            const seqStr = String(nextSeq).padStart(3, '0');
            generatedInvoiceNo = `CS${seqStr}/${getFinancialYear()}`;
          });
        } catch (txErr) {
          console.error("Failed transaction for invoiceSeq, using short order ID as fallback", txErr);
        }

        if (walletDiscount > 0) {
          if (orderData.userId.startsWith("mock_")) {
            const localKey = `craftstyle_mock_wallet_${user?.email || "guest"}`;
            const storedWallet = localStorage.getItem(localKey);
            if (storedWallet) {
              const parsed = JSON.parse(storedWallet);
              const newBalance = Math.max(0, parsed.balance - walletDiscount);
              const newTxns = [
                {
                  id: `txn_mock_debit_${Date.now()}`,
                  walletId: orderData.userId,
                  amount: -walletDiscount,
                  transactionType: "DEBIT",
                  source: "ORDER_PAYMENT",
                  referenceId: orderId,
                  description: `Paid for Order #${orderId.slice(-8).toUpperCase()}`,
                  createdAt: new Date().toISOString()
                },
                ...(parsed.transactions || [])
              ];
              localStorage.setItem(localKey, JSON.stringify({
                balance: newBalance,
                transactions: newTxns
              }));
            }
          } else {
            // Real User: Try client-side direct update first (guaranteed authenticated context)
            let debitSucceeded = false;
            try {
              const { doc, getDoc, setDoc, updateDoc, collection } = await import("firebase/firestore");
              const walletRef = doc(db, "wallets", orderData.userId);
              const walletSnap = await getDoc(walletRef);
              if (walletSnap.exists()) {
                const currentBalance = Number(walletSnap.data().balance || 0);
                if (currentBalance >= walletDiscount) {
                  const previousHash = walletSnap.data().latestTransactionHash || "genesis";
                  
                  // Safe client-side SHA-256 implementation using Web Crypto API
                  const msgBuffer = new TextEncoder().encode(`${orderData.userId}_${walletDiscount}_DEBIT_${previousHash}`);
                  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
                  const hashArray = Array.from(new Uint8Array(hashBuffer));
                  const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                  const txnRef = doc(collection(db, "wallet_transactions"));
                  await setDoc(txnRef, {
                    walletId: orderData.userId,
                    amount: -walletDiscount,
                    transactionType: "DEBIT",
                    source: "ORDER_PAYMENT",
                    referenceId: orderId,
                    description: `Paid for Order #${orderId.slice(-8).toUpperCase()}`,
                    createdAt: new Date().toISOString(),
                    hash: newHash
                  });

                  await updateDoc(walletRef, {
                    balance: currentBalance - walletDiscount,
                    latestTransactionHash: newHash,
                    updatedAt: new Date().toISOString()
                  });
                  debitSucceeded = true;
                }
              }
            } catch (clientDebitErr) {
              console.error("Client-side direct debit failed, falling back to API:", clientDebitErr);
            }

            // Fallback to API route if client-side write failed
            if (!debitSucceeded) {
              const debitRes = await fetch("/api/wallet/debit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: orderData.userId,
                  orderId: orderId,
                  amount: walletDiscount
                })
              });

              if (!debitRes.ok) {
                const errData = await debitRes.json();
                throw new Error(errData.error || "Failed to debit wallet balance.");
              }
            }
          }
          window.dispatchEvent(new Event("wallet-update"));
        }

        const completeOrderData = {
          ...orderData,
          id: orderId,
          invoiceNo: generatedInvoiceNo,
          invoiceDate: new Date().toISOString(),
          walletAmountUsed: walletDiscount,
          cashAmountPaid: remainingToPay
        };

        await setDoc(docRef, completeOrderData);
      } catch (dbErr) {
        console.error("Firestore order creation failed, saving locally", dbErr);
        orderId = `mock_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
        
        const getFinancialYear = (date: Date = new Date()) => {
          const year = date.getFullYear();
          const month = date.getMonth();
          const startYear = month >= 3 ? year : year - 1;
          const endYear = startYear + 1;
          const startYY = String(startYear).substring(2);
          const endYY = String(endYear).substring(2);
          return `${startYY}-${endYY}`;
        };

        const localOrders = JSON.parse(localStorage.getItem("craftstyle_local_orders") || "[]");
        const nextLocalSeq = localOrders.length + 1;
        const seqStr = String(nextLocalSeq).padStart(3, '0');
        const localInvoiceNo = `CS${seqStr}/${getFinancialYear()}`;

        if (walletDiscount > 0) {
          try {
            if (orderData.userId.startsWith("mock_")) {
              const localKey = `craftstyle_mock_wallet_${user?.email || "guest"}`;
              const storedWallet = localStorage.getItem(localKey);
              if (storedWallet) {
                const parsed = JSON.parse(storedWallet);
                const newBalance = Math.max(0, parsed.balance - walletDiscount);
                const newTxns = [
                  {
                    id: `txn_mock_debit_${Date.now()}`,
                    walletId: orderData.userId,
                    amount: -walletDiscount,
                    transactionType: "DEBIT",
                    source: "ORDER_PAYMENT",
                    referenceId: orderId,
                    description: `Paid for Order #${orderId.slice(-8).toUpperCase()}`,
                    createdAt: new Date().toISOString()
                  },
                  ...(parsed.transactions || [])
                ];
                localStorage.setItem(localKey, JSON.stringify({
                  balance: newBalance,
                  transactions: newTxns
                }));
              }
            } else {
              // Real User Fallback: Try client-side direct update first
              let debitSucceeded = false;
              try {
                const { doc, getDoc, setDoc, updateDoc, collection } = await import("firebase/firestore");
                const walletRef = doc(db, "wallets", orderData.userId);
                const walletSnap = await getDoc(walletRef);
                if (walletSnap.exists()) {
                  const currentBalance = Number(walletSnap.data().balance || 0);
                  if (currentBalance >= walletDiscount) {
                    const previousHash = walletSnap.data().latestTransactionHash || "genesis";
                    
                    const msgBuffer = new TextEncoder().encode(`${orderData.userId}_${walletDiscount}_DEBIT_${previousHash}`);
                    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                    const txnRef = doc(collection(db, "wallet_transactions"));
                    await setDoc(txnRef, {
                      walletId: orderData.userId,
                      amount: -walletDiscount,
                      transactionType: "DEBIT",
                      source: "ORDER_PAYMENT",
                      referenceId: orderId,
                      description: `Paid for Order #${orderId.slice(-8).toUpperCase()}`,
                      createdAt: new Date().toISOString(),
                      hash: newHash
                    });

                    await updateDoc(walletRef, {
                      balance: currentBalance - walletDiscount,
                      latestTransactionHash: newHash,
                      updatedAt: new Date().toISOString()
                    });
                    debitSucceeded = true;
                  }
                }
              } catch (clientDebitErr) {
                console.error("Client-side direct fallback debit failed:", clientDebitErr);
              }

              if (!debitSucceeded) {
                await fetch("/api/wallet/debit", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: orderData.userId,
                    orderId: orderId,
                    amount: walletDiscount
                  })
                });
              }
            }
            window.dispatchEvent(new Event("wallet-update"));
          } catch (debitErr) {
            console.error("Failed to debit wallet for local fallback order:", debitErr);
          }
        }

        localOrders.push({ 
          ...orderData, 
          id: orderId,
          invoiceNo: localInvoiceNo,
          invoiceDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          walletAmountUsed: walletDiscount,
          cashAmountPaid: remainingToPay
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
            amount: remainingToPay
          })
        });
      } catch (e) {
        console.error("Notification trigger failed", e);
      }

      if (checkedIds.length > 0) {
        await clearCart(checkedIds);
        localStorage.removeItem("craftstyle_checked_cart_ids");
      } else {
        await clearCart();
      }
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

        {/* Courier Charges Alert */}
        {courierCharges > 0 && (
          <div className="bg-amber-50 border border-amber-250 text-amber-800 text-xs font-semibold p-3.5 rounded-xl flex flex-col gap-1 mb-4">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle size={14} className="text-amber-600" />
              <span>Courier Charges Applicable</span>
            </div>
            <span className="text-[11px] text-amber-700 leading-normal">
              An additional courier charge of ₹100 is applied for orders below ₹500.
            </span>
          </div>
        )}

        {/* Wallet Toggle Card */}
        {walletBalance > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-4 select-none animate-fade-in">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center space-x-3">
                <Coins className="text-pink-500" size={20} />
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-gray-900">Use Wallet Balance</span>
                  <span className="text-[10px] text-gray-500">Available: ₹{walletBalance} (Max ₹50 per order)</span>
                </div>
              </div>
              <input 
                type="checkbox"
                checked={useWallet}
                onChange={(e) => setUseWallet(e.target.checked)}
                className="w-4.5 h-4.5 text-pink-500 border-gray-300 rounded focus:ring-pink-500 cursor-pointer"
              />
            </label>
          </div>
        )}

        {/* Coupons Card */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
            <div className="flex items-center space-x-2 text-gray-800">
              <Tag size={18} className="text-pink-500" />
              <h3 className="font-bold text-sm uppercase tracking-wide">Apply Coupon</h3>
            </div>
            {couponCode && (
              <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded border border-green-150 flex items-center gap-1">
                <Check size={10} className="stroke-[3]" /> Coupon Active
              </span>
            )}
          </div>

          {couponCode ? (
            <div className="flex items-center justify-between bg-green-50/50 border border-green-100 rounded-xl p-3.5 animate-fade-in">
              <div className="flex items-start space-x-2.5">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 flex-shrink-0 mt-0.5">
                  <Check size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-gray-900 uppercase font-mono tracking-wider">{couponCode} APPLIED</h4>
                  <p className="text-[11px] text-green-700 mt-0.5 font-medium">You saved ₹{couponDiscountAmount} ({couponDiscountPercent}% OFF)</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  removeCouponCode();
                  setCouponSuccess("");
                  setCouponError("");
                }}
                className="text-gray-400 hover:text-red-500 p-1.5 transition-colors cursor-pointer"
                title="Remove Coupon"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Enter Coupon Code (e.g. FIRSTBUY20)"
                  value={checkoutCouponInput}
                  onChange={(e) => {
                    setCheckoutCouponInput(e.target.value);
                    setCouponError("");
                    setCouponSuccess("");
                  }}
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm uppercase font-mono tracking-wider focus:ring-1 focus:ring-pink-500 outline-none text-gray-900 placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => handleApplyCheckoutCoupon()}
                  disabled={applyingCoupon}
                  className="bg-pink-500 text-white font-bold px-5 py-2.5 rounded-md hover:bg-pink-600 transition-colors text-xs uppercase tracking-wider disabled:opacity-75 cursor-pointer"
                >
                  {applyingCoupon ? "APPLYING..." : "APPLY"}
                </button>
              </div>

              {couponError && (
                <div className="bg-red-50 text-red-600 text-xs py-2 px-3 rounded-lg border border-red-100 animate-shake flex items-center gap-1.5 font-medium">
                  <AlertTriangle size={13} />
                  <span>{couponError}</span>
                </div>
              )}

              {couponSuccess && (
                <div className="bg-green-50 text-green-700 text-xs py-2 px-3 rounded-lg border border-green-150 animate-fade-in flex items-center gap-1.5 font-medium">
                  <Check size={13} />
                  <span>{couponSuccess}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Price Details */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-4">
          <h3 className="font-bold text-sm text-gray-900 mb-4 uppercase tracking-wide border-b border-gray-100 pb-2">Price Summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Total MRP</span>
              <span>₹{totalMRP}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Discount on MRP</span>
              <span className="text-green-600">-₹{productDiscountAmount + storeDiscountAmount}</span>
            </div>
            {couponDiscountPercent > 0 && (
              <div className="flex justify-between text-gray-600 animate-fade-in">
                <span className="flex items-center gap-1.5 text-green-600 font-medium">
                  <Tag size={13} />
                  <span>Coupon Discount ({couponCode})</span>
                </span>
                <span className="text-green-600 font-bold">-₹{couponDiscountAmount}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Platform Fee</span>
              <span className="text-green-600">FREE</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Courier Charges</span>
              {courierCharges > 0 ? (
                <span className="text-gray-900 font-bold">₹{courierCharges}</span>
              ) : (
                <span className="text-green-600 font-bold">FREE</span>
              )}
            </div>
            {walletDiscount > 0 && (
              <div className="flex justify-between text-gray-600 animate-fade-in font-medium">
                <span className="flex items-center gap-1.5 text-pink-600">
                  <Coins size={13} />
                  <span>Wallet Balance Used</span>
                </span>
                <span className="text-pink-650 font-bold">-₹{walletDiscount}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between font-bold text-gray-900 text-base">
              <span>Total to Pay</span>
              <span>₹{remainingToPay}</span>
            </div>
          </div>
        </div>

        {remainingToPay === 0 ? (
          <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 text-xs p-4 rounded-xl flex items-center gap-3 mb-4 animate-scale-in">
            <Check className="text-emerald-600 stroke-[3] flex-shrink-0 animate-bounce" size={20} />
            <div>
              <p className="font-bold">Paid in Full via Wallet</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">Your wallet balance covers the total order amount. No payment gateway needed.</p>
            </div>
          </div>
        ) : (
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
        )}
      </div>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 bg-white border-t border-gray-200 p-3 pb-safe z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900">₹{remainingToPay}</span>
            <a href="#" className="text-xs text-pink-600 font-bold uppercase tracking-wide">Total to pay</a>
          </div>
          <button 
            type="submit"
            form="checkout-form"
            disabled={placing}
            className="bg-pink-500 text-white font-bold py-3.5 px-8 rounded-md hover:bg-pink-600 transition-colors disabled:opacity-70 flex justify-center items-center w-[60%]"
          >
            {placing ? "PROCESSING..." : remainingToPay === 0 ? "PLACE ORDER" : payMethod === "Online" ? "PROCEED TO PAY" : "CONFIRM ORDER"}
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
                <h3 className="font-extrabold text-pink-600 text-lg">₹{remainingToPay}</h3>
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
