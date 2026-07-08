"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronLeft, Search, FolderOpen, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { STORE_CATEGORIES, ParentCategory } from "@/lib/constants";

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<ParentCategory[]>([]);
  const [activeParentIdx, setActiveParentIdx] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const docRef = doc(db, "settings", "categories");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().data) {
          const fetched = docSnap.data().data;
          // Validate structure
          if (Array.isArray(fetched) && fetched.length > 0 && "subCategories" in fetched[0]) {
            setCategories(fetched);
          } else {
            setCategories(STORE_CATEGORIES);
          }
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

  const activeParent = categories[activeParentIdx];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-20">
      {/* Header */}
      <div className="bg-white p-4 flex items-center justify-between border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 cursor-pointer">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-xs">Categories</h1>
        </div>
        <button className="p-1 hover:bg-slate-50 rounded-full cursor-pointer">
          <Search size={20} className="text-gray-650" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center py-20 bg-white">
          <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center p-8 bg-white text-center text-gray-500">
          <FolderOpen size={48} className="text-gray-300 mb-2 animate-bounce" />
          <p>No categories configured yet.</p>
        </div>
      ) : (
        /* Dual-pane Layout Container */
        <div className="flex-1 flex bg-white overflow-hidden" style={{ height: "calc(100vh - 120px)" }}>
          {/* Left Sidebar Pane */}
          <div className="w-[110px] bg-slate-50 border-r border-gray-100 flex flex-col overflow-y-auto hide-scrollbar">
            {categories.map((parent, idx) => {
              const isActive = activeParentIdx === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveParentIdx(idx)}
                  className={`w-full py-5 px-3 flex flex-col items-center justify-center text-center transition-all focus:outline-none relative border-b border-gray-100/50 cursor-pointer ${
                    isActive 
                      ? "bg-white text-pink-600 font-bold border-l-4 border-l-pink-500" 
                      : "text-slate-600 font-medium hover:bg-gray-100/60"
                  }`}
                >
                  {/* Miniature Parent Circle */}
                  <div className={`w-10 h-10 rounded-full overflow-hidden mb-1.5 border transition-all ${
                    isActive ? "border-pink-300 scale-105 shadow-2xs" : "border-gray-200"
                  }`}>
                    {parent.image ? (
                      <Image src={parent.image} alt={parent.name} width={40} height={40} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-450 text-[10px]">?</div>
                    )}
                  </div>
                  <span className="text-[10px] leading-tight break-words uppercase tracking-tight">
                    {parent.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Sub-categories Pane */}
          <div className="flex-1 bg-white overflow-y-auto p-4 flex flex-col space-y-4">
            {activeParent && (
              <>
                {/* Active Category Header cover card */}
                <div className="relative rounded-2xl overflow-hidden aspect-[16/6] bg-slate-900 shadow-xs border border-gray-200/50">
                  {activeParent.image ? (
                    <Image 
                      src={activeParent.image} 
                      alt={activeParent.name} 
                      fill 
                      className="object-cover opacity-60 animate-fade-in" 
                    />
                  ) : (
                    <div className="absolute inset-0 bg-slate-800" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-3">
                    <h2 className="text-white text-xs font-black uppercase tracking-widest leading-none">
                      {activeParent.name}
                    </h2>
                    <p className="text-[9px] text-pink-300 font-bold mt-1 tracking-wider">
                      {(activeParent.subCategories?.length || 0)} SUB-CATEGORIES
                    </p>
                  </div>
                </div>

                {/* Subcategories Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {activeParent.subCategories && activeParent.subCategories.length > 0 ? (
                    activeParent.subCategories.map((sub, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => router.push(`/category/${encodeURIComponent(sub.name)}`)}
                        className="bg-slate-50 border border-slate-100 hover:border-pink-200 rounded-xl p-3 flex flex-col items-center justify-center transition-all shadow-2xs hover:shadow-xs hover:bg-slate-50/50 group focus:outline-none cursor-pointer"
                      >
                        <div className="w-16 h-16 rounded-full overflow-hidden relative border border-gray-200/50 shadow-2xs mb-2 group-hover:scale-105 transition-transform animate-fade-in bg-gray-100">
                          {sub.image ? (
                            <Image src={sub.image} alt={sub.name} fill className="object-cover" />
                          ) : (
                            <div className="absolute inset-0 bg-gray-200 flex items-center justify-center text-gray-400">?</div>
                          )}
                        </div>
                        <span className="text-[10px] font-black text-slate-850 group-hover:text-pink-600 transition-colors mt-0.5 text-center leading-tight uppercase tracking-wider">
                          {sub.name}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="col-span-2 text-center text-xs text-gray-400 py-10 italic">
                      No sub-categories in this section.
                    </div>
                  )}

                  {/* View All Card at the end */}
                  <button
                    onClick={() => router.push(`/category/${encodeURIComponent(activeParent.name)}`)}
                    className="col-span-2 mt-2 bg-pink-50 hover:bg-pink-100/80 border border-pink-100 rounded-xl p-3 flex items-center justify-between transition-all focus:outline-none group cursor-pointer"
                  >
                    <span className="text-[10px] font-black text-pink-700 uppercase tracking-widest">
                      View All {activeParent.name}
                    </span>
                    <ArrowRight size={14} className="text-pink-600 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
