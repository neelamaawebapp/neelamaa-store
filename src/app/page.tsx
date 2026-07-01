import Header from "@/components/Header";
import CategoryMenu from "@/components/CategoryMenu";
import HeroBanner from "@/components/HeroBanner";
import RecentlyViewed from "@/components/RecentlyViewed";
import ProductFeed, { ProductFeedSkeleton } from "@/components/ProductFeed";
import { Suspense } from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center w-full pb-16">
      <div className="w-full max-w-md bg-transparent relative shadow-md border-x border-gray-200 min-h-screen overflow-hidden isolate">
        {/* Vibrant, soothing backdrop blobs */}
        <div className="absolute inset-0 pointer-events-none -z-10 bg-slate-50/50">
          {/* Blob 1: Top Right - Pink */}
          <div className="absolute -top-10 -right-20 w-80 h-80 rounded-full bg-pink-300/40 blur-[80px]" />
          {/* Blob 2: Upper-Middle Left - Purple */}
          <div className="absolute top-[20%] -left-32 w-96 h-96 rounded-full bg-purple-300/45 blur-[90px]" />
          {/* Blob 3: Middle Right - Blue */}
          <div className="absolute top-[45%] -right-24 w-80 h-80 rounded-full bg-sky-300/40 blur-[80px]" />
          {/* Blob 4: Lower-Middle Left - Orange/Amber */}
          <div className="absolute top-[70%] -left-20 w-80 h-80 rounded-full bg-amber-200/35 blur-[80px]" />
          {/* Blob 5: Bottom Right - Rose */}
          <div className="absolute -bottom-10 right-0 w-96 h-96 rounded-full bg-rose-200/40 blur-[100px]" />
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
