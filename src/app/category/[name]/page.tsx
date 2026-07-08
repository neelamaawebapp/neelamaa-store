"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Heart, ChevronLeft, SlidersHorizontal, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import OptimizedImage from "@/components/OptimizedImage";
import { STORE_CATEGORIES, ParentCategory } from "@/lib/constants";

export default function CategoryProductsPage() {
  const params = useParams();
  const router = useRouter();
  const categoryName = decodeURIComponent(params.name as string);

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesSchema, setCategoriesSchema] = useState<ParentCategory[]>([]);
  const [activeChip, setActiveChip] = useState<string>("All");

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<"none" | "lowHigh" | "highLow">("none");

  // 1. Fetch Categories Schema
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const docRef = doc(db, "settings", "categories");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().data) {
          const fetched = docSnap.data().data;
          if (Array.isArray(fetched) && fetched.length > 0 && "subCategories" in fetched[0]) {
            setCategoriesSchema(fetched);
            return;
          }
        }
        setCategoriesSchema(STORE_CATEGORIES);
      } catch (err) {
        console.error("Failed to fetch schema", err);
        setCategoriesSchema(STORE_CATEGORIES);
      }
    };
    fetchSchema();
  }, []);

  // 2. Resolve parent/subcategory structure
  let parentCategoryName = "";
  let subCategoriesList: any[] = [];

  const foundParent = categoriesSchema.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );
  
  const foundParentOfSub = categoriesSchema.find((c) =>
    c.subCategories.some((sub) => sub.name.toLowerCase() === categoryName.toLowerCase())
  );

  if (foundParent) {
    parentCategoryName = foundParent.name;
    subCategoriesList = foundParent.subCategories;
  } else if (foundParentOfSub) {
    parentCategoryName = foundParentOfSub.name;
    subCategoriesList = foundParentOfSub.subCategories;
  }

  // 3. Handle default selected chip based on landing URL
  useEffect(() => {
    if (foundParentOfSub) {
      const subObj = foundParentOfSub.subCategories.find(
        (sub) => sub.name.toLowerCase() === categoryName.toLowerCase()
      );
      if (subObj) {
        setActiveChip(subObj.name);
      }
    } else {
      setActiveChip("All");
    }
  }, [categoryName, categoriesSchema, foundParentOfSub]);

  // 4. Fetch products matching either parent or sub-categories
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        let q;
        if (categoryName === "New Arrivals") {
          q = query(collection(db, "products"), where("homeSection", "==", "New Arrivals"));
        } else {
          if (parentCategoryName && subCategoriesList.length > 0) {
            // Firestore 'in' query allows querying products with category in list of parent + sub names
            const categoriesToFetch = [parentCategoryName, ...subCategoriesList.map((s) => s.name)];
            q = query(collection(db, "products"), where("category", "in", categoriesToFetch));
          } else {
            q = query(collection(db, "products"), where("category", "==", categoryName));
          }
        }
        
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(data);
      } catch (err) {
        console.error("Error fetching category products:", err);
      } finally {
        setLoading(false);
      }
    };

    if (categoriesSchema.length > 0) {
      fetchProducts();
    }
  }, [categoryName, parentCategoryName, subCategoriesList, categoriesSchema]);

  // 5. Local filtering based on active chip
  let filteredProducts = [...products];
  if (activeChip !== "All") {
    filteredProducts = products.filter(
      (product) =>
        product.subCategory?.toLowerCase() === activeChip.toLowerCase() ||
        product.category?.toLowerCase() === activeChip.toLowerCase()
    );
  }

  // Apply sorting
  if (sortOrder === "lowHigh") {
    filteredProducts.sort((a, b) => a.price - b.price);
  } else if (sortOrder === "highLow") {
    filteredProducts.sort((a, b) => b.price - a.price);
  }

  const displayName = foundParentOfSub ? foundParentOfSub.name : categoryName;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-24">
      {/* Header */}
      <div className="bg-white p-4 flex items-center justify-between border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 cursor-pointer">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-xs">
            {displayName}
          </h1>
        </div>
      </div>

      {/* Subcategory Chips Scroll */}
      {!loading && subCategoriesList.length > 0 && (
        <div className="bg-white border-b border-gray-150 py-3 px-4 flex items-center space-x-2 overflow-x-auto hide-scrollbar sticky top-[57px] z-10 shadow-2xs">
          <button
            onClick={() => setActiveChip("All")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap cursor-pointer ${
              activeChip === "All"
                ? "bg-pink-500 border-pink-500 text-white shadow-sm scale-102"
                : "bg-slate-50 border-gray-250 text-slate-655 hover:bg-slate-100"
            }`}
          >
            All
          </button>
          {subCategoriesList.map((sub, idx) => {
            const isSelected = activeChip.toLowerCase() === sub.name.toLowerCase();
            return (
              <button
                key={idx}
                onClick={() => setActiveChip(sub.name)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? "bg-pink-500 border-pink-500 text-white shadow-sm scale-102"
                    : "bg-slate-50 border-gray-250 text-slate-655 hover:bg-slate-100"
                }`}
              >
                {sub.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Feed Header & Filters */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white sticky z-10" style={{ top: subCategoriesList.length > 0 ? "114px" : "57px" }}>
        <h2 className="font-bold text-gray-900 text-xs uppercase tracking-wide">
          {filteredProducts.length} Items Found
        </h2>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center space-x-1 border px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${showFilters ? 'bg-slate-50 border-pink-200 text-pink-600' : 'border-gray-300 text-gray-700 hover:bg-slate-50'}`}
        >
          <span>FILTER</span>
          <SlidersHorizontal size={11} />
        </button>
      </div>

      {/* Filter Options Drawer */}
      {showFilters && (
        <div className="px-4 py-4 bg-gray-50 border-b border-gray-200 space-y-4 animate-fade-in">
          <div>
            <p className="text-[10px] font-bold text-gray-450 mb-2 uppercase tracking-wider">Sort By Price</p>
            <div className="flex space-x-2">
              <button 
                onClick={() => setSortOrder(sortOrder === "lowHigh" ? "none" : "lowHigh")}
                className={`px-3 py-1.5 text-xs font-bold border rounded-full transition-all cursor-pointer ${sortOrder === "lowHigh" ? "border-pink-500 bg-pink-50 text-pink-600" : "border-gray-300 bg-white text-gray-750"}`}
              >
                Low to High
              </button>
              <button 
                onClick={() => setSortOrder(sortOrder === "highLow" ? "none" : "highLow")}
                className={`px-3 py-1.5 text-xs font-bold border rounded-full transition-all cursor-pointer ${sortOrder === "highLow" ? "border-pink-500 bg-pink-50 text-pink-600" : "border-gray-300 bg-white text-gray-750"}`}
              >
                High to Low
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Grid */}
      {loading ? (
        <div className="flex-1 flex justify-center items-center py-20 bg-white">
          <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex-1 py-20 text-center text-gray-500 flex flex-col items-center justify-center bg-white p-6">
          <p className="font-bold text-slate-800 mb-1">No products found</p>
          <p className="text-xs text-gray-400">There are no products available in this category selection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-0.5 bg-gray-100 flex-1">
          {filteredProducts.map((product) => (
            <Link href={`/product/${product.id}`} key={product.id} className="bg-white flex flex-col relative group cursor-pointer">
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-55">
                <OptimizedImage
                  src={product.image}
                  alt={product.brand}
                  fill
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                />
                <button className="absolute bottom-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full shadow-sm text-gray-650 hover:text-pink-600 transition-colors cursor-pointer">
                  <Heart size={16} />
                </button>
              </div>
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-950 truncate uppercase tracking-wide">{product.title}</h3>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">{product.brand}</p>
                </div>
                <div className="mt-1.5 flex items-baseline space-x-1.5 flex-wrap">
                  <span className="font-bold text-xs text-gray-900">₹{product.price}</span>
                  {(() => {
                    const mrpVal = product.mrp || Math.round(product.price * 1.5);
                    const discountPercent = mrpVal > product.price ? Math.round(((mrpVal - product.price) / mrpVal) * 100) : 0;
                    return (
                      mrpVal > product.price && (
                        <>
                          <span className="text-[10px] text-gray-400 line-through">₹{mrpVal}</span>
                          <span className="text-[9px] font-bold text-orange-500">({discountPercent}% OFF)</span>
                        </>
                      )
                    );
                  })()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
