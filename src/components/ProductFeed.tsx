"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Heart, SlidersHorizontal, ChevronRight, Zap, Star } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ProductFeed() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search")?.toLowerCase() || "";

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"none" | "lowHigh" | "highLow">("none");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(data);
      } catch (err) {
        console.error("Error fetching products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Filtering Logic
  let filteredProducts = products;

  if (searchQuery) {
    filteredProducts = filteredProducts.filter(p => 
      p.title?.toLowerCase().includes(searchQuery) || 
      p.brand?.toLowerCase().includes(searchQuery) ||
      p.category?.toLowerCase().includes(searchQuery)
    );
  }

  if (sortOrder === "lowHigh") {
    filteredProducts = [...filteredProducts].sort((a, b) => a.price - b.price);
  } else if (sortOrder === "highLow") {
    filteredProducts = [...filteredProducts].sort((a, b) => b.price - a.price);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 bg-white">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Reusable Product Card Component
  const ProductCard = ({ product, isHorizontal = false }: { product: any, isHorizontal?: boolean }) => (
    <Link 
      href={`/product/${product.id}`} 
      className={`bg-white flex flex-col relative group cursor-pointer block rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow
        ${isHorizontal ? 'w-40 flex-shrink-0' : 'w-full'}`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-50">
        <img
          src={product.image}
          alt={product.brand}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <button className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full shadow-sm text-gray-400 hover:text-pink-500 hover:bg-white transition-all z-10" onClick={(e) => { e.preventDefault(); /* Wishlist logic if needed */ }}>
          <Heart size={16} />
        </button>
        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-gray-800 flex items-center space-x-1">
          <Star size={10} className="text-yellow-500 fill-yellow-500" />
          <span>4.5</span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-bold text-sm text-gray-900 truncate">{product.brand}</h3>
        <p className="text-xs text-gray-500 truncate mt-0.5">{product.title}</p>
        <div className="mt-2 flex items-baseline space-x-1.5 flex-wrap">
          <span className="font-bold text-sm text-gray-900">₹{product.price}</span>
          <span className="text-xs text-gray-400 line-through">₹{Math.round(product.price * 1.5)}</span>
          <span className="text-[10px] font-bold text-orange-500">(33% OFF)</span>
        </div>
      </div>
    </Link>
  );

  // SEARCH MODE (Grid View)
  if (searchQuery) {
    return (
      <div className="bg-white min-h-screen">
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 sticky top-16 bg-white z-20 shadow-sm">
          <h2 className="font-bold text-gray-900 text-sm">
            Search Results
            <span className="text-gray-500 ml-1 font-normal">({filteredProducts.length})</span>
          </h2>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-1 border px-2 py-1 rounded-full text-xs font-bold transition-colors ${showFilters ? 'bg-pink-50 border-pink-200 text-pink-600' : 'border-gray-200 text-gray-700'}`}
          >
            <span>FILTER</span>
            <SlidersHorizontal size={12} />
          </button>
        </div>
        
        {/* Filters */}
        {showFilters && (
          <div className="px-4 py-4 bg-gray-50 border-b border-gray-200 space-y-4">
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Sort By Price</p>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setSortOrder(sortOrder === "lowHigh" ? "none" : "lowHigh")}
                  className={`px-3 py-1.5 text-xs font-bold border rounded-full ${sortOrder === "lowHigh" ? "border-pink-500 bg-pink-50 text-pink-600" : "border-gray-300 bg-white text-gray-700"}`}
                >
                  Low to High
                </button>
                <button 
                  onClick={() => setSortOrder(sortOrder === "highLow" ? "none" : "highLow")}
                  className={`px-3 py-1.5 text-xs font-bold border rounded-full ${sortOrder === "highLow" ? "border-pink-500 bg-pink-50 text-pink-600" : "border-gray-300 bg-white text-gray-700"}`}
                >
                  High to Low
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Size Filter</p>
              <div className="flex space-x-2 overflow-x-auto hide-scrollbar pb-1">
                {["S", "M", "L", "XL", "XXL"].map(size => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                    className={`w-10 h-10 flex items-center justify-center text-xs font-bold border rounded-full flex-shrink-0 ${selectedSize === size ? "border-pink-500 bg-pink-50 text-pink-600" : "border-gray-300 bg-white text-gray-700"}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            No products found matching "{searchQuery}".
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 pb-24">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // HOME MODE (Dynamic Dashboard)
  // Safely partition products
  const flashDeals = products.slice(0, Math.min(4, products.length));
  const newArrivals = products.slice(Math.min(4, products.length), Math.min(9, products.length));
  const allOtherProducts = products.slice(Math.min(9, products.length));

  return (
    <div className="bg-gray-50 pb-24 space-y-2">
      
      {/* 1. Flash Sale Section */}
      {flashDeals.length > 0 && (
        <div className="bg-gradient-to-br from-purple-900 via-pink-800 to-orange-600 p-4 pt-6 pb-6">
          <div className="flex justify-between items-end mb-4">
            <div>
              <div className="flex items-center space-x-1 mb-1">
                <Zap size={16} className="text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider">Hot Deals</span>
              </div>
              <h2 className="text-xl font-bold text-white leading-none">Flash Sale</h2>
            </div>
            <div className="text-white bg-white/20 px-2 py-1 rounded text-xs font-mono font-bold backdrop-blur-sm shadow-sm">
              Ends in 05:42:19
            </div>
          </div>
          
          <div className="flex space-x-3 overflow-x-auto hide-scrollbar pb-2 pt-1 px-1 -mx-1">
            {flashDeals.map((product) => (
              <ProductCard key={product.id} product={product} isHorizontal={true} />
            ))}
          </div>
        </div>
      )}

      {/* 2. New Arrivals Section */}
      {newArrivals.length > 0 && (
        <div className="bg-white p-4 py-6 shadow-sm border-y border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">New Arrivals</h2>
            <Link href="/categories" className="text-xs font-bold text-pink-600 flex items-center hover:underline bg-pink-50 px-2 py-1 rounded-full">
              View All <ChevronRight size={14} className="ml-0.5" />
            </Link>
          </div>
          <div className="flex space-x-3 overflow-x-auto hide-scrollbar pb-2 pt-1 px-1 -mx-1">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} isHorizontal={true} />
            ))}
          </div>
        </div>
      )}

      {/* 3. Explore More / Main Grid */}
      <div className="bg-white p-4 pt-6 shadow-sm border-t border-gray-100 min-h-screen">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Trending Highlights</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {allOtherProducts.length > 0 ? (
            allOtherProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            // Fallback if there are fewer than 9 products total
             products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
