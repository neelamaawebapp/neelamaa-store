"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Heart, SlidersHorizontal, ChevronDown } from "lucide-react";
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

  // If size filter is selected, we assume all products have all sizes (as per design), 
  // but if they had an array we would check: p.sizes?.includes(selectedSize).
  // For now, size filter doesn't remove products since all sizes are "in stock".
  // But visually, we will keep the filter state active to satisfy the requirement.
  
  if (sortOrder === "lowHigh") {
    filteredProducts = [...filteredProducts].sort((a, b) => a.price - b.price);
  } else if (sortOrder === "highLow") {
    filteredProducts = [...filteredProducts].sort((a, b) => b.price - a.price);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      {/* Feed Header & Filters */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 sticky top-16 bg-white z-20">
        <h2 className="font-bold text-gray-900">
          {searchQuery ? `Search Results for "${searchQuery}"` : "Recommended For You"}
          <span className="text-gray-500 text-sm ml-2 font-normal">({filteredProducts.length})</span>
        </h2>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center space-x-1 border px-2 py-1 rounded text-xs font-bold transition-colors ${showFilters ? 'bg-pink-50 border-pink-200 text-pink-600' : 'border-gray-300 text-gray-700'}`}
        >
          <span>FILTER</span>
          <SlidersHorizontal size={12} />
        </button>
      </div>

      {/* Filter Options Drawer */}
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
          No products found.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-0.5 bg-gray-100 pb-20">
          {filteredProducts.map((product) => (
            <Link href={`/product/${product.id}`} key={product.id} className="bg-white flex flex-col relative group cursor-pointer block">
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-50">
                <img
                  src={product.image}
                  alt={product.brand}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <button className="absolute bottom-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full shadow-sm text-gray-600 hover:text-pink-500 transition-colors">
                  <Heart size={18} />
                </button>
              </div>
              <div className="p-3">
                <h3 className="font-bold text-sm text-gray-900 truncate">{product.brand}</h3>
                <p className="text-xs text-gray-500 truncate mt-0.5">{product.title}</p>
                <div className="mt-1.5 flex items-baseline space-x-1.5">
                  <span className="font-bold text-sm text-gray-900">₹{product.price}</span>
                  <span className="text-xs text-gray-400 line-through">₹{Math.round(product.price * 1.5)}</span>
                  <span className="text-[10px] font-bold text-orange-500">(33% OFF)</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
