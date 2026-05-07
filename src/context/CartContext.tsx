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
    if (!user) {
      setCart([]);
      return;
    }

    const cartRef = collection(db, `users/${user.uid}/cartItems`);
    const unsubscribe = onSnapshot(cartRef, (snapshot) => {
      const items: CartItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ ...doc.data() } as CartItem);
      });
      setCart(items);
    });

    return () => unsubscribe();
  }, [user]);

  const addToBag = async (product: Omit<CartItem, "quantity" | "id"> & { size: string }) => {
    if (!user) {
      alert("Please login to add items to your bag.");
      return;
    }

    // Unique ID for cart item combines productId and size
    const cartItemId = `${product.productId}_${product.size}`;
    const itemRef = doc(db, `users/${user.uid}/cartItems`, cartItemId);
    const existingItem = cart.find(item => item.id === cartItemId);

    if (existingItem) {
      await updateDoc(itemRef, {
        quantity: existingItem.quantity + 1
      });
    } else {
      await setDoc(itemRef, {
        ...product,
        id: cartItemId,
        quantity: 1
      });
    }
  };

  const removeFromBag = async (id: string) => {
    if (!user) return;
    const itemRef = doc(db, `users/${user.uid}/cartItems`, id);
    await deleteDoc(itemRef);
  };

  const updateQuantity = async (id: string, qty: number) => {
    if (!user) return;
    if (qty <= 0) {
      await removeFromBag(id);
      return;
    }
    const itemRef = doc(db, `users/${user.uid}/cartItems`, id);
    await updateDoc(itemRef, { quantity: qty });
  };

  const clearCart = async () => {
    if (!user) return;
    const promises = cart.map(item => removeFromBag(item.id));
    await Promise.all(promises);
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
