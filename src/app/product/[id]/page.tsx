"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, addDoc, query, where, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeft, Share2, Heart, ShoppingBag, Info, Truck, ShieldCheck, Bell, X } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";

const parseShortDescription = (text: string): string[] => {
  if (!text) return [];
  const rawLines = text.split(/\r?\n/);
  const points: string[] = [];
  
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.includes("•") || trimmed.includes("*") || trimmed.includes("- ")) {
      const parts = trimmed
        .split(/[•\*\-]/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
      points.push(...parts);
    } else {
      points.push(trimmed);
    }
  }
  
  return points
    .map(p => p.replace(/^([•\*\-\d\.\)\s])+/, ""))
    .map(p => p.trim())
    .filter(p => p.length > 0);
};

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
  const [quantity, setQuantity] = useState(1);
  const [deliveryInfo, setDeliveryInfo] = useState("Deliver to Mukesh - Jodhpur 342008");

  // Dynamically load delivery information
  useEffect(() => {
    const fetchDeliveryInfo = async () => {
      let name = user?.displayName || user?.email?.split("@")[0] || "Mukesh";
      let pin = "342008";
      let city = "Jodhpur";

      const localAddr = localStorage.getItem("craftstyle_mock_user_address");
      if (localAddr) {
        try {
          const parsed = JSON.parse(localAddr);
          if (parsed.city) city = parsed.city;
          if (parsed.pin) pin = parsed.pin;
        } catch (e) {
          console.error(e);
        }
      } else if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.city) city = data.city;
            if (data.pin) pin = data.pin;
          }
        } catch (err) {
          console.error("Failed to fetch profile", err);
        }
      }

      setDeliveryInfo(`Deliver to ${name} - ${city} ${pin}`);
    };
    
    fetchDeliveryInfo();
  }, [user]);

  // Reset quantity to 1 when options change
  useEffect(() => {
    setQuantity(1);
  }, [selectedSize, selectedVariantColor, selectedVariantMaterial, id]);

  // Touch Swipe States
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [touchEndX, setTouchEndX] = useState<number>(0);
  const [touchEndY, setTouchEndY] = useState<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
    setTouchEndX(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    const imgCount = product?.images?.length || 0;
    if (imgCount <= 1) return;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // swipe left -> next image
        setActiveImageIdx((prev) => (prev + 1) % imgCount);
      } else {
        // swipe right -> prev image
        setActiveImageIdx((prev) => (prev - 1 + imgCount) % imgCount);
      }
    }
  };
  const sizes = ["S", "M", "L", "XL", "XXL"];

  const getFormattedSize = (v: any) => `${v.size}${v.sizeUnit ? ' ' + v.sizeUnit : ''}`;
  const getVariantLabel = (v: any) => {
    const parts = [];
    if (v.color) parts.push(v.color);
    const formattedSize = getFormattedSize(v);
    if (formattedSize) parts.push(formattedSize);
    return parts.join(" / ");
  };

  const availableColors = product?.variants
    ? (Array.from(new Set(product.variants.map((v: any) => v.color).filter(Boolean))) as string[])
    : [];
  const availableSizes = product?.variants
    ? (Array.from(new Set(product.variants.map(getFormattedSize).filter(Boolean))) as string[])
    : [];
  const availableMaterials = product?.variants
    ? (Array.from(new Set(product.variants.map((v: any) => v.material).filter(Boolean))) as string[])
    : [];



  // Click handlers with auto-selection of compatible variant attributes
  const handleSizeClick = (formattedSize: string) => {
    setSelectedSize(formattedSize);
    if (product?.variants && product.variants.length > 0) {
      const matchingVars = product.variants.filter((v: any) => getFormattedSize(v) === formattedSize);
      if (matchingVars.length > 0) {
        const isColorValid = matchingVars.some((v: any) => v.color === selectedVariantColor);
        if (!isColorValid) {
          const firstCompatible = matchingVars.find((v: any) => v.stock > 0) || matchingVars[0];
          setSelectedVariantColor(firstCompatible.color || "");
          setSelectedVariantMaterial(firstCompatible.material || "");
        }
      }
    }
  };

  const handleColorClick = (color: string) => {
    setSelectedVariantColor(color);
    if (product?.variants && product.variants.length > 0) {
      const matchingVars = product.variants.filter((v: any) => v.color === color);
      if (matchingVars.length > 0) {
        const isSizeValid = matchingVars.some((v: any) => getFormattedSize(v) === selectedSize);
        if (!isSizeValid) {
          const firstCompatible = matchingVars.find((v: any) => v.stock > 0) || matchingVars[0];
          setSelectedSize(firstCompatible.size ? getFormattedSize(firstCompatible) : "");
          setSelectedVariantMaterial(firstCompatible.material || "");
        }
      }
    }
  };

  const handleMaterialClick = (material: string) => {
    setSelectedVariantMaterial(material);
    if (product?.variants && product.variants.length > 0) {
      const matchingVars = product.variants.filter((v: any) => v.material === material);
      if (matchingVars.length > 0) {
        const isSizeValid = matchingVars.some((v: any) => getFormattedSize(v) === selectedSize);
        const isColorValid = matchingVars.some((v: any) => v.color === selectedVariantColor);
        if (!isSizeValid || !isColorValid) {
          const firstCompatible = matchingVars.find((v: any) => v.stock > 0) || matchingVars[0];
          setSelectedSize(firstCompatible.size ? getFormattedSize(firstCompatible) : "");
          setSelectedVariantColor(firstCompatible.color || "");
        }
      }
    }
  };

  const matchedVariant = product?.variants?.find((v: any) => {
    const matchSize = !v.size || getFormattedSize(v) === selectedSize;
    const matchColor = !v.color || v.color === selectedVariantColor;
    const matchMaterial = !v.material || v.material === selectedVariantMaterial;
    return matchSize && matchColor && matchMaterial;
  });

  const displayPrice = matchedVariant ? matchedVariant.price : (product?.price || 0);
  const displayMrp = matchedVariant ? matchedVariant.mrp : (product?.mrp || Math.round((product?.price || 0) * 1.5));

  const currentSize = matchedVariant 
    ? `${matchedVariant.size}${matchedVariant.sizeUnit ? ' ' + matchedVariant.sizeUnit : ''}` 
    : `${product?.size || ''}${product?.sizeUnit ? ' ' + product?.sizeUnit : ''}`;
  const currentColor = matchedVariant ? matchedVariant.color : (product?.color || '');
  const currentMaterial = matchedVariant ? matchedVariant.material : (product?.material || '');

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

  const wishlistKey = user ? `craftstyle_wishlist_${user.uid}` : "craftstyle_wishlist_guest";

  // Check local wishlist on load or when key changes
  useEffect(() => {
    if (!id) return;
    try {
      const stored = localStorage.getItem(wishlistKey);
      if (stored) {
        const localWishlist = JSON.parse(stored);
        setIsWishlisted(localWishlist.includes(id));
      } else {
        setIsWishlisted(false);
      }
    } catch (e) {
      console.error("Failed to parse wishlist:", e);
      setIsWishlisted(false);
    }
  }, [id, wishlistKey]);

  const toggleWishlist = () => {
    if (!id) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    try {
      const stored = localStorage.getItem(wishlistKey);
      const localWishlist = stored ? JSON.parse(stored) : [];
      let newWishlist;
      if (isWishlisted) {
        newWishlist = localWishlist.filter((itemId: string) => itemId !== id);
        setToast("Removed from Wishlist");
      } else {
        newWishlist = [...localWishlist, id];
        setToast("Added to Wishlist!");
      }
      localStorage.setItem(wishlistKey, JSON.stringify(newWishlist));
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

  // Track product view in recently viewed
  useEffect(() => {
    if (product && product.id) {
      const recordView = async () => {
        try {
          const localKey = "craftstyle_recently_viewed";
          const localData = localStorage.getItem(localKey);
          let list: { id: string; viewedAt: number }[] = localData ? JSON.parse(localData) : [];
          
          // Remove product if it's already in the list
          list = list.filter((item) => item.id !== product.id);
          
          // Add to front of the list
          list.unshift({ id: product.id, viewedAt: Date.now() });
          
          // Keep only the 10 most recent
          list = list.slice(0, 10);
          localStorage.setItem(localKey, JSON.stringify(list));

          // If user logged in, sync/save to Firestore
          if (user?.uid) {
            const rvRef = doc(db, "users", user.uid, "recentlyViewed", product.id);
            await setDoc(rvRef, {
              productId: product.id,
              viewedAt: serverTimestamp(),
            });
          }
        } catch (e) {
          console.error("Failed to record product view", e);
        }
      };
      recordView();
    }
  }, [product, user]);

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
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

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
      const formattedSize = `${matchedVariant.size}${matchedVariant.sizeUnit ? ' ' + matchedVariant.sizeUnit : ''}`;
      finalSizeString = [formattedSize, matchedVariant.color, matchedVariant.material].filter(Boolean).join(" / ");
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
        const formattedBaseSize = `${product.size || ''}${product.sizeUnit ? ' ' + product.sizeUnit : ''}`;
        if (formattedBaseSize) {
          finalSizeString = formattedBaseSize;
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
    }, quantity);
    setAdding(false);
    setShowAddedModal(true);
  };

  const handleBuyNow = async () => {
    if (!product) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

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
      const formattedSize = `${matchedVariant.size}${matchedVariant.sizeUnit ? ' ' + matchedVariant.sizeUnit : ''}`;
      finalSizeString = [formattedSize, matchedVariant.color, matchedVariant.material].filter(Boolean).join(" / ");
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
        const formattedBaseSize = `${product.size || ''}${product.sizeUnit ? ' ' + product.sizeUnit : ''}`;
        if (formattedBaseSize) {
          finalSizeString = formattedBaseSize;
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
    }, quantity);
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
    <div className="min-h-screen bg-white w-full max-w-md mx-auto relative pb-24">
      {/* Header (Relative to not overlap with text) */}
      <div className="p-4 flex justify-between items-center bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="w-10 h-10 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full flex items-center justify-center transition-all cursor-pointer">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <div className="flex space-x-2">
          <button onClick={handleShare} className="w-10 h-10 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full flex items-center justify-center transition-all cursor-pointer">
            <Share2 size={20} className="text-gray-800" />
          </button>
          <button onClick={toggleWishlist} className="w-10 h-10 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full flex items-center justify-center transition-all cursor-pointer">
            <Heart size={20} className={isWishlisted ? "text-pink-600 fill-slate-900" : "text-gray-800"} />
          </button>
        </div>
      </div>

      {/* Top Section: Product Name and Short Description with divider lines */}
      <div className="p-4 bg-white border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">{product.title}</h1>
        <h2 className="text-sm font-semibold text-gray-500 mt-1 leading-snug tracking-tight uppercase tracking-wider">{product.brand}</h2>
        
        {(() => {
          const points = parseShortDescription(product.shortDescription || "");
          if (points.length === 0) return null;
          return (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] font-bold text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 leading-normal">
              {points.map((point, index) => (
                <span key={index} className="flex items-center">
                  {index > 0 && <span className="text-gray-300 mr-2.5 font-normal">|</span>}
                  <span className="text-gray-650">{point}</span>
                </span>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Product Image / Carousel */}
      <div className="relative bg-gray-150">
        <div 
          className="w-full aspect-[3/4] bg-gray-100 relative overflow-hidden select-none touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <OptimizedImage
            src={(matchedVariant && matchedVariant.image) ? matchedVariant.image : (product.images && product.images.length > 0 ? product.images[activeImageIdx] : product.image)}
            alt={product.brand}
            fill
            priority={activeImageIdx === 0}
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
                className={`w-10 h-14 rounded-md overflow-hidden bg-gray-100 border-2 transition-all flex-shrink-0 cursor-pointer relative
                  ${activeImageIdx === idx ? 'border-pink-500 scale-95 shadow-sm' : 'border-transparent'}`}
              >
                <OptimizedImage src={imgUrl} alt={`Angle ${idx + 1}`} fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Size Selection / Options Selection (Variant Selector Cards Scroll) */}
      {product.variants && product.variants.length > 0 ? (
        <div className="p-4 bg-white border-b border-gray-100 space-y-3">
          {/* Heading */}
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
              {(() => {
                const parts = [];
                const colors = Array.from(new Set(product.variants.map((v: any) => v.color).filter(Boolean)));
                const sizes = Array.from(new Set(product.variants.map((v: any) => v.size).filter(Boolean)));
                const hasColorVar = colors.length > 1;
                const hasSizeVar = sizes.length > 1;
                
                if (hasColorVar) {
                  parts.push(
                    <span>
                      Color: <strong className="text-gray-900">{selectedVariantColor || "Select"}</strong>
                    </span>
                  );
                }
                if (hasSizeVar) {
                  parts.push(
                    <span>
                      Size: <strong className="text-gray-900">{selectedSize || "Select"}</strong>
                    </span>
                  );
                }
                
                if (parts.length === 0) {
                  return "Available Options";
                }
                
                return (
                  <div className="flex items-center gap-2">
                    {parts.map((p, i) => (
                      <span key={i} className="flex items-center gap-2">
                        {i > 0 && <span className="text-gray-300">|</span>}
                        {p}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </span>
          </div>

          {/* Cards Scrollable Strip */}
          <div className="flex gap-3 overflow-x-auto hide-scrollbar py-1">
            {product.variants.map((v: any) => {
              const formattedSize = getFormattedSize(v);
              const isActive = (!v.size || formattedSize === selectedSize) &&
                               (!v.color || v.color === selectedVariantColor) &&
                               (!v.material || v.material === selectedVariantMaterial);
              
              // Calculate discount percent
              const discountPercent = v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
              
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    if (v.size) setSelectedSize(formattedSize);
                    if (v.color) setSelectedVariantColor(v.color);
                    if (v.material) setSelectedVariantMaterial(v.material);
                  }}
                  className={`w-28 flex-shrink-0 bg-white border rounded-xl overflow-hidden text-left transition-all cursor-pointer shadow-sm
                    ${isActive 
                      ? 'border-pink-500 ring-2 ring-pink-500/20 scale-[0.98]' 
                      : 'border-gray-200 hover:border-gray-300'}`}
                >
                  {/* Variant Image */}
                  <div className="w-full aspect-[3/4] bg-gray-50 relative border-b border-gray-100">
                    <OptimizedImage
                      src={v.image || product.image}
                      alt={getVariantLabel(v)}
                      fill
                      className="object-cover"
                    />
                  </div>
                  
                  {/* Variant info metadata */}
                  <div className="p-2 space-y-1">
                    <p className="text-[10px] font-bold text-gray-800 truncate" title={getVariantLabel(v)}>
                      {getVariantLabel(v)}
                    </p>
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-xs font-black text-pink-600">₹{v.price}</span>
                      {v.mrp > v.price && (
                        <span className="text-[9px] text-gray-400 line-through">₹{v.mrp}</span>
                      )}
                    </div>
                    {discountPercent > 0 && (
                      <span className="text-[8px] bg-red-50/50 text-red-650 font-extrabold px-1 py-0.5 rounded uppercase tracking-wide block w-fit">
                        {discountPercent}% OFF
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
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
      )}

      {/* Price & Option Details */}
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="flex items-baseline space-x-3 flex-wrap">
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
        
        {/* Dynamic Variant / Base Specs Display */}
        {(currentSize || currentColor || currentMaterial) && (
          <div className="mt-3 flex gap-1.5 flex-wrap">
            {currentSize && (
              <span className="bg-pink-50 text-pink-700 border border-pink-100/50 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase">
                Size: {currentSize}
              </span>
            )}
            {currentColor && (
              <span className="bg-slate-50 text-slate-755 border border-slate-200/50 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase">
                Color: {currentColor}
              </span>
            )}
            {currentMaterial && (
              <span className="bg-slate-50 text-slate-755 border border-slate-200/50 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase">
                Material: {currentMaterial}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Amazon-style Buying Block */}
      <div className="p-4 bg-white border-b border-gray-100 space-y-4">
        {/* Deliver to address line */}
        <div className="flex items-center gap-1.5 text-xs text-slate-650 font-medium">
          <svg className="w-4.5 h-4.5 text-slate-750 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          <span className="truncate">{deliveryInfo}</span>
        </div>

        {/* Availability Status */}
        <div>
          {(() => {
            const isFashion = product.category?.toLowerCase() === "fashion";
            let stock = product.quantity !== undefined && product.quantity !== null ? Number(product.quantity) : 10;
            let hasSelectedOptions = true;

            if (product.variants && product.variants.length > 0) {
              if (!matchedVariant) {
                hasSelectedOptions = false;
                stock = 10;
              } else {
                stock = matchedVariant.stock;
              }
            } else if (isFashion) {
              if (!selectedSize) {
                hasSelectedOptions = false;
                stock = 10;
              } else {
                stock = Number(product.sizesInventory?.[selectedSize] || 0);
              }
            }

            if (!hasSelectedOptions) {
              return (
                <span className="text-sm font-semibold text-[#007185]">
                  Select options to check availability
                </span>
              );
            }

            if (stock <= 0) {
              return (
                <span className="text-lg font-bold text-red-650">
                  Out of Stock
                </span>
              );
            }

            if (stock <= 5) {
              return (
                <span className="text-sm font-bold text-amber-700 animate-pulse">
                  ⚡ Only {stock} left in stock - order soon.
                </span>
              );
            }

            return (
              <span className="text-lg font-bold text-green-700">
                In stock
              </span>
            );
          })()}
        </div>

        {/* Cashback Banner: "Up to ₹90 cash back | ₹30 per unit on buying 2+" */}
        {(() => {
          const price = displayPrice;
          const cashbackLimit = Math.round(price * 0.45);
          const cashbackPerUnit = Math.round(price * 0.15);
          return (
            <div className="flex flex-wrap items-center gap-2 text-xs py-1.5 px-2 bg-slate-50 border border-slate-100 rounded-lg">
              <span className="bg-[#cbf4c9] text-[#0e5210] font-bold px-2 py-0.5 rounded text-[11px]">
                Up to ₹{cashbackLimit} cash back
              </span>
              <span className="text-gray-700 font-medium">
                ₹{cashbackPerUnit} per unit on buying 2+
              </span>
            </div>
          );
        })()}

        {/* Quantity and Actions Block */}
        {(() => {
          const isFashion = product.category?.toLowerCase() === "fashion";
          let stock = product.quantity !== undefined && product.quantity !== null ? Number(product.quantity) : 10;
          let hasSelectedOptions = true;

          if (product.variants && product.variants.length > 0) {
            if (!matchedVariant) {
              hasSelectedOptions = false;
              stock = 10;
            } else {
              stock = matchedVariant.stock;
            }
          } else if (isFashion) {
            if (!selectedSize) {
              hasSelectedOptions = false;
              stock = 10;
            } else {
              stock = Number(product.sizesInventory?.[selectedSize] || 0);
            }
          }

          const outOfStock = hasSelectedOptions && stock <= 0;

          if (outOfStock) {
            return (
              <div className="space-y-3 pt-2">
                <p className="text-sm text-gray-500 font-medium">
                  We'll notify you as soon as this item is back in stock.
                </p>
                {isSubscribed ? (
                  <button 
                    disabled
                    className="w-full py-3.5 bg-emerald-50 text-emerald-600 border border-emerald-250 rounded-full font-bold flex items-center justify-center gap-1.5 text-sm uppercase cursor-not-allowed shadow-sm"
                  >
                    <Bell size={16} className="fill-emerald-600" />
                    <span>✓ ON THE LIST</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowNotifyModal(true)}
                    className="w-full py-3.5 bg-slate-900 text-white rounded-full font-bold flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors text-sm cursor-pointer uppercase tracking-wider shadow-md hover:shadow-lg"
                  >
                    <Bell size={16} />
                    <span>Notify Me</span>
                  </button>
                )}
              </div>
            );
          }

          const selectLimit = Math.min(10, stock);

          return (
            <div className="space-y-3 pt-1">
              {/* Quantity Select dropdown */}
              <div className="relative">
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-white border border-[#D5D9D9] hover:bg-[#F7FAFA] text-sm text-gray-900 px-4 py-2.5 rounded-lg font-medium shadow-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#007185] focus:border-[#007185] appearance-none cursor-pointer pr-10"
                >
                  {[...Array(selectLimit > 0 ? selectLimit : 1)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Quantity: {i + 1}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>

              {/* Add to Cart button */}
              <button 
                onClick={handleAdd}
                disabled={adding}
                className="w-full py-3 border border-pink-500 text-pink-600 bg-white rounded-full font-bold flex items-center justify-center hover:bg-slate-50 disabled:opacity-70 transition-all text-sm cursor-pointer shadow-sm"
              >
                Add to cart
              </button>

              {/* Buy Now button */}
              <button 
                onClick={handleBuyNow}
                disabled={adding}
                className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-full flex items-center justify-center hover:shadow-md disabled:opacity-70 transition-all text-sm cursor-pointer shadow-md hover:shadow-lg"
              >
                {adding ? "Processing..." : "Buy Now"}
              </button>
            </div>
          );
        })()}

        {/* Shipment Details Table */}
        <div className="border-t border-gray-100 pt-3 text-[12px] font-medium text-slate-700">
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="py-1 w-24 text-gray-500 font-normal">Ships from</td>
                <td className="py-1 text-slate-800">Craft Style</td>
              </tr>
              <tr>
                <td className="py-1 w-24 text-gray-500 font-normal">Sold by</td>
                <td className="py-1 text-[#007185] hover:underline cursor-pointer">{product.brand || "Craft Style"}</td>
              </tr>
              <tr>
                <td className="py-1 w-24 text-gray-500 font-normal">Gift options</td>
                <td className="py-1 text-[#007185] hover:underline cursor-pointer">Available at checkout</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Inline Save this item / Wishlist block */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-900 mb-2">Save this item</p>
          <button
            onClick={toggleWishlist}
            className="w-full py-2.5 px-4 bg-white border border-[#D5D9D9] hover:bg-[#F7FAFA] rounded-full text-xs font-medium text-gray-900 flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Heart size={14} className={isWishlisted ? "text-pink-650 fill-pink-650" : "text-gray-500"} />
            <span>{isWishlisted ? "Remove from Wish List" : "Add to Wish List"}</span>
          </button>
        </div>
      </div>
      {/* Product Highlights & Descriptions Section */}
      {(product.shortDescription || product.fullDescription) && (
        <div className="p-5 bg-white border-b border-gray-100 space-y-5">
          {/* Short highlights block */}
          {product.shortDescription && (() => {
            const highlightPoints = parseShortDescription(product.shortDescription);
            if (highlightPoints.length === 0) return null;
            return (
              <div className="space-y-3">
                <h2 className="font-extrabold text-gray-950 text-[15px] tracking-tight">Top highlights</h2>
                <ul className="space-y-2">
                  {highlightPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-[13px] text-slate-800 font-medium leading-relaxed">
                      <span className="text-emerald-600 font-black text-sm mt-0.5 flex-shrink-0">✓</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-gray-400 flex items-center gap-1 font-semibold italic">
                  Summarized from seller-provided product information ✨
                </p>
              </div>
            );
          })()}

          {/* Divider if both exist */}
          {product.shortDescription && product.fullDescription && (
            <div className="border-t border-gray-100 my-2"></div>
          )}

          {/* Full description block */}
          {product.fullDescription && (() => {
            const rawLines = product.fullDescription.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
            if (rawLines.length === 0) return null;
            return (
              <div className="space-y-3.5">
                <h2 className="font-extrabold text-gray-950 text-[15px] tracking-tight">Product Details</h2>
                <ul className="space-y-2.5">
                  {rawLines.map((line: string, idx: number) => {
                    const cleanLine = line.replace(/^([•\*\-\d\.\)\s])+/, "").trim();
                    if (!cleanLine) return null;
                    
                    let prefix = "";
                    let content = cleanLine;
                    let separator = "";
                    
                    // Look for common separators inside first 40 chars
                    const colonIdx = cleanLine.indexOf(":");
                    const emDashIdx = cleanLine.indexOf("–");
                    const enDashIdx = cleanLine.indexOf(" - ");
                    
                    if (colonIdx !== -1 && (emDashIdx === -1 || colonIdx < emDashIdx) && (enDashIdx === -1 || colonIdx < enDashIdx)) {
                      if (colonIdx < 40) {
                        prefix = cleanLine.substring(0, colonIdx).trim();
                        content = cleanLine.substring(colonIdx + 1).trim();
                        separator = ":";
                      }
                    } else if (emDashIdx !== -1 && (enDashIdx === -1 || emDashIdx < enDashIdx)) {
                      if (emDashIdx < 40) {
                        prefix = cleanLine.substring(0, emDashIdx).trim();
                        content = cleanLine.substring(emDashIdx + 1).trim();
                        separator = "–";
                      }
                    } else if (enDashIdx !== -1) {
                      if (enDashIdx < 40) {
                        prefix = cleanLine.substring(0, enDashIdx).trim();
                        content = cleanLine.substring(enDashIdx + 3).trim();
                        separator = "–";
                      }
                    }
                    
                    return (
                      <li key={idx} className="flex items-start gap-2 text-[13px] leading-relaxed">
                        <span className="text-gray-400 mt-1 flex-shrink-0 text-xs">•</span>
                        <span className="text-gray-850">
                          {prefix ? (
                            <>
                              <strong className="font-extrabold text-gray-905">{prefix}</strong>
                              {separator} {content}
                            </>
                          ) : (
                            cleanLine
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}
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
                    <OptimizedImage src={item.image} alt={item.brand} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                    {discountPercent > 0 && (
                      <div className="absolute top-2 left-2 bg-pink-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow">
                        {discountPercent}% OFF
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-left">
                    <h3 className="font-bold text-[11px] text-gray-900 truncate uppercase tracking-tight">{item.title}</h3>
                    <p className="text-[10px] text-gray-500 truncate mt-0.5 leading-normal">{item.brand}</p>
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

      {/* Bottom Action Bar removed to use the inline Amazon-style Buying Block */}

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
              <div className="w-16 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 relative">
                <OptimizedImage src={product.image} alt={product.brand} fill className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-gray-900 truncate">{product.title}</h4>
                <p className="text-xs text-gray-500 truncate mt-0.5">{product.brand}</p>
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
