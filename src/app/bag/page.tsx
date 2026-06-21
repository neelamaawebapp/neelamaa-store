"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Trash2, Plus, Minus, ShieldCheck, AlertTriangle } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function BagPage() {
  const { cart, removeFromBag, updateQuantity, totalAmount } = useCart();
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [loadingStock, setLoadingStock] = useState(true);

  useEffect(() => {
    const fetchStock = async () => {
      const newStockLevels: Record<string, number> = {};
      try {
        await Promise.all(
          cart.map(async (item) => {
            const productRef = doc(db, "products", item.productId);
            const docSnap = await getDoc(productRef);
            if (docSnap.exists()) {
              const prodData = docSnap.data();
              const isFashion = prodData.category?.toLowerCase() === "fashion";
              if (isFashion && item.size && prodData.sizesInventory) {
                newStockLevels[item.id] = Number(prodData.sizesInventory[item.size] || 0);
              } else {
                newStockLevels[item.id] = Number(prodData.quantity || 0);
              }
            } else {
              newStockLevels[item.id] = 0;
            }
          })
        );
      } catch (err) {
        console.error("Error fetching stock levels", err);
      } finally {
        setStockLevels(newStockLevels);
        setLoadingStock(false);
      }
    };
    if (cart.length > 0) {
      fetchStock();
    } else {
      setLoadingStock(false);
    }
  }, [cart]);

  const hasOutOfStockItems = cart.some(item => {
    const stock = stockLevels[item.id];
    return stock !== undefined && (stock <= 0 || stock < item.quantity);
  });
  const router = useRouter();

  const [discountPercent, setDiscountPercent] = useState(0);

  useEffect(() => {
    getDoc(doc(db, "settings", "discount")).then((snap) => {
      if (snap.exists() && typeof snap.data().percent === "number") {
        setDiscountPercent(snap.data().percent);
      }
    });
  }, []);

  const discount = Math.round(totalAmount * (discountPercent / 100));
  const finalAmount = totalAmount - discount;
  const courierCharges = finalAmount < 500 && finalAmount > 0 ? 100 : 0;
  const totalToPay = finalAmount + courierCharges;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-32">
      {/* Header */}
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 leading-tight">Shopping Bag</h1>
          <p className="text-xs text-gray-500 font-medium">{cart.length} items</p>
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <span className="text-5xl">🛍️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Hey, it feels so light!</h2>
          <p className="text-gray-500 text-sm mb-8">There is nothing in your bag. Let's add some items.</p>
          <button 
            onClick={() => router.push("/")}
            className="border-2 border-pink-500 text-pink-600 font-bold py-3 px-8 rounded-md hover:bg-slate-50 transition-colors"
          >
            ADD ITEMS FROM WISHLIST
          </button>
        </div>
      ) : (
        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
          {/* Cart Items */}
          {cart.map((item) => (
            <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex space-x-4 relative">
              <Link 
                href={`/product/${item.productId}`}
                className="w-24 h-32 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 block cursor-pointer hover:opacity-90 transition-opacity"
              >
                <img src={item.image} alt={item.brand} className="w-full h-full object-cover" />
              </Link>
              <div className="flex-1 flex flex-col pt-1">
                <Link href={`/product/${item.productId}`} className="group cursor-pointer block">
                  <h3 className="font-bold text-sm text-gray-900 group-hover:text-pink-600 transition-colors">{item.brand}</h3>
                  <p className="text-xs text-gray-500 truncate mb-1 group-hover:text-pink-500 transition-colors">{item.title}</p>
                </Link>
                {item.size && (
                  <p className="text-xs text-gray-500 mb-2">Size: <span className="font-bold text-gray-800">{item.size}</span></p>
                )}
                <div className="flex items-baseline space-x-2 mb-3">
                  <span className="font-bold text-sm text-gray-900">₹{item.price}</span>
                  <span className="text-xs text-gray-400 line-through">₹{Math.round(item.price * 1.5)}</span>
                </div>

                {stockLevels[item.id] !== undefined && stockLevels[item.id] <= 0 && (
                  <div className="text-red-600 text-[11px] font-extrabold mb-2 bg-red-50/50 border border-red-150 px-2 py-1 rounded w-max flex items-center gap-1 uppercase tracking-wide">
                    <AlertTriangle size={11} /> Out of Stock
                  </div>
                )}
                {stockLevels[item.id] !== undefined && stockLevels[item.id] > 0 && stockLevels[item.id] < item.quantity && (
                  <div className="text-orange-600 text-[11px] font-extrabold mb-2 bg-orange-50/50 border border-orange-150 px-2 py-1 rounded w-max flex items-center gap-1 uppercase tracking-wide">
                    <AlertTriangle size={11} /> Only {stockLevels[item.id]} available
                  </div>
                )}
                
                <div className="mt-auto flex items-center space-x-4">
                  <div className="flex items-center border border-gray-300 rounded overflow-hidden bg-gray-50">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-gray-900">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-pink-600 hover:bg-slate-50"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => removeFromBag(item.id)}
                className="absolute top-3 right-3 text-gray-400 hover:text-red-500 p-1"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          {/* Courier Charges Alert */}
          {courierCharges > 0 && (
            <div className="bg-amber-50 border border-amber-250 text-amber-800 text-xs font-semibold p-3.5 rounded-xl flex flex-col gap-1 mt-4">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle size={14} className="text-amber-600" />
                <span>Courier Charges Applicable</span>
              </div>
              <span className="text-[11px] text-amber-700 leading-normal">
                An additional courier charge of ₹100 is applied for orders below ₹500. Add items worth <strong>₹{500 - finalAmount}</strong> more to get FREE shipping!
              </span>
            </div>
          )}

          {/* Price Details */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mt-4">
            <h3 className="font-bold text-sm text-gray-900 mb-4 uppercase tracking-wide">Price Details ({cart.length} Items)</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total MRP</span>
                <span>₹{totalAmount}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Discount on MRP</span>
                <span className="text-green-600">-₹{discount}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Platform Fee</span>
                <span className="text-green-600">FREE</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping Fee</span>
                {courierCharges > 0 ? (
                  <span className="text-gray-900 font-bold">₹{courierCharges}</span>
                ) : (
                  <span className="text-green-600 font-bold">FREE</span>
                )}
              </div>
              <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between font-bold text-gray-900 text-base">
                <span>Total Amount</span>
                <span>₹{totalToPay}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center space-x-2 text-gray-500 text-xs py-4">
            <ShieldCheck size={16} className="text-green-600" />
            <span>Safe and secure payments. 100% Authentic products.</span>
          </div>
        </div>
      )}

      {/* Sticky Bottom Action */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 bg-white border-t border-gray-200 p-3 pb-safe z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {hasOutOfStockItems && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-2.5 rounded-lg text-center mb-3 flex items-center justify-center gap-1.5 animate-pulse">
              <AlertTriangle size={14} />
              <span>Out of stock items present. Please remove them.</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900">₹{totalToPay}</span>
              <a href="#" className="text-xs text-pink-600 font-bold uppercase tracking-wide">View Details</a>
            </div>
            <button 
              onClick={() => {
                if (hasOutOfStockItems) {
                  alert("Please remove out of stock items from your bag to proceed.");
                  return;
                }
                router.push("/checkout");
              }}
              disabled={hasOutOfStockItems || loadingStock}
              className={`font-bold py-3.5 px-8 rounded-md transition-colors w-1/2 flex justify-center items-center uppercase tracking-wider text-xs cursor-pointer
                ${hasOutOfStockItems || loadingStock
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                  : "bg-pink-500 text-white hover:bg-pink-600 shadow-sm"}`}
            >
              {loadingStock ? "CHECKING STOCK..." : "PLACE ORDER"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
