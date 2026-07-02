"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Trash2, Plus, Minus, ShieldCheck, AlertTriangle, Tag, Check, X, Gift } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function BagPage() {
  const { 
    cart, 
    removeFromBag, 
    updateQuantity, 
    totalAmount,
    couponCode,
    couponDiscountPercent,
    applyCouponCode,
    removeCouponCode
  } = useCart();
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [loadingStock, setLoadingStock] = useState(true);

  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");
  const [applying, setApplying] = useState(false);

  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Sync state with cart: initialize all checked by default when first loaded
  useEffect(() => {
    if (cart.length > 0 && !isInitialized) {
      setCheckedItemIds(cart.map(item => item.id));
      setIsInitialized(true);
    }
  }, [cart, isInitialized]);

  // Keep state updated: auto-check new items and filter out removed items
  useEffect(() => {
    if (cart.length > 0 && isInitialized) {
      setCheckedItemIds(prev => {
        const cartIds = cart.map(item => item.id);
        const updated = prev.filter(id => cartIds.includes(id));
        cartIds.forEach(id => {
          if (!prev.includes(id) && !updated.includes(id)) {
            updated.push(id);
          }
        });
        return updated;
      });
    }
  }, [cart, isInitialized]);

  const handleToggleCheck = (itemId: string) => {
    setCheckedItemIds(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

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

  const checkedItems = cart.filter(item => checkedItemIds.includes(item.id));

  const hasOutOfStockItems = checkedItems.some(item => {
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

  const totalMRP = checkedItems.reduce((sum, item) => sum + (item.mrp || Math.round(item.price * 1.5)) * item.quantity, 0);
  const totalSellingPrice = checkedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const productDiscountAmount = totalMRP - totalSellingPrice;
  const storeDiscountAmount = Math.round(totalSellingPrice * (discountPercent / 100));
  
  // Coupon Discount
  const couponDiscountAmount = Math.round(totalSellingPrice * (couponDiscountPercent / 100));
  
  const totalDiscountAmount = productDiscountAmount + storeDiscountAmount + couponDiscountAmount;
  const calculatedDiscountPercent = totalMRP > 0 ? Math.round((totalDiscountAmount / totalMRP) * 100) : 0;

  const finalAmount = Math.max(0, totalMRP - totalDiscountAmount);
  const courierCharges = finalAmount < 500 && finalAmount > 0 ? 100 : 0;
  const totalToPay = finalAmount + courierCharges;

  const handleApply = async (codeToApply?: string) => {
    const code = codeToApply || couponInput;
    if (!code.trim()) {
      setCouponError("Please enter a coupon code.");
      setCouponSuccess("");
      return;
    }
    setApplying(true);
    setCouponError("");
    setCouponSuccess("");
    try {
      const res = await applyCouponCode(code);
      if (res.success) {
        setCouponSuccess(res.message);
        setCouponInput("");
      } else {
        setCouponError(res.message);
      }
    } catch (err: any) {
      setCouponError(err.message || "Failed to apply coupon.");
    } finally {
      setApplying(false);
    }
  };

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
            onClick={() => router.push("/wishlist")}
            className="border-2 border-pink-500 text-pink-600 font-bold py-3 px-8 rounded-md hover:bg-slate-50 transition-colors"
          >
            ADD ITEMS FROM WISHLIST
          </button>
        </div>
      ) : (
        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
          {/* Cart Items */}
          {cart.map((item) => (
            <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-start space-x-3 relative">
              {/* Selection Checkbox */}
              <div 
                className="self-center flex-shrink-0 cursor-pointer p-1.5 -ml-1.5" 
                onClick={(e) => { e.preventDefault(); handleToggleCheck(item.id); }}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200
                  ${checkedItemIds.includes(item.id) 
                    ? 'bg-pink-500 border-pink-500 text-white shadow-sm shadow-pink-500/25' 
                    : 'bg-white border-gray-300 text-transparent hover:border-pink-500'}`}>
                  <Check size={12} className="stroke-[3]" />
                </div>
              </div>

              <Link 
                href={`/product/${item.productId}`}
                className="w-20 h-28 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 block cursor-pointer hover:opacity-90 transition-opacity"
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
                {(() => {
                  const mrpVal = item.mrp || Math.round(item.price * 1.5);
                  const discountPercent = mrpVal > item.price ? Math.round(((mrpVal - item.price) / mrpVal) * 100) : 0;
                  const discountAmount = mrpVal - item.price;
                  return (
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center space-x-2 text-[11px] flex-wrap text-gray-500">
                        <span>MRP:</span>
                        <span className="line-through">₹{mrpVal}</span>
                        {mrpVal > item.price && (
                          <>
                            <span className="text-pink-600 font-bold">({discountPercent}% OFF)</span>
                            <span className="text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded text-[10px]">
                              Save ₹{discountAmount}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xs text-gray-500 font-medium">Price:</span>
                        <span className="font-extrabold text-sm text-gray-900">₹{item.price}</span>
                        {item.quantity > 1 && (
                          <span className="text-xs text-gray-400 font-normal">
                            (Total: ₹{item.price * item.quantity})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

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

          {/* Coupons Section */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mt-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <div className="flex items-center space-x-2 text-gray-800">
                <Tag size={18} className="text-pink-500" />
                <h3 className="font-bold text-sm uppercase tracking-wide">Apply Coupon</h3>
              </div>
              {couponCode && (
                <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded border border-green-150 flex items-center gap-1">
                  <Check size={10} className="stroke-[3]" /> Coupon Active
                </span>
              )}
            </div>

            {couponCode ? (
              <div className="flex items-center justify-between bg-green-50/50 border border-green-100 rounded-xl p-3.5 animate-fade-in">
                <div className="flex items-start space-x-2.5">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 flex-shrink-0 mt-0.5">
                    <Gift size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900 uppercase font-mono tracking-wider">{couponCode} APPLIED</h4>
                    <p className="text-[11px] text-green-700 mt-0.5 font-medium">You saved ₹{couponDiscountAmount} ({couponDiscountPercent}% OFF)</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    removeCouponCode();
                    setCouponSuccess("");
                    setCouponError("");
                  }}
                  className="text-gray-400 hover:text-red-500 p-1.5 transition-colors cursor-pointer"
                  title="Remove Coupon"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Enter Coupon Code (e.g. FIRSTBUY20)"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value);
                      setCouponError("");
                      setCouponSuccess("");
                    }}
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm uppercase font-mono tracking-wider focus:ring-1 focus:ring-pink-500 outline-none text-gray-900 placeholder-gray-400"
                  />
                  <button
                    onClick={() => handleApply()}
                    disabled={applying}
                    className="bg-pink-500 text-white font-bold px-5 py-2.5 rounded-md hover:bg-pink-600 transition-colors text-xs uppercase tracking-wider disabled:opacity-75 cursor-pointer"
                  >
                    {applying ? "APPLYING..." : "APPLY"}
                  </button>
                </div>

                {couponError && (
                  <p className="text-red-500 text-[11px] font-bold flex items-center gap-1">
                    <AlertTriangle size={12} /> {couponError}
                  </p>
                )}

                {couponSuccess && (
                  <p className="text-green-600 text-[11px] font-bold flex items-center gap-1">
                    <Check size={12} className="stroke-[3]" /> {couponSuccess}
                  </p>
                )}

                {/* Available Offers Accordion */}
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Available Coupons</span>
                  <div className="space-y-2">
                    {[
                      { code: "FIRSTBUY20", desc: "Flat 20% OFF on your first purchase (Login Required)" },
                      { code: "WELCOME15", desc: "Flat 15% OFF on your order" },
                      { code: "CRAFTSTYLE10", desc: "Flat 10% OFF on your bag total" },
                      { code: "FESTIVE25", desc: "Flat 25% OFF on orders above ₹1000" }
                    ].map((c) => {
                      const isDisabled = c.code === "FESTIVE25" && totalAmount < 1000;
                      return (
                        <div 
                          key={c.code} 
                          className={`flex items-center justify-between p-2.5 border rounded-lg transition-colors
                            ${isDisabled 
                              ? "bg-gray-50 border-gray-200 opacity-60" 
                              : "border-gray-200 hover:border-pink-200 bg-white"}`}
                        >
                          <div className="min-w-0 pr-2">
                            <span className={`font-mono text-[11px] font-extrabold tracking-wider px-1.5 py-0.5 rounded
                              ${isDisabled 
                                ? "bg-gray-200 text-gray-500" 
                                : "bg-pink-50 text-pink-700"}`}>
                              {c.code}
                            </span>
                            <p className="text-[10px] text-gray-500 mt-1 font-medium leading-tight">{c.desc}</p>
                          </div>
                          <button
                            onClick={() => handleApply(c.code)}
                            disabled={applying || isDisabled}
                            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded transition-colors flex-shrink-0 cursor-pointer
                              ${isDisabled
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-pink-100 text-pink-700 hover:bg-pink-500 hover:text-white"}`}
                          >
                            Apply
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Price Details */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mt-4">
            <h3 className="font-bold text-sm text-gray-900 mb-4 uppercase tracking-wide">Price Details ({checkedItems.length} of {cart.length} Items Selected)</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total MRP</span>
                <span>₹{totalMRP}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Discount on MRP</span>
                <span className="text-green-600">-₹{productDiscountAmount + storeDiscountAmount}</span>
              </div>
              {couponDiscountPercent > 0 && (
                <div className="flex justify-between text-gray-600 animate-fade-in">
                  <span className="flex items-center gap-1.5 text-green-600 font-medium">
                    <Tag size={13} />
                    <span>Coupon Discount ({couponCode})</span>
                  </span>
                  <span className="text-green-600 font-bold">-₹{couponDiscountAmount}</span>
                </div>
              )}
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
              <span>Out of stock selected items. Please uncheck or remove them.</span>
            </div>
          )}
          
          <div className="text-[10px] text-gray-500 font-bold text-center mb-2.5 uppercase tracking-wider border-b border-gray-150 pb-1.5 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping"></span>
            <span>{checkedItemIds.length} of {cart.length} items to be ordered</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900">₹{totalToPay}</span>
              <a href="#" className="text-xs text-pink-600 font-bold uppercase tracking-wide">View Details</a>
            </div>
            <button 
              onClick={() => {
                if (checkedItemIds.length === 0) {
                  alert("Please select at least one item to order.");
                  return;
                }
                if (hasOutOfStockItems) {
                  alert("Please uncheck or remove out of stock items to proceed.");
                  return;
                }
                // Save checked items to localStorage
                localStorage.setItem("craftstyle_checked_cart_ids", JSON.stringify(checkedItemIds));
                router.push("/checkout");
              }}
              disabled={hasOutOfStockItems || loadingStock || checkedItemIds.length === 0}
              className={`font-bold py-3.5 px-8 rounded-md transition-colors w-1/2 flex justify-center items-center uppercase tracking-wider text-xs cursor-pointer
                ${hasOutOfStockItems || loadingStock || checkedItemIds.length === 0
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                  : "bg-pink-500 text-white hover:bg-pink-600 shadow-sm"}`}
            >
              {loadingStock ? "CHECKING STOCK..." : `PLACE ORDER (${checkedItemIds.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
