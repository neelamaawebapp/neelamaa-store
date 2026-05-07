"use client";

import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trash2, Plus, Minus, ShieldCheck } from "lucide-react";

export default function BagPage() {
  const { cart, removeFromBag, updateQuantity, totalAmount } = useCart();
  const router = useRouter();

  const discount = Math.round(totalAmount * 0.33); // Simulating 33% total discount
  const finalAmount = totalAmount - discount;

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
          <div className="w-32 h-32 bg-pink-50 rounded-full flex items-center justify-center mb-6">
            <span className="text-5xl">🛍️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Hey, it feels so light!</h2>
          <p className="text-gray-500 text-sm mb-8">There is nothing in your bag. Let's add some items.</p>
          <button 
            onClick={() => router.push("/")}
            className="border-2 border-pink-500 text-pink-500 font-bold py-3 px-8 rounded-md hover:bg-pink-50 transition-colors"
          >
            ADD ITEMS FROM WISHLIST
          </button>
        </div>
      ) : (
        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
          {/* Cart Items */}
          {cart.map((item) => (
            <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex space-x-4 relative">
              <div className="w-24 h-32 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                <img src={item.image} alt={item.brand} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 flex flex-col pt-1">
                <h3 className="font-bold text-sm text-gray-900">{item.brand}</h3>
                <p className="text-xs text-gray-500 truncate mb-1">{item.title}</p>
                {item.size && (
                  <p className="text-xs text-gray-500 mb-2">Size: <span className="font-bold text-gray-800">{item.size}</span></p>
                )}
                <div className="flex items-baseline space-x-2 mb-3">
                  <span className="font-bold text-sm text-gray-900">₹{item.price}</span>
                  <span className="text-xs text-gray-400 line-through">₹{Math.round(item.price * 1.5)}</span>
                </div>
                
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
                      className="w-8 h-8 flex items-center justify-center text-pink-600 hover:bg-pink-50"
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
                <span className="text-green-600">FREE</span>
              </div>
              <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between font-bold text-gray-900 text-base">
                <span>Total Amount</span>
                <span>₹{finalAmount}</span>
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
        <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 p-3 pb-safe z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900">₹{finalAmount}</span>
              <a href="#" className="text-xs text-pink-600 font-bold uppercase tracking-wide">View Details</a>
            </div>
            <button 
              onClick={() => router.push("/checkout")}
              className="bg-pink-500 text-white font-bold py-3.5 px-8 rounded-md hover:bg-pink-600 transition-colors w-1/2 flex justify-center items-center"
            >
              PLACE ORDER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
