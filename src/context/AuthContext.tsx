"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  loginAsMockUser: (email: string, name: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  loginAsMockUser: () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check local storage for mock user first
    if (typeof window !== "undefined") {
      const localMockUser = localStorage.getItem("neelsutra_mock_user");
      if (localMockUser) {
        try {
          const parsed = JSON.parse(localMockUser);
          setUser(parsed);
          if (parsed.email === "admin@neelsutra.com" || parsed.email === "neelsutra1@gmail.com" || parsed.email === "neelamaaexports@gmail.com") {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
          setLoading(false);
          return;
        } catch (e) {
          console.error("Failed to parse mock user", e);
        }
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && (currentUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL || currentUser.email === "neelsutra1@gmail.com" || currentUser.email === "neelamaaexports@gmail.com")) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginAsMockUser = (email: string, name: string) => {
    const mockUser = {
      uid: `mock_${Date.now()}`,
      email,
      displayName: name,
      emailVerified: true,
    } as any;
    localStorage.setItem("neelsutra_mock_user", JSON.stringify(mockUser));
    setUser(mockUser);
    if (email === "admin@neelsutra.com" || email === "neelsutra1@gmail.com" || email === "neelamaaexports@gmail.com") {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem("neelsutra_mock_user");
    setUser(null);
    setIsAdmin(false);
    try {
      const { signOut } = await import("firebase/auth");
      await signOut(auth);
    } catch (e) {
      console.error("Failed to sign out from Firebase", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, loginAsMockUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

