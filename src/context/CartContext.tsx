"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";

export interface CartItem {
  id: string; // product id + size for uniqueness
  productId: string; // actual product id
  brand: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
  size?: string;
  gstRate?: number;
  mrp?: number;
}

interface CartContextType {
  cart: CartItem[];
  addToBag: (item: Omit<CartItem, "quantity" | "id"> & { size: string }, quantity?: number) => Promise<void>;
  removeFromBag: (id: string) => Promise<void>;
  updateQuantity: (id: string, qty: number) => Promise<void>;
  clearCart: (checkedIds?: string[]) => Promise<void>;
  totalCount: number;
  totalAmount: number;
  couponCode: string;
  couponDiscountPercent: number;
  applyCouponCode: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCouponCode: () => void;
  updatingItems: Record<string, 'updating' | 'deleting' | null>;
}

const CartContext = createContext<CartContextType>({
  cart: [],
  addToBag: async () => {},
  removeFromBag: async () => {},
  updateQuantity: async () => {},
  clearCart: async (checkedIds?: string[]) => {},
  totalCount: 0,
  totalAmount: 0,
  couponCode: "",
  couponDiscountPercent: 0,
  applyCouponCode: async () => ({ success: false, message: "" }),
  removeCouponCode: () => {},
  updatingItems: {},
});

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState<string>("");
  const [couponDiscountPercent, setCouponDiscountPercent] = useState<number>(0);
  const [updatingItems, setUpdatingItems] = useState<Record<string, 'updating' | 'deleting' | null>>({});

  useEffect(() => {
    const savedCode = sessionStorage.getItem("craftstyle_applied_coupon");
    const savedPercent = sessionStorage.getItem("craftstyle_applied_coupon_percent");
    if (savedCode && savedPercent) {
      setCouponCode(savedCode);
      setCouponDiscountPercent(Number(savedPercent));
    }
  }, []);

  useEffect(() => {
    // If not logged in, load from localStorage
    if (!user) {
      const stored = localStorage.getItem("craftstyle_local_cart");
      if (stored) {
        try {
          setCart(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse local cart", e);
          setCart([]);
        }
      } else {
        setCart([]);
      }
      return;
    }

    // If logged in, fetch from Firestore
    const cartRef = collection(db, `users/${user.uid}/cartItems`);
    const unsubscribe = onSnapshot(cartRef, (snapshot) => {
      const items: CartItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ ...doc.data() } as CartItem);
      });
      setCart(items);

      // Sync local cart items to Firestore if there are any
      const stored = localStorage.getItem("craftstyle_local_cart");
      if (stored) {
        try {
          const localItems = JSON.parse(stored) as CartItem[];
          if (localItems.length > 0) {
            localItems.forEach(async (localItem) => {
              const cartItemId = localItem.id;
              const itemRef = doc(db, `users/${user.uid}/cartItems`, cartItemId);
              const existingItem = items.find(item => item.id === cartItemId);
              if (existingItem) {
                await updateDoc(itemRef, {
                  quantity: existingItem.quantity + localItem.quantity
                });
              } else {
                await setDoc(itemRef, localItem);
              }
            });
            localStorage.removeItem("craftstyle_local_cart");
          }
        } catch (e) {
          console.error("Sync local cart failed", e);
        }
      }
    }, (error) => {
      console.error("Firestore cart sub error, falling back to localStorage", error);
      const stored = localStorage.getItem("craftstyle_local_cart");
      if (stored) {
        try {
          setCart(JSON.parse(stored));
        } catch (e) {
          setCart([]);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  const updateCartAbandonmentTracker = async (isEmpty: boolean = false) => {
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        cartUpdatedAt: isEmpty ? null : new Date().toISOString(),
        abandonedCartStage: 0
      });
    } catch (e) {
      console.error("Failed to update cart abandonment tracker:", e);
    }
  };

  const addToBag = async (product: Omit<CartItem, "quantity" | "id"> & { size: string }, quantity: number = 1) => {
    const cartItemId = `${product.productId}_${product.size}`;
    const newCartItem: CartItem = {
      ...product,
      id: cartItemId,
      quantity,
    };

    if (!user) {
      console.warn("Attempted to add to bag without being logged in");
      return;
    }

    setUpdatingItems(prev => ({ ...prev, [cartItemId]: 'updating' }));

    // Handle Firestore
    try {
      const itemRef = doc(db, `users/${user.uid}/cartItems`, cartItemId);
      const existingItem = cart.find(item => item.id === cartItemId);

      await Promise.all([
        existingItem
          ? updateDoc(itemRef, { quantity: existingItem.quantity + quantity })
          : setDoc(itemRef, newCartItem),
        updateCartAbandonmentTracker(false)
      ]);
    } catch (err) {
      console.error("Firestore addToBag failed, falling back to local storage", err);
      // Fallback
      const currentCart = [...cart];
      const existingIdx = currentCart.findIndex(item => item.id === cartItemId);
      if (existingIdx > -1) {
        currentCart[existingIdx].quantity += quantity;
      } else {
        currentCart.push(newCartItem);
      }
      setCart(currentCart);
      localStorage.setItem("craftstyle_local_cart", JSON.stringify(currentCart));
    } finally {
      setUpdatingItems(prev => ({ ...prev, [cartItemId]: null }));
    }
  };

  const removeFromBag = async (id: string) => {
    setUpdatingItems(prev => ({ ...prev, [id]: 'deleting' }));
    if (!user) {
      const currentCart = cart.filter(item => item.id !== id);
      setCart(currentCart);
      localStorage.setItem("craftstyle_local_cart", JSON.stringify(currentCart));
      setUpdatingItems(prev => ({ ...prev, [id]: null }));
      return;
    }

    try {
      const itemRef = doc(db, `users/${user.uid}/cartItems`, id);
      const isNowEmpty = cart.filter(item => item.id !== id).length === 0;
      await Promise.all([
        deleteDoc(itemRef),
        updateCartAbandonmentTracker(isNowEmpty)
      ]);
    } catch (err) {
      console.error("Firestore delete failed, falling back to local storage", err);
      const currentCart = cart.filter(item => item.id !== id);
      setCart(currentCart);
      localStorage.setItem("craftstyle_local_cart", JSON.stringify(currentCart));
    } finally {
      setUpdatingItems(prev => ({ ...prev, [id]: null }));
    }
  };

  const updateQuantity = async (id: string, qty: number) => {
    if (qty <= 0) {
      await removeFromBag(id);
      return;
    }

    setUpdatingItems(prev => ({ ...prev, [id]: 'updating' }));
    if (!user) {
      const currentCart = cart.map(item => item.id === id ? { ...item, quantity: qty } : item);
      setCart(currentCart);
      localStorage.setItem("craftstyle_local_cart", JSON.stringify(currentCart));
      setUpdatingItems(prev => ({ ...prev, [id]: null }));
      return;
    }

    try {
      const itemRef = doc(db, `users/${user.uid}/cartItems`, id);
      await Promise.all([
        updateDoc(itemRef, { quantity: qty }),
        updateCartAbandonmentTracker(false)
      ]);
    } catch (err) {
      console.error("Firestore update failed, falling back to local storage", err);
      const currentCart = cart.map(item => item.id === id ? { ...item, quantity: qty } : item);
      setCart(currentCart);
      localStorage.setItem("craftstyle_local_cart", JSON.stringify(currentCart));
    } finally {
      setUpdatingItems(prev => ({ ...prev, [id]: null }));
    }
  };

  const clearCart = async (checkedIds?: string[]) => {
    if (!checkedIds) {
      localStorage.removeItem("craftstyle_local_cart");
      removeCouponCode();
      if (!user) {
        setCart([]);
        return;
      }

      try {
        const promises = cart.map(item => deleteDoc(doc(db, `users/${user.uid}/cartItems`, item.id)));
        await Promise.all(promises);
        setCart([]);
        await updateCartAbandonmentTracker(true);
      } catch (err) {
        console.error("Firestore clear failed, clearing local state", err);
        setCart([]);
      }
    } else {
      const itemsToKeep = cart.filter(item => !checkedIds.includes(item.id));
      const itemsToDelete = cart.filter(item => checkedIds.includes(item.id));

      if (!user) {
        setCart(itemsToKeep);
        localStorage.setItem("craftstyle_local_cart", JSON.stringify(itemsToKeep));
        return;
      }

      try {
        const promises = itemsToDelete.map(item => deleteDoc(doc(db, `users/${user.uid}/cartItems`, item.id)));
        await Promise.all(promises);
        setCart(itemsToKeep);
        const isNowEmpty = itemsToKeep.length === 0;
        await updateCartAbandonmentTracker(isNowEmpty);
      } catch (err) {
        console.error("Firestore selective clear failed, syncing with local state", err);
        setCart(itemsToKeep);
      }
    }
  };

  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const checkFirstOrderEligible = async (userId: string) => {
    try {
      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      
      let hasOrders = false;
      querySnapshot.forEach((doc) => {
        const order = doc.data();
        if (order.status !== "Cancelled") {
          hasOrders = true;
        }
      });

      if (hasOrders) return false;

      // Check local storage orders too
      const localOrdersStr = localStorage.getItem("craftstyle_local_orders");
      if (localOrdersStr) {
        const localOrders = JSON.parse(localOrdersStr);
        const activeLocalOrders = localOrders.filter((o: any) => o.status !== "Cancelled" && o.userId === userId);
        if (activeLocalOrders.length > 0) {
          return false;
        }
      }

      return true;
    } catch (err) {
      console.error("Error checking first order eligibility:", err);
      return false;
    }
  };

  const applyCouponCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    const upperCode = code.trim().toUpperCase();
    if (!upperCode) {
      return { success: false, message: "Please enter a coupon code." };
    }

    if (upperCode === "FIRSTBUY20") {
      if (!user) {
        return { success: false, message: "Please log in to apply this coupon." };
      }
      
      const isEligible = await checkFirstOrderEligible(user.uid);
      if (!isEligible) {
        return { success: false, message: "This coupon is only valid for your first purchase." };
      }

      setCouponCode(upperCode);
      setCouponDiscountPercent(20);
      sessionStorage.setItem("craftstyle_applied_coupon", upperCode);
      sessionStorage.setItem("craftstyle_applied_coupon_percent", "20");
      return { success: true, message: "Coupon applied successfully! 20% discount on first purchase." };
    }

    if (upperCode === "WELCOME15") {
      setCouponCode(upperCode);
      setCouponDiscountPercent(15);
      sessionStorage.setItem("craftstyle_applied_coupon", upperCode);
      sessionStorage.setItem("craftstyle_applied_coupon_percent", "15");
      return { success: true, message: "Coupon applied successfully! 15% discount applied." };
    }

    if (upperCode === "CRAFTSTYLE10") {
      setCouponCode(upperCode);
      setCouponDiscountPercent(10);
      sessionStorage.setItem("craftstyle_applied_coupon", upperCode);
      sessionStorage.setItem("craftstyle_applied_coupon_percent", "10");
      return { success: true, message: "Coupon applied successfully! 10% discount applied." };
    }

    if (upperCode === "FESTIVE25") {
      if (totalAmount < 1000) {
        return { success: false, message: "This coupon is only valid for orders above ₹1000." };
      }
      setCouponCode(upperCode);
      setCouponDiscountPercent(25);
      sessionStorage.setItem("craftstyle_applied_coupon", upperCode);
      sessionStorage.setItem("craftstyle_applied_coupon_percent", "25");
      return { success: true, message: "Coupon applied successfully! 25% discount applied." };
    }

    return { success: false, message: "Invalid coupon code. Please try another one." };
  };

  const removeCouponCode = () => {
    setCouponCode("");
    setCouponDiscountPercent(0);
    sessionStorage.removeItem("craftstyle_applied_coupon");
    sessionStorage.removeItem("craftstyle_applied_coupon_percent");
  };

  // Automatically validate festive coupon threshold
  useEffect(() => {
    if (couponCode === "FESTIVE25" && totalAmount < 1000) {
      removeCouponCode();
    }
  }, [totalAmount, couponCode]);

  return (
    <CartContext.Provider value={{ 
      cart, 
      addToBag, 
      removeFromBag, 
      updateQuantity, 
      clearCart, 
      totalCount, 
      totalAmount,
      couponCode,
      couponDiscountPercent,
      applyCouponCode,
      removeCouponCode,
      updatingItems
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
