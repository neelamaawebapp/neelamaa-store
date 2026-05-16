"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { STORE_CATEGORIES } from "@/lib/constants";

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const docRef = doc(db, "settings", "categories");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().data) {
          setCategories(docSnap.data().data);
        } else {
          setCategories(STORE_CATEGORIES);
        }
      } catch (err) {
        console.error(err);
        setCategories(STORE_CATEGORIES);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-24">
      {/* Header */}
      <div className="bg-white p-4 flex items-center justify-between border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Categories</h1>
        </div>
        <Search size={20} className="text-gray-600" />
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        {loading ? (
           <div className="col-span-2 py-20 flex justify-center items-center">
             <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
           </div>
        ) : (
          categories.map((cat, idx) => (
            <button
              key={idx}
              onClick={() => router.push(`/category/${encodeURIComponent(cat.name)}`)}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:border-pink-300 transition-colors focus:outline-none"
            >
              <div className="w-full aspect-square relative bg-gray-100">
                {cat.image ? (
                  <Image src={cat.image} alt={cat.name} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">?</div>
                )}
              </div>
              <div className="p-3 text-center">
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">{cat.name}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
