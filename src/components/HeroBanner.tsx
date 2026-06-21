"use client";

import Image from "next/image";
import { ChevronRight, Edit2, UploadCloud, X, Save, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import ImageEditorModal from "@/components/ImageEditorModal";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { autoAdjustImage } from "@/lib/imageUtils";

const defaultBanners = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&h=800&fit=crop",
    title: "Everyday Picks",
    subtitle: "MIN. 82% OFF",
    brand1: "EL PASO",
    brand2: "REDTAPE",
    link: "/categories"
  }
];

export default function HeroBanner() {
  const { isAdmin } = useAuth();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editBanners, setEditBanners] = useState(defaultBanners);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // Image Editor States
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editorImageUrl, setEditorImageUrl] = useState<string>("");

  // Fetch Banners from Firestore
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const docRef = doc(db, "settings", "banners");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().data) {
          setBanners(docSnap.data().data);
          setEditBanners(docSnap.data().data);
        } else {
          setBanners(defaultBanners);
          setEditBanners(defaultBanners);
        }
      } catch (err) {
        console.error("Failed to fetch banners", err);
        setBanners(defaultBanners);
      } finally {
        setLoading(false);
      }
    };
    fetchBanners();
  }, []);

  // Auto Slider
  useEffect(() => {
    if (isEditing || banners.length === 0) return; // Pause slider when editing
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length, isEditing]);

  const uploadAndSaveBannerImg = async (file: File, idx: number) => {
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
        const newBanners = [...editBanners];
        newBanners[idx].image = data.data.url;
        setEditBanners(newBanners);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingIdx(idx);
    try {
      const adjustedFile = await autoAdjustImage(file, 21 / 9);
      await uploadAndSaveBannerImg(adjustedFile, idx);
    } catch (err) {
      console.error("Failed to automatically adjust banner image:", err);
      alert("Failed to automatically adjust and upload banner image.");
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleSaveEditedBanner = async (editedFile: File) => {
    const idx = editingIdx;
    setEditingIdx(null);
    setEditorImageUrl("");
    if (idx !== null) {
      const adjustedFile = await autoAdjustImage(editedFile, 21 / 9);
      await uploadAndSaveBannerImg(adjustedFile, idx);
    }
  };

  const handleSave = async () => {
    try {
      // Sanitize data to remove any undefined values or non-serializable objects
      const cleanData = JSON.parse(JSON.stringify(editBanners));
      await setDoc(doc(db, "settings", "banners"), { data: cleanData });
      setBanners(editBanners);
      setIsEditing(false);
      alert("Banners updated successfully!");
    } catch (err: any) {
      console.error("Firebase Save Error:", err);
      alert(`Failed to save banners: ${err.message || err}`);
    }
  };

  const handleAddBanner = () => {
    if (editBanners.length >= 3) return;
    setEditBanners([
      ...editBanners,
      {
        id: Date.now(),
        image: "",
        title: "New Banner",
        subtitle: "",
        brand1: "",
        brand2: "",
        link: "/categories"
      }
    ]);
  };

  const handleRemoveBanner = (idx: number) => {
    const newBanners = [...editBanners];
    newBanners.splice(idx, 1);
    setEditBanners(newBanners);
  };

  return (
    <div className="flex flex-col relative">
      {/* Magic Edit Button */}
      {isAdmin && !isEditing && (
        <button 
          onClick={() => setIsEditing(true)}
          className="absolute top-4 right-4 z-30 bg-black/80 backdrop-blur text-white px-4 py-2 rounded-full font-bold text-sm flex items-center space-x-2 shadow-xl hover:bg-black transition-all animate-bounce"
        >
          <Edit2 size={16} />
          <span>EDIT BANNERS</span>
        </button>
      )}

      {/* Main Banner */}
      <div className="relative w-full h-[400px] overflow-hidden bg-gray-100">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          banners.map((banner, idx) => (
            <Link 
              href={banner.link || "/categories"}
              key={banner.id || idx}
              className={`absolute inset-0 transition-opacity duration-1000 block ${idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            >
              <Image
                src={banner.image || "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&h=800&fit=crop"}
                alt={banner.title || "Banner"}
                fill
                className="object-cover"
                priority={idx === 0}
                unoptimized={
                  banner.image?.toLowerCase().includes(".apng") || 
                  banner.image?.toLowerCase().includes(".png") ||
                  banner.image?.toLowerCase().includes(".gif")
                }
              />
              
              {/* Banner Content Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
                <div className="bg-white rounded-md w-max px-3 py-2 flex items-center space-x-3 mb-2 shadow-sm">
                  <span className="font-bold text-sm tracking-widest text-gray-800">{banner.brand1}</span>
                  <div className="h-4 w-px bg-gray-300"></div>
                  <span className="font-bold text-sm text-red-600">{banner.brand2}</span>
                  <span className="text-xs text-gray-500 font-medium">& More</span>
                </div>
                
                <h2 className="text-white text-4xl font-serif font-bold mb-2 tracking-wide">{banner.title}</h2>
                <div className="flex items-center justify-between w-full">
                  <p className="text-white text-sm font-medium">{banner.subtitle}</p>
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md">
                    <ChevronRight size={20} className="text-gray-800" />
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Carousel Dots */}
      <div className="flex justify-center space-x-1.5 py-3">
        {banners.map((_, idx) => (
          <button 
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-2 h-2 rounded-full transition-colors ${idx === currentIndex ? 'bg-gray-800' : 'bg-gray-300'}`}
          />
        ))}
      </div>

      {/* Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center">
          <div className="bg-white w-full max-w-md h-[85dvh] sm:h-auto sm:max-h-[85dvh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-fade-in-up">
            {/* Modal Header */}
            <div className="bg-gray-900 p-4 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Edit2 size={18} /> Storefront Editor
              </h2>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-4 flex-1 space-y-8 bg-gray-50">
              {editBanners.map((banner, idx) => (
                <div key={banner.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                  <div className="absolute -top-3 -left-3 w-8 h-8 bg-pink-500 text-white rounded-full flex items-center justify-center font-bold border-4 border-gray-50 z-10">
                    {idx + 1}
                  </div>
                  {editBanners.length > 1 && (
                    <button 
                      onClick={() => handleRemoveBanner(idx)}
                      className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center border-4 border-gray-50 hover:bg-red-600 transition-colors z-10 shadow-sm"
                      title="Remove Banner"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  
                  {/* Image Upload */}
                  <div className="mb-4 mt-2">
                    <label className="block text-xs font-bold text-gray-500 mb-2">BANNER IMAGE</label>
                    <div className="relative w-full h-32 rounded-lg overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 group">
                      {banner.image ? (
                        <>
                          <Image src={banner.image} alt="Preview" fill className="object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingIdx(idx);
                              setEditorImageUrl(banner.image);
                            }}
                            className="absolute bottom-2 left-2 bg-black/80 hover:bg-black text-white text-[10px] px-2.5 py-1 rounded backdrop-blur z-20 cursor-pointer font-bold border border-white/20"
                            title="Edit Image"
                          >
                            Edit
                          </button>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                          <UploadCloud size={24} className="mb-1" />
                          <span className="text-xs">Upload Image</span>
                        </div>
                      )}
                      
                      {uploadingIdx === idx && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                          <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}

                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, idx)}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur">
                        Change
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">MAIN TITLE</label>
                      <input 
                        type="text" 
                        value={banner.title} 
                        onChange={(e) => {
                          const newB = [...editBanners];
                          newB[idx].title = e.target.value;
                          setEditBanners(newB);
                        }}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-pink-500" 
                        placeholder="e.g. Diwali Special"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">SUBTITLE</label>
                      <input 
                        type="text" 
                        value={banner.subtitle} 
                        onChange={(e) => {
                          const newB = [...editBanners];
                          newB[idx].subtitle = e.target.value;
                          setEditBanners(newB);
                        }}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-pink-500" 
                        placeholder="e.g. FLAT 50% OFF"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">BRAND 1</label>
                        <input 
                          type="text" 
                          value={banner.brand1 || ""} 
                          onChange={(e) => {
                            const newB = [...editBanners];
                            newB[idx].brand1 = e.target.value;
                            setEditBanners(newB);
                          }}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-pink-500 uppercase" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">BRAND 2</label>
                        <input 
                          type="text" 
                          value={banner.brand2 || ""} 
                          onChange={(e) => {
                            const newB = [...editBanners];
                            newB[idx].brand2 = e.target.value;
                            setEditBanners(newB);
                          }}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-pink-500 uppercase" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">REDIRECT LINK</label>
                      <input 
                        type="text" 
                        value={banner.link || ""} 
                        onChange={(e) => {
                          const newB = [...editBanners];
                          newB[idx].link = e.target.value;
                          setEditBanners(newB);
                        }}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-pink-500" 
                        placeholder="/categories or /product/123"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add New Banner Button */}
              {editBanners.length < 3 && (
                <button 
                  onClick={handleAddBanner}
                  className="w-full border-2 border-dashed border-gray-300 bg-white text-gray-600 font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:border-slate-400 hover:text-pink-600 hover:bg-slate-50 transition-colors"
                >
                  <Plus size={20} />
                  ADD NEW BANNER ({editBanners.length}/3)
                </button>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-white p-4 pb-safe border-t border-gray-200">
              <button 
                onClick={handleSave}
                className="w-full bg-pink-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-pink-600 transition-colors"
              >
                <Save size={20} />
                SAVE & PUBLISH
              </button>
            </div>
          </div>
        </div>
      )}

      {editorImageUrl && (
        <ImageEditorModal
          imageUrl={editorImageUrl}
          aspectRatio={21 / 9} // Banners are wide 21:9
          onClose={() => {
            setEditingIdx(null);
            setEditorImageUrl("");
          }}
          onSave={handleSaveEditedBanner}
        />
      )}
    </div>
  );
}
