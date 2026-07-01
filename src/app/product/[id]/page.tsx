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
  const [selectedVariantColor, setSelectedVariantColor] = useState("");
  const [selectedVariantMaterial, setSelectedVariantMaterial] = useState("");
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const sizes = ["S", "M", "L", "XL", "XXL"];

  const availableColors = product?.variants
    ? (Array.from(new Set(product.variants.map((v: any) => v.color).filter(Boolean))) as string[])
    : [];
  const availableSizes = product?.variants
    ? (Array.from(new Set(product.variants.map((v: any) => v.size).filter(Boolean))) as string[])
    : [];
  const availableMaterials = product?.variants
    ? (Array.from(new Set(product.variants.map((v: any) => v.material).filter(Boolean))) as string[])
    : [];

  const matchedVariant = product?.variants?.find((v: any) => {
    const matchSize = !v.size || v.size === selectedSize;
    const matchColor = !v.color || v.color === selectedVariantColor;
    const matchMaterial = !v.material || v.material === selectedVariantMaterial;
    return matchSize && matchColor && matchMaterial;
  });

  const displayPrice = matchedVariant ? matchedVariant.price : (product?.price || 0);
  const displayMrp = matchedVariant ? matchedVariant.mrp : (product?.mrp || Math.round((product?.price || 0) * 1.5));

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
      try {
        const stored = localStorage.getItem("craftstyle_stock_subscriptions");
        if (stored) {
          const localSubs = JSON.parse(stored);
          const localMatched = localSubs.some((s: any) => s.productId === id && s.status === "Pending");
          if (localMatched) {
            setIsSubscribed(true);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to parse local subscriptions:", e);
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
      try {
        const stored = localStorage.getItem("craftstyle_stock_subscriptions");
        const localSubs = stored ? JSON.parse(stored) : [];
        const exists = localSubs.some((s: any) => s.productId === id && s.email === subscriptionData.email && s.status === "Pending");
        if (!exists) {
          localSubs.push(subscriptionData);
          localStorage.setItem("craftstyle_stock_subscriptions", JSON.stringify(localSubs));
        }
      } catch (e) {
        console.error("Failed to write local stock subscription:", e);
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
    try {
      const stored = localStorage.getItem("craftstyle_wishlist");
      if (stored) {
        const localWishlist = JSON.parse(stored);
        setIsWishlisted(localWishlist.includes(id));
      }
    } catch (e) {
      console.error("Failed to parse wishlist:", e);
    }
  }, [id]);

  const toggleWishlist = () => {
    if (!id) return;
    try {
      const stored = localStorage.getItem("craftstyle_wishlist");
      const localWishlist = stored ? JSON.parse(stored) : [];
      let newWishlist;
      if (isWishlisted) {
        newWishlist = localWishlist.filter((itemId: string) => itemId !== id);
        setToast("Removed from Wishlist");
      } else {
        newWishlist = [...localWishlist, id];
        setToast("Added to Wishlist!");
      }
      localStorage.setItem("craftstyle_wishlist", JSON.stringify(newWishlist));
      setIsWishlisted(!isWishlisted);
    } catch (e) {
      console.error("Failed to toggle wishlist:", e);
    }
    setTimeout(() => setToast(""), 2000);
  };

  const handleShare = async () => {
    if (!product) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Craft Style - ${product.brand}`,
          text: `Check out ${product.title} on Craft Style!`,
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

  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Reset scroll and state when page ID changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [id]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!product) return;
      try {
        const { collection, getDocs } = await import("firebase/firestore");
        const productsRef = collection(db, "products");
        const allProductsSnap = await getDocs(productsRef);
        const allProductsList: any[] = [];
        allProductsSnap.forEach((doc) => {
          if (doc.id !== product.id) {
            allProductsList.push({ id: doc.id, ...doc.data() });
          }
        });

        const currentCategory = product.category || "";
        const sameCategoryItems = allProductsList.filter(item => 
          item.category && item.category.toLowerCase() === currentCategory.toLowerCase()
        );
        const differentCategoryItems = allProductsList.filter(item => 
          !item.category || item.category.toLowerCase() !== currentCategory.toLowerCase()
        );

        // Mix same category and different categories (max 5 of each)
        const selectedSame = sameCategoryItems.sort(() => 0.5 - Math.random()).slice(0, 5);
        const selectedDiff = differentCategoryItems.sort(() => 0.5 - Math.random()).slice(0, 5);

        setSuggestions([...selectedSame, ...selectedDiff]);
      } catch (err) {
        console.error("Error fetching suggestions", err);
      }
    };

    fetchSuggestions();
  }, [product]);

  const handleAdd = async () => {
    if (!product) return;

    let finalPrice = product.price;
    let finalMrp = product.mrp || Math.round(product.price * 1.5);
    let finalSizeString = selectedSize;

    if (product.variants && product.variants.length > 0) {
      if (availableColors.length > 0 && !selectedVariantColor) {
        setToast("Please select a color first!");
        setTimeout(() => setToast(""), 3000);
        return;
      }
      if (availableSizes.length > 0 && !selectedSize) {
        setToast("Please select a size first!");
        setTimeout(() => setToast(""), 3000);
        return;
      }
      if (availableMaterials.length > 0 && !selectedVariantMaterial) {
        setToast("Please select a material first!");
        setTimeout(() => setToast(""), 3000);
        return;
      }

      if (!matchedVariant) {
        setToast("Selected combination is unavailable.");
        setTimeout(() => setToast(""), 3500);
        return;
      }

      if (matchedVariant.stock <= 0) {
        setToast("Selected combination is out of stock.");
        setTimeout(() => setToast(""), 3500);
        return;
      }

      finalPrice = matchedVariant.price;
      finalMrp = matchedVariant.mrp;
      finalSizeString = [matchedVariant.size, matchedVariant.color, matchedVariant.material].filter(Boolean).join(" / ");
    } else {
      const isFashion = product.category?.toLowerCase() === "fashion";
      if (isFashion) {
        if (!selectedSize) {
          setToast("Please select a size first!");
          setTimeout(() => setToast(""), 3000);
          return;
        }
        const sizesInv = product.sizesInventory || {};
        const sizeStock = Number(sizesInv[selectedSize] || 0);
        if (sizeStock <= 0) {
          setToast(`Size ${selectedSize} is currently out of stock.`);
          setTimeout(() => setToast(""), 3000);
          return;
        }
      } else {
        if (product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0) {
          setToast("This item is currently out of stock.");
          setTimeout(() => setToast(""), 3000);
          return;
        }
      }
    }

    setAdding(true);
    await addToBag({
      productId: product.id,
      brand: product.brand,
      title: product.title,
      price: finalPrice,
      image: product.image,
      size: finalSizeString || "Default",
      gstRate: product.gstRate || 0,
      mrp: finalMrp,
    });
    setAdding(false);
    setShowAddedModal(true);
  };

  const handleBuyNow = async () => {
    if (!product) return;

    let finalPrice = product.price;
    let finalMrp = product.mrp || Math.round(product.price * 1.5);
    let finalSizeString = selectedSize;

    if (product.variants && product.variants.length > 0) {
      if (availableColors.length > 0 && !selectedVariantColor) {
        setToast("Please select a color first!");
        setTimeout(() => setToast(""), 3000);
        return;
      }
      if (availableSizes.length > 0 && !selectedSize) {
        setToast("Please select a size first!");
        setTimeout(() => setToast(""), 3000);
        return;
      }
      if (availableMaterials.length > 0 && !selectedVariantMaterial) {
        setToast("Please select a material first!");
        setTimeout(() => setToast(""), 3000);
        return;
      }

      if (!matchedVariant) {
        setToast("Selected combination is unavailable.");
        setTimeout(() => setToast(""), 3500);
        return;
      }

      if (matchedVariant.stock <= 0) {
        setToast("Selected combination is out of stock.");
        setTimeout(() => setToast(""), 3500);
        return;
      }

      finalPrice = matchedVariant.price;
      finalMrp = matchedVariant.mrp;
      finalSizeString = [matchedVariant.size, matchedVariant.color, matchedVariant.material].filter(Boolean).join(" / ");
    } else {
      const isFashion = product.category?.toLowerCase() === "fashion";
      if (isFashion) {
        if (!selectedSize) {
          setToast("Please select a size first!");
          setTimeout(() => setToast(""), 3000);
          return;
        }
        const sizesInv = product.sizesInventory || {};
        const sizeStock = Number(sizesInv[selectedSize] || 0);
        if (sizeStock <= 0) {
          setToast(`Size ${selectedSize} is currently out of stock.`);
          setTimeout(() => setToast(""), 3000);
          return;
        }
      } else {
        if (product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0) {
          setToast("This item is currently out of stock.");
          setTimeout(() => setToast(""), 3000);
          return;
        }
      }
    }

    setAdding(true);
    await addToBag({
      productId: product.id,
      brand: product.brand,
      title: product.title,
      price: finalPrice,
      image: product.image,
      size: finalSizeString || "Default",
      gstRate: product.gstRate || 0,
      mrp: finalMrp,
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
        
        <div className="mt-4 flex items-baseline space-x-3 flex-wrap">
          <span className="text-3xl font-extrabold text-pink-600">₹{displayPrice}</span>
          {(() => {
            const mrpVal = displayMrp;
            const discountPercent = mrpVal > displayPrice ? Math.round(((mrpVal - displayPrice) / mrpVal) * 100) : 0;
            return (
              <>
                {mrpVal > displayPrice && (
                  <>
                    <span className="text-sm text-gray-400 line-through font-medium">₹{mrpVal}</span>
                    <span className="text-sm font-bold text-orange-500">({discountPercent}% OFF)</span>
                  </>
                )}
              </>
            );
          })()}
        </div>
        <p className="text-[10px] text-green-700 font-bold tracking-widest uppercase mt-2">inclusive of all taxes</p>
        
        <div className="mt-3.5">
          {product.variants && product.variants.length > 0 ? (
            matchedVariant ? (
              matchedVariant.stock <= 0 ? (
                <span className="bg-red-50 text-red-700 border border-red-100 rounded px-2.5 py-1 text-xs font-bold inline-flex items-center gap-1">
                  🚫 Out of Stock
                </span>
              ) : matchedVariant.stock <= 5 ? (
                <span className="bg-amber-50 text-amber-700 border border-amber-100 rounded px-2.5 py-1 text-xs font-bold inline-flex items-center gap-1 animate-pulse">
                  ⚡ Only {matchedVariant.stock} pieces left in this combination!
                </span>
              ) : (
                <span className="bg-green-50 text-green-700 border border-green-100 rounded px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1">
                  ✓ Option in Stock ({matchedVariant.stock} units available)
                </span>
              )
            ) : (
              <span className="bg-slate-50 text-slate-600 border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1">
                👉 Select options to check availability (Total: {product.quantity || 0} units)
              </span>
            )
          ) : (
            product.category?.toLowerCase() === "fashion" ? (
              selectedSize ? (
                (() => {
                  const sizeStock = Number((product.sizesInventory || {})[selectedSize] || 0);
                  if (sizeStock <= 0) {
                    return (
                      <span className="bg-red-50 text-red-700 border border-red-100 rounded px-2.5 py-1 text-xs font-bold inline-flex items-center gap-1">
                        🚫 Size {selectedSize} is Out of Stock
                      </span>
                    );
                  } else if (sizeStock <= 5) {
                    return (
                      <span className="bg-amber-50 text-amber-700 border border-amber-100 rounded px-2.5 py-1 text-xs font-bold inline-flex items-center gap-1 animate-pulse">
                        ⚡ Only {sizeStock} pieces left in size {selectedSize}!
                      </span>
                    );
                  } else {
                    return (
                      <span className="bg-green-50 text-green-700 border border-green-100 rounded px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1">
                        ✓ Size {selectedSize} in Stock ({sizeStock} units)
                      </span>
                    );
                  }
                })()
              ) : (
                <span className="bg-slate-50 text-slate-600 border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1">
                  👉 Select a size to check availability (Total: {product.quantity || 0} units)
                </span>
              )
            ) : (
              product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0 ? (
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
              )
            )
          )}
        </div>
      </div>
      {/* Size Selection / Options Selection */}
      {product.variants && product.variants.length > 0 ? (
        <div className="p-4 bg-white border-b border-gray-100 space-y-4">
          <h2 className="font-bold text-gray-905 text-sm">Select Custom Options</h2>
          
          {availableColors.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Color</span>
              <div className="flex gap-2 flex-wrap">
                {availableColors.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedVariantColor(color)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer
                      ${selectedVariantColor === color
                        ? 'border-pink-500 bg-pink-50 text-pink-650 font-bold shadow-sm'
                        : 'border-gray-350 text-gray-750 hover:border-gray-400'}`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableSizes.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Size</span>
              <div className="flex gap-2 flex-wrap">
                {availableSizes.map(size => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer
                      ${selectedSize === size
                        ? 'border-pink-500 bg-pink-50 text-pink-650 font-bold shadow-sm'
                        : 'border-gray-355 text-gray-755 hover:border-gray-400'}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableMaterials.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Material</span>
              <div className="flex gap-2 flex-wrap">
                {availableMaterials.map(material => (
                  <button
                    key={material}
                    onClick={() => setSelectedVariantMaterial(material)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer
                      ${selectedVariantMaterial === material
                        ? 'border-pink-500 bg-pink-50 text-pink-650 font-bold shadow-sm'
                        : 'border-gray-355 text-gray-755 hover:border-gray-400'}`}
                  >
                    {material}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        product.category?.toLowerCase() === "fashion" && (
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
              {sizes.map((size) => {
                const sizesInv = product.sizesInventory || {};
                const stock = Number(sizesInv[size] || 0);
                const isOutOfStock = stock <= 0;
                return (
                  <button 
                    key={size}
                    disabled={isOutOfStock}
                    onClick={() => setSelectedSize(size)}
                    className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center font-bold transition-all flex-shrink-0 relative cursor-pointer
                      ${isOutOfStock 
                        ? 'border-gray-200 text-gray-300 bg-gray-50/50 cursor-not-allowed line-through' 
                        : selectedSize === size 
                          ? 'border-pink-500 bg-slate-50 text-pink-600 shadow-sm' 
                          : 'border-gray-305 text-gray-700 hover:border-gray-400'}`}
                  >
                    {size}
                    {isOutOfStock && (
                      <span className="absolute bottom-1 text-[7px] text-red-500 font-extrabold uppercase scale-90">Out</span>
                    )}
                  </button>
                );
              })}
            </div>
            {!selectedSize && toast === "Please select a size first!" && (
              <p className="text-red-500 text-xs font-bold mt-2 animate-bounce">Please select a size</p>
            )}
          </div>
        )
      )}          {/* Product Descriptions Section */}
      {(product.shortDescription || product.fullDescription) && (
        <div className="p-4 bg-white border-b border-gray-100 space-y-2">
          <h2 className="font-bold text-gray-900 uppercase text-[10px] tracking-wider text-gray-500">Product Description</h2>
          {product.shortDescription && (
            <p className="text-gray-800 text-xs font-semibold leading-relaxed">
              {product.shortDescription}
            </p>
          )}
          {product.fullDescription && (
            <p className="text-gray-650 text-[11px] leading-relaxed whitespace-pre-line">
              {product.fullDescription}
            </p>
          )}
        </div>
      )}

      {/* Technical Specifications Section */}
      {product.attributes && Object.keys(product.attributes).length > 0 && (
        <div className="p-4 bg-white border-b border-gray-100 space-y-2">
          <h2 className="font-bold text-gray-900 uppercase text-[10px] tracking-wider text-gray-500">Specifications</h2>
          <div className="border border-gray-100 rounded-xl overflow-hidden text-[11px]">
            <table className="w-full text-left border-collapse">
              <tbody>
                {Object.entries(product.attributes).map(([key, val]: any, index) => (
                  <tr key={key} className={index % 2 === 0 ? "bg-gray-50/50" : "bg-white"}>
                    <td className="py-2 px-3 font-semibold text-gray-400 border-b border-gray-100/50 w-5/12">{key}</td>
                    <td className="py-2 px-3 text-gray-800 border-b border-gray-100/50 font-medium">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manufacturing & Care Details Section */}
      {(product.countryOfOrigin || product.manufacturer || product.packer || product.hsnCode || product.sku || product.shipping) && (
        <div className="p-4 bg-white border-b border-gray-100 space-y-2">
          <h2 className="font-bold text-gray-900 uppercase text-[10px] tracking-wider text-gray-500">Manufacturing & Product Info</h2>
          <div className="space-y-2 text-[11px]">
            {product.sku && (
              <div className="flex justify-between">
                <span className="font-semibold text-gray-400">Product SKU</span>
                <span className="font-bold text-gray-800">{product.sku}</span>
              </div>
            )}
            {product.countryOfOrigin && (
              <div className="flex justify-between">
                <span className="font-semibold text-gray-400">Country of Origin</span>
                <span className="font-medium text-gray-800">{product.countryOfOrigin}</span>
              </div>
            )}
            {product.hsnCode && (
              <div className="flex justify-between">
                <span className="font-semibold text-gray-400">HSN Code</span>
                <span className="font-medium text-gray-800">{product.hsnCode}</span>
              </div>
            )}
            {product.manufacturer && (
              <div className="flex justify-between items-start gap-4">
                <span className="font-semibold text-gray-400 whitespace-nowrap">Manufacturer</span>
                <span className="font-medium text-gray-800 text-right">{product.manufacturer}</span>
              </div>
            )}
            {product.packer && (
              <div className="flex justify-between items-start gap-4">
                <span className="font-semibold text-gray-400 whitespace-nowrap">Packer</span>
                <span className="font-medium text-gray-800 text-right">{product.packer}</span>
              </div>
            )}
            {product.shipping && (product.shipping.packageWeight || product.shipping.packageLength) && (
              <div className="flex justify-between pt-1.5 border-t border-gray-50">
                <span className="font-semibold text-gray-400">Dimensions & Weight</span>
                <span className="font-medium text-gray-800">
                  {product.shipping.packageLength || 0} x {product.shipping.packageWidth || 0} x {product.shipping.packageHeight || 0} cm
                  {product.shipping.packageWeight ? ` (${product.shipping.packageWeight} kg)` : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delivery & Trust */}
      <div className="p-4 bg-white space-y-4">
        <div className="flex items-start gap-3">
          <Truck className="text-gray-650 mt-1" size={20} />
          <div>
            <h3 className="font-bold text-sm text-gray-900">Delivery</h3>
            <p className="text-sm text-gray-600">Estimated Delivery: 5-7 Days</p>
            <p className="text-xs text-gray-500 mt-1">Cash on delivery available.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <ShieldCheck className="text-gray-655 mt-1" size={20} />
          <div>
            <h3 className="font-bold text-sm text-gray-900">100% Original Products</h3>
            <p className="text-sm text-gray-600">Pay on delivery might be available</p>
          </div>
        </div>
      </div>

      {/* Suggested Items Section */}
      {suggestions.length > 0 && (
        <div className="p-4 bg-white border-t border-gray-100 mt-4 pb-20">
          <h2 className="font-bold text-gray-900 uppercase text-[10px] tracking-wider text-gray-500 mb-3.5">You May Also Like</h2>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-3 snap-x">
            {suggestions.map((item) => {
              const itemMrp = item.mrp || Math.round(item.price * 1.5);
              const discountPercent = itemMrp > item.price ? Math.round(((itemMrp - item.price) / itemMrp) * 100) : 0;
              return (
                <div 
                  key={item.id} 
                  onClick={() => {
                    router.push(`/product/${item.id}`);
                    setActiveImageIdx(0);
                    setSelectedSize("");
                    setSelectedVariantColor("");
                    setSelectedVariantMaterial("");
                  }}
                  className="w-32 flex-shrink-0 cursor-pointer snap-start group"
                >
                  <div className="w-32 h-44 bg-gray-150 rounded-xl overflow-hidden relative shadow-sm border border-gray-100/50 group-hover:shadow-md transition-all duration-300">
                    <img src={item.image} alt={item.brand} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {discountPercent > 0 && (
                      <div className="absolute top-2 left-2 bg-pink-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow">
                        {discountPercent}% OFF
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-left">
                    <h3 className="font-bold text-[11px] text-gray-900 truncate uppercase tracking-tight">{item.brand}</h3>
                    <p className="text-[10px] text-gray-500 truncate mt-0.5 leading-normal">{item.title}</p>
                    <div className="mt-1 flex items-baseline space-x-1.5">
                      <span className="text-[11px] font-extrabold text-pink-600 font-sans">₹{item.price}</span>
                      {itemMrp > item.price && (
                        <span className="text-[9px] text-gray-400 line-through font-sans">₹{itemMrp}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && toast !== "Please select a size first!" && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium z-50 animate-fade-in-up">
          {toast}
        </div>
      )}

      {/* Bottom Action Bar */}
      <div 
        className="fixed w-full max-w-md left-1/2 -translate-x-1/2 bg-white border-t border-gray-200 p-3 flex space-x-2 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
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
