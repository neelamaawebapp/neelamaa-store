import Header from "@/components/Header";
import CategoryMenu from "@/components/CategoryMenu";
import HeroBanner from "@/components/HeroBanner";
import RecentlyViewed from "@/components/RecentlyViewed";
import ProductFeed, { ProductFeedSkeleton } from "@/components/ProductFeed";
import { Suspense } from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 flex justify-center w-full pb-16">
      <div className="w-full max-w-md bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative shadow-2xl border-x border-slate-800 min-h-screen overflow-hidden isolate">
        {/* Vibrant, glowing backdrop blobs (larger and more saturated to cover the full block) */}
        <div className="absolute inset-0 pointer-events-none -z-10 bg-slate-950/20">
          {/* Blob 1: Top Right - Pink/Magenta */}
          <div className="absolute -top-20 right-0 w-96 h-96 rounded-full bg-pink-600/30 blur-[100px] animate-pulse" />
          {/* Blob 2: Upper-Middle Left - Purple */}
          <div className="absolute top-[25%] -left-20 w-[28rem] h-[28rem] rounded-full bg-purple-600/25 blur-[120px] animate-pulse" />
          {/* Blob 3: Middle Right - Blue */}
          <div className="absolute top-[50%] -right-20 w-[24rem] h-[24rem] rounded-full bg-blue-600/30 blur-[110px]" />
          {/* Blob 4: Lower-Middle Left - Rose */}
          <div className="absolute top-[75%] -left-10 w-96 h-96 rounded-full bg-rose-600/20 blur-[100px]" />
          {/* Blob 5: Bottom Right - Indigo */}
          <div className="absolute -bottom-20 right-0 w-[28rem] h-[28rem] rounded-full bg-indigo-600/25 blur-[120px]" />
        </div>
        <Header />
        <main>
          <CategoryMenu />
          <HeroBanner />
          <RecentlyViewed />
          <Suspense fallback={<ProductFeedSkeleton />}>
            <ProductFeed />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
