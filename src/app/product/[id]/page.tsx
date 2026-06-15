"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeft, Share2, Heart, ShoppingBag, Info, Truck, ShieldCheck, Bell, X } from "lucide-react";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { addToBag } = useCart();
  const { user } = useAuth();
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");
  const [showAddedModal, setShowAddedModal] = useState(false);

  const [selectedSize, setSelectedSize] = useState("");
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const sizes = ["S", "M", "L", "XL", "XXL"];

  // Stock Subscription States
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [submittingNotify, setSubmittingNotify] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyPhone, setNotifyPhone] = useState("");

  // Prefill email if logged in
  useEffect(() => {
    if (user) {
      setNotifyEmail(user.email || "");
    }
  }, [user]);

  // Check if already subscribed to notifications for this item
  useEffect(() => {
    const checkSubscription = async () => {
      if (!id) return;

      // Check local storage first
      const localSubs = JSON.parse(localStorage.getItem("neelsutra_stock_subscriptions") || "[]");
      const localMatched = localSubs.some((s: any) => s.productId === id && s.status === "Pending");
      
      if (localMatched) {
        setIsSubscribed(true);
        return;
      }

      // Check Firestore if logged in
      if (user) {
        try {
          const subsRef = collection(db, "back_in_stock_subscriptions");
          const q = query(
            subsRef, 
            where("productId", "==", id), 
            where("userId", "==", user.uid),
            where("status", "==", "Pending")
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setIsSubscribed(true);
          }
        } catch (err) {
          console.error("Error checking stock subscription:", err);
        }
      }
    };
    
    checkSubscription();
  }, [id, user]);

  const handleNotifyMe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !id) return;
    if (!notifyEmail.trim()) {
      alert("Please enter a valid email address.");
      return;
    }

    setSubmittingNotify(true);
    try {
      const subscriptionData = {
        productId: id,
        productBrand: product.brand,
        productName: product.title,
        userId: user ? user.uid : null,
        email: notifyEmail.trim().toLowerCase(),
        phone: notifyPhone.trim(),
        createdAt: new Date().toISOString(),
        status: "Pending"
      };

      // Save to Firestore
      try {
        const subsRef = collection(db, "back_in_stock_subscriptions");
        await addDoc(subsRef, subscriptionData);
      } catch (firestoreErr) {
        console.warn("Firestore save failed, falling back to localStorage", firestoreErr);
      }

      // Prepend or add to localStorage
      const localSubs = JSON.parse(localStorage.getItem("neelsutra_stock_subscriptions") || "[]");
      const exists = localSubs.some((s: any) => s.productId === id && s.email === subscriptionData.email && s.status === "Pending");
      if (!exists) {
        localSubs.push(subscriptionData);
        localStorage.setItem("neelsutra_stock_subscriptions", JSON.stringify(localSubs));
      }

      setIsSubscribed(true);
      setShowNotifyModal(false);
      setToast("Alert registered! We'll notify you.");
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to register alert. Please try again.");
    } finally {
      setSubmittingNotify(false);
    }
  };

  // Check local wishlist on load
  useEffect(() => {
    if (!id) return;
    const localWishlist = JSON.parse(localStorage.getItem("neelsutra_wishlist") || "[]");
    setIsWishlisted(localWishlist.includes(id));
  }, [id]);

  const toggleWishlist = () => {
    if (!id) return;
    const localWishlist = JSON.parse(localStorage.getItem("neelsutra_wishlist") || "[]");
    let newWishlist;
    if (isWishlisted) {
      newWishlist = localWishlist.filter((itemId: string) => itemId !== id);
      setToast("Removed from Wishlist");
    } else {
      newWishlist = [...localWishlist, id];
      setToast("Added to Wishlist!");
    }
    localStorage.setItem("neelsutra_wishlist", JSON.stringify(newWishlist));
    setIsWishlisted(!isWishlisted);
    setTimeout(() => setToast(""), 2000);
  };

  const handleShare = async () => {
    if (!product) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `NeelSutra - ${product.brand}`,
          text: `Check out ${product.title} on NeelSutra!`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setToast("Link copied to clipboard!");
        setTimeout(() => setToast(""), 3000);
      }
    } catch (err) {
      console.log("Error sharing:", err);
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "products", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() });
        } else {
          setProduct(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleAdd = async () => {
    if (!product) return;

    if (product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0) {
      setToast("This item is currently out of stock.");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    const isFashion = product.category?.toLowerCase() === "fashion";
    if (isFashion && !selectedSize) {
      setToast("Please select a size first!");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    setAdding(true);
    await addToBag({
      productId: product.id,
      brand: product.brand,
      title: product.title,
      price: product.price,
      image: product.image,
      size: selectedSize,
      gstRate: product.gstRate || 0,
    });
    setAdding(false);
    setShowAddedModal(true);
  };

  const handleBuyNow = async () => {
    if (!product) return;

    if (product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0) {
      setToast("This item is currently out of stock.");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    const isFashion = product.category?.toLowerCase() === "fashion";
    if (isFashion && !selectedSize) {
      setToast("Please select a size first!");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    setAdding(true);
    await addToBag({
      productId: product.id,
      brand: product.brand,
      title: product.title,
      price: product.price,
      image: product.image,
      size: selectedSize,
      gstRate: product.gstRate || 0,
    });
    setAdding(false);
    router.push("/checkout");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white w-full max-w-md mx-auto">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white w-full max-w-md mx-auto">
        <p className="text-gray-500">Product not found.</p>
        <button onClick={() => router.push("/")} className="mt-4 text-pink-600 font-bold">Go Home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white w-full max-w-md mx-auto relative pb-36">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
        <button onClick={() => router.back()} className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <div className="flex space-x-2">
          <button onClick={handleShare} className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm">
            <Share2 size={20} className="text-gray-800" />
          </button>
          <button onClick={toggleWishlist} className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm">
            <Heart size={20} className={isWishlisted ? "text-pink-600 fill-slate-900" : "text-gray-800"} />
          </button>
        </div>
      </div>

      {/* Product Image / Carousel */}
      <div className="relative bg-gray-150">
        <div className="w-full aspect-[3/4] bg-gray-100 relative overflow-hidden">
          <img
            src={product.images && product.images.length > 0 ? product.images[activeImageIdx] : product.image}
            alt={product.brand}
            className="w-full h-full object-cover transition-all duration-305"
          />
          
          {/* Navigation Arrows for Carousel */}
          {product.images && product.images.length > 1 && (
            <>
              <button 
                onClick={() => setActiveImageIdx(prev => (prev - 1 + product.images.length) % product.images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 backdrop-blur hover:bg-white shadow-sm flex items-center justify-center text-gray-800 transition-all font-black text-sm cursor-pointer z-10"
              >
                &lsaquo;
              </button>
              <button 
                onClick={() => setActiveImageIdx(prev => (prev + 1) % product.images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 backdrop-blur hover:bg-white shadow-sm flex items-center justify-center text-gray-800 transition-all font-black text-sm cursor-pointer z-10"
              >
                &rsaquo;
              </button>
              
              {/* Pagination Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10">
                {product.images.map((_: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeImageIdx === idx ? 'bg-pink-600 w-3' : 'bg-gray-300/80'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {product.images && product.images.length > 1 && (
          <div className="flex gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 overflow-x-auto hide-scrollbar">
            {product.images.map((imgUrl: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setActiveImageIdx(idx)}
                className={`w-10 h-14 rounded-md overflow-hidden bg-gray-100 border-2 transition-all flex-shrink-0 cursor-pointer
                  ${activeImageIdx === idx ? 'border-pink-500 scale-95 shadow-sm' : 'border-transparent'}`}
              >
                <img src={imgUrl} alt={`Angle ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 bg-white border-b border-gray-100">
        <h1 className="text-2xl font-serif font-bold text-pink-600">{product.brand}</h1>
        <p className="text-gray-500 mt-1 tracking-tight">{product.title}</p>
        
        <div className="mt-4 flex items-baseline space-x-3">
          <span className="text-3xl font-extrabold text-pink-600">₹{product.price}</span>
          <span className="text-sm text-gray-400 line-through font-medium">₹{Math.round(product.price * 1.5)}</span>
        </div>
        <p className="text-[10px] text-green-700 font-bold tracking-widest uppercase mt-2">inclusive of all taxes</p>
        
        <div className="mt-3.5">
          {product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0 ? (
            <span className="bg-red-50 text-red-700 border border-red-100 rounded px-2.5 py-1 text-xs font-bold inline-flex items-center gap-1">
              🚫 Out of Stock
            </span>
          ) : Number(product.quantity) <= 5 ? (
            <span className="bg-amber-50 text-amber-700 border border-amber-100 rounded px-2.5 py-1 text-xs font-bold inline-flex items-center gap-1 animate-pulse">
              ⚡ Only {product.quantity} pieces available!
            </span>
          ) : (
            <span className="bg-green-50 text-green-700 border border-green-100 rounded px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1">
              ✓ In Stock ({product.quantity} units)
            </span>
          )}
        </div>
      </div>

      {/* Size Selection */}
      {product.category?.toLowerCase() === "fashion" && (
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            Select Size
          </h2>
          <button onClick={() => setShowSizeGuide(true)} className="text-pink-600 font-bold text-sm uppercase flex items-center gap-1 hover:underline">
            Size Guide
          </button>
        </div>
        
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
          {sizes.map((size) => (
            <button 
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`w-12 h-12 rounded-full border flex items-center justify-center font-bold transition-colors flex-shrink-0
                ${selectedSize === size 
                  ? 'border-pink-500 bg-slate-50 text-pink-600' 
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}
            >
              {size}
            </button>
          ))}
        </div>
        {!selectedSize && toast === "Please select a size first!" && (
          <p className="text-red-500 text-xs font-bold mt-2 animate-bounce">Please select a size</p>
        )}
      </div>
      )}

      {/* Delivery & Trust */}
      <div className="p-4 bg-white space-y-4">
        <div className="flex items-start gap-3">
          <Truck className="text-gray-600 mt-1" size={20} />
          <div>
            <h3 className="font-bold text-sm text-gray-900">Delivery</h3>
            <p className="text-sm text-gray-600">Estimated Delivery: 5-7 Days</p>
            <p className="text-xs text-gray-500 mt-1">Cash on delivery available.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <ShieldCheck className="text-gray-600 mt-1" size={20} />
          <div>
            <h3 className="font-bold text-sm text-gray-900">100% Original Products</h3>
            <p className="text-sm text-gray-600">Pay on delivery might be available</p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && toast !== "Please select a size first!" && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium z-50 animate-fade-in-up">
          {toast}
        </div>
      )}

      {/* Bottom Action Bar */}
      <div 
        className="fixed w-full max-w-md left-1/2 -translate-x-1/2 bg-white border-t border-gray-200 p-3 flex space-x-2 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
        style={{ bottom: "calc(70px + env(safe-area-inset-bottom, 0px))" }}
      >
        <button onClick={toggleWishlist} className={`p-3.5 border rounded-md flex items-center justify-center transition-colors ${isWishlisted ? "border-pink-500 text-pink-600 bg-slate-50" : "border-gray-300 text-gray-800"}`} title="Wishlist">
          <Heart size={20} className={isWishlisted ? "fill-slate-900" : ""} />
        </button>
        {product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0 ? (
          isSubscribed ? (
            <button 
              disabled
              className="flex-1 py-3.5 bg-emerald-50 text-emerald-600 border border-emerald-250 rounded-md font-bold flex items-center justify-center gap-1.5 text-sm uppercase cursor-not-allowed"
            >
              <Bell size={16} className="fill-emerald-600" />
              <span>✓ ON THE LIST</span>
            </button>
          ) : (
            <button 
              onClick={() => setShowNotifyModal(true)}
              className="flex-1 py-3.5 bg-slate-900 text-white rounded-md font-bold flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors text-sm cursor-pointer uppercase tracking-wider shadow-md hover:shadow-lg"
            >
              <Bell size={16} />
              <span>Notify Me</span>
            </button>
          )
        ) : (
          <>
            <button 
              onClick={handleAdd}
              disabled={adding}
              className="flex-1 py-3.5 border border-pink-500 text-pink-600 bg-white rounded-md font-bold flex items-center justify-center hover:bg-slate-50 disabled:opacity-70 transition-colors text-sm cursor-pointer"
            >
              ADD TO BAG
            </button>
            <button 
              onClick={handleBuyNow}
              disabled={adding}
              className="flex-1 py-3.5 bg-pink-500 rounded-md font-bold text-white flex items-center justify-center hover:bg-pink-600 disabled:opacity-70 transition-colors text-sm cursor-pointer"
            >
              {adding ? "PROCESSING..." : "BUY NOW"}
            </button>
          </>
        )}
      </div>

      {/* Size Guide Modal */}
      {showSizeGuide && product.category?.toLowerCase() === "fashion" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-6 transform transition-transform duration-300 translate-y-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Size Guide (in inches)</h2>
              <button onClick={() => setShowSizeGuide(false)} className="text-gray-500 p-2"><Info size={20}/></button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3 font-bold text-gray-700">Size</th>
                    <th className="py-2 px-3 font-bold text-gray-700">Bust</th>
                    <th className="py-2 px-3 font-bold text-gray-700">Waist</th>
                    <th className="py-2 px-3 font-bold text-gray-700">Hips</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-2 px-3 font-bold">S</td><td className="py-2 px-3">34</td><td className="py-2 px-3">28</td><td className="py-2 px-3">36</td></tr>
                  <tr><td className="py-2 px-3 font-bold">M</td><td className="py-2 px-3">36</td><td className="py-2 px-3">30</td><td className="py-2 px-3">38</td></tr>
                  <tr><td className="py-2 px-3 font-bold">L</td><td className="py-2 px-3">38</td><td className="py-2 px-3">32</td><td className="py-2 px-3">40</td></tr>
                  <tr><td className="py-2 px-3 font-bold">XL</td><td className="py-2 px-3">40</td><td className="py-2 px-3">34</td><td className="py-2 px-3">42</td></tr>
                  <tr><td className="py-2 px-3 font-bold">XXL</td><td className="py-2 px-3">42</td><td className="py-2 px-3">36</td><td className="py-2 px-3">44</td></tr>
                </tbody>
              </table>
            </div>

            <button onClick={() => setShowSizeGuide(false)} className="w-full bg-pink-500 text-white font-bold py-3 mt-6 rounded-md">
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Added to Bag Slide-Up Modal */}
      {showAddedModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-2xl transform transition-transform duration-300 translate-y-0 animate-slide-up relative">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-xs font-bold">✓</span>
                </div>
                <h3 className="font-bold text-gray-900 text-base">Added to Shopping Bag</h3>
              </div>
              <button onClick={() => setShowAddedModal(false)} className="text-gray-400 hover:text-gray-600 font-bold p-1 text-xl">&times;</button>
            </div>

            <div className="flex space-x-4 mb-6 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-16 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                <img src={product.image} alt={product.brand} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-gray-900 truncate">{product.brand}</h4>
                <p className="text-xs text-gray-500 truncate mt-0.5">{product.title}</p>
                {selectedSize && (
                  <p className="text-xs text-gray-500 mt-1">Size: <span className="font-bold text-gray-800">{selectedSize}</span></p>
                )}
                <p className="text-sm font-bold text-pink-600 mt-1">₹{product.price}</p>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => {
                  setShowAddedModal(false);
                  router.push("/checkout");
                }}
                className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-xl hover:bg-pink-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 text-sm cursor-pointer"
              >
                <span>PROCEED TO CHECKOUT</span>
              </button>
              <button 
                onClick={() => {
                  setShowAddedModal(false);
                  router.push("/bag");
                }}
                className="w-full border border-pink-500 text-pink-600 font-bold py-3.5 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer bg-white"
              >
                <span>GO TO BAG</span>
              </button>
              <button 
                onClick={() => setShowAddedModal(false)}
                className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-all text-xs cursor-pointer"
              >
                CONTINUE SHOPPING
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notify Me Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-gray-150 p-6 relative animate-scale-in">
            <button 
              type="button"
              onClick={() => setShowNotifyModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-650 transition-colors cursor-pointer"
              disabled={submittingNotify}
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-12 h-12 bg-pink-50 rounded-full flex items-center justify-center text-pink-500 mb-4 border border-pink-100 shadow-inner">
                <Bell size={22} className="animate-bounce" />
              </div>
              <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">Get Notified</h3>
              <p className="text-xs text-gray-500 mt-2 px-1">
                We'll email you a notification as soon as <strong>{product.brand} - {product.title}</strong> is back in stock!
              </p>
            </div>

            <form onSubmit={handleNotifyMe} className="mt-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Email Address *</label>
                <input 
                  type="email" 
                  required
                  value={notifyEmail}
                  onChange={e => setNotifyEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs focus:ring-1 focus:ring-pink-500 focus:border-pink-500 outline-none text-gray-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Mobile Number (Optional)</label>
                <input 
                  type="tel"
                  value={notifyPhone}
                  onChange={e => setNotifyPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs focus:ring-1 focus:ring-pink-500 focus:border-pink-500 outline-none text-gray-800 font-medium"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={submittingNotify}
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-lg transition-colors text-xs uppercase tracking-wider shadow-md disabled:opacity-70 cursor-pointer"
                >
                  {submittingNotify ? "Saving..." : "Notify Me when available"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
