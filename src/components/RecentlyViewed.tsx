"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, documentId, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Heart, Star } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getDailyGradients } from "@/lib/colorUtils";
import OptimizedImage from "./OptimizedImage";

export default function RecentlyViewed() {
  const { user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [popHeartId, setPopHeartId] = useState<string | null>(null);

  const wishlistKey = user ? `craftstyle_wishlist_${user.uid}` : "craftstyle_wishlist_guest";

  useEffect(() => {
    try {
      const stored = localStorage.getItem(wishlistKey);
      if (stored) {
        setWishlist(JSON.parse(stored));
      } else {
        setWishlist([]);
      }
    } catch (e) {
      console.error("Failed to load wishlist", e);
      setWishlist([]);
    }
  }, [wishlistKey]);

  const toggleWishlist = (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setPopHeartId(productId);
    setTimeout(() => setPopHeartId(null), 450);

    let newWishlist;
    if (wishlist.includes(productId)) {
      newWishlist = wishlist.filter((id) => id !== productId);
    } else {
      newWishlist = [...wishlist, productId];
    }
    setWishlist(newWishlist);
    localStorage.setItem(wishlistKey, JSON.stringify(newWishlist));
  };

  useEffect(() => {
    const fetchRecentlyViewed = async () => {
      try {
        let productIds: string[] = [];

        if (user?.uid) {
          // 1. Sync guest items from localStorage if any exist
          const localKey = "craftstyle_recently_viewed";
          const localData = localStorage.getItem(localKey);
          if (localData) {
            try {
              const localList: { id: string; viewedAt: number }[] = JSON.parse(localData);
              if (localList.length > 0) {
                // Sync each to Firestore
                const syncPromises = localList.map(async (item) => {
                  const rvRef = doc(db, "users", user.uid, "recentlyViewed", item.id);
                  await setDoc(rvRef, {
                    productId: item.id,
                    viewedAt: new Date(item.viewedAt),
                  });
                });
                await Promise.all(syncPromises);
                // Clear local storage copy to prevent re-syncing, or keep it.
                // We'll clear it so Firestore is the single source of truth for logged-in users.
                localStorage.removeItem(localKey);
              }
            } catch (e) {
              console.error("Error syncing local recently viewed to Firestore:", e);
            }
          }

          // 2. Fetch from Firestore
          const { orderBy, limit } = await import("firebase/firestore");
          const rvRef = collection(db, "users", user.uid, "recentlyViewed");
          const q = query(rvRef, orderBy("viewedAt", "desc"), limit(10));
          const snap = await getDocs(q);
          productIds = snap.docs.map((doc) => doc.id);
        } else {
          // Fetch from localStorage
          const localKey = "craftstyle_recently_viewed";
          const localData = localStorage.getItem(localKey);
          if (localData) {
            try {
              const list: { id: string; viewedAt: number }[] = JSON.parse(localData);
              productIds = list.map((item) => item.id);
            } catch (e) {
              console.error("Failed to parse local recently viewed:", e);
            }
          }
        }

        if (productIds.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }

        // Fetch full product details for these IDs
        const productsRef = collection(db, "products");
        const qProducts = query(productsRef, where(documentId(), "in", productIds));
        const productsSnap = await getDocs(qProducts);
        
        const fetchedProducts = productsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort the fetched products to match the order of productIds (chronological order)
        const sortedProducts = productIds
          .map((id) => fetchedProducts.find((p) => p.id === id))
          .filter(Boolean);

        setProducts(sortedProducts);
      } catch (err) {
        console.error("Error loading recently viewed products:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentlyViewed();
  }, [user]);

  const gradients = getDailyGradients();
  const gradient = gradients[1];

  if (!user || loading || products.length === 0) {
    return null; // Don't render anything if not logged in, loading, or no products
  }

  return (
    <div className={`p-4 pt-6 pb-6 border-y relative ${gradient.bg} ${gradient.border}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-sans font-bold text-[18px] md:text-[20px] text-[#1A1A1A] tracking-tight flex items-center gap-1.5">
          <span>Keep Shopping For</span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-pulse"></span>
        </h2>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${gradient.badge}`}>
          From where you left
        </span>
      </div>
      
      <div className="flex space-x-3 overflow-x-auto hide-scrollbar pb-2 pt-1 px-1 -mx-1">
        {products.map((product) => {
          const isOutOfStock = product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0;
          return (
            <Link 
              key={product.id}
              href={`/product/${product.id}`} 
              className="bg-white/85 backdrop-blur-xs flex flex-col relative group cursor-pointer block rounded-2xl overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_12px_32px_rgba(0,59,179,0.06)] hover:border-pink-300/40 hover:-translate-y-1 transition-all duration-300 border border-gray-100/50 w-36 flex-shrink-0"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#F9F9F9]">
                <OptimizedImage
                  src={product.image}
                  alt={product.brand}
                  fill
                  className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'opacity-40 grayscale' : ''}`}
                />
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black/25 backdrop-blur-[0.5px] flex items-center justify-center z-10">
                    <span className="bg-rose-600 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-wider shadow">
                      Sold Out
                    </span>
                  </div>
                )}
                {(() => {
                  const isWishlisted = wishlist.includes(product.id);
                  return (
                    <button 
                      className={`absolute top-2 right-2 p-1 bg-white/90 backdrop-blur rounded-full shadow-sm transition-all z-20 cursor-pointer ${popHeartId === product.id ? 'animate-heart-pop' : ''}`}
                      onClick={(e) => toggleWishlist(product.id, e)}
                    >
                      <Heart 
                        size={14} 
                        className={isWishlisted ? "text-pink-600 fill-pink-600" : "text-gray-400 hover:text-pink-600"} 
                      />
                    </button>
                  );
                })()}
                {!isOutOfStock && (
                  <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-800 flex items-center space-x-0.5 z-10">
                    <Star size={9} className="text-yellow-500 fill-yellow-500" />
                    <span>{product.rating !== undefined ? Number(product.rating).toFixed(1) : (() => {
                      let hash = 0;
                      const id = product.id || "default";
                      for (let i = 0; i < id.length; i++) {
                        hash = id.charCodeAt(i) + ((hash << 5) - hash);
                      }
                      return (4.0 + (Math.abs(hash) % 9) / 10).toFixed(1);
                    })()}</span>
                  </div>
                )}
              </div>
              <div className="p-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-sans font-normal text-[12px] text-[#666666] truncate">{product.brand}</h4>
                  <h3 className="font-sans font-semibold text-[14px] text-[#222222] truncate mt-0.5">{product.title}</h3>
                </div>
                <div className="mt-1.5 flex items-baseline space-x-1.5 flex-wrap">
                  <span className="font-sans font-bold text-[16px] text-[#000000]">₹{product.price}</span>
                  {(() => {
                    const mrpVal = product.mrp || Math.round(product.price * 1.5);
                    const discountPercent = mrpVal > product.price ? Math.round(((mrpVal - product.price) / mrpVal) * 100) : 0;
                    return (
                      mrpVal > product.price && (
                        <>
                          <span className="font-sans font-normal text-[12px] text-[#999999] line-through">₹{mrpVal}</span>
                          <span className="font-sans font-bold text-[12px] text-[#10B981]">({discountPercent}% OFF)</span>
                        </>
                      )
                    );
                  })()}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
