"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Heart, ChevronLeft, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function CategoryProductsPage() {
  const params = useParams();
  const router = useRouter();
  const categoryName = decodeURIComponent(params.name as string);

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<"none" | "lowHigh" | "highLow">("none");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(
          collection(db, "products"),
          where("category", "==", categoryName)
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(data);
      } catch (err) {
        console.error("Error fetching category products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [categoryName]);

  // Filtering Logic
  let filteredProducts = [...products];
  if (sortOrder === "lowHigh") {
    filteredProducts.sort((a, b) => a.price - b.price);
  } else if (sortOrder === "highLow") {
    filteredProducts.sort((a, b) => b.price - a.price);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-24">
      {/* Header */}
      <div className="bg-white p-4 flex items-center justify-between border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">{categoryName}</h1>
        </div>
      </div>

      {/* Feed Header & Filters */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white sticky top-[60px] z-10">
        <h2 className="font-bold text-gray-900 text-sm">
          {filteredProducts.length} Items Found
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
        </div>
      )}

      {/* Product Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center text-gray-500 flex flex-col items-center">
          <p>No products available in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-0.5 bg-gray-100 flex-1">
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
