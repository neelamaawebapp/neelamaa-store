"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, documentId, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Heart, Star } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getDailyGradients } from "@/lib/colorUtils";

export default function RecentlyViewed() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading || products.length === 0) {
    return null; // Don't render anything if loading or no products
  }

  return (
    <div className={`p-4 pt-6 pb-6 border-y relative ${gradient.bg} ${gradient.border}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-serif font-black text-slate-800 tracking-tight flex items-center gap-1.5">
          <span>Keep Shopping For</span>
          <span className="w-1.5 h-1.5 rounded-full bg-pink-600 animate-pulse"></span>
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
              className="bg-white flex flex-col relative group cursor-pointer block rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 border border-gray-100/40 w-36 flex-shrink-0"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F9F9F9]">
                <img
                  src={product.image}
                  alt={product.brand}
                  className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'opacity-40 grayscale' : ''}`}
                />
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black/25 backdrop-blur-[0.5px] flex items-center justify-center z-10">
                    <span className="bg-rose-600 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-wider shadow">
                      Sold Out
                    </span>
                  </div>
                )}
                <button 
                  className="absolute top-2 right-2 p-1 bg-white/90 backdrop-blur rounded-full shadow-sm text-gray-400 hover:text-pink-600 hover:bg-white transition-all z-20" 
                  onClick={(e) => { e.preventDefault(); }}
                >
                  <Heart size={14} />
                </button>
                {!isOutOfStock && (
                  <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-800 flex items-center space-x-0.5 z-10">
                    <Star size={9} className="text-yellow-500 fill-yellow-500" />
                    <span>4.5</span>
                  </div>
                )}
              </div>
              <div className="p-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-xs text-gray-900 truncate tracking-tight">{product.brand}</h3>
                  <p className="text-[10px] text-gray-500 truncate mt-0.5">{product.title}</p>
                </div>
                <div className="mt-1.5 flex items-baseline space-x-1.5 flex-wrap">
                  <span className="font-black text-xs text-pink-600">₹{product.price}</span>
                  {(() => {
                    const mrpVal = product.mrp || Math.round(product.price * 1.5);
                    const discountPercent = mrpVal > product.price ? Math.round(((mrpVal - product.price) / mrpVal) * 100) : 0;
                    return (
                      mrpVal > product.price && (
                        <>
                          <span className="text-[9px] text-gray-400 line-through font-medium">₹{mrpVal}</span>
                          <span className="text-[8px] font-bold text-orange-500">({discountPercent}% OFF)</span>
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
