import Header from "@/components/Header";
import CategoryMenu from "@/components/CategoryMenu";
import HeroBanner from "@/components/HeroBanner";
import RecentlyViewed from "@/components/RecentlyViewed";
import ProductFeed, { ProductFeedSkeleton } from "@/components/ProductFeed";
import { Suspense } from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center w-full pb-16">
      <div className="w-full max-w-md bg-white relative shadow-md border-x border-gray-200 min-h-screen overflow-hidden isolate">
        <div className="header-container">
          <Header />
        </div>
        <main>
          <CategoryMenu />
          <div className="homepage-content-block">
            <HeroBanner />
            <RecentlyViewed />
            <Suspense fallback={<ProductFeedSkeleton />}>
              <ProductFeed />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
