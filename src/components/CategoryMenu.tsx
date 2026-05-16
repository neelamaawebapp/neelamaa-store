"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Edit2, Plus, Save, Trash2, UploadCloud, X } from "lucide-react";
import { STORE_CATEGORIES } from "@/lib/constants";

export default function CategoryMenu() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editCategories, setEditCategories] = useState<any[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const docRef = doc(db, "settings", "categories");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().data) {
          setCategories(docSnap.data().data);
          setEditCategories(docSnap.data().data);
        } else {
          // Fallback to constants if DB is empty
          setCategories(STORE_CATEGORIES);
          setEditCategories(STORE_CATEGORIES);
        }
      } catch (err) {
        console.error("Failed to fetch categories", err);
        setCategories(STORE_CATEGORIES);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingIdx(idx);
    try {
      const formData = new FormData();
      formData.append("image", file);
      
      const res = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        const newCats = [...editCategories];
        newCats[idx].image = data.data.url;
        setEditCategories(newCats);
      } else {
        alert("Image upload failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading image");
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleAddCategory = () => {
    setEditCategories([
      ...editCategories,
      { name: "New Category", image: "" }
    ]);
  };

  const handleRemoveCategory = (idx: number) => {
    const newCats = [...editCategories];
    newCats.splice(idx, 1);
    setEditCategories(newCats);
  };

  const handleSave = async () => {
    try {
      await setDoc(doc(db, "settings", "categories"), { data: editCategories });
      setCategories(editCategories);
      setIsEditing(false);
      alert("Categories updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save categories.");
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-b from-[#fff0f0] to-white pb-4 pt-4 px-4 flex space-x-6 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center flex-shrink-0 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-gray-200 mb-2"></div>
            <div className="w-12 h-3 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-[#fff0f0] to-white pb-4 pt-4 relative">
      
      {/* Magic Edit Button */}
      {isAdmin && !isEditing && (
        <button 
          onClick={() => setIsEditing(true)}
          className="absolute top-2 left-4 z-20 bg-black/80 backdrop-blur text-white px-3 py-1.5 rounded-full font-bold text-xs flex items-center space-x-1 shadow-md hover:bg-black transition-all"
        >
          <Edit2 size={12} />
          <span>EDIT CATEGORIES</span>
        </button>
      )}

      {/* Categories Horizontal Scroll */}
      <div className={`flex overflow-x-auto hide-scrollbar px-4 pb-2 space-x-6 justify-between ${isAdmin ? 'pt-8' : ''}`}>
        {categories.map((cat, idx) => (
          <button 
            key={idx} 
            onClick={() => router.push(`/category/${encodeURIComponent(cat.name)}`)}
            className="flex flex-col items-center flex-shrink-0 focus:outline-none group"
          >
            <div className="w-16 h-16 rounded-full overflow-hidden mb-2 border border-gray-200 shadow-sm group-hover:ring-2 group-hover:ring-pink-500 group-hover:ring-offset-2 transition-all bg-gray-100">
              {cat.image ? (
                <Image
                  src={cat.image}
                  alt={cat.name}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">?</div>
              )}
            </div>
            <span className="text-xs font-bold text-gray-800">
              {cat.name}
            </span>
          </button>
        ))}
      </div>

      {/* Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center">
          <div className="bg-white w-full max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-fade-in-up">
            {/* Modal Header */}
            <div className="bg-gray-900 p-4 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Edit2 size={18} /> Category Editor
              </h2>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-4 flex-1 space-y-4 bg-gray-50">
              {editCategories.map((cat, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                  {/* Image Upload */}
                  <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 border border-gray-300 flex-shrink-0">
                    {cat.image ? (
                      <Image src={cat.image} alt={cat.name} fill className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                        <UploadCloud size={16} />
                      </div>
                    )}
                    
                    {uploadingIdx === idx && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                        <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}

                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, idx)}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                  </div>

                  {/* Category Name & Delete */}
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">CATEGORY NAME</label>
                    <input 
                      type="text" 
                      value={cat.name} 
                      onChange={(e) => {
                        const newCats = [...editCategories];
                        newCats[idx].name = e.target.value;
                        setEditCategories(newCats);
                      }}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-pink-500 font-bold text-gray-800" 
                      placeholder="e.g. Fashion"
                    />
                  </div>
                  
                  <button 
                    onClick={() => handleRemoveCategory(idx)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}

              {/* Add New Category Button */}
              <button 
                onClick={handleAddCategory}
                className="w-full border-2 border-dashed border-gray-300 bg-white text-gray-600 font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50 transition-colors"
              >
                <Plus size={20} />
                ADD NEW CATEGORY
              </button>
            </div>

            {/* Modal Footer */}
            <div className="bg-white p-4 border-t border-gray-200">
              <button 
                onClick={handleSave}
                className="w-full bg-pink-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-pink-600 transition-colors"
              >
                <Save size={20} />
                SAVE CATEGORIES
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
