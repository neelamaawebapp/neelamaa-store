"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from "firebase/firestore";
import { UploadCloud, Edit2, Trash2, Image as ImageIcon, X } from "lucide-react";
import { STORE_CATEGORIES } from "@/lib/constants";

export default function AdminDashboard() {
  // Product List State
  const [products, setProducts] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(STORE_CATEGORIES[0].name);
  
  // Image Upload State
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status State
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Fetch Products
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
      setFetching(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFileSelection(file);
    } else {
      setError("Please drop a valid image file.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    setImageFile(file);
    setImageUrl(""); // Clear manual URL if file selected
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImageSelection = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setEditingId(null);
    setBrand("");
    setTitle("");
    setPrice("");
    setCategory("Fashion");
    setImageUrl("");
    clearImageSelection();
  };

  const handleEditClick = (product: any) => {
    setEditingId(product.id);
    setBrand(product.brand);
    setTitle(product.title);
    setPrice(product.price.toString());
    setCategory(product.category);
    setImageUrl(product.image);
    clearImageSelection();
    setImagePreview(product.image); // Show current image as preview
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      setSuccess("Product deleted successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete product.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setError("");

    try {
      if (!imageUrl && !imageFile && !imagePreview) {
        throw new Error("Please provide an image URL or upload an image file.");
      }

      let finalImageUrl = imageUrl;

      // Upload file to ImgBB if a new file is selected
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        
        const res = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
          method: "POST",
          body: formData
        });
        
        const data = await res.json();
        
        if (data.success) {
          finalImageUrl = data.data.url;
        } else {
          throw new Error(data.error?.message || "Failed to upload image.");
        }
      } else if (!finalImageUrl && imagePreview) {
        // If editing and didn't change image, imagePreview holds the existing URL
        finalImageUrl = imagePreview; 
      }

      const productData = {
        brand,
        title,
        price: Number(price),
        category,
        image: finalImageUrl,
      };

      if (editingId) {
        await updateDoc(doc(db, "products", editingId), productData);
        setSuccess("Product updated successfully!");
      } else {
        await addDoc(collection(db, "products"), {
          ...productData,
          createdAt: serverTimestamp(),
        });
        setSuccess("Product added successfully!");
      }

      resetForm();
    } catch (err: any) {
      setError(err.message || "Failed to save product");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(""), 4000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Left Column: Add/Edit Form */}
      <div className="lg:col-span-1">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 sticky top-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {editingId ? "Edit Product" : "Add New Product"}
            </h2>
            {editingId && (
              <button onClick={resetForm} className="text-xs text-pink-600 font-bold hover:underline">Cancel Edit</button>
            )}
          </div>
          
          {success && <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-md border border-green-200 text-sm">{success}</div>}
          {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md border border-red-200 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">BRAND</label>
              <input type="text" required value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none" placeholder="e.g. LEVIS" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">TITLE</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none" placeholder="e.g. Men Slim Fit Jeans" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">PRICE (₹)</label>
                <input type="number" required value={price} onChange={(e) => setPrice(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none" placeholder="999" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">CATEGORY</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none">
                  {STORE_CATEGORIES.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold text-gray-700 mb-2">PRODUCT IMAGE</label>
              
              {/* Drag & Drop Zone */}
              {!imagePreview ? (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors
                    ${isDragging ? 'border-pink-500 bg-pink-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
                  `}
                >
                  <UploadCloud size={32} className={`mb-2 ${isDragging ? 'text-pink-500' : 'text-gray-400'}`} />
                  <p className="text-xs text-center text-gray-600 font-medium">Click or drag image to upload</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
              ) : (
                <div className="relative border rounded-lg overflow-hidden h-48 bg-gray-100 flex items-center justify-center group">
                  <img src={imagePreview} alt="Preview" className="h-full object-contain" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button type="button" onClick={clearImageSelection} className="bg-white text-red-500 px-3 py-1.5 rounded-full text-xs font-bold flex items-center space-x-1 hover:bg-red-50">
                      <Trash2 size={14} />
                      <span>REMOVE</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center my-3">
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="px-3 text-xs text-gray-400 font-bold uppercase">OR PASTE URL</span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>

              <input 
                type="text" 
                value={imageUrl} 
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  if (e.target.value) clearImageSelection();
                }} 
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-pink-500 outline-none" 
                placeholder="https://..." 
              />
            </div>

            <div className="pt-4">
              <button type="submit" disabled={loading} className="w-full bg-pink-500 text-white font-bold py-3 rounded-md hover:bg-pink-600 disabled:opacity-70 transition-colors">
                {loading ? "SAVING..." : editingId ? "UPDATE PRODUCT" : "ADD PRODUCT"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Column: Product List */}
      <div className="lg:col-span-2">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Store Inventory ({products.length})</h2>
        
        {fetching ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
            No products in inventory yet.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <img src={product.image} alt={product.brand} className="w-10 h-12 object-cover rounded bg-gray-100" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-gray-900 truncate w-32 sm:w-48">{product.brand}</span>
                            <span className="text-xs text-gray-500 truncate w-32 sm:w-48">{product.title}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{product.category}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">₹{product.price}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => handleEditClick(product)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(product.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
