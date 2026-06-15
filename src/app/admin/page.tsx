"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from "firebase/firestore";
import { UploadCloud, Edit2, Trash2, X, Layers, AlertTriangle, CheckCircle2, Package, Coins, BarChart3, Search, Filter, Bell } from "lucide-react";
import { STORE_CATEGORIES } from "@/lib/constants";

export default function AdminDashboard() {
  const [viewMode, setViewMode] = useState<"single" | "bulk" | "alerts">("single");
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [fetchingSubs, setFetchingSubs] = useState(true);

  // Product List State
  const [products, setProducts] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  
  // Dynamic Categories State
  const [availableCategories, setAvailableCategories] = useState<string[]>(STORE_CATEGORIES.map(c => c.name));

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(STORE_CATEGORIES[0].name);
  const [homeSection, setHomeSection] = useState("Standard");
  const [gstRate, setGstRate] = useState("18");
  
  // Pricing & Stock Fields
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [packingCharges, setPackingCharges] = useState("");
  const [courierCharges, setCourierCharges] = useState("");
  const [otherExpenses, setOtherExpenses] = useState("");
  const [profit, setProfit] = useState("");
  
  // Search and Filters for product table
  const [searchQuery, setSearchQuery] = useState("");
  const [tableFilter, setTableFilter] = useState<"all" | "lowStock" | "incomplete">("all");

  // Flash Sale State
  const [flashSaleEnd, setFlashSaleEnd] = useState("");
  const [flashSaleLoading, setFlashSaleLoading] = useState(false);
  
  // Product Images States (Multiple)
  const [productImages, setProductImages] = useState<{
    id: string;
    file: File | null;
    url: string;
    preview: string;
  }[]>([]);
  const [pastedUrl, setPastedUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status State
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // BULK UPLOAD STATE
  const [bulkFiles, setBulkFiles] = useState<{
    file: File;
    preview: string;
    brand: string;
    title: string;
    quantity: string;
    purchasePrice: string;
    packingCharges: string;
    courierCharges: string;
    otherExpenses: string;
    profit: string;
    category: string;
    homeSection: string;
    gstRate: string;
  }[]>([]);
  const [isDraggingBulk, setIsDraggingBulk] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Products & Categories
  useEffect(() => {
    // Fetch Products
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
      setFetching(false);
    });

    // Fetch Categories
    import("firebase/firestore").then(({ getDoc, doc }) => {
      getDoc(doc(db, "settings", "categories")).then((snap) => {
        if (snap.exists() && snap.data().data) {
          const fetchedCats = snap.data().data.map((c: any) => c.name);
          setAvailableCategories(Array.from(new Set([...STORE_CATEGORIES.map(c => c.name), ...fetchedCats])));
        }
      });
      // Fetch Flash Sale Setting
      getDoc(doc(db, "settings", "flashSale")).then((snap) => {
        if (snap.exists() && snap.data().endTime) {
          const date = snap.data().endTime.toDate();
          const offset = date.getTimezoneOffset() * 60000;
          const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
          setFlashSaleEnd(localISOTime);
        }
      });
    });

    return () => unsubscribe();
  }, []);

  // Fetch Restock Alert Subscriptions
  useEffect(() => {
    const q = collection(db, "back_in_stock_subscriptions");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort in JS memory to avoid custom index errors in Firestore
      subs.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      // Combine with local mock subscriptions if they exist in localStorage
      let localSubs: any[] = [];
      try {
        const stored = localStorage.getItem("neelsutra_stock_subscriptions");
        if (stored) {
          localSubs = JSON.parse(stored);
        }
      } catch (e) {}

      // Deduplicate by combining remote and local (remote takes precedence)
      const combined = [...subs];
      localSubs.forEach((lSub: any) => {
        const isMatched = combined.some((rSub: any) => rSub.productId === lSub.productId && rSub.email === lSub.email);
        if (!isMatched) {
          combined.push({
            id: `local_${lSub.productId}_${lSub.email}`,
            isLocal: true,
            ...lSub
          });
        }
      });

      // Also sort combined list again in case local items were added
      combined.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setSubscriptions(combined);
      setFetchingSubs(false);
    }, (err) => {
      console.warn("Firestore subscriptions sub failed, falling back to local storage", err);
      try {
        const stored = localStorage.getItem("neelsutra_stock_subscriptions");
        if (stored) {
          const localSubs = JSON.parse(stored).map((s: any) => ({
            id: `local_${s.productId}_${s.email}`,
            isLocal: true,
            ...s
          }));
          localSubs.sort((a: any, b: any) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          setSubscriptions(localSubs);
        }
      } catch (e) {
        setSubscriptions([]);
      }
      setFetchingSubs(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteSubscription = async (sub: any) => {
    if (!confirm("Are you sure you want to remove this stock alert request?")) return;
    
    if (sub.isLocal) {
      try {
        const stored = localStorage.getItem("neelsutra_stock_subscriptions");
        if (stored) {
          const localSubs = JSON.parse(stored);
          const filtered = localSubs.filter((s: any) => !(s.productId === sub.productId && s.email === sub.email));
          localStorage.setItem("neelsutra_stock_subscriptions", JSON.stringify(filtered));
          setSubscriptions(prev => prev.filter(s => s.id !== sub.id));
        }
      } catch (e) {
        console.error("Failed to delete local subscription:", e);
      }
      return;
    }

    try {
      await deleteDoc(doc(db, "back_in_stock_subscriptions", sub.id));
      setSuccess("Subscription removed successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to remove subscription.");
    }
  };

  // Pricing checking helpers
  const getMissingPricingFields = (product: any) => {
    const missing = [];
    if (product.purchasePrice === undefined || product.purchasePrice === null || product.purchasePrice === "") missing.push("Purchase Price");
    if (product.packingCharges === undefined || product.packingCharges === null || product.packingCharges === "") missing.push("Packing Cost");
    if (product.courierCharges === undefined || product.courierCharges === null || product.courierCharges === "") missing.push("Courier Cost");
    if (product.otherExpenses === undefined || product.otherExpenses === null || product.otherExpenses === "") missing.push("Other Expenses");
    if (product.profit === undefined || product.profit === null || product.profit === "") missing.push("Profit Margin");
    return missing;
  };

  const isPricingIncomplete = (product: any) => {
    return getMissingPricingFields(product).length > 0;
  };

  // Form calculated values
  const calculatedPrice = 
    Number(purchasePrice || 0) + 
    Number(packingCharges || 0) + 
    Number(courierCharges || 0) + 
    Number(otherExpenses || 0) + 
    Number(profit || 0);

  const saveFlashSaleTimer = async () => {
    if (!flashSaleEnd) return;
    setFlashSaleLoading(true);
    try {
      const { doc, setDoc, Timestamp } = await import("firebase/firestore");
      const dateObj = new Date(flashSaleEnd);
      await setDoc(doc(db, "settings", "flashSale"), {
        endTime: Timestamp.fromDate(dateObj)
      });
      setSuccess("Flash sale timer updated!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update flash sale timer");
    } finally {
      setFlashSaleLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleMultipleFileSelection = (files: File[]) => {
    const newItems = files.map(file => ({
      id: `img_${Date.now()}_${Math.random()}`,
      file,
      url: "",
      preview: URL.createObjectURL(file)
    }));
    setProductImages(prev => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(f => f.type.startsWith("image/"));
    if (validFiles.length > 0) {
      handleMultipleFileSelection(validFiles);
    } else {
      setError("Please drop valid image files.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter(f => f.type.startsWith("image/"));
      handleMultipleFileSelection(validFiles);
    }
  };

  const removeProductImage = (idToRemove: string) => {
    setProductImages(prev => prev.filter(img => img.id !== idToRemove));
  };

  const addPastedUrl = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!pastedUrl.trim()) return;
    setProductImages(prev => [...prev, {
      id: `img_${Date.now()}_${Math.random()}`,
      file: null,
      url: pastedUrl.trim(),
      preview: pastedUrl.trim()
    }]);
    setPastedUrl("");
  };

  const resetForm = () => {
    setEditingId(null);
    setBrand("");
    setTitle("");
    setQuantity("");
    setPurchasePrice("");
    setPackingCharges("");
    setCourierCharges("");
    setOtherExpenses("");
    setProfit("");
    setCategory(STORE_CATEGORIES[0].name);
    setHomeSection("Standard");
    setGstRate("18");
    setProductImages([]);
    setPastedUrl("");
  };

  const handleEditClick = (product: any) => {
    setViewMode("single");
    setEditingId(product.id);
    setBrand(product.brand || "");
    setTitle(product.title || "");
    setCategory(product.category || STORE_CATEGORIES[0].name);
    setHomeSection(product.homeSection || "Standard");
    setGstRate(product.gstRate?.toString() || "18");
    
    // Set photos list (support images array fallback to single image string)
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      setProductImages(product.images.map((url: string, index: number) => ({
        id: `img_${Date.now()}_${index}_${Math.random()}`,
        file: null,
        url,
        preview: url
      })));
    } else if (product.image) {
      setProductImages([{
        id: `img_${Date.now()}_0_${Math.random()}`,
        file: null,
        url: product.image,
        preview: product.image
      }]);
    } else {
      setProductImages([]);
    }
    setPastedUrl("");

    // Cost breakdown fields
    setQuantity(product.quantity !== undefined && product.quantity !== null ? product.quantity.toString() : "");
    setPurchasePrice(product.purchasePrice !== undefined && product.purchasePrice !== null ? product.purchasePrice.toString() : "");
    setPackingCharges(product.packingCharges !== undefined && product.packingCharges !== null ? product.packingCharges.toString() : "");
    setCourierCharges(product.courierCharges !== undefined && product.courierCharges !== null ? product.courierCharges.toString() : "");
    setOtherExpenses(product.otherExpenses !== undefined && product.otherExpenses !== null ? product.otherExpenses.toString() : "");
    setProfit(product.profit !== undefined && product.profit !== null ? product.profit.toString() : "");
    
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
      if (productImages.length === 0) {
        throw new Error("Please add at least one product photo.");
      }

      // Upload all queued image files sequentially
      const uploadedUrls: string[] = [];
      for (const img of productImages) {
        if (img.file) {
          const formData = new FormData();
          formData.append("image", img.file);
          
          const res = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
            method: "POST",
            body: formData
          });
          
          const data = await res.json();
          if (data.success) {
            uploadedUrls.push(data.data.url);
          } else {
            throw new Error(data.error?.message || "Failed to upload one of the images.");
          }
        } else if (img.url) {
          uploadedUrls.push(img.url);
        }
      }

      if (uploadedUrls.length === 0) {
        throw new Error("Failed to resolve product photos.");
      }

      const primaryImage = uploadedUrls[0];

      const productData = {
        brand,
        title,
        price: calculatedPrice,
        purchasePrice: purchasePrice !== "" ? Number(purchasePrice) : null,
        packingCharges: packingCharges !== "" ? Number(packingCharges) : null,
        courierCharges: courierCharges !== "" ? Number(courierCharges) : null,
        otherExpenses: otherExpenses !== "" ? Number(otherExpenses) : null,
        profit: profit !== "" ? Number(profit) : null,
        quantity: quantity !== "" ? Number(quantity) : 0,
        category,
        homeSection,
        gstRate: Number(gstRate),
        image: primaryImage, // For backwards compatibility
        images: uploadedUrls, // The full array of angles!
      };

      let savedProductId = editingId;
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), productData);
        setSuccess("Product updated successfully!");
      } else {
        const docRef = await addDoc(collection(db, "products"), {
          ...productData,
          createdAt: serverTimestamp(),
        });
        savedProductId = docRef.id;
        setSuccess("Product added successfully!");
      }

      // Trigger back-in-stock notification check if quantity is > 0
      if (productData.quantity > 0 && savedProductId) {
        // Trigger Server API (calls Nodemailer & writes Firestore Notifications)
        try {
          await fetch("/api/notify-restock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: savedProductId,
              brand: productData.brand,
              title: productData.title,
              quantity: productData.quantity
            })
          });
        } catch (apiErr) {
          console.error("Failed to trigger restock API:", apiErr);
        }

        // Trigger Local/Mock Notifications (for local guest testing)
        try {
          const localSubs = JSON.parse(localStorage.getItem("neelsutra_stock_subscriptions") || "[]");
          const pendingSubs = localSubs.filter((s: any) => s.productId === savedProductId && s.status === "Pending");
          
          if (pendingSubs.length > 0) {
            const localNotifications = JSON.parse(localStorage.getItem("neelsutra_local_notifications") || "[]");
            pendingSubs.forEach((sub: any) => {
              localNotifications.unshift({
                id: `notif_${Date.now()}_${Math.random()}`,
                userId: sub.userId,
                email: sub.email,
                title: "Back in Stock! 🌟",
                message: `The "${productData.brand} - ${productData.title}" you wanted is back in stock now!`,
                productId: savedProductId,
                createdAt: new Date().toISOString(),
                read: false
              });
            });
            localStorage.setItem("neelsutra_local_notifications", JSON.stringify(localNotifications));

            const updatedSubs = localSubs.map((s: any) => {
              if (s.productId === savedProductId && s.status === "Pending") {
                return { ...s, status: "Notified", notifiedAt: new Date().toISOString() };
              }
              return s;
            });
            localStorage.setItem("neelsutra_stock_subscriptions", JSON.stringify(updatedSubs));
          }
        } catch (localErr) {
          console.error("Failed to process local restock notifications:", localErr);
        }
      }

      resetForm();
    } catch (err: any) {
      setError(err.message || "Failed to save product");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(""), 4000);
    }
  };

  // BULK UPLOAD HANDLERS
  const handleBulkDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBulk(false);
    if (e.dataTransfer.files) {
      handleBulkFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleBulkFiles(Array.from(e.target.files));
    }
  };

  const handleBulkFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith("image/"));
    const newBulkItems = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      brand: "",
      title: "",
      quantity: "10",
      purchasePrice: "",
      packingCharges: "",
      courierCharges: "",
      otherExpenses: "",
      profit: "",
      category: STORE_CATEGORIES[0].name,
      homeSection: "Standard",
      gstRate: "18"
    }));
    setBulkFiles(prev => [...prev, ...newBulkItems]);
  };

  const updateBulkItem = (index: number, field: string, value: string) => {
    const newItems = [...bulkFiles];
    newItems[index] = { ...newItems[index], [field]: value } as any;
    setBulkFiles(newItems);
  };

  const removeBulkItem = (index: number) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== index));
  };

  const submitBulk = async () => {
    if (bulkFiles.length === 0) return;
    setLoading(true);
    setSuccess("");
    setError("");

    try {
      for (const item of bulkFiles) {
        if (!item.brand || !item.title || !item.purchasePrice || !item.packingCharges || !item.courierCharges || !item.otherExpenses || !item.profit || !item.category) {
          throw new Error("Please fill out all fields for all images before saving.");
        }
      }

      let count = 0;
      for (const item of bulkFiles) {
        const formData = new FormData();
        formData.append("image", item.file);
        const res = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
          method: "POST",
          body: formData
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error?.message || "Failed to upload image.");
        
        const finalUrl = data.data.url;

        const calculatedBulkPrice = 
          Number(item.purchasePrice || 0) + 
          Number(item.packingCharges || 0) + 
          Number(item.courierCharges || 0) + 
          Number(item.otherExpenses || 0) + 
          Number(item.profit || 0);

        const docRef = await addDoc(collection(db, "products"), {
          brand: item.brand,
          title: item.title,
          price: calculatedBulkPrice,
          purchasePrice: Number(item.purchasePrice),
          packingCharges: Number(item.packingCharges),
          courierCharges: Number(item.courierCharges),
          otherExpenses: Number(item.otherExpenses),
          profit: Number(item.profit),
          quantity: Number(item.quantity || 0),
          category: item.category,
          homeSection: item.homeSection,
          gstRate: Number(item.gstRate),
          image: finalUrl,
          createdAt: serverTimestamp(),
        });

        // Trigger notifications if restocked (bulk upload stock > 0)
        const bulkQuantity = Number(item.quantity || 0);
        if (bulkQuantity > 0) {
          try {
            await fetch("/api/notify-restock", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                productId: docRef.id,
                brand: item.brand,
                title: item.title,
                quantity: bulkQuantity
              })
            });
          } catch (apiErr) {
            console.error("Failed to trigger bulk restock API:", apiErr);
          }

          // Trigger Local/Mock Notifications
          try {
            const localSubs = JSON.parse(localStorage.getItem("neelsutra_stock_subscriptions") || "[]");
            const pendingSubs = localSubs.filter((s: any) => s.productId === docRef.id && s.status === "Pending");
            if (pendingSubs.length > 0) {
              const localNotifications = JSON.parse(localStorage.getItem("neelsutra_local_notifications") || "[]");
              pendingSubs.forEach((sub: any) => {
                localNotifications.unshift({
                  id: `notif_${Date.now()}_${Math.random()}`,
                  userId: sub.userId,
                  email: sub.email,
                  title: "Back in Stock! 🌟",
                  message: `The "${item.brand} - ${item.title}" you wanted is back in stock now!`,
                  productId: docRef.id,
                  createdAt: new Date().toISOString(),
                  read: false
                });
              });
              localStorage.setItem("neelsutra_local_notifications", JSON.stringify(localNotifications));

              const updatedSubs = localSubs.map((s: any) => {
                if (s.productId === docRef.id && s.status === "Pending") {
                  return { ...s, status: "Notified", notifiedAt: new Date().toISOString() };
                }
                return s;
              });
              localStorage.setItem("neelsutra_stock_subscriptions", JSON.stringify(updatedSubs));
            }
          } catch (localErr) {
            console.error("Failed to process bulk local notifications:", localErr);
          }
        }
        count++;
      }
      setSuccess(`Successfully uploaded ${count} products!`);
      setBulkFiles([]);
      setViewMode("single");
    } catch (err: any) {
      setError(err.message || "Bulk upload failed.");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(""), 5000);
    }
  };

  // Stats derivations
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
  const incompletePricingCount = products.filter(p => isPricingIncomplete(p)).length;
  const outOfStockCount = products.filter(p => p.quantity !== undefined && p.quantity !== null && Number(p.quantity) <= 0).length;

  // Filter products for the table
  const filteredProducts = products.filter((product) => {
    // Search query matching
    const matchesSearch = 
      product.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    // Category / status filtering
    if (tableFilter === "lowStock") {
      return product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0;
    }
    if (tableFilter === "incomplete") {
      return isPricingIncomplete(product);
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto pb-20 text-slate-100 font-sans">
      
      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/40 backdrop-blur border border-slate-900 p-5 rounded-2xl flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-slate-800 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl group-hover:bg-pink-500/10 transition-colors"></div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Catalog</span>
            <span className="text-3xl font-extrabold text-white mt-1 block">{totalProducts}</span>
          </div>
          <div className="w-11 h-11 bg-pink-500/10 rounded-xl flex items-center justify-center text-pink-500 border border-pink-500/20">
            <Package size={20} />
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur border border-slate-900 p-5 rounded-2xl flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-slate-800 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Inventory</span>
            <span className="text-3xl font-extrabold text-indigo-400 mt-1 block">{totalStock} units</span>
          </div>
          <div className="w-11 h-11 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <BarChart3 size={20} />
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur border border-slate-900 p-5 rounded-2xl flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-slate-800 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors"></div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block font-bold">Incomplete Pricing</span>
            <span className={`text-3xl font-extrabold mt-1 block ${incompletePricingCount > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-300'}`}>{incompletePricingCount}</span>
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${incompletePricingCount > 0 ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'bg-slate-850 text-slate-500 border-slate-800'}`}>
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur border border-slate-900 p-5 rounded-2xl flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-slate-800 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors"></div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block font-bold">Out of Stock</span>
            <span className={`text-3xl font-extrabold mt-1 block ${outOfStockCount > 0 ? 'text-rose-500' : 'text-slate-300'}`}>{outOfStockCount}</span>
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${outOfStockCount > 0 ? 'bg-rose-500/20 text-rose-500 border-rose-500/30' : 'bg-slate-850 text-slate-500 border-slate-800'}`}>
            <Coins size={20} />
          </div>
        </div>
      </div>

      {/* Top Toggle Bar */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-900/60 p-1 rounded-xl flex space-x-1 shadow-inner border border-slate-800">
          <button 
            onClick={() => setViewMode("single")}
            className={`px-6 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === "single" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/15" : "text-slate-400 hover:text-slate-200"}`}
          >
            Inventory & Single Upload
          </button>
          <button 
            onClick={() => { setViewMode("bulk"); resetForm(); }}
            className={`px-6 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${viewMode === "bulk" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/15" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Layers size={14} />
            <span>Bulk Upload Mode</span>
          </button>
          <button 
            onClick={() => { setViewMode("alerts"); resetForm(); }}
            className={`px-6 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${viewMode === "alerts" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/15" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Bell size={14} />
            <span>Restock Alerts</span>
          </button>
        </div>
      </div>

      {success && <div className="mb-6 max-w-2xl mx-auto bg-emerald-500/10 text-emerald-400 p-4 rounded-xl border border-emerald-500/20 text-center font-bold shadow-md shadow-emerald-500/5 animate-pulse">{success}</div>}
      {error && <div className="mb-6 max-w-2xl mx-auto bg-rose-500/10 text-rose-400 p-4 rounded-xl border border-rose-500/20 text-center font-bold shadow-md shadow-rose-500/5">{error}</div>}

      {viewMode === "single" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Add/Edit Form */}
          <div className="lg:col-span-4">
            <div className="bg-slate-900/40 backdrop-blur p-6 rounded-2xl border border-slate-900 shadow-xl sticky top-6">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-3">
                <h2 className="text-base font-extrabold text-white">
                  {editingId ? "Edit Store Item" : "Create Store Item"}
                </h2>
                {editingId && (
                  <button onClick={resetForm} className="text-xs text-pink-500 font-bold hover:underline cursor-pointer">Cancel Edit</button>
                )}
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Product Photos Section at the Top */}
                <div className="border-b border-slate-900 pb-5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Product Photos (Multiple Angles)</label>
                  
                  {/* Previews Grid */}
                  {productImages.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {productImages.map((img, idx) => (
                        <div key={img.id} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center group">
                          <img src={img.preview} alt={`Angle ${idx + 1}`} className="w-full h-full object-cover" />
                          <button 
                            type="button" 
                            onClick={() => removeProductImage(img.id)}
                            className="absolute -top-1 -right-1 bg-rose-650 text-white p-0.5 rounded-full hover:bg-rose-700 opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                          {idx === 0 && (
                            <span className="absolute bottom-1 left-1 bg-pink-650 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Primary
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Drag & Drop Zone */}
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 mb-3
                      ${isDragging ? 'border-pink-500 bg-pink-500/5' : 'border-slate-850 bg-slate-950/40 hover:bg-slate-950/60'}
                    `}
                  >
                    <UploadCloud size={24} className={`mb-1 ${isDragging ? 'text-pink-500' : 'text-slate-500'}`} />
                    <p className="text-[10px] text-center text-slate-400 font-medium">Click or drag images to add photo angles</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
                  </div>

                  {/* Paste URL */}
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={pastedUrl} 
                      onChange={(e) => setPastedUrl(e.target.value)} 
                      className="flex-1 bg-slate-950/60 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500 transition-all placeholder-slate-700" 
                      placeholder="Or paste photo URL..." 
                    />
                    <button 
                      type="button"
                      onClick={addPastedUrl}
                      className="bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-350 hover:text-white transition-all cursor-pointer flex-shrink-0"
                    >
                      Add URL
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">BRAND</label>
                  <input type="text" required value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700" placeholder="e.g. LEVIS" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">TITLE</label>
                  <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700" placeholder="e.g. Men Slim Fit Jeans" />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">HOME SECTION</label>
                    <select value={homeSection} onChange={(e) => setHomeSection(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all">
                      <option value="Standard">Standard</option>
                      <option value="Flash Sale">Flash Sale</option>
                      <option value="New Arrivals">New Arrivals</option>
                      <option value="Trending">Trending</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">CATEGORY</label>
                    <input 
                      type="text" 
                      list="category-options"
                      required 
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)} 
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700" 
                      placeholder="e.g. Fashion"
                    />
                    <datalist id="category-options">
                      {availableCategories.map(c => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Stock Quantity */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Stock Quantity</label>
                  <input 
                    type="number" 
                    required 
                    min="0"
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)} 
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700" 
                    placeholder="e.g. 50" 
                  />
                </div>

                {/* Costs details breakdown */}
                <div className="bg-slate-950/30 p-4 border border-slate-900 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Pricing Breakdown Details</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Purchase Cost (₹)</label>
                      <input 
                        type="number" 
                        required
                        value={purchasePrice} 
                        onChange={(e) => setPurchasePrice(e.target.value)} 
                        className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs outline-none text-white transition-all
                          ${purchasePrice === "" ? 'border-amber-500/40 focus:border-amber-500' : 'border-slate-800 focus:border-pink-500'}`} 
                        placeholder="0" 
                      />
                      {purchasePrice === "" && <span className="text-[8px] text-amber-500 font-bold block mt-0.5">Not Entered</span>}
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Packing Fee (₹)</label>
                      <input 
                        type="number" 
                        required
                        value={packingCharges} 
                        onChange={(e) => setPackingCharges(e.target.value)} 
                        className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs outline-none text-white transition-all
                          ${packingCharges === "" ? 'border-amber-500/40 focus:border-amber-500' : 'border-slate-800 focus:border-pink-500'}`} 
                        placeholder="0" 
                      />
                      {packingCharges === "" && <span className="text-[8px] text-amber-500 font-bold block mt-0.5">Not Entered</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Courier Fee (₹)</label>
                      <input 
                        type="number" 
                        required
                        value={courierCharges} 
                        onChange={(e) => setCourierCharges(e.target.value)} 
                        className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs outline-none text-white transition-all
                          ${courierCharges === "" ? 'border-amber-500/40 focus:border-amber-500' : 'border-slate-800 focus:border-pink-500'}`} 
                        placeholder="0" 
                      />
                      {courierCharges === "" && <span className="text-[8px] text-amber-500 font-bold block mt-0.5">Not Entered</span>}
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Other Expense (₹)</label>
                      <input 
                        type="number" 
                        required
                        value={otherExpenses} 
                        onChange={(e) => setOtherExpenses(e.target.value)} 
                        className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs outline-none text-white transition-all
                          ${otherExpenses === "" ? 'border-amber-500/40 focus:border-amber-500' : 'border-slate-800 focus:border-pink-500'}`} 
                        placeholder="0" 
                      />
                      {otherExpenses === "" && <span className="text-[8px] text-amber-500 font-bold block mt-0.5">Not Entered</span>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Expected Profit (₹)</label>
                    <input 
                      type="number" 
                      required
                      value={profit} 
                      onChange={(e) => setProfit(e.target.value)} 
                      className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs outline-none text-white transition-all
                        ${profit === "" ? 'border-amber-500/40 focus:border-amber-500' : 'border-slate-800 focus:border-pink-500'}`} 
                      placeholder="0" 
                    />
                    {profit === "" && <span className="text-[8px] text-amber-500 font-bold block mt-0.5">Not Entered</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-slate-900">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">GST rate (%)</label>
                      <select value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-xs focus:border-pink-500 outline-none text-white">
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </div>
                    {/* Live Pricing Calculator Indicator Widget */}
                    <div className="flex flex-col justify-center text-right bg-[#e11d48]/5 border border-pink-500/20 p-2 rounded-lg">
                      <span className="text-[8px] font-bold text-pink-500 uppercase block tracking-wider">Selling Price</span>
                      <span className="text-sm font-extrabold text-white block mt-0.5">₹{calculatedPrice}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-900">
                  <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-extrabold py-3 rounded-xl hover:opacity-90 disabled:opacity-75 transition-all shadow-md shadow-pink-500/10 cursor-pointer text-xs uppercase tracking-wider">
                    {loading ? "SAVING..." : editingId ? "UPDATE ITEM" : "CREATE ITEM"}
                  </button>
                </div>
              </form>
            </div>

            {/* Flash Sale Settings Panel */}
            <div className="bg-slate-900/40 backdrop-blur p-6 rounded-2xl border border-slate-900 mt-6 shadow-xl">
              <h2 className="text-base font-extrabold text-white mb-4">Flash Sale Settings</h2>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">END TIME</label>
                <input 
                  type="datetime-local" 
                  value={flashSaleEnd} 
                  onChange={(e) => setFlashSaleEnd(e.target.value)} 
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all mb-4" 
                />
                <button 
                  onClick={saveFlashSaleTimer} 
                  disabled={flashSaleLoading} 
                  className="w-full bg-slate-850 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl disabled:opacity-75 transition-all cursor-pointer text-xs uppercase tracking-wider border border-slate-800"
                >
                  {flashSaleLoading ? "SAVING..." : "SET TIMER"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Product List */}
          <div className="lg:col-span-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-black text-white">Catalog Inventory ({filteredProducts.length})</h2>
              
              {/* Filters toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Search catalog..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900/60 border border-slate-800/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-pink-500/50 w-44 md:w-56 transition-all"
                  />
                </div>
                
                {/* Status Filtering tabs */}
                <div className="bg-slate-900/60 p-0.5 rounded-lg border border-slate-800 flex text-[10px] font-bold uppercase tracking-wider">
                  <button 
                    onClick={() => setTableFilter("all")}
                    className={`px-3 py-1.5 rounded cursor-pointer transition-all ${tableFilter === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setTableFilter("incomplete")}
                    className={`px-3 py-1.5 rounded cursor-pointer transition-all flex items-center gap-1 ${tableFilter === "incomplete" ? "bg-amber-500/20 text-amber-400 border border-amber-500/20" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Incomplete
                  </button>
                  <button 
                    onClick={() => setTableFilter("lowStock")}
                    className={`px-3 py-1.5 rounded cursor-pointer transition-all flex items-center gap-1 ${tableFilter === "lowStock" ? "bg-rose-500/20 text-rose-400 border border-rose-500/20" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Out Of Stock
                  </button>
                </div>
              </div>
            </div>
            
            {fetching ? (
              <div className="flex justify-center items-center py-24 bg-slate-900/20 border border-slate-900 rounded-2xl">
                <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-slate-900/20 p-12 rounded-2xl border border-slate-900 text-center text-slate-500">
                No items found matching the selected filters.
              </div>
            ) : (
              <div className="bg-slate-900/40 backdrop-blur rounded-2xl border border-slate-900 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        <th className="px-5 py-4">Item Details</th>
                        <th className="px-5 py-4">Category</th>
                        <th className="px-5 py-4">Quantity (Stock)</th>
                        <th className="px-5 py-4">Pricing Breakdown</th>
                        <th className="px-5 py-4">Selling Price</th>
                        <th className="px-5 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/50">
                      {filteredProducts.map((product) => {
                        const missingPricingFields = getMissingPricingFields(product);
                        const isPricingIncompleteStatus = missingPricingFields.length > 0;
                        const stockQuantity = Number(product.quantity || 0);

                        return (
                          <tr key={product.id} className="hover:bg-slate-900/30 transition-all group">
                            <td className="px-5 py-4">
                              <div className="flex items-center space-x-3.5">
                                <img src={product.image} alt={product.brand} className="w-9 h-11 object-cover rounded bg-slate-950 border border-slate-900 group-hover:border-slate-800 transition-all flex-shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-extrabold text-slate-100 truncate w-32 sm:w-44">{product.brand}</span>
                                  <span className="text-[10px] text-slate-400 truncate w-32 sm:w-44 mt-0.5">{product.title}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-slate-400 font-medium">{product.category}</td>
                            <td className="px-5 py-4">
                              {stockQuantity <= 0 ? (
                                <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                                  Out of Stock
                                </span>
                              ) : stockQuantity <= 5 ? (
                                <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold px-2 py-1 rounded-full">
                                  {stockQuantity} Low Stock
                                </span>
                              ) : (
                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full">
                                  {stockQuantity} available
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {isPricingIncompleteStatus ? (
                                <div className="flex flex-col gap-1">
                                  <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-full w-max flex items-center gap-1 uppercase tracking-wide animate-pulse">
                                    <AlertTriangle size={10} />
                                    Incomplete Costs
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-medium">
                                    Missing: {missingPricingFields.join(", ")}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400 font-medium space-y-0.5">
                                  <div className="flex items-center gap-1.5 text-emerald-400 text-[9px] font-bold uppercase">
                                    <CheckCircle2 size={10} /> Complete Cost Setup
                                  </div>
                                  <div className="text-[9px] text-slate-500">
                                    Buy: ₹{product.purchasePrice} | Expenses: ₹{Number(product.packingCharges || 0) + Number(product.courierCharges || 0) + Number(product.otherExpenses || 0)} | Profit: ₹{product.profit}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 font-black text-white text-sm">₹{product.price}</td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex justify-end space-x-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditClick(product)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-pink-500 rounded-lg transition-all cursor-pointer" title="Edit Item">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => handleDelete(product.id)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer" title="Delete Item">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : viewMode === "bulk" ? (
        /* BULK UPLOAD VIEW */
        <div className="max-w-4xl mx-auto">
          {/* Main Dropzone */}
          <div 
            onDragOver={handleBulkDrop}
            onDragLeave={(e) => { e.preventDefault(); setIsDraggingBulk(false); }}
            onDrop={handleBulkDrop}
            onClick={() => bulkFileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-14 flex flex-col items-center justify-center cursor-pointer transition-all mb-8
              ${isDraggingBulk ? 'border-pink-500 bg-pink-500/5 scale-[1.01]' : 'border-slate-800 bg-slate-900/20 hover:border-slate-700 hover:bg-slate-900/40'}
            `}
          >
            <UploadCloud size={52} className={`mb-3 ${isDraggingBulk ? 'text-pink-500' : 'text-slate-500'}`} />
            <h3 className="text-lg font-extrabold text-white mb-1">Drop multiple images here</h3>
            <p className="text-slate-400 text-xs font-semibold">Or click to select files from your computer</p>
            <input type="file" ref={bulkFileInputRef} onChange={handleBulkFileChange} accept="image/*" multiple className="hidden" />
          </div>

          {/* Pending List */}
          {bulkFiles.length > 0 && (
            <div className="space-y-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-extrabold text-white">Pending Upload Items ({bulkFiles.length})</h3>
                <button onClick={() => setBulkFiles([])} className="text-xs font-bold text-rose-500 hover:text-rose-450 cursor-pointer">Clear All</button>
              </div>
              
              {bulkFiles.map((item, index) => {
                const calculatedBulkPrice = 
                  Number(item.purchasePrice || 0) + 
                  Number(item.packingCharges || 0) + 
                  Number(item.courierCharges || 0) + 
                  Number(item.otherExpenses || 0) + 
                  Number(item.profit || 0);

                return (
                  <div key={index} className="bg-slate-900/40 p-5 rounded-2xl border border-slate-900 flex flex-col sm:flex-row gap-6 relative">
                    <button onClick={() => removeBulkItem(index)} className="absolute -top-2.5 -right-2.5 bg-rose-600 text-white p-1 rounded-full shadow hover:bg-rose-700 transition-colors z-10 cursor-pointer">
                      <X size={14} />
                    </button>
                    
                    {/* Image Preview */}
                    <div className="w-full sm:w-40 h-40 sm:h-auto bg-slate-950 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-850">
                      <img src={item.preview} alt={`Upload ${index}`} className="w-full h-full object-contain" />
                    </div>
                    
                    {/* Form Fields */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">BRAND *</label>
                        <input type="text" required value={item.brand} onChange={(e) => updateBulkItem(index, "brand", e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none" placeholder="e.g. LEVIS" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">TITLE *</label>
                        <input type="text" required value={item.title} onChange={(e) => updateBulkItem(index, "title", e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none" placeholder="e.g. Slim Fit Jeans" />
                      </div>
                      
                      {/* Quantity */}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">Quantity *</label>
                        <input type="number" required min="0" value={item.quantity} onChange={(e) => updateBulkItem(index, "quantity", e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none" placeholder="10" />
                      </div>

                      {/* Purchase Cost */}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">Purchase Cost (₹) *</label>
                        <input type="number" required value={item.purchasePrice} onChange={(e) => updateBulkItem(index, "purchasePrice", e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none" placeholder="0" />
                      </div>

                      {/* Packing Cost */}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">Packing charges (₹) *</label>
                        <input type="number" required value={item.packingCharges} onChange={(e) => updateBulkItem(index, "packingCharges", e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none" placeholder="0" />
                      </div>

                      {/* Courier Cost */}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">Courier charges (₹) *</label>
                        <input type="number" required value={item.courierCharges} onChange={(e) => updateBulkItem(index, "courierCharges", e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none" placeholder="0" />
                      </div>

                      {/* Other expenses */}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">Other expenses (₹) *</label>
                        <input type="number" required value={item.otherExpenses} onChange={(e) => updateBulkItem(index, "otherExpenses", e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none" placeholder="0" />
                      </div>

                      {/* Profit */}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">Profit margin (₹) *</label>
                        <input type="number" required value={item.profit} onChange={(e) => updateBulkItem(index, "profit", e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none" placeholder="0" />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">HOME SECTION</label>
                        <select value={item.homeSection} onChange={(e) => updateBulkItem(index, "homeSection", e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none">
                          <option value="Standard">Standard</option>
                          <option value="Flash Sale">Flash Sale</option>
                          <option value="New Arrivals">New Arrivals</option>
                          <option value="Trending">Trending</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">GST RATE (%)</label>
                        <select value={item.gstRate} onChange={(e) => updateBulkItem(index, "gstRate", e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none">
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">CATEGORY *</label>
                        <input 
                          type="text" 
                          list={`bulk-category-${index}`}
                          required 
                          value={item.category} 
                          onChange={(e) => updateBulkItem(index, "category", e.target.value)} 
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none" 
                          placeholder="e.g. Fashion"
                        />
                        <datalist id={`bulk-category-${index}`}>
                          {availableCategories.map(c => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>

                      {/* Display calculated price for bulk item */}
                      <div className="flex flex-col justify-center text-right bg-pink-500/5 border border-pink-500/10 p-2.5 rounded-xl">
                        <span className="text-[8px] font-bold text-pink-500 uppercase tracking-wider block">Calculated Price</span>
                        <span className="text-sm font-black text-white block mt-0.5">₹{calculatedBulkPrice}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="pt-4 sticky bottom-6 z-20">
                <button 
                  onClick={submitBulk} 
                  disabled={loading} 
                  className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-extrabold py-4 rounded-xl shadow-xl hover:opacity-95 disabled:opacity-75 transition-all text-xs uppercase tracking-wider flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>UPLOADING IMAGES & SAVING...</span>
                    </>
                  ) : (
                    <span>SAVE ALL {bulkFiles.length} PRODUCTS</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* RESTOCK ALERTS VIEW */
        <div className="bg-slate-900/40 backdrop-blur rounded-2xl border border-slate-900 overflow-hidden shadow-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Bell className="text-pink-500" size={20} />
              <span>Restock Notification Requests ({subscriptions.length})</span>
            </h2>
          </div>

          {fetchingSubs ? (
            <div className="flex justify-center items-center py-24">
              <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="p-12 text-center text-slate-550 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
              No back-in-stock notification requests found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                    <th className="px-5 py-4">Product Details</th>
                    <th className="px-5 py-4">Customer Contact</th>
                    <th className="px-5 py-4">Date Registered</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {subscriptions.map((sub) => {
                    const formattedDate = sub.createdAt ? new Date(sub.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    }) : "-";

                    return (
                      <tr key={sub.id} className="hover:bg-slate-900/30 transition-all group">
                        <td className="px-5 py-4 font-bold text-white">
                          <div className="flex flex-col">
                            <span className="text-sm font-extrabold text-slate-100">{sub.productBrand}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">{sub.productName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col text-slate-350">
                            <span className="font-semibold">{sub.email}</span>
                            {sub.phone && <span className="text-[10px] text-slate-500 mt-0.5">{sub.phone}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-450">{formattedDate}</td>
                        <td className="px-5 py-4">
                          {sub.status === "Pending" ? (
                            <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                              Pending Alert
                            </span>
                          ) : (
                            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                              ✓ Notified
                            </span>
                          )}
                          {sub.isLocal && (
                            <span className="ml-2 bg-slate-800 text-slate-400 text-[8px] font-bold px-1.5 py-0.5 rounded">
                              LOCAL TEST
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteSubscription(sub)} 
                            className="p-1.5 bg-slate-850 text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer inline-flex" 
                            title="Remove Request"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
