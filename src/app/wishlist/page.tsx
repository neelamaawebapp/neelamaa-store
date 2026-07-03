"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/context/CartContext";
import { ChevronLeft, Heart, ShoppingBag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OptimizedImage from "@/components/OptimizedImage";

export default function WishlistPage() {
  const router = useRouter();
  const { addToBag } = useCart();
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  
  // State for inline size selection
  const [selectingSizeProductId, setSelectingSizeProductId] = useState<string | null>(null);

  // Load wishlist from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("craftstyle_wishlist");
      if (stored) {
        setWishlistIds(JSON.parse(stored));
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error("Failed to read wishlist local storage:", e);
      setLoading(false);
    }
  }, []);

  // Fetch product data from Firestore
  useEffect(() => {
    const fetchWishlistProducts = async () => {
      if (wishlistIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        const productsRef = collection(db, "products");
        // Firestore 'in' query accepts up to 30 items
        const chunkIds = wishlistIds.slice(0, 30);
        const qProducts = query(productsRef, where(documentId(), "in", chunkIds));
        const snap = await getDocs(qProducts);
        
        const fetched = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Keep the original order of products matching the wishlistIds
        const ordered = wishlistIds
          .map((id) => fetched.find((p) => p.id === id))
          .filter(Boolean);

        setProducts(ordered);
      } catch (err) {
        console.error("Error fetching wishlist products:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWishlistProducts();
  }, [wishlistIds]);

  const handleRemoveFromWishlist = (productId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const updatedIds = wishlistIds.filter((id) => id !== productId);
    setWishlistIds(updatedIds);
    localStorage.setItem("craftstyle_wishlist", JSON.stringify(updatedIds));
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    showToast("Removed from Wishlist");
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleMoveToBag = async (product: any, size: string = "Default") => {
    try {
      // Calculate price and MRP
      let price = product.price;
      let mrp = product.mrp || Math.round(product.price * 1.5);

      if (product.variants && Array.isArray(product.variants)) {
        const matched = product.variants.find((v: any) => {
          const formattedSize = `${v.size}${v.sizeUnit ? ' ' + v.sizeUnit : ''}`;
          return formattedSize === size;
        });
        if (matched) {
          price = matched.price;
          mrp = matched.mrp;
        }
      }

      await addToBag({
        productId: product.id,
        brand: product.brand,
        title: product.title,
        price: price,
        image: product.image,
        size: size,
        gstRate: product.gstRate || 0,
        mrp: mrp,
      });

      // Remove from wishlist as it's "moved" to bag
      handleRemoveFromWishlist(product.id);
      setSelectingSizeProductId(null);
      showToast("Moved to Bag!");
    } catch (err) {
      console.error("Error moving item to bag:", err);
      showToast("Error adding to bag");
    }
  };

  const handleAddToBagClick = (product: any) => {
    const isFashion = product.category?.toLowerCase() === "fashion";
    const availableSizes = product.variants
      ? Array.from(new Set(product.variants.map((v: any) => `${v.size}${v.sizeUnit ? ' ' + v.sizeUnit : ''}`).filter(Boolean))) as string[]
      : (product.sizes || ["S", "M", "L", "XL", "XXL"]);

    // If it's fashion and there are multiple sizes, prompt for size
    if (isFashion && availableSizes.length > 0) {
      setSelectingSizeProductId(product.id);
    } else {
      handleMoveToBag(product, "Default");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-24">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg z-50 animate-fade-in flex items-center space-x-1.5 backdrop-blur-sm border border-white/10">
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm justify-between">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">
            My Wishlist ({products.length})
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-10">
          <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mb-6">
            <Heart size={32} className="text-pink-400 fill-pink-100" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Your wishlist is empty</h2>
          <p className="text-xs text-gray-500 mb-6 max-w-xs leading-relaxed">
            Save items that you like in your wishlist. Review them anytime and easily move them to the bag.
          </p>
          <Link href="/" className="px-8 py-3 bg-pink-500 text-white font-bold rounded-md hover:bg-pink-600 transition-colors shadow-sm text-xs uppercase tracking-wider">
            CONTINUE SHOPPING
          </Link>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto flex-1">
          {products.map((product) => {
            const isOutOfStock = product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0;
            const isSelectingSize = selectingSizeProductId === product.id;
            
            const availableSizes = product.variants
              ? Array.from(new Set(product.variants.map((v: any) => `${v.size}${v.sizeUnit ? ' ' + v.sizeUnit : ''}`).filter(Boolean))) as string[]
              : (product.sizes || ["S", "M", "L", "XL", "XXL"]);

            return (
              <div 
                key={product.id} 
                className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm flex flex-col relative group"
              >
                {/* Delete button */}
                <button
                  onClick={(e) => handleRemoveFromWishlist(product.id, e)}
                  className="absolute top-2 right-2 w-7 h-7 bg-white/95 backdrop-blur rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 shadow-sm z-20 cursor-pointer border border-gray-100/50"
                  title="Remove from wishlist"
                >
                  <X size={14} />
                </button>

                {/* Product Image Link */}
                <Link href={`/product/${product.id}`} className="block relative aspect-[4/5] bg-gray-50 overflow-hidden">
                  <OptimizedImage 
                    src={product.image} 
                    alt={product.title} 
                    fill
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                  />
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-black/25 backdrop-blur-[0.5px] flex items-center justify-center z-10">
                      <span className="bg-rose-600 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-wider">
                        Sold Out
                      </span>
                    </div>
                  )}
                </Link>

                {/* Info & Move to Bag button */}
                <div className="p-2.5 flex-1 flex flex-col justify-between relative bg-white">
                  {isSelectingSize ? (
                    /* Inline Size Selector Overlay */
                    <div className="absolute inset-0 bg-white p-2.5 flex flex-col z-20 animate-fade-in justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Select Size</span>
                          <button onClick={() => setSelectingSizeProductId(null)} className="text-gray-400 hover:text-gray-700">
                            <X size={12} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {availableSizes.map((sz: string) => (
                            <button
                              key={sz}
                              onClick={() => handleMoveToBag(product, sz)}
                              className="w-8 h-8 rounded-full border border-gray-200 hover:border-pink-500 hover:text-pink-600 text-xs font-bold transition-all flex items-center justify-center cursor-pointer bg-white"
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectingSizeProductId(null)}
                        className="text-[10px] text-gray-400 font-bold hover:underline py-1 text-center"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}

                  <div>
                    <h3 className="font-extrabold text-xs text-gray-900 truncate tracking-tight uppercase">
                      {product.brand}
                    </h3>
                    <p className="text-[10px] text-gray-500 truncate mt-0.5">
                      {product.title}
                    </p>
                    
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

                  {/* Add to Bag Action */}
                  <div className="mt-3 pt-2.5 border-t border-gray-50">
                    <button
                      onClick={() => handleAddToBagClick(product)}
                      disabled={isOutOfStock}
                      className="w-full bg-pink-50 text-pink-600 hover:bg-pink-100/80 font-bold text-[10px] py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer tracking-wider uppercase"
                    >
                      <ShoppingBag size={11} />
                      Move to Bag
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
