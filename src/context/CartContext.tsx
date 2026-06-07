"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
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
}

interface CartContextType {
  cart: CartItem[];
  addToBag: (item: Omit<CartItem, "quantity" | "id"> & { size: string }) => Promise<void>;
  removeFromBag: (id: string) => Promise<void>;
  updateQuantity: (id: string, qty: number) => Promise<void>;
  clearCart: () => Promise<void>;
  totalCount: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType>({
  cart: [],
  addToBag: async () => {},
  removeFromBag: async () => {},
  updateQuantity: async () => {},
  clearCart: async () => {},
  totalCount: 0,
  totalAmount: 0,
});

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    // If not logged in, load from localStorage
    if (!user) {
      const stored = localStorage.getItem("neelsutra_local_cart");
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
      const stored = localStorage.getItem("neelsutra_local_cart");
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
            localStorage.removeItem("neelsutra_local_cart");
          }
        } catch (e) {
          console.error("Sync local cart failed", e);
        }
      }
    }, (error) => {
      console.error("Firestore cart sub error, falling back to localStorage", error);
      const stored = localStorage.getItem("neelsutra_local_cart");
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

  const addToBag = async (product: Omit<CartItem, "quantity" | "id"> & { size: string }) => {
    const cartItemId = `${product.productId}_${product.size}`;
    const newCartItem: CartItem = {
      ...product,
      id: cartItemId,
      quantity: 1,
    };

    if (!user) {
      // Handle local cart
      const currentCart = [...cart];
      const existingIdx = currentCart.findIndex(item => item.id === cartItemId);
      if (existingIdx > -1) {
        currentCart[existingIdx].quantity += 1;
      } else {
        currentCart.push(newCartItem);
      }
      setCart(currentCart);
      localStorage.setItem("neelsutra_local_cart", JSON.stringify(currentCart));
      return;
    }

    // Handle Firestore
    try {
      const itemRef = doc(db, `users/${user.uid}/cartItems`, cartItemId);
      const existingItem = cart.find(item => item.id === cartItemId);

      if (existingItem) {
        await updateDoc(itemRef, {
          quantity: existingItem.quantity + 1
        });
      } else {
        await setDoc(itemRef, newCartItem);
      }
    } catch (err) {
      console.error("Firestore addToBag failed, falling back to local storage", err);
      // Fallback
      const currentCart = [...cart];
      const existingIdx = currentCart.findIndex(item => item.id === cartItemId);
      if (existingIdx > -1) {
        currentCart[existingIdx].quantity += 1;
      } else {
        currentCart.push(newCartItem);
      }
      setCart(currentCart);
      localStorage.setItem("neelsutra_local_cart", JSON.stringify(currentCart));
    }
  };

  const removeFromBag = async (id: string) => {
    if (!user) {
      const currentCart = cart.filter(item => item.id !== id);
      setCart(currentCart);
      localStorage.setItem("neelsutra_local_cart", JSON.stringify(currentCart));
      return;
    }

    try {
      const itemRef = doc(db, `users/${user.uid}/cartItems`, id);
      await deleteDoc(itemRef);
    } catch (err) {
      console.error("Firestore delete failed, falling back to local storage", err);
      const currentCart = cart.filter(item => item.id !== id);
      setCart(currentCart);
      localStorage.setItem("neelsutra_local_cart", JSON.stringify(currentCart));
    }
  };

  const updateQuantity = async (id: string, qty: number) => {
    if (qty <= 0) {
      await removeFromBag(id);
      return;
    }

    if (!user) {
      const currentCart = cart.map(item => item.id === id ? { ...item, quantity: qty } : item);
      setCart(currentCart);
      localStorage.setItem("neelsutra_local_cart", JSON.stringify(currentCart));
      return;
    }

    try {
      const itemRef = doc(db, `users/${user.uid}/cartItems`, id);
      await updateDoc(itemRef, { quantity: qty });
    } catch (err) {
      console.error("Firestore update failed, falling back to local storage", err);
      const currentCart = cart.map(item => item.id === id ? { ...item, quantity: qty } : item);
      setCart(currentCart);
      localStorage.setItem("neelsutra_local_cart", JSON.stringify(currentCart));
    }
  };

  const clearCart = async () => {
    localStorage.removeItem("neelsutra_local_cart");
    if (!user) {
      setCart([]);
      return;
    }

    try {
      const promises = cart.map(item => deleteDoc(doc(db, `users/${user.uid}/cartItems`, item.id)));
      await Promise.all(promises);
      setCart([]);
    } catch (err) {
      console.error("Firestore clear failed, clearing local state", err);
      setCart([]);
    }
  };

  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ cart, addToBag, removeFromBag, updateQuantity, clearCart, totalCount, totalAmount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
