import Header from "@/components/Header";
import CategoryMenu from "@/components/CategoryMenu";
import HeroBanner from "@/components/HeroBanner";
import ProductFeed from "@/components/ProductFeed";
import BottomNav from "@/components/BottomNav";
import { Suspense } from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center w-full pb-16">
      <div className="w-full max-w-md bg-white relative shadow-md border-x border-gray-200 min-h-screen">
        <Header />
        <main>
          <CategoryMenu />
          <HeroBanner />
          <Suspense fallback={<div className="p-8 text-center">Loading feed...</div>}>
            <ProductFeed />
          </Suspense>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
