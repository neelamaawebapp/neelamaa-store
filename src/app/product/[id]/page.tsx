"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/context/CartContext";
import { ChevronLeft, Share2, Heart, ShoppingBag, Info, Truck, ShieldCheck } from "lucide-react";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { addToBag } = useCart();
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");

  const [selectedSize, setSelectedSize] = useState("");
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const sizes = ["S", "M", "L", "XL", "XXL"];

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

  const handleAdd = async () => {
    if (!product) return;
    if (!selectedSize) {
      setToast("Please select a size first!");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    setAdding(true);
    await addToBag({
      productId: product.id,
      brand: product.brand,
      title: product.title,
      price: product.price,
      image: product.image,
      size: selectedSize,
    });
    setAdding(false);
    setToast("Added to Bag!");
    setTimeout(() => setToast(""), 3000);
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
        <button onClick={() => router.push("/")} className="mt-4 text-pink-500 font-bold">Go Home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white w-full max-w-md mx-auto relative pb-28">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
        <button onClick={() => router.back()} className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <div className="flex space-x-2">
          <button className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm">
            <Share2 size={20} className="text-gray-800" />
          </button>
          <button className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm">
            <Heart size={20} className="text-gray-800" />
          </button>
        </div>
      </div>

      {/* Product Image */}
      <div className="w-full aspect-[3/4] bg-gray-100 relative">
        <img
          src={product.image}
          alt={product.brand}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Product Info */}
      <div className="p-4 bg-white border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">{product.brand}</h1>
        <p className="text-gray-500 mt-1">{product.title}</p>
        
        <div className="mt-4 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-gray-900">₹{product.price}</span>
          <span className="text-sm text-gray-500 line-through">₹{Math.round(product.price * 1.5)}</span>
          <span className="text-sm font-bold text-orange-500">(33% OFF)</span>
        </div>
        <p className="text-xs text-green-700 font-medium mt-1">inclusive of all taxes</p>
      </div>

      {/* Size Selection */}
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
          {sizes.map((size) => (
            <button 
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`w-12 h-12 rounded-full border flex items-center justify-center font-bold transition-colors flex-shrink-0
                ${selectedSize === size 
                  ? 'border-pink-500 bg-pink-50 text-pink-600' 
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}
            >
              {size}
            </button>
          ))}
        </div>
        {!selectedSize && toast === "Please select a size first!" && (
          <p className="text-red-500 text-xs font-bold mt-2 animate-bounce">Please select a size</p>
        )}
      </div>

      {/* Delivery & Trust */}
      <div className="p-4 bg-white space-y-4">
        <div className="flex items-start gap-3">
          <Truck className="text-gray-600 mt-1" size={20} />
          <div>
            <h3 className="font-bold text-sm text-gray-900">Delivery</h3>
            <p className="text-sm text-gray-600">Estimated Delivery: 5-7 Days</p>
            <p className="text-xs text-gray-500 mt-1">Cash on delivery available.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <ShieldCheck className="text-gray-600 mt-1" size={20} />
          <div>
            <h3 className="font-bold text-sm text-gray-900">100% Original Products</h3>
            <p className="text-sm text-gray-600">Pay on delivery might be available</p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && toast !== "Please select a size first!" && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium z-50 animate-fade-in-up">
          {toast}
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 p-3 pb-safe flex space-x-3 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button className="flex-1 py-3.5 border border-gray-300 rounded-md font-bold text-gray-800 flex items-center justify-center space-x-2">
          <Heart size={20} />
          <span>WISHLIST</span>
        </button>
        <button 
          onClick={handleAdd}
          disabled={adding}
          className="flex-1 py-3.5 bg-pink-500 rounded-md font-bold text-white flex items-center justify-center space-x-2 hover:bg-pink-600 disabled:opacity-70 transition-colors"
        >
          <ShoppingBag size={20} />
          <span>{adding ? "ADDING..." : "ADD TO BAG"}</span>
        </button>
      </div>

      {/* Size Guide Modal */}
      {showSizeGuide && (
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
    </div>
  );
}
