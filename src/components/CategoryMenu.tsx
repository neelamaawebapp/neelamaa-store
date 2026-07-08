"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Edit2, Plus, Save, Trash2, UploadCloud, X, ChevronUp, ChevronDown, Folder, ChevronRight } from "lucide-react";
import { STORE_CATEGORIES, ParentCategory } from "@/lib/constants";
import ImageEditorModal from "@/components/ImageEditorModal";
import { getDailyGradients } from "@/lib/colorUtils";

export default function CategoryMenu() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState<ParentCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editCategories, setEditCategories] = useState<ParentCategory[]>([]);
  const [expandedParentIdx, setExpandedParentIdx] = useState<number | null>(null);

  // Image Editor States
  const [uploadingPath, setUploadingPath] = useState<{ parentIdx: number; subIdx?: number } | null>(null);
  const [editingPath, setEditingPath] = useState<{ parentIdx: number; subIdx?: number } | null>(null);
  const [editorImageUrl, setEditorImageUrl] = useState<string>("");

  // Drawer State
  const [activeDrawerParent, setActiveDrawerParent] = useState<ParentCategory | null>(null);

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const docRef = doc(db, "settings", "categories");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().data) {
          const fetched = docSnap.data().data;
          // Validate structure (ensure subCategories exist, otherwise fallback)
          if (Array.isArray(fetched) && fetched.length > 0 && "subCategories" in fetched[0]) {
            setCategories(fetched);
            setEditCategories(fetched);
          } else {
            setCategories(STORE_CATEGORIES);
            setEditCategories(STORE_CATEGORIES);
          }
        } else {
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

  const uploadAndSaveCategoryImg = async (file: File, path: { parentIdx: number; subIdx?: number }) => {
    setUploadingPath(path);
    try {
      const formData = new FormData();
      formData.append("image", file);
      
      const res = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        const newCats = JSON.parse(JSON.stringify(editCategories));
        if (path.subIdx !== undefined) {
          newCats[path.parentIdx].subCategories[path.subIdx].image = data.data.url;
        } else {
          newCats[path.parentIdx].image = data.data.url;
        }
        setEditCategories(newCats);
      } else {
        alert("Image upload failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading image");
    } finally {
      setUploadingPath(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, parentIdx: number, subIdx?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditingPath({ parentIdx, subIdx });
    setEditorImageUrl(URL.createObjectURL(file));
  };

  const handleSaveEditedCategory = async (editedFile: File) => {
    const path = editingPath;
    setEditingPath(null);
    setEditorImageUrl("");
    if (path !== null) {
      await uploadAndSaveCategoryImg(editedFile, path);
    }
  };

  const handleMoveParentUp = (idx: number) => {
    if (idx === 0) return;
    const reordered = [...editCategories];
    const temp = reordered[idx];
    reordered[idx] = reordered[idx - 1];
    reordered[idx - 1] = temp;
    setEditCategories(reordered);
    if (expandedParentIdx === idx) setExpandedParentIdx(idx - 1);
    else if (expandedParentIdx === idx - 1) setExpandedParentIdx(idx);
  };

  const handleMoveParentDown = (idx: number) => {
    if (idx === editCategories.length - 1) return;
    const reordered = [...editCategories];
    const temp = reordered[idx];
    reordered[idx] = reordered[idx + 1];
    reordered[idx + 1] = temp;
    setEditCategories(reordered);
    if (expandedParentIdx === idx) setExpandedParentIdx(idx + 1);
    else if (expandedParentIdx === idx + 1) setExpandedParentIdx(idx);
  };

  const handleMoveSubUp = (parentIdx: number, subIdx: number) => {
    if (subIdx === 0) return;
    const newCats = JSON.parse(JSON.stringify(editCategories));
    const subs = newCats[parentIdx].subCategories;
    const temp = subs[subIdx];
    subs[subIdx] = subs[subIdx - 1];
    subs[subIdx - 1] = temp;
    setEditCategories(newCats);
  };

  const handleMoveSubDown = (parentIdx: number, subIdx: number) => {
    const newCats = JSON.parse(JSON.stringify(editCategories));
    const subs = newCats[parentIdx].subCategories;
    if (subIdx === subs.length - 1) return;
    const temp = subs[subIdx];
    subs[subIdx] = subs[subIdx + 1];
    subs[subIdx + 1] = temp;
    setEditCategories(newCats);
  };

  const handleAddParent = () => {
    setEditCategories([
      ...editCategories,
      { name: "New Category", image: "", subCategories: [] }
    ]);
    setExpandedParentIdx(editCategories.length);
  };

  const handleRemoveParent = (parentIdx: number) => {
    if (confirm(`Are you sure you want to delete "${editCategories[parentIdx].name}" and all of its sub-categories?`)) {
      const newCats = [...editCategories];
      newCats.splice(parentIdx, 1);
      setEditCategories(newCats);
      setExpandedParentIdx(null);
    }
  };

  const handleAddSub = (parentIdx: number) => {
    const newCats = JSON.parse(JSON.stringify(editCategories));
    newCats[parentIdx].subCategories.push({ name: "New Sub Category", image: "" });
    setEditCategories(newCats);
  };

  const handleRemoveSub = (parentIdx: number, subIdx: number) => {
    const newCats = JSON.parse(JSON.stringify(editCategories));
    newCats[parentIdx].subCategories.splice(subIdx, 1);
    setEditCategories(newCats);
  };

  const handleSave = async () => {
    try {
      await setDoc(doc(db, "settings", "categories"), { data: editCategories });
      setCategories(editCategories);
      setIsEditing(false);
      alert("Categories & Subcategories updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save categories settings.");
    }
  };

  const handleCategoryClick = (cat: ParentCategory) => {
    if (cat.subCategories && cat.subCategories.length > 0) {
      setActiveDrawerParent(cat);
    } else {
      router.push(`/category/${encodeURIComponent(cat.name)}`);
    }
  };

  const gradients = getDailyGradients();
  const gradient = gradients[0];

  if (loading) {
    return (
      <div className={`pb-4 pt-4 px-4 flex space-x-4 overflow-hidden ${gradient.bg}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center flex-shrink-0 animate-pulse">
            <div className="w-[85px] h-[125px] rounded-2xl bg-gray-200 mb-2"></div>
            <div className="w-14 h-3 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`pb-5 pt-4 relative border-b ${gradient.bg} ${gradient.border}`}>
      
      {/* Magic Edit Button */}
      {isAdmin && !isEditing && (
        <button 
          onClick={() => setIsEditing(true)}
          className="absolute top-2 left-4 z-20 bg-black/80 backdrop-blur text-white px-3 py-1.5 rounded-full font-bold text-xs flex items-center space-x-1 shadow-md hover:bg-black transition-all cursor-pointer"
        >
          <Edit2 size={12} />
          <span>EDIT CATEGORIES</span>
        </button>
      )}

      {/* Categories Horizontal Scroll */}
      <div className={`flex overflow-x-auto hide-scrollbar px-4 pb-2 space-x-4 ${isAdmin ? 'pt-8' : ''}`}>
        {categories.map((cat, idx) => (
          <button 
            key={idx} 
            onClick={() => handleCategoryClick(cat)}
            className="flex flex-col items-center flex-shrink-0 focus:outline-none group animate-fade-in cursor-pointer"
          >
            <div className="w-[85px] h-[125px] rounded-2xl overflow-hidden mb-2 border border-gray-200/60 shadow-sm group-hover:ring-2 group-hover:ring-pink-500 group-hover:ring-offset-2 transition-all bg-gray-100 relative">
              {cat.image ? (
                <Image
                  src={cat.image}
                  alt={cat.name}
                  width={85}
                  height={125}
                  className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Folder size={24} />
                </div>
              )}
              {cat.subCategories && cat.subCategories.length > 0 && (
                <div className="absolute bottom-1 right-1 bg-black/60 text-white rounded-full p-0.5 z-10 flex items-center justify-center">
                  <ChevronRight size={10} className="text-white" />
                </div>
              )}
            </div>
            <span className="text-[11px] font-bold text-slate-800 group-hover:text-pink-600 transition-colors mt-1 uppercase tracking-wide">
              {cat.name}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom Sheet Drawer for Subcategories */}
      {activeDrawerParent && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center">
          {/* Backdrop */}
          <div 
            onClick={() => setActiveDrawerParent(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
          />
          
          {/* Drawer Sheet */}
          <div className="relative w-full max-w-md bg-white rounded-t-3xl overflow-hidden shadow-2xl z-10 max-h-[70vh] flex flex-col animate-slide-up pb-safe">
            {/* Handle Bar */}
            <div className="w-full flex justify-center py-3">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-950 text-base leading-tight uppercase tracking-wide">
                  {activeDrawerParent.name}
                </h3>
                <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                  Select a sub-category to view products
                </p>
              </div>
              <button 
                onClick={() => setActiveDrawerParent(null)}
                className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-categories Grid */}
            <div className="overflow-y-auto px-5 py-4 grid grid-cols-2 gap-4 flex-1">
              {activeDrawerParent.subCategories.map((sub, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => {
                    setActiveDrawerParent(null);
                    router.push(`/category/${encodeURIComponent(sub.name)}`);
                  }}
                  className="group bg-slate-50 border border-slate-100 hover:border-pink-200 rounded-2xl p-3 flex flex-col items-center justify-center transition-all focus:outline-none cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full overflow-hidden relative border border-gray-200/50 shadow-xs mb-2 group-hover:scale-105 transition-transform animate-fade-in">
                    {sub.image ? (
                      <Image src={sub.image} alt={sub.name} fill className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-400">?</div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-pink-600 transition-colors text-center">
                    {sub.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Footer View All button */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  const parentName = activeDrawerParent.name;
                  setActiveDrawerParent(null);
                  router.push(`/category/${encodeURIComponent(parentName)}`);
                }}
                className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                VIEW ALL {activeDrawerParent.name.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center">
          <div className="bg-white w-full max-w-md h-[85dvh] sm:h-auto sm:max-h-[85dvh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-fade-in-up">
            {/* Modal Header */}
            <div className="bg-gray-900 p-4 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Edit2 size={18} /> Category & Subcategory Editor
              </h2>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-4 flex-1 space-y-4 bg-gray-50">
              {editCategories.map((parent, pIdx) => {
                const isExpanded = expandedParentIdx === pIdx;
                
                return (
                  <div 
                    key={pIdx}
                    className="bg-white rounded-xl border border-gray-200 shadow-xs flex flex-col overflow-hidden transition-all"
                  >
                    {/* Parent Category Row */}
                    <div className="p-3 flex items-center space-x-3 bg-slate-50 border-b border-gray-100">
                      {/* Image Upload */}
                      <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-300 flex-shrink-0 group">
                        {parent.image ? (
                          <>
                            <Image src={parent.image} alt={parent.name} fill className="object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPath({ parentIdx: pIdx });
                                setEditorImageUrl(parent.image);
                              }}
                              className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer text-[9px] font-bold"
                              title="Edit Image"
                            >
                              EDIT
                            </button>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                            <UploadCloud size={14} />
                          </div>
                        )}
                        {uploadingPath?.parentIdx === pIdx && uploadingPath?.subIdx === undefined && (
                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-xs">
                            <div className="w-3 h-3 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, pIdx)}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                      </div>

                      {/* Parent Name */}
                      <div className="flex-1">
                        <label className="block text-[8px] font-bold text-gray-400 mb-0.5">PARENT CATEGORY</label>
                        <input 
                          type="text" 
                          value={parent.name} 
                          onChange={(e) => {
                            const newCats = [...editCategories];
                            newCats[pIdx].name = e.target.value;
                            setEditCategories(newCats);
                          }}
                          className="w-full border border-gray-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:border-pink-500 font-bold text-gray-800" 
                          placeholder="e.g. Home Decor"
                        />
                      </div>
                      
                      {/* Move controls */}
                      <div className="flex flex-col -space-y-1">
                        <button 
                          type="button"
                          onClick={() => handleMoveParentUp(pIdx)} 
                          disabled={pIdx === 0}
                          className="p-0.5 text-gray-400 hover:text-pink-600 disabled:opacity-20 rounded hover:bg-gray-250 cursor-pointer"
                          title="Move Parent Up"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleMoveParentDown(pIdx)} 
                          disabled={pIdx === editCategories.length - 1}
                          className="p-0.5 text-gray-400 hover:text-pink-600 disabled:opacity-20 rounded hover:bg-gray-250 cursor-pointer"
                          title="Move Parent Down"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>

                      {/* Delete Parent */}
                      <button 
                        type="button"
                        onClick={() => handleRemoveParent(pIdx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                        title="Delete Parent Category"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Subcategories Expander Header */}
                    <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 bg-white">
                      <button
                        type="button"
                        onClick={() => setExpandedParentIdx(isExpanded ? null : pIdx)}
                        className="text-xs font-bold text-gray-500 hover:text-pink-600 flex items-center gap-1.5 focus:outline-none cursor-pointer"
                      >
                        <span>{parent.subCategories?.length || 0} Sub-categories</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      
                      {isExpanded && (
                        <button
                          type="button"
                          onClick={() => handleAddSub(pIdx)}
                          className="text-[10px] font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1 bg-pink-50 hover:bg-pink-100 px-2 py-1 rounded-md transition-all cursor-pointer"
                        >
                          <Plus size={12} /> ADD SUB
                        </button>
                      )}
                    </div>

                    {/* Sub-categories List (Expandable) */}
                    {isExpanded && (
                      <div className="bg-slate-50/50 p-3 space-y-2 border-t border-gray-50">
                        {parent.subCategories && parent.subCategories.length > 0 ? (
                          parent.subCategories.map((sub, sIdx) => (
                            <div 
                              key={sIdx} 
                              className="bg-white p-2 rounded-lg border border-gray-150 flex items-center space-x-2 shadow-2xs"
                            >
                              {/* Sub Image */}
                              <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gray-100 border border-gray-300 flex-shrink-0 group">
                                {sub.image ? (
                                  <>
                                    <Image src={sub.image} alt={sub.name} fill className="object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPath({ parentIdx: pIdx, subIdx: sIdx });
                                        setEditorImageUrl(sub.image);
                                      }}
                                      className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer text-[8px] font-bold"
                                      title="Edit Image"
                                    >
                                      EDIT
                                    </button>
                                  </>
                                ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                                    <UploadCloud size={10} />
                                  </div>
                                )}
                                {uploadingPath?.parentIdx === pIdx && uploadingPath?.subIdx === sIdx && (
                                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-xs">
                                    <div className="w-2.5 h-2.5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                                  </div>
                                )}
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  onChange={(e) => handleImageUpload(e, pIdx, sIdx)}
                                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                />
                              </div>

                              {/* Sub Name */}
                              <div className="flex-1">
                                <input 
                                  type="text" 
                                  value={sub.name} 
                                  onChange={(e) => {
                                    const newCats = JSON.parse(JSON.stringify(editCategories));
                                    newCats[pIdx].subCategories[sIdx].name = e.target.value;
                                    setEditCategories(newCats);
                                  }}
                                  className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-pink-500 font-bold text-gray-700" 
                                  placeholder="e.g. Iron Decor"
                                />
                              </div>

                              {/* Sub Reorder controls */}
                              <div className="flex flex-col -space-y-1">
                                <button 
                                  type="button"
                                  onClick={() => handleMoveSubUp(pIdx, sIdx)} 
                                  disabled={sIdx === 0}
                                  className="p-0.5 text-gray-400 hover:text-pink-600 disabled:opacity-20 rounded hover:bg-gray-100 cursor-pointer"
                                >
                                  <ChevronUp size={12} />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => handleMoveSubDown(pIdx, sIdx)} 
                                  disabled={sIdx === parent.subCategories.length - 1}
                                  className="p-0.5 text-gray-400 hover:text-pink-600 disabled:opacity-20 rounded hover:bg-gray-100 cursor-pointer"
                                >
                                  <ChevronDown size={12} />
                                </button>
                              </div>

                              {/* Delete Sub */}
                              <button 
                                type="button"
                                onClick={() => handleRemoveSub(pIdx, sIdx)}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                                title="Delete Sub-category"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-3 text-xs text-gray-400 italic bg-white border border-dashed border-gray-200 rounded-lg">
                            No sub-categories yet. Click "Add Sub" above.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add New Parent Category Button */}
              <button 
                onClick={handleAddParent}
                className="w-full border-2 border-dashed border-gray-300 bg-white text-gray-600 font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:border-slate-400 hover:text-pink-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Plus size={20} />
                ADD NEW PARENT CATEGORY
              </button>
            </div>

            {/* Modal Footer */}
            <div className="bg-white p-4 pb-safe border-t border-gray-200">
              <button 
                onClick={handleSave}
                className="w-full bg-pink-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-pink-600 transition-colors cursor-pointer"
              >
                <Save size={20} />
                SAVE CATEGORIES & SUBCATEGORIES
              </button>
            </div>
          </div>
        </div>
      )}

      {editorImageUrl && (
        <ImageEditorModal
          imageUrl={editorImageUrl}
          aspectRatio={1} // Categories are 1:1 round circles
          onClose={() => {
            setEditingPath(null);
            setEditorImageUrl("");
          }}
          onSave={handleSaveEditedCategory}
        />
      )}
    </div>
  );
}
