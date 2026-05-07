"use client";

import { STORE_CATEGORIES } from "@/lib/constants";
import { ChevronLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function CategoriesPage() {
  const router = useRouter();

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
        {STORE_CATEGORIES.map((cat, idx) => (
          <button
            key={idx}
            onClick={() => router.push(`/category/${encodeURIComponent(cat.name)}`)}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:border-pink-300 transition-colors focus:outline-none"
          >
            <div className="w-full aspect-square relative bg-gray-100">
              <Image src={cat.image} alt={cat.name} fill className="object-cover" />
            </div>
            <div className="p-3 text-center">
              <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">{cat.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
