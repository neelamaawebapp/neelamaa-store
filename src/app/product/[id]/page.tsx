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
  const { addToBag, cart } = useCart();
  const { user } = useAuth();
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");
  const [showAddedModal, setShowAddedModal] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedVariantColor, setSelectedVariantColor] = useState("");
  const [selectedVariantMaterial, setSelectedVariantMaterial] = useState("");
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [deliveryInfo, setDeliveryInfo] = useState("Deliver to Mukesh - Jodhpur 342008");

  // Reviews & Ratings States
  const [reviews, setReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCounts, setRatingCounts] = useState<any>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewPhotos, setReviewPhotos] = useState<File[]>([]);
  const [uploadingReviewPhotos, setUploadingReviewPhotos] = useState(false);
  const [activeReviewImage, setActiveReviewImage] = useState<string | null>(null);

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

  // Fetch reviews of the product
  useEffect(() => {
    if (!id) return;
    
    const fetchReviews = async () => {
      try {
        const q = query(
          collection(db, "reviews"),
          where("productId", "==", id)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort reviews by date descending locally
        list.sort((a: any, b: any) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

        setReviews(list);

        if (list.length > 0) {
          const sum = list.reduce((acc, r: any) => acc + Number(r.rating || 0), 0);
          setAverageRating(sum / list.length);

          const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
          list.forEach((r: any) => {
            const star = Math.round(r.rating || 5);
            if (star >= 1 && star <= 5) {
              counts[star as keyof typeof counts]++;
            }
          });
          setRatingCounts(counts);
        } else {
          setAverageRating(0);
          setRatingCounts({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
        }
      } catch (err) {
        console.error("Failed to load reviews:", err);
      }
    };

    fetchReviews();
  }, [id]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please log in to submit a review");
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      alert("Please select a rating between 1 and 5 stars");
      return;
    }

    setSubmittingReview(true);
    setUploadingReviewPhotos(true);

    try {
      const uploadedUrls: string[] = [];

      // 1. Upload review photos to ImgBB
      for (const file of reviewPhotos) {
        const formData = new FormData();
        formData.append("image", file);
        
        const uploadRes = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
          method: "POST",
          body: formData
        });
        
        if (uploadRes.ok) {
          const resJson = await uploadRes.json();
          const url = resJson?.data?.url;
          if (url) {
            uploadedUrls.push(url);
          }
        }
      }

      setUploadingReviewPhotos(false);

      // 2. Save review in Firestore
      const reviewData = {
        productId: id,
        userId: user.uid,
        userName: user.displayName || user.email?.split("@")[0] || "Verified Buyer",
        userEmail: user.email || "",
        rating: Number(reviewRating),
        comment: reviewComment.trim(),
        photos: uploadedUrls,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "reviews"), reviewData);

      // 3. Reset form states
      setReviewRating(5);
      setReviewComment("");
      setReviewPhotos([]);
      setToast("Thank you! Review submitted successfully.");
      setTimeout(() => setToast(""), 4000);

      // 4. Reload reviews list
      const q = query(
        collection(db, "reviews"),
        where("productId", "==", id)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      
      setReviews(list);

      if (list.length > 0) {
        const sum = list.reduce((acc, r: any) => acc + Number(r.rating || 0), 0);
        setAverageRating(sum / list.length);
        
        const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        list.forEach((r: any) => {
          const star = Math.round(r.rating || 5);
          if (star >= 1 && star <= 5) {
            counts[star as keyof typeof counts]++;
          }
        });
        setRatingCounts(counts);
      }

    } catch (err: any) {
      console.error("Failed to submit review:", err);
      alert("Error submitting review: " + (err.message || "Unknown error"));
    } finally {
      setSubmittingReview(false);
      setUploadingReviewPhotos(false);
    }
  };

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
    const imgCount = mediaSlides?.length || 0;
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
    if (v.isBase) return "Base Variant";
    const parts = [];
    if (v.color) parts.push(v.color);
    const formattedSize = getFormattedSize(v);
    if (formattedSize) parts.push(formattedSize);
    return parts.join(" / ") || "Default Option";
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

  // Get all options including base product as the first variant option
  const allVariants = product ? [
    {
      id: "base",
      size: product.size || "",
      sizeUnit: product.sizeUnit || "",
      color: product.color || "",
      material: product.material || "",
      price: product.price || 0,
      mrp: product.mrp || Math.round((product.price || 0) * 1.5),
      stock: product.quantity || 0,
      image: product.image,
      isBase: true
    },
    ...(product.variants || [])
  ] : [];

  const matchedVariant = product?.variants?.find((v: any) => {
    const matchSize = !v.size || getFormattedSize(v) === selectedSize;
    const matchColor = !v.color || v.color === selectedVariantColor;
    const matchMaterial = !v.material || v.material === selectedVariantMaterial;
    return matchSize && matchColor && matchMaterial;
  });

  const displayImages = (matchedVariant && matchedVariant.images && matchedVariant.images.length > 0)
    ? matchedVariant.images
    : ((matchedVariant && matchedVariant.image) 
       ? [matchedVariant.image] 
       : (product?.images && product.images.length > 0 ? product.images : [product?.image].filter(Boolean)));

  const getDirectVideoUrl = (url: string) => {
    if (!url) return "";
    let cleanUrl = url.trim();
    if (cleanUrl.includes("dropbox.com")) {
      return cleanUrl.replace("?dl=0", "?raw=1").replace("?dl=1", "?raw=1");
    }
    return cleanUrl;
  };

  const mediaSlides = [
    ...(product?.videoUrl ? [{ type: "video", url: getDirectVideoUrl(product.videoUrl) }] : []),
    ...displayImages.map((img: string) => ({ type: "image", url: img }))
  ];

  const displayPrice = matchedVariant ? matchedVariant.price : (product?.price || 0);
  const displayMrp = matchedVariant ? matchedVariant.mrp : (product?.mrp || Math.round((product?.price || 0) * 1.5));

  const currentSize = matchedVariant 
    ? `${matchedVariant.size}${matchedVariant.sizeUnit ? ' ' + matchedVariant.sizeUnit : ''}` 
    : `${product?.size || ''}${product?.sizeUnit ? ' ' + product?.sizeUnit : ''}`;
  const currentColor = matchedVariant ? matchedVariant.color : (product?.color || '');
  const currentMaterial = matchedVariant ? matchedVariant.material : (product?.material || '');
  const hasSizesInventory = product?.sizesInventory && Object.values(product.sizesInventory).some((qty: any) => Number(qty) > 0);

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

  // Reset active image index when variant changes
  useEffect(() => {
    setActiveImageIdx(0);
  }, [matchedVariant?.id]);

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
      const isBaseSelected = selectedSize === "" && selectedVariantColor === "" && selectedVariantMaterial === "";
      
      if (!isBaseSelected) {
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
        if (product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0) {
          setToast("This item is currently out of stock.");
          setTimeout(() => setToast(""), 3000);
          return;
        }
        finalPrice = product.price;
        finalMrp = product.mrp || Math.round(product.price * 1.5);
        const formattedBaseSize = `${product.size || ''}${product.sizeUnit ? ' ' + product.sizeUnit : ''}`;
        finalSizeString = [formattedBaseSize, product.color, product.material].filter(Boolean).join(" / ");
      }
    } else {
      const isFashion = product.category?.toLowerCase() === "fashion" || product.category?.toLowerCase() === "lifestyle & fashion";
      if (isFashion && hasSizesInventory) {
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
      const isBaseSelected = selectedSize === "" && selectedVariantColor === "" && selectedVariantMaterial === "";
      
      if (!isBaseSelected) {
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
        if (product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0) {
          setToast("This item is currently out of stock.");
          setTimeout(() => setToast(""), 3000);
          return;
        }
        finalPrice = product.price;
        finalMrp = product.mrp || Math.round(product.price * 1.5);
        const formattedBaseSize = `${product.size || ''}${product.sizeUnit ? ' ' + product.sizeUnit : ''}`;
        finalSizeString = [formattedBaseSize, product.color, product.material].filter(Boolean).join(" / ");
      }
    } else {
      const isFashion = product.category?.toLowerCase() === "fashion" || product.category?.toLowerCase() === "lifestyle & fashion";
      if (isFashion && hasSizesInventory) {
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

    try {
      const cartItemId = `${product.id}_${finalSizeString || "Default"}`;
      let checkedIdsList: string[] = [];
      const storedChecked = localStorage.getItem("craftstyle_checked_cart_ids");
      if (storedChecked) {
        checkedIdsList = JSON.parse(storedChecked);
      }
      
      if (checkedIdsList.length === 0 && cart && cart.length > 0) {
        checkedIdsList = cart.map(item => item.id);
      }

      if (!checkedIdsList.includes(cartItemId)) {
        checkedIdsList.push(cartItemId);
      }
      localStorage.setItem("craftstyle_checked_cart_ids", JSON.stringify(checkedIdsList));
    } catch (e) {
      console.error("Failed to update checked IDs in localStorage during Buy Now:", e);
    }

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
        <h1 className="font-sans font-semibold text-[18px] text-[#222222] leading-tight tracking-tight">{product.title}</h1>
        <h2 className="font-sans font-normal text-[12px] text-[#666666] mt-1 leading-snug tracking-tight uppercase tracking-wider">{product.brand}</h2>
        {reviews.length > 0 && (
          <div 
            onClick={() => {
              const element = document.getElementById("reviews-section");
              if (element) {
                element.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="flex items-center gap-1.5 mt-2 cursor-pointer w-fit group select-none"
          >
            <div className="flex text-amber-500 text-[11px] font-bold">
              {[...Array(5)].map((_, i) => (
                <span key={i}>{i < Math.round(averageRating) ? "★" : "☆"}</span>
              ))}
            </div>
            <span className="text-[11px] text-[#007185] font-extrabold group-hover:underline">
              {averageRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
            </span>
          </div>
        )}
        {product.oneLiner && (
          <p className="text-xs text-slate-500 font-medium mt-1.5 leading-normal tracking-wide bg-slate-50 px-2.5 py-1.5 rounded-lg inline-block border border-slate-100">
            {product.oneLiner}
          </p>
        )}
      </div>

      {/* Product Image / Carousel */}
      <div className="relative bg-gray-150">
        <div 
          className="w-full aspect-[3/4] bg-gray-100 relative overflow-hidden select-none touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            if (mediaSlides[activeImageIdx]?.type !== 'video') {
              setShowFullPhoto(true);
            }
          }}
        >
          {mediaSlides[activeImageIdx]?.type === "video" ? (
            mediaSlides[activeImageIdx].url.includes("drive.google.com") || mediaSlides[activeImageIdx].url.includes("docs.google.com") ? (
              <iframe
                src={(() => {
                  const url = mediaSlides[activeImageIdx].url;
                  const gdRegex1 = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
                  const gdRegex2 = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
                  const gdRegex3 = /drive\.google\.com\/uc\?.*?id=([a-zA-Z0-9_-]+)/;
                  const match1 = url.match(gdRegex1);
                  const match2 = url.match(gdRegex2);
                  const match3 = url.match(gdRegex3);
                  const docId = (match1 && match1[1]) || (match2 && match2[1]) || (match3 && match3[1]);
                  return docId ? `https://drive.google.com/file/d/${docId}/preview` : url;
                })()}
                className="w-full h-full border-0"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            ) : (
              <video
                src={mediaSlides[activeImageIdx].url}
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                controls
              />
            )
          ) : (
            <OptimizedImage
              src={mediaSlides[activeImageIdx]?.url || product.image}
              alt={product.brand}
              fill
              priority={activeImageIdx === 0}
              className="w-full h-full object-cover transition-all duration-305 cursor-zoom-in"
            />
          )}
          
          {/* Navigation Arrows for Carousel */}
          {mediaSlides && mediaSlides.length > 1 && (
            <>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIdx(prev => (prev - 1 + mediaSlides.length) % mediaSlides.length);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 backdrop-blur hover:bg-white shadow-sm flex items-center justify-center text-gray-800 transition-all font-black text-sm cursor-pointer z-10"
              >
                &lsaquo;
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIdx(prev => (prev + 1) % mediaSlides.length);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 backdrop-blur hover:bg-white shadow-sm flex items-center justify-center text-gray-800 transition-all font-black text-sm cursor-pointer z-10"
              >
                &rsaquo;
              </button>
              
              {/* Pagination Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10">
                {mediaSlides.map((slide: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIdx(idx);
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${activeImageIdx === idx ? 'bg-pink-600 w-3' : 'bg-gray-300/80'} ${slide.type === 'video' ? 'w-2 h-2 border border-pink-500' : 'w-1.5'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {mediaSlides && mediaSlides.length > 1 && (
          <div className="flex gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 overflow-x-auto hide-scrollbar">
            {mediaSlides.map((slide: any, idx: number) => (
              <button
                key={idx}
                onClick={() => setActiveImageIdx(idx)}
                className={`w-10 h-14 rounded-md overflow-hidden bg-gray-100 border-2 transition-all flex-shrink-0 cursor-pointer relative
                  ${activeImageIdx === idx ? 'border-pink-500 scale-95 shadow-sm' : 'border-transparent'}`}
              >
                {slide.type === "video" ? (
                  <div className="w-full h-full relative flex flex-col items-center justify-center bg-slate-900 text-white">
                    <span className="text-[8px] font-black uppercase text-pink-500">Reel</span>
                    <span className="text-[8px]">▶</span>
                  </div>
                ) : (
                  <OptimizedImage src={slide.url} alt={`Angle ${idx + 1}`} fill className="object-cover" />
                )}
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
                      Color: <strong className="text-gray-900">{selectedVariantColor || "Original"}</strong>
                    </span>
                  );
                }
                if (hasSizeVar) {
                  parts.push(
                    <span>
                      Size: <strong className="text-gray-900">{selectedSize || "Original"}</strong>
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
            {allVariants.map((v: any) => {
              const formattedSize = getFormattedSize(v);
              const isActive = v.isBase
                ? (selectedSize === "" && selectedVariantColor === "" && selectedVariantMaterial === "")
                : ((!v.size || formattedSize === selectedSize) &&
                   (!v.color || v.color === selectedVariantColor) &&
                   (!v.material || v.material === selectedVariantMaterial));
              
              // Calculate discount percent
              const discountPercent = v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
              
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    if (v.isBase) {
                      setSelectedSize("");
                      setSelectedVariantColor("");
                      setSelectedVariantMaterial("");
                    } else {
                      if (v.size) setSelectedSize(formattedSize);
                      if (v.color) setSelectedVariantColor(v.color);
                      if (v.material) setSelectedVariantMaterial(v.material);
                    }
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
                      <span className="font-sans font-bold text-xs text-[#000000]">₹{v.price}</span>
                      {v.mrp > v.price && (
                        <span className="font-sans font-normal text-[9px] text-[#999999] line-through">₹{v.mrp}</span>
                      )}
                    </div>
                    {discountPercent > 0 && (
                      <span className="font-sans font-bold text-[8px] bg-emerald-50 text-[#10B981] px-1 py-0.5 rounded uppercase tracking-wide block w-fit">
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
        (product.category?.toLowerCase() === "fashion" || product.category?.toLowerCase() === "lifestyle & fashion") && hasSizesInventory && (
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
          <span className="text-3xl font-bold text-[#000000] font-sans">₹{displayPrice}</span>
          {(() => {
            const mrpVal = displayMrp;
            const discountPercent = mrpVal > displayPrice ? Math.round(((mrpVal - displayPrice) / mrpVal) * 100) : 0;
            return (
              <>
                {mrpVal > displayPrice && (
                  <>
                    <span className="text-sm font-sans font-normal text-[#999999] line-through">₹{mrpVal}</span>
                    <span className="text-sm font-sans font-bold text-[#10B981]">({discountPercent}% OFF)</span>
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
            const isFashion = product.category?.toLowerCase() === "fashion" || product.category?.toLowerCase() === "lifestyle & fashion";
            let stock = product.quantity !== undefined && product.quantity !== null ? Number(product.quantity) : 10;
            let hasSelectedOptions = true;

            if (product.variants && product.variants.length > 0) {
              if (!matchedVariant) {
                hasSelectedOptions = false;
                stock = 10;
              } else {
                stock = matchedVariant.stock;
              }
            } else if (isFashion && hasSizesInventory) {
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
          const isFashion = product.category?.toLowerCase() === "fashion" || product.category?.toLowerCase() === "lifestyle & fashion";
          let stock = product.quantity !== undefined && product.quantity !== null ? Number(product.quantity) : 10;
          let hasSelectedOptions = true;

          if (product.variants && product.variants.length > 0) {
            if (!matchedVariant) {
              hasSelectedOptions = false;
              stock = 10;
            } else {
              stock = matchedVariant.stock;
            }
          } else if (isFashion && hasSizesInventory) {
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

      {/* Product Reviews & Ratings Section */}
      <div id="reviews-section" className="p-4 bg-white border-t border-gray-100 space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="font-sans font-black text-[#1A1A1A] uppercase text-xs tracking-widest flex items-center gap-1.5">
            Customer Ratings & Reviews
          </h2>
        </div>

        {/* Ratings summary breakdown */}
        <div className="grid grid-cols-12 gap-4 items-center">
          <div className="col-span-5 text-center flex flex-col justify-center items-center border-r border-gray-100 py-1">
            <span className="text-4xl font-extrabold text-gray-900">{averageRating.toFixed(1)}</span>
            <div className="flex text-amber-500 text-sm font-bold mt-1.5 mb-1">
              {[...Array(5)].map((_, i) => (
                <span key={i}>{i < Math.round(averageRating) ? "★" : "☆"}</span>
              ))}
            </div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">
              {reviews.length} {reviews.length === 1 ? "Rating" : "Ratings"}
            </span>
          </div>

          <div className="col-span-7 space-y-1.5 pl-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratingCounts[star] || 0;
              const percent = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center text-[10px] text-gray-500 font-semibold gap-2">
                  <span className="w-3 text-right">{star}★</span>
                  <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                  <span className="w-6 text-right text-gray-400">{Math.round(percent)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Write a Review Submission Form */}
        <div className="bg-slate-50/50 p-4 border border-slate-100/50 rounded-2xl space-y-4">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
            {user ? "Share Your Experience" : "Login to write a review"}
          </h3>

          {user ? (
            <form onSubmit={handleReviewSubmit} className="space-y-3.5">
              {/* Star selector */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Your Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className={`text-2xl transition-all cursor-pointer ${
                        star <= reviewRating ? "text-amber-500 scale-110" : "text-gray-300 hover:text-amber-400"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Text */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Detailed Review</label>
                <textarea
                  required
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full bg-white border border-gray-200/80 rounded-xl p-3 text-xs text-gray-800 focus:border-pink-500 focus:ring-1 focus:ring-pink-500/25 outline-none transition-all resize-none font-medium"
                  placeholder="What did you like or dislike? How is the quality, packaging, and delivery?"
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Add Photos</label>
                
                {/* Chosen files preview strip */}
                {reviewPhotos.length > 0 && (
                  <div className="flex gap-2 mb-2 overflow-x-auto py-1">
                    {reviewPhotos.map((file, idx) => (
                      <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="preview" 
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setReviewPhotos(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-3 py-1.5 rounded-xl text-[10px] uppercase cursor-pointer transition-colors shadow-sm inline-block">
                    Select Images
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files) {
                          setReviewPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[9px] text-gray-400 font-medium">PNG, JPG formats (Max 3 files)</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submittingReview}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold py-3 rounded-full text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                {submittingReview ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Submitting Review...</span>
                  </>
                ) : (
                  <span>Submit Review</span>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-2.5">
              <p className="text-xs text-gray-500 font-semibold mb-2.5">
                Share your valuable thoughts with other customers.
              </p>
              <button
                type="button"
                onClick={() => router.push(`/login?redirectTo=/product/${id}`)}
                className="bg-white hover:bg-gray-50 text-pink-600 border border-pink-200 hover:border-pink-300 font-bold px-4 py-2 rounded-xl text-[10px] uppercase shadow-sm tracking-wider transition-colors cursor-pointer"
              >
                Login to Write a Review
              </button>
            </div>
          )}
        </div>

        {/* Customer reviews list */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-850 uppercase tracking-widest border-b border-gray-50 pb-1.5">
            Review feed ({reviews.length})
          </h3>

          {reviews.length > 0 ? (
            <div className="space-y-4 divide-y divide-gray-100">
              {reviews.map((review, idx) => (
                <div key={review.id || idx} className={`space-y-1.5 ${idx > 0 ? 'pt-4' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-[11px] text-slate-800 flex items-center gap-1">
                      {review.userName}
                      <span className="text-[8px] bg-green-50 text-green-600 border border-green-200/50 px-1 py-0.5 rounded uppercase font-extrabold">
                        Verified Buyer
                      </span>
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold">
                      {review.createdAt ? new Date(review.createdAt.seconds * 1000).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric"
                      }) : "Just now"}
                    </span>
                  </div>

                  <div className="flex text-amber-400 text-[10px] font-bold">
                    {[...Array(5)].map((_, i) => (
                      <span key={i}>{i < Math.round(review.rating) ? "★" : "☆"}</span>
                    ))}
                  </div>

                  <p className="text-xs text-gray-750 font-semibold leading-relaxed">
                    {review.comment}
                  </p>

                  {/* Customer Review Uploaded Photos Grid */}
                  {review.photos && review.photos.length > 0 && (
                    <div className="flex gap-1.5 pt-1 overflow-x-auto hide-scrollbar">
                      {review.photos.map((photo: string, photoIdx: number) => (
                        <div 
                          key={photoIdx} 
                          onClick={() => setActiveReviewImage(photo)}
                          className="w-16 h-16 rounded-lg overflow-hidden border border-gray-150 bg-gray-50 flex-shrink-0 cursor-zoom-in hover:opacity-90 transition-opacity"
                        >
                          <img 
                            src={photo} 
                            alt={`customer-upload-${photoIdx}`} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-gray-200 rounded-2xl bg-gray-50/20">
              <span className="text-gray-400 text-xs font-semibold">No reviews yet. Be the first to review this product!</span>
            </div>
          )}
        </div>
      </div>

      {/* Review Photo Zoom Lightbox Modal */}
      {activeReviewImage && (
        <div 
          onClick={() => setActiveReviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out animate-fade-in"
        >
          <button 
            onClick={() => setActiveReviewImage(null)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5 border border-white/25 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
          <img 
            src={activeReviewImage} 
            alt="Customer review photo zoom" 
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10 animate-scale-in"
          />
        </div>
      )}

      {/* Suggested Items Section */}
      {suggestions.length > 0 && (
        <div className="p-4 bg-white border-t border-gray-100 mt-4 pb-20">
          <h2 className="font-sans font-bold text-[#1A1A1A] uppercase text-[12px] tracking-wider mb-3.5">You May Also Like</h2>
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
                      <div className="absolute top-2 left-2 bg-[#10B981] text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow">
                        {discountPercent}% OFF
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-left">
                    <p className="text-[12px] font-normal text-[#666666] truncate font-sans">{item.brand}</p>
                    <h3 className="font-semibold text-[14px] text-[#222222] truncate mt-0.5 font-sans">{item.title}</h3>
                    <div className="mt-1 flex items-baseline space-x-1.5">
                      <span className="text-[16px] font-bold text-[#000000] font-sans">₹{item.price}</span>
                      {itemMrp > item.price && (
                        <span className="text-[12px] text-[#999999] line-through font-sans">₹{itemMrp}</span>
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
      {showSizeGuide && (product.category?.toLowerCase() === "fashion" || product.category?.toLowerCase() === "lifestyle & fashion") && (
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

      {/* Full Screen Image Viewer Modal */}
      {showFullPhoto && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col justify-between"
          onClick={() => setShowFullPhoto(false)}
        >
          {/* Header */}
          <div className="w-full p-4 flex justify-end">
            <button 
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all backdrop-blur cursor-pointer border border-white/10"
              onClick={(e) => { e.stopPropagation(); setShowFullPhoto(false); }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Main Full Image */}
          <div className="flex-1 w-full max-w-lg mx-auto relative flex items-center justify-center p-4">
            <div className="relative w-full h-[75vh]" onClick={(e) => e.stopPropagation()}>
              <OptimizedImage
                src={displayImages[activeImageIdx] || product.image}
                alt={product.brand}
                fill
                className="object-contain select-none"
              />
            </div>
          </div>

          {/* Navigation Arrows for fullscreen lightbox */}
          {displayImages && displayImages.length > 1 && (
            <>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIdx(prev => (prev - 1 + displayImages.length) % displayImages.length);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white text-2xl transition-all cursor-pointer z-55"
              >
                &lsaquo;
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIdx(prev => (prev + 1) % displayImages.length);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white text-2xl transition-all cursor-pointer z-55"
              >
                &rsaquo;
              </button>
            </>
          )}

          {/* Details / Pagination Dots Footer */}
          <div className="w-full p-6 text-center bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center">
            <p className="text-white text-sm font-bold uppercase tracking-wider">{product.brand}</p>
            <p className="text-gray-300 text-xs mt-1 truncate max-w-xs">{product.title}</p>
            
            {/* Dots / Carousel indicators in fullscreen */}
            {displayImages && displayImages.length > 1 && (
              <div className="flex space-x-2 mt-4" onClick={(e) => e.stopPropagation()}>
                {displayImages.map((_: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${activeImageIdx === idx ? 'bg-pink-500 w-5' : 'bg-gray-600 hover:bg-gray-500'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
