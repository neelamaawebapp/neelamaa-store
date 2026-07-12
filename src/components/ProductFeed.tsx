"use client";

import { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Heart, SlidersHorizontal, ChevronRight, Zap, Star } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getDailyGradients } from "@/lib/colorUtils";
import OptimizedImage from "./OptimizedImage";
import { useAuth } from "@/context/AuthContext";

// Seeded pseudo-random number generator (Mulberry32 or similar)
function seededRandom(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Seeded shuffle algorithm (Fisher-Yates with seeded random)
function seededShuffle<T>(array: T[], seed: string): T[] {
  const rand = seededRandom(seed);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

export default function ProductFeed() {
  const { user } = useAuth();
  const trendingScrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [flashSaleStartTime, setFlashSaleStartTime] = useState<number | null>(null);
  const [flashSaleEndTime, setFlashSaleEndTime] = useState<number | null>(null);
  const [flashSaleState, setFlashSaleState] = useState<"upcoming" | "active" | "ended">("ended");
  const [flashSaleCountdown, setFlashSaleCountdown] = useState<string>("00:00:00");
  
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search")?.toLowerCase() || "";

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"none" | "lowHigh" | "highLow">("none");
  const [wishlist, setWishlist] = useState<string[]>([]);

  const wishlistKey = user ? `craftstyle_wishlist_${user.uid}` : "craftstyle_wishlist_guest";

  // Load wishlist from localstorage on mount or auth change
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
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(data);
        
        // Fetch Flash Sale settings
        const { getDoc, doc: fdoc } = await import("firebase/firestore");
        const snap = await getDoc(fdoc(db, "settings", "flashSale"));
        if (snap.exists()) {
          const data = snap.data();
          if (data.startTime) {
            setFlashSaleStartTime(data.startTime.toMillis());
          }
          if (data.endTime) {
            setFlashSaleEndTime(data.endTime.toMillis());
          }
        }
      } catch (err) {
        console.error("Error fetching products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Countdown Timer Logic
  useEffect(() => {
    if (!flashSaleEndTime) return;
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      if (flashSaleStartTime && now < flashSaleStartTime) {
        setFlashSaleState("upcoming");
        const distance = flashSaleStartTime - now;
        
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        setFlashSaleCountdown(
          `Starts In: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      } else {
        const distance = flashSaleEndTime - now;
        
        if (distance < 0) {
          setFlashSaleState("ended");
          setFlashSaleCountdown("ENDED");
          clearInterval(interval);
          return;
        }
        
        setFlashSaleState("active");
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        setFlashSaleCountdown(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [flashSaleStartTime, flashSaleEndTime]);

  // HOME MODE (Dynamic Dashboard)
  // Partition products, keeping Flash Sale and New Arrivals fixed
  const flashDeals = products.filter(p => p.homeSection === "Flash Sale");
  const newArrivals = products.filter(p => p.homeSection === "New Arrivals");
  
  // Dynamic daily shuffle for Trending and More to Explore
  // Get date seed (YYYY-MM-DD local date format)
  const today = new Date();
  const dateSeed = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  
  // All products not in Flash Sale or New Arrivals are candidates for Trending and More to Explore
  const candidates = products.filter(p => p.homeSection !== "Flash Sale" && p.homeSection !== "New Arrivals");
  
  // Deterministically shuffle candidates based on today's seed
  const shuffledCandidates = seededShuffle(candidates, dateSeed);
  
  // We want to dynamically select Trending and More to Explore every day.
  // We'll show up to 6 trending items, and the rest will go to "More to Explore".
  let trendingLimit = 0;
  if (shuffledCandidates.length > 0) {
    trendingLimit = Math.max(1, Math.min(5, Math.floor(shuffledCandidates.length / 2)));
  }
  
  const gradients = getDailyGradients();
  const trendingGrad = gradients[2];
  const flashSaleGrad = gradients[3];
  const newArrivalsGrad = gradients[4];
  const moreToExploreGrad = gradients[5];

  const trending = shuffledCandidates.slice(0, trendingLimit);
  const allOtherProducts = shuffledCandidates.slice(trendingLimit);

  useEffect(() => {
    const el = trendingScrollRef.current;
    if (!el || trending.length === 0) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let isInteractingRef = false;
    let interactionTimeout: any;

    const handleStart = () => {
      isInteractingRef = true;
      if (interactionTimeout) clearTimeout(interactionTimeout);
    };

    const handleEnd = () => {
      if (interactionTimeout) clearTimeout(interactionTimeout);
      interactionTimeout = setTimeout(() => {
        isInteractingRef = false;
        lastTime = performance.now();
      }, 2000);
    };

    // Touch events for mobile swiping
    el.addEventListener('touchstart', handleStart, { passive: true });
    el.addEventListener('touchend', handleEnd, { passive: true });

    // Drag to scroll events for desktop mouse
    let isDown = false;
    let startX: number;
    let scrollLeftVal: number;
    let isDragging = false;
    let clickStartX = 0;
    let clickStartY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isDown = true;
      isDragging = false;
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      isInteractingRef = true;
      if (interactionTimeout) clearTimeout(interactionTimeout);
      startX = e.pageX - el.offsetLeft;
      scrollLeftVal = el.scrollLeft;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      const x = e.pageX - el.offsetLeft;
      
      // Drag threshold
      if (Math.abs(e.clientX - clickStartX) > 5 || Math.abs(e.clientY - clickStartY) > 5) {
        isDragging = true;
      }
      
      const walk = (x - startX) * 1.5;
      el.scrollLeft = scrollLeftVal - walk;
    };

    const handleMouseUpOrLeave = () => {
      isDown = false;
      handleEnd();
    };

    const handleClickCapture = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseup', handleMouseUpOrLeave);
    el.addEventListener('mouseleave', handleMouseUpOrLeave);
    el.addEventListener('click', handleClickCapture, true);

    // Auto-scroll animation loop
    const scrollSpeed = 30; // speed in pixels per second
    const loop = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (!isInteractingRef && el) {
        const itemWidth = el.scrollWidth / 2;
        if (itemWidth > 0) {
          el.scrollLeft += scrollSpeed * delta;
          if (el.scrollLeft >= itemWidth) {
            el.scrollLeft -= itemWidth;
          } else if (el.scrollLeft <= 0) {
            el.scrollLeft += itemWidth;
          }
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (interactionTimeout) clearTimeout(interactionTimeout);
      el.removeEventListener('touchstart', handleStart);
      el.removeEventListener('touchend', handleEnd);
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseup', handleMouseUpOrLeave);
      el.removeEventListener('mouseleave', handleMouseUpOrLeave);
      el.removeEventListener('click', handleClickCapture, true);
    };
  }, [trending]);

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
    return <ProductFeedSkeleton />;
  }

  // Reusable Product Card Component
  const ProductCard = ({ product, isHorizontal = false }: { product: any, isHorizontal?: boolean }) => {
    const isOutOfStock = product.quantity === undefined || product.quantity === null || Number(product.quantity) <= 0;

    return (
      <Link 
        href={`/product/${product.id}`} 
        className={`bg-white flex flex-col relative group cursor-pointer block rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 border-none
          ${isHorizontal ? 'w-52 flex-shrink-0' : 'w-full'}`}
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#F9F9F9]">
          <OptimizedImage
            src={product.image}
            alt={product.brand}
            fill
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'opacity-40 grayscale' : ''}`}
          />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-10">
              <span className="bg-rose-600 text-white text-[9px] font-black px-2.5 py-1.5 rounded-full uppercase tracking-widest shadow-md">
                Out of Stock
              </span>
            </div>
          )}
          {product.quantity !== undefined && product.quantity !== null && Number(product.quantity) > 0 && Number(product.quantity) <= 5 && (
            <div className="absolute top-2 left-2 bg-slate-700/90 backdrop-blur-xs text-white text-[8px] font-bold px-2 py-0.5 rounded shadow-sm z-10 font-sans uppercase tracking-wider">
              Only {product.quantity} left
            </div>
          )}
          {(() => {
            const isWishlisted = wishlist.includes(product.id);
            return (
              <button 
                className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full shadow-sm transition-all z-20 cursor-pointer"
                onClick={(e) => toggleWishlist(product.id, e)}
              >
                <Heart 
                  size={16} 
                  className={isWishlisted ? "text-pink-600 fill-pink-600" : "text-gray-400 hover:text-pink-600"} 
                />
              </button>
            );
          })()}
          {!isOutOfStock && (
            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-gray-800 flex items-center space-x-1 z-10">
              <Star size={10} className="text-yellow-500 fill-yellow-500" />
              <span>4.5</span>
            </div>
          )}
        </div>
        <div className="p-3">
          <h4 className="font-sans font-normal text-[12px] text-[#666666] truncate">{product.brand}</h4>
          <h3 className="font-sans font-semibold text-[14px] text-[#222222] truncate mt-0.5">{product.title}</h3>
          
          <div className="mt-2 flex items-baseline space-x-2 flex-wrap">
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
  };

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
            className={`flex items-center space-x-1 border px-2 py-1 rounded-full text-xs font-bold transition-colors ${showFilters ? 'bg-slate-50 border-slate-200 text-pink-600' : 'border-gray-200 text-gray-700'}`}
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
                  className={`px-3 py-1.5 text-xs font-bold border rounded-full ${sortOrder === "lowHigh" ? "border-pink-500 bg-slate-50 text-pink-600" : "border-gray-300 bg-white text-gray-700"}`}
                >
                  Low to High
                </button>
                <button 
                  onClick={() => setSortOrder(sortOrder === "highLow" ? "none" : "highLow")}
                  className={`px-3 py-1.5 text-xs font-bold border rounded-full ${sortOrder === "highLow" ? "border-pink-500 bg-slate-50 text-pink-600" : "border-gray-300 bg-white text-gray-700"}`}
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
                    className={`w-10 h-10 flex items-center justify-center text-xs font-bold border rounded-full flex-shrink-0 ${selectedSize === size ? "border-pink-500 bg-slate-50 text-pink-600" : "border-gray-300 bg-white text-gray-700"}`}
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
          <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 pb-24">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // HOME MODE (Dynamic Dashboard)

  return (
    <div className="pb-24 space-y-6 bg-white">
      
      {/* 1. Explore More / Main Grid (Trending) */}
      <div className={`p-4 pt-8 pb-6 border-b relative overflow-hidden ${trendingGrad.bg} ${trendingGrad.border}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-sans font-bold text-[18px] md:text-[20px] text-[#1A1A1A] tracking-tight">Trending</h2>
          <span className="text-[9px] font-bold text-gray-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Auto Sliding
          </span>
        </div>
        <div className="overflow-hidden -mx-4 px-4 relative">
          <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-white/90 to-transparent z-10 pointer-events-none"></div>
          <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-white/90 to-transparent z-10 pointer-events-none"></div>

          <div 
            ref={trendingScrollRef}
            className="flex space-x-3 overflow-x-auto hide-scrollbar py-2 cursor-grab active:cursor-grabbing select-none"
          >
            {/* First copy */}
            {trending.map((product) => (
              <ProductCard key={`${product.id}-t1`} product={product} isHorizontal={true} />
            ))}
            {/* Second copy for looping */}
            {trending.map((product) => (
              <ProductCard key={`${product.id}-t2`} product={product} isHorizontal={true} />
            ))}
          </div>
        </div>
      </div>

      {/* 2. Flash Sale Section */}
      {flashDeals.length > 0 && flashSaleState !== "ended" && (
        <div className={`border-y shadow-sm p-4 pt-6 pb-6 relative overflow-hidden ${flashSaleGrad.bg} ${flashSaleGrad.border}`}>
          {/* Subtle background element for the glassmorphism to pop against */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-200/50 rounded-full blur-3xl opacity-35 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          
          <div className="flex justify-between items-end mb-5 relative z-10">
            <div>
              <div className="flex items-center space-x-1 mb-1">
                <Zap size={16} className="text-amber-500" />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${flashSaleState === 'upcoming' ? "text-amber-600" : "text-gray-500"}`}>
                  {flashSaleState === 'upcoming' ? "Coming Soon" : "Limited Time"}
                </span>
              </div>
              <h2 className={`font-sans font-bold text-[18px] md:text-[20px] leading-none ${flashSaleState === 'upcoming' ? "text-slate-800" : "text-[#1A1A1A]"}`}>Flash Sale</h2>
            </div>
            <div className={`px-2 py-1 rounded shadow-sm border text-xs font-mono font-bold tracking-wider transition-all duration-300
              ${flashSaleState === 'upcoming' 
                ? 'text-amber-700 bg-amber-50 border border-amber-200 shadow-inner' 
                : flashSaleGrad.badge}`}>
              {flashSaleCountdown}
            </div>
          </div>
          
          <div className="flex space-x-3 overflow-x-auto hide-scrollbar pb-2 pt-1 px-1 -mx-1">
            {flashDeals.map((product) => (
              <ProductCard key={product.id} product={product} isHorizontal={true} />
            ))}
          </div>
        </div>
      )}

      {/* 3. New Arrivals Section */}
      {newArrivals.length > 0 && (
        <div className={`p-4 py-8 border-b relative ${newArrivalsGrad.bg} ${newArrivalsGrad.border}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-sans font-bold text-[18px] md:text-[20px] text-[#1A1A1A] tracking-tight">New Arrivals</h2>
            <Link href={`/category/${encodeURIComponent("New Arrivals")}`} className="text-xs font-bold text-gray-500 flex items-center hover:text-pink-600 transition-colors uppercase tracking-wider">
              View All <ChevronRight size={14} className="ml-0.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* 4. All Other Products (Standard) */}
      <div className={`p-4 pt-6 min-h-screen ${moreToExploreGrad.bg}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-sans font-bold text-[18px] md:text-[20px] text-[#1A1A1A] tracking-tight">More to Explore</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {allOtherProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductFeedSkeleton() {
  return (
    <div className="bg-gray-50 pb-24 space-y-2 animate-pulse w-full select-none">
      {/* 1. Trending Slider Skeleton */}
      <div className="bg-[#F9F9F9] p-4 pt-8 pb-4">
        <div className="h-6 w-32 bg-gray-200 rounded mb-6"></div>
        <div className="flex space-x-3 overflow-x-auto hide-scrollbar pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-44 flex-shrink-0 bg-white rounded-2xl p-3 space-y-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div className="aspect-[4/5] bg-gray-200 rounded-xl w-full"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mt-1"></div>
              <div className="h-4 bg-gray-300 rounded w-1/3 mt-2"></div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Flash Sale Slider Skeleton */}
      <div className="bg-white p-4 pt-6 pb-6 border-y border-gray-100">
        <div className="flex justify-between items-end mb-5">
          <div className="space-y-2">
            <div className="h-3 w-16 bg-gray-200 rounded"></div>
            <div className="h-6 w-28 bg-gray-200 rounded"></div>
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded"></div>
        </div>
        <div className="flex space-x-3 overflow-x-auto hide-scrollbar pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-44 flex-shrink-0 bg-white rounded-2xl p-3 space-y-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div className="aspect-[4/5] bg-gray-200 rounded-xl w-full"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mt-1"></div>
              <div className="h-4 bg-gray-300 rounded w-1/3 mt-2"></div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. More to Explore Grid Skeleton */}
      <div className="bg-[#F9F9F9] p-4 pt-4">
        <div className="h-6 w-36 bg-gray-200 rounded mb-6"></div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-3 space-y-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div className="aspect-[4/5] bg-gray-200 rounded-xl w-full"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mt-1"></div>
              <div className="h-4 bg-gray-300 rounded w-1/3 mt-2"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
