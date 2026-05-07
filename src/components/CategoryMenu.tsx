"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { STORE_CATEGORIES } from "@/lib/constants";

export default function CategoryMenu() {
  const router = useRouter();

  return (
    <div className="bg-gradient-to-b from-[#fff0f0] to-white pb-4 pt-4">
      {/* Categories Horizontal Scroll */}
      <div className="flex overflow-x-auto hide-scrollbar px-4 pb-2 space-x-6 justify-between">
        {STORE_CATEGORIES.map((cat, idx) => (
          <button 
            key={idx} 
            onClick={() => router.push(`/category/${encodeURIComponent(cat.name)}`)}
            className="flex flex-col items-center flex-shrink-0 focus:outline-none"
          >
            <div className="w-16 h-16 rounded-full overflow-hidden mb-2 border border-gray-200 shadow-sm hover:ring-2 hover:ring-pink-500 hover:ring-offset-2 transition-all">
              <Image
                src={cat.image}
                alt={cat.name}
                width={64}
                height={64}
                className="object-cover w-full h-full"
              />
            </div>
            <span className="text-xs font-bold text-gray-800">
              {cat.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
