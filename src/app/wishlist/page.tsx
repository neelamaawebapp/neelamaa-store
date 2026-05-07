import { ChevronLeft, Heart } from "lucide-react";
import Link from "next/link";

export default function WishlistPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-24">
      {/* Header */}
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </Link>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Wishlist</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-10">
        <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mb-6">
          <Heart size={32} className="text-pink-300" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Your wishlist is empty</h2>
        <p className="text-sm text-gray-500 mb-6">Save items that you like in your wishlist. Review them anytime and easily move them to the bag.</p>
        <Link href="/" className="px-8 py-3 border border-pink-500 text-pink-600 font-bold rounded-md hover:bg-pink-50 transition-colors">
          CONTINUE SHOPPING
        </Link>
      </div>
    </div>
  );
}
