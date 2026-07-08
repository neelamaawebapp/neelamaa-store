"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from "firebase/firestore";
import { UploadCloud, Edit2, Trash2, X, Layers, AlertTriangle, CheckCircle2, Package, Coins, BarChart3, Search, Filter, Bell } from "lucide-react";
import { STORE_CATEGORIES, ParentCategory } from "@/lib/constants";
import ImageEditorModal from "@/components/ImageEditorModal";
import { autoAdjustImage } from "@/lib/imageUtils";

export default function AdminDashboard() {
  const [viewMode, setViewMode] = useState<"inventory" | "add-product" | "bulk">("inventory");

  // Product List State
  const [products, setProducts] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  
  // Dynamic Categories State
  const [availableCategories, setAvailableCategories] = useState<string[]>(STORE_CATEGORIES.map(c => c.name));
  const [categoriesSchema, setCategoriesSchema] = useState<ParentCategory[]>([]);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(STORE_CATEGORIES[0].name);
  const [subCategory, setSubCategory] = useState("");
  const [homeSection, setHomeSection] = useState("Standard");
  const [gstRate, setGstRate] = useState("18");
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [skuEdited, setSkuEdited] = useState(false);
  
  // Migration State
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState("");
  
  // Pricing & Stock Fields
  const [quantity, setQuantity] = useState("");
  const [sizesInventory, setSizesInventory] = useState({
    S: "",
    M: "",
    L: "",
    XL: "",
    XXL: ""
  });
  const [mrp, setMrp] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [packingCharges, setPackingCharges] = useState("");
  const [courierCharges, setCourierCharges] = useState("");
  const [otherExpenses, setOtherExpenses] = useState("");
  const [profit, setProfit] = useState("");

  // Flexible Model Extensions
  const [sku, setSku] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [status, setStatus] = useState("Active");
  const [countryOfOrigin, setCountryOfOrigin] = useState("India");
  const [manufacturer, setManufacturer] = useState("");
  const [packer, setPacker] = useState("");
  const [hsnCode, setHsnCode] = useState("");

  // SEO Settings
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [slug, setSlug] = useState("");

  // Shipping Specs
  const [packageWeight, setPackageWeight] = useState("");
  const [packageLength, setPackageLength] = useState("");
  const [packageWidth, setPackageWidth] = useState("");
  const [packageHeight, setPackageHeight] = useState("");

  // Dynamic Attributes
  const [attributeRows, setAttributeRows] = useState<{ name: string; value: string }[]>([]);

  // Base Product Options
  const [size, setSize] = useState("");
  const [sizeUnit, setSizeUnit] = useState("");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");

  // Variants Manager
  const [hasVariants, setHasVariants] = useState(false);
  const [variantRows, setVariantRows] = useState<{
    id: string;
    size: string;
    sizeUnit: string;
    color: string;
    material: string;
    price: string;
    mrp: string;
    stock: string;
    sku: string;
    image: string;
  }[]>([]);
  const [uploadingVariantIdx, setUploadingVariantIdx] = useState<number | null>(null);

  const handleVariantImageChange = async (idx: number, file: File) => {
    if (!file) return;
    setUploadingVariantIdx(idx);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const newVars = [...variantRows];
        newVars[idx].image = data.data.url;
        setVariantRows(newVars);
      } else {
        alert("Image upload failed: " + (data.error?.message || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading image");
    } finally {
      setUploadingVariantIdx(null);
    }
  };
  
  // Search and Filters for product table
  const [searchQuery, setSearchQuery] = useState("");
  const [tableFilter, setTableFilter] = useState<"all" | "lowStock" | "incomplete">("all");

  // Flash Sale State
  const [flashSaleStart, setFlashSaleStart] = useState("");
  const [flashSaleEnd, setFlashSaleEnd] = useState("");
  const [flashSaleLoading, setFlashSaleLoading] = useState(false);

  // Promo Ticker State
  const [promoMessages, setPromoMessages] = useState<string[]>([
    "⚡ Mid-Season Sale: FLAT 50% OFF! Code: CRAFTSTYLE50 ⚡",
    "✨ Explore Craft Style's New Arrivals: Fresh Styles Daily ✨",
    "💫 CRAFT STYLE: Indulge in Premium Luxury Fashion 💫"
  ]);
  const [promoLoading, setPromoLoading] = useState(false);

  // Global Discount State
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountLoading, setDiscountLoading] = useState(false);
  
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

  // CSV Bulk Upload States
  const [bulkSubMode, setBulkSubMode] = useState<"csv" | "images">("csv");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImages, setCsvImages] = useState<File[]>([]);
  const [csvIsUploading, setCsvIsUploading] = useState(false);
  const [csvUploadProgress, setCsvUploadProgress] = useState(0);
  const [csvTotalRows, setCsvTotalRows] = useState(0);
  const [csvCurrentRow, setCsvCurrentRow] = useState(0);
  const [csvLogs, setCsvLogs] = useState<string[]>([]);

  // Image Editor States
  const [editingImageIdx, setEditingImageIdx] = useState<number | null>(null);
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);
  const [isEditingBulkImage, setIsEditingBulkImage] = useState(false);
  const [cropQueue, setCropQueue] = useState<{ file: File; isBulk: boolean }[]>([]);

  const startCropQueue = (files: File[], isBulk: boolean) => {
    const queueItems = files.map(file => ({ file, isBulk }));
    setCropQueue(prev => {
      const newQueue = [...prev, ...queueItems];
      if (prev.length === 0) {
        setEditorImageUrl(URL.createObjectURL(newQueue[0].file));
        setIsEditingBulkImage(newQueue[0].isBulk);
        setEditingImageIdx(0);
      }
      return newQueue;
    });
  };

  const handleSaveEditedImage = async (editedFile: File, editedDataUrl: string) => {
    const optimizedFile = editedFile;
    const optimizedDataUrl = editedDataUrl;

    if (cropQueue.length > 0) {
      const currentItem = cropQueue[0];
      if (currentItem.isBulk) {
        setBulkFiles(prev => [
          ...prev,
          {
            file: optimizedFile,
            preview: optimizedDataUrl,
            brand: "",
            title: "",
            quantity: "10",
            mrp: "",
            purchasePrice: "",
            packingCharges: "",
            courierCharges: "",
            otherExpenses: "",
            profit: "",
            category: availableCategories[0] || STORE_CATEGORIES[0].name,
            homeSection: "Standard",
            gstRate: "18"
          }
        ]);
      } else {
        setProductImages(prev => [
          ...prev,
          {
            id: `img_${Date.now()}_${Math.random()}`,
            file: optimizedFile,
            url: "",
            preview: optimizedDataUrl
          }
        ]);
      }

      const nextQueue = cropQueue.slice(1);
      setCropQueue(nextQueue);

      if (nextQueue.length > 0) {
        setEditorImageUrl(URL.createObjectURL(nextQueue[0].file));
        setIsEditingBulkImage(nextQueue[0].isBulk);
        setEditingImageIdx(0);
      } else {
        setEditingImageIdx(null);
        setEditorImageUrl(null);
        setIsEditingBulkImage(false);
      }
    } else {
      if (editingImageIdx === null) return;
      if (isEditingBulkImage) {
        setBulkFiles(prev => {
          const updated = [...prev];
          updated[editingImageIdx] = {
            ...updated[editingImageIdx],
            file: optimizedFile,
            preview: optimizedDataUrl
          };
          return updated;
        });
      } else {
        setProductImages(prev => {
          const updated = [...prev];
          updated[editingImageIdx] = {
            ...updated[editingImageIdx],
            file: optimizedFile,
            preview: optimizedDataUrl,
            url: ""
          };
          return updated;
        });
      }
      setEditingImageIdx(null);
      setEditorImageUrl(null);
      setIsEditingBulkImage(false);
    }
  };

  const handleCloseEditor = () => {
    if (cropQueue.length > 0) {
      const nextQueue = cropQueue.slice(1);
      setCropQueue(nextQueue);
      if (nextQueue.length > 0) {
        setEditorImageUrl(URL.createObjectURL(nextQueue[0].file));
        setIsEditingBulkImage(nextQueue[0].isBulk);
        setEditingImageIdx(0);
      } else {
        setEditingImageIdx(null);
        setEditorImageUrl(null);
        setIsEditingBulkImage(false);
      }
    } else {
      setEditingImageIdx(null);
      setEditorImageUrl(null);
      setIsEditingBulkImage(false);
    }
  };

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
    mrp: string;
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

    // Fetch Categories and other settings
    import("firebase/firestore").then(({ getDoc, doc }) => {
      getDoc(doc(db, "settings", "categories")).then((snap) => {
        if (snap.exists() && snap.data().data) {
          const data = snap.data().data;
          if (Array.isArray(data) && data.length > 0 && "subCategories" in data[0]) {
            setCategoriesSchema(data);
            setAvailableCategories(data.map((c: any) => c.name));
            return;
          }
        }
        setCategoriesSchema(STORE_CATEGORIES);
        setAvailableCategories(STORE_CATEGORIES.map(c => c.name));
      });
      // Fetch Flash Sale Setting
      getDoc(doc(db, "settings", "flashSale")).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.startTime) {
            const date = data.startTime.toDate();
            const offset = date.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
            setFlashSaleStart(localISOTime);
          }
          if (data.endTime) {
            const date = data.endTime.toDate();
            const offset = date.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
            setFlashSaleEnd(localISOTime);
          }
        }
      });
      // Fetch Promo Ticker Setting
      getDoc(doc(db, "settings", "promoTicker")).then((snap) => {
        if (snap.exists() && snap.data().messages) {
          setPromoMessages(snap.data().messages);
        }
      });
      // Fetch Store Discount
      getDoc(doc(db, "settings", "discount")).then((snap) => {
        if (snap.exists() && typeof snap.data().percent === "number") {
          setDiscountPercent(snap.data().percent);
        }
      });
    });

    return () => unsubscribe();
  }, []);



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

  const handleSizeInventoryChange = (size: string, value: string) => {
    setSizesInventory(prev => {
      const updated = { ...prev, [size]: value };
      const total = Object.values(updated).reduce((sum, val) => sum + Number(val || 0), 0);
      setQuantity(total.toString());
      return updated;
    });
  };

  // Form calculated values
  const calculatedPrice = 
    Number(purchasePrice || 0) + 
    Number(packingCharges || 0) + 
    Number(courierCharges || 0) + 
    Number(otherExpenses || 0) + 
    Number(profit || 0);

  const saveFlashSaleTimer = async () => {
    if (!flashSaleStart || !flashSaleEnd) {
      alert("Please set both start and end times.");
      return;
    }
    const startObj = new Date(flashSaleStart);
    const endObj = new Date(flashSaleEnd);
    if (endObj <= startObj) {
      alert("End time must be after start time.");
      return;
    }
    setFlashSaleLoading(true);
    try {
      const { doc, setDoc, Timestamp } = await import("firebase/firestore");
      await setDoc(doc(db, "settings", "flashSale"), {
        startTime: Timestamp.fromDate(startObj),
        endTime: Timestamp.fromDate(endObj)
      });
      setSuccess("Flash sale timer updated!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update flash sale timer");
    } finally {
      setFlashSaleLoading(false);
    }
  };

  const updatePromoMessage = (index: number, val: string) => {
    setPromoMessages(prev => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
  };

  const savePromoTicker = async () => {
    setPromoLoading(true);
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      const cleaned = promoMessages.map(m => m.trim()).filter(Boolean);
      if (cleaned.length === 0) {
        throw new Error("Must provide at least one promotional message");
      }
      await setDoc(doc(db, "settings", "promoTicker"), {
        messages: cleaned
      });
      setSuccess("Promo ticker updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update promo ticker");
    } finally {
      setPromoLoading(false);
    }
  };

  const saveStoreDiscount = async () => {
    setDiscountLoading(true);
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "settings", "discount"), {
        percent: Number(discountPercent)
      });
      setSuccess("Store-wide discount updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update store-wide discount");
    } finally {
      setDiscountLoading(false);
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

  const handleMultipleFileSelection = async (files: File[]) => {
    setLoading(true);
    setError("");
    try {
      const adjustedFiles = await Promise.all(
        files.map(file => autoAdjustImage(file, 3 / 4))
      );
      
      const newImages = adjustedFiles.map(file => ({
        id: `img_${Date.now()}_${Math.random()}`,
        file: file,
        url: "",
        preview: URL.createObjectURL(file)
      }));
      
      setProductImages(prev => [...prev, ...newImages]);
    } catch (err) {
      console.error("Failed to auto-adjust images:", err);
      setError("Failed to automatically adjust some image files.");
    } finally {
      setLoading(false);
    }
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

  // Auto-generate SKU when brand or category changes (only for new products, if SKU was not manually edited)
  useEffect(() => {
    if (!editingId && !skuEdited) {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const b = brand ? brand.trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "") : "CS";
      const c = category ? category.trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "") : "GEN";
      setSku(`${b || "CS"}-${c || "GEN"}-${randomNum}`);
    }
  }, [brand, category, editingId, skuEdited]);

  const handleMigrateProducts = async () => {
    if (!confirm("Are you sure you want to migrate all current products in the database? This will update their category and subCategory fields based on the new schema.")) {
      return;
    }
    setMigrating(true);
    setMigrationStatus("Migrating database products...");
    try {
      const { getDocs, collection, updateDoc, doc: firestoreDoc } = await import("firebase/firestore");
      const snap = await getDocs(collection(db, "products"));
      let count = 0;
      
      for (const productDoc of snap.docs) {
        const data = productDoc.data();
        const oldCategory = data.category || "";
        
        let newCategory = oldCategory;
        let newSubCategory = data.subCategory || "";
        
        const lowerCat = oldCategory.toLowerCase().trim();
        if (lowerCat === "mdf crafts") {
          newCategory = "Home Decor";
          newSubCategory = "MDF Designs";
        } else if (lowerCat === "fashion") {
          newCategory = "Lifestyle & Fashion";
          newSubCategory = "Women’s Apparel";
        } else if (lowerCat === "diy" || lowerCat === "paper craft") {
          newCategory = "Hobby & Crafts";
          newSubCategory = "DIY Products";
        }
        
        if (newCategory !== oldCategory || newSubCategory !== data.subCategory) {
          const docRef = firestoreDoc(db, "products", productDoc.id);
          await updateDoc(docRef, {
            category: newCategory,
            subCategory: newSubCategory
          });
          count++;
        }
      }
      setMigrationStatus(`Successfully migrated ${count} products!`);
    } catch (e: any) {
      console.error(e);
      setMigrationStatus(`Migration failed: ${e.message}`);
    } finally {
      setMigrating(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setBrand("");
    setTitle("");
    setQuantity("");
    setSizesInventory({ S: "", M: "", L: "", XL: "", XXL: "" });
    setMrp("");
    setPurchasePrice("");
    setPackingCharges("");
    setCourierCharges("");
    setOtherExpenses("");
    setProfit("");
    setCategory(categoriesSchema[0]?.name || STORE_CATEGORIES[0].name);
    setSubCategory(categoriesSchema[0]?.subCategories[0]?.name || "");
    setHomeSection("Standard");
    setGstRate("18");
    setProductImages([]);
    setPastedUrl("");
    setSku("");
    setSkuEdited(false);
    setIsAddingNewCategory(false);
    setNewCategoryName("");
    setMigrationStatus("");
    setShortDescription("");
    setFullDescription("");
    setStatus("Active");
    setCountryOfOrigin("India");
    setManufacturer("");
    setPacker("");
    setHsnCode("");
    setMetaTitle("");
    setMetaDescription("");
    setKeywords("");
    setSlug("");
    setPackageWeight("");
    setPackageLength("");
    setPackageWidth("");
    setPackageHeight("");
    setAttributeRows([]);
    setHasVariants(false);
    setVariantRows([]);
    setSize("");
    setSizeUnit("");
    setColor("");
    setMaterial("");
  };

  const handleEditClick = (product: any) => {
    setViewMode("add-product");
    setEditingId(product.id);
    setBrand(product.brand || "");
    setTitle(product.title || "");
    setCategory(product.category || STORE_CATEGORIES[0].name);
    setSubCategory(product.subCategory || "");
    setHomeSection(product.homeSection || "Standard");
    setGstRate(product.gstRate?.toString() || "18");
    
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

    setQuantity(product.quantity !== undefined && product.quantity !== null ? product.quantity.toString() : "");
    if (product.sizesInventory) {
      setSizesInventory({
        S: product.sizesInventory.S !== undefined ? product.sizesInventory.S.toString() : "",
        M: product.sizesInventory.M !== undefined ? product.sizesInventory.M.toString() : "",
        L: product.sizesInventory.L !== undefined ? product.sizesInventory.L.toString() : "",
        XL: product.sizesInventory.XL !== undefined ? product.sizesInventory.XL.toString() : "",
        XXL: product.sizesInventory.XXL !== undefined ? product.sizesInventory.XXL.toString() : "",
      });
    } else {
      setSizesInventory({ S: "", M: "", L: "", XL: "", XXL: "" });
    }
    setMrp(product.mrp !== undefined && product.mrp !== null ? product.mrp.toString() : "");
    setPurchasePrice(product.purchasePrice !== undefined && product.purchasePrice !== null ? product.purchasePrice.toString() : "");
    setPackingCharges(product.packingCharges !== undefined && product.packingCharges !== null ? product.packingCharges.toString() : "");
    setCourierCharges(product.courierCharges !== undefined && product.courierCharges !== null ? product.courierCharges.toString() : "");
    setOtherExpenses(product.otherExpenses !== undefined && product.otherExpenses !== null ? product.otherExpenses.toString() : "");
    setProfit(product.profit !== undefined && product.profit !== null ? product.profit.toString() : "");

    setSku(product.sku || "");
    setSkuEdited(true);
    setShortDescription(product.shortDescription || "");
    setFullDescription(product.fullDescription || "");
    setStatus(product.status || "Active");
    setCountryOfOrigin(product.countryOfOrigin || "India");
    setManufacturer(product.manufacturer || "");
    setPacker(product.packer || "");
    setHsnCode(product.hsnCode || "");

    const seo = product.seo || {};
    setMetaTitle(seo.metaTitle || "");
    setMetaDescription(seo.metaDescription || "");
    setKeywords(seo.keywords || "");
    setSlug(seo.slug || "");

    const shipping = product.shipping || {};
    setPackageWeight(shipping.packageWeight !== undefined ? shipping.packageWeight.toString() : "");
    setPackageLength(shipping.packageLength !== undefined ? shipping.packageLength.toString() : "");
    setPackageWidth(shipping.packageWidth !== undefined ? shipping.packageWidth.toString() : "");
    setPackageHeight(shipping.packageHeight !== undefined ? shipping.packageHeight.toString() : "");

    if (product.attributes && typeof product.attributes === "object") {
      setAttributeRows(Object.entries(product.attributes).map(([k, v]: any) => ({
        name: k,
        value: v.toString()
      })));
    } else {
      setAttributeRows([]);
    }

    if (product.variants && Array.isArray(product.variants)) {
      setHasVariants(true);
      setVariantRows(product.variants.map((v: any, index: number) => ({
        id: v.id || `var_${Date.now()}_${index}_${Math.random()}`,
        size: v.size || "",
        sizeUnit: v.sizeUnit || "",
        color: v.color || "",
        material: v.material || "",
        price: v.price !== undefined ? v.price.toString() : "",
        mrp: v.mrp !== undefined ? v.mrp.toString() : "",
        stock: v.stock !== undefined ? v.stock.toString() : "",
        sku: v.sku || "",
        image: v.image || ""
      })));
    } else {
      setHasVariants(false);
      setVariantRows([]);
    }

    setSize(product.size || "");
    setSizeUnit(product.sizeUnit || "");
    setColor(product.color || "");
    setMaterial(product.material || "");
    
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

      const attributesObj: any = {};
      attributeRows.forEach(row => {
        if (row.name.trim()) {
          attributesObj[row.name.trim()] = row.value.trim();
        }
      });

      const variantsList = variantRows.map((v, index) => ({
        id: v.id || `var_${Date.now()}_${index}_${Math.random()}`,
        size: v.size.trim(),
        sizeUnit: v.sizeUnit || "",
        color: v.color.trim(),
        material: v.material.trim(),
        price: Number(v.price || 0),
        mrp: Number(v.mrp || 0),
        stock: Number(v.stock || 0),
        sku: v.sku.trim(),
        image: v.image || ""
      })).filter(v => v.size || v.color || v.material);

      if (hasVariants) {
        if (variantsList.length === 0) {
          throw new Error("Please add at least one variant if Variants are enabled.");
        }
        for (const v of variantsList) {
          if (v.price <= 0 || v.mrp <= 0) {
            throw new Error(`Variant sizes/colors must have valid pricing and MRP.`);
          }
          if (v.mrp < v.price) {
            throw new Error(`MRP cannot be less than Selling Price for variant (${v.size} / ${v.color} / ${v.material}).`);
          }
        }
      } else {
        if (mrp !== "" && Number(mrp) < calculatedPrice) {
          throw new Error("Maximum Retail Price (MRP) cannot be less than the calculated Selling Price (₹" + calculatedPrice + ").");
        }
      }

      const productData: any = {
        brand,
        title,
        price: calculatedPrice,
        mrp: mrp !== "" ? Number(mrp) : null,
        purchasePrice: purchasePrice !== "" ? Number(purchasePrice) : null,
        packingCharges: packingCharges !== "" ? Number(packingCharges) : null,
        courierCharges: courierCharges !== "" ? Number(courierCharges) : null,
        otherExpenses: otherExpenses !== "" ? Number(otherExpenses) : null,
        profit: profit !== "" ? Number(profit) : null,
        quantity: quantity !== "" ? Number(quantity) : 0,
        size: size.trim(),
        sizeUnit: sizeUnit,
        color: color.trim(),
        material: material.trim(),
        category,
        subCategory,
        homeSection,
        gstRate: Number(gstRate),
        image: primaryImage, // For backwards compatibility
        images: uploadedUrls, // The full array of angles!
        
        // Flexible model fields
        sku: sku.trim() || `${brand ? brand.trim().substring(0, 3).toUpperCase() : "CS"}-${category ? category.trim().substring(0, 3).toUpperCase() : "GEN"}-${Math.floor(100000 + Math.random() * 900000)}`,
        shortDescription: shortDescription.trim(),
        fullDescription: fullDescription.trim(),
        status,
        countryOfOrigin: countryOfOrigin.trim(),
        manufacturer: manufacturer.trim(),
        packer: packer.trim(),
        hsnCode: hsnCode.trim(),
        seo: {
          metaTitle: metaTitle.trim(),
          metaDescription: metaDescription.trim(),
          keywords: keywords.trim(),
          slug: slug.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
        },
        shipping: {
          packageWeight: packageWeight !== "" ? Number(packageWeight) : null,
          packageLength: packageLength !== "" ? Number(packageLength) : null,
          packageWidth: packageWidth !== "" ? Number(packageWidth) : null,
          packageHeight: packageHeight !== "" ? Number(packageHeight) : null
        },
        attributes: attributesObj,
        variants: hasVariants && variantsList.length > 0 ? variantsList : null
      };

      if (category.toLowerCase() === "fashion") {
        if (hasVariants && variantsList.length > 0) {
          const legacySizes: any = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
          variantsList.forEach(v => {
            const sizeKey = v.size.toUpperCase();
            if (sizeKey in legacySizes) {
              legacySizes[sizeKey] += v.stock;
            }
          });
          productData.sizesInventory = legacySizes;
          productData.quantity = Object.values(legacySizes).reduce((a: number, b: any) => a + b, 0) as number;
        } else {
          productData.sizesInventory = {
            S: Number(sizesInventory.S || 0),
            M: Number(sizesInventory.M || 0),
            L: Number(sizesInventory.L || 0),
            XL: Number(sizesInventory.XL || 0),
            XXL: Number(sizesInventory.XXL || 0)
          };
          productData.quantity = Object.values(productData.sizesInventory).reduce((a: number, b: any) => a + Number(b), 0);
        }
      }

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
          const localSubs = JSON.parse(localStorage.getItem("craftstyle_stock_subscriptions") || "[]");
          const pendingSubs = localSubs.filter((s: any) => s.productId === savedProductId && s.status === "Pending");
          
          if (pendingSubs.length > 0) {
            const localNotifications = JSON.parse(localStorage.getItem("craftstyle_local_notifications") || "[]");
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
            localStorage.setItem("craftstyle_local_notifications", JSON.stringify(localNotifications));

            const updatedSubs = localSubs.map((s: any) => {
              if (s.productId === savedProductId && s.status === "Pending") {
                return { ...s, status: "Notified", notifiedAt: new Date().toISOString() };
              }
              return s;
            });
            localStorage.setItem("craftstyle_stock_subscriptions", JSON.stringify(updatedSubs));
          }
        } catch (localErr) {
          console.error("Failed to process local restock notifications:", localErr);
        }
      }

      resetForm();
      setViewMode("inventory");
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

  const handleBulkFiles = async (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith("image/"));
    if (validFiles.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const adjustedFiles = await Promise.all(
        validFiles.map(file => autoAdjustImage(file, 3 / 4))
      );
      
      const newItems = adjustedFiles.map(file => ({
        file: file,
        preview: URL.createObjectURL(file),
        brand: "",
        title: "",
        quantity: "10",
        mrp: "",
        purchasePrice: "",
        packingCharges: "",
        courierCharges: "",
        otherExpenses: "",
        profit: "",
        category: availableCategories[0] || STORE_CATEGORIES[0].name,
        homeSection: "Standard",
        gstRate: "18"
      }));
      
      setBulkFiles(prev => [...prev, ...newItems]);
    } catch (err) {
      console.error("Failed to auto-adjust bulk images:", err);
      setError("Failed to automatically adjust some bulk images.");
    } finally {
      setLoading(false);
    }
  };

  const updateBulkItem = (index: number, field: string, value: string) => {
    const newItems = [...bulkFiles];
    newItems[index] = { ...newItems[index], [field]: value } as any;
    setBulkFiles(newItems);
  };

  const removeBulkItem = (index: number) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== index));
  };

  const downloadCSVTemplate = () => {
    const headers = [
      "Brand",
      "Title",
      "Price",
      "MRP",
      "Quantity",
      "Category",
      "SubCategory",
      "ShortDescription",
      "FullDescription",
      "Size",
      "SizeUnit",
      "Color",
      "Material",
      "ImageFileNames",
      "SKU",
      "HSNCode",
      "CountryOfOrigin"
    ];
    const sampleRow = [
      "Neelamaa",
      "Premium Stainless Steel Water Bottle 900ml",
      "499",
      "899",
      "50",
      "Home",
      "Kitchen",
      "• Lightweight steel bottle won't weigh down your bag\n• Wide mouth opening makes cleaning effortless",
      "• High-Quality Stainless Steel – Made from durable rust-resistant material.\n• Odour-Free & Safe – Food-grade steel.",
      "900",
      "ml",
      "Silver",
      "Stainless Steel",
      "bottle_front.jpg, bottle_side.jpg",
      "NMA-BOT-900",
      "7323",
      "India"
    ];
    
    const formatCSVRow = (arr: string[]) => 
      arr.map(val => `"${val.replace(/"/g, '""')}"`).join(",");
      
    const csvContent = "\uFEFF" + [formatCSVRow(headers), formatCSVRow(sampleRow)].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "products_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push("");
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  const handleBulkCsvUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      setError("Please select a CSV file.");
      return;
    }
    
    const log = (msg: string) => {
      setCsvLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };
    
    setCsvIsUploading(true);
    setCsvLogs([]);
    setError("");
    setSuccess("");
    
    try {
      const text = await csvFile.text();
      const rows = parseCSV(text);
      if (rows.length <= 1) {
        setError("The CSV file is empty or only contains headers.");
        setCsvIsUploading(false);
        return;
      }
      
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const dataRows = rows.slice(1);
      
      setCsvTotalRows(dataRows.length);
      setCsvCurrentRow(0);
      setCsvUploadProgress(0);
      
      log(`Found ${dataRows.length} products to process in CSV.`);
      
      let successCount = 0;
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row.length === 0 || row.join("").trim() === "") {
          log(`Skipping empty row ${i + 2}`);
          continue;
        }
        
        setCsvCurrentRow(i + 1);
        setCsvUploadProgress(Math.round(((i) / dataRows.length) * 100));
        
        const getVal = (headerName: string) => {
          const idx = headers.indexOf(headerName.toLowerCase());
          return idx !== -1 ? row[idx] : "";
        };
        
        const rowBrand = getVal("brand");
        const rowTitle = getVal("title");
        const rowPrice = getVal("price");
        const rowMrp = getVal("mrp");
        const rowQuantity = getVal("quantity");
        const rowCategory = getVal("category");
        const rowSubCategory = getVal("subcategory");
        const rowShortDesc = getVal("shortdescription");
        const rowFullDesc = getVal("fulldescription");
        const rowSize = getVal("size");
        const rowSizeUnit = getVal("sizeunit");
        const rowColor = getVal("color");
        const rowMaterial = getVal("material");
        const rowImageFileNames = getVal("imagefilenames");
        const rowSku = getVal("sku");
        const rowHsn = getVal("hsncode");
        const rowOrigin = getVal("countryoforigin");
        
        if (!rowBrand || !rowTitle || !rowPrice) {
          log(`Row ${i + 2}: Skipping - Brand, Title, and Price are required.`);
          continue;
        }
        
        log(`Processing "${rowBrand} - ${rowTitle}"...`);
        
        const imageList = rowImageFileNames
          .split(",")
          .map(name => name.trim())
          .filter(Boolean);
          
        const uploadedUrls: string[] = [];
        
        for (const filename of imageList) {
          const matchedFile = csvImages.find(f => f.name.toLowerCase() === filename.toLowerCase());
          if (matchedFile) {
            log(`Compressing and uploading image "${filename}"...`);
            try {
              const adjustedFile = await autoAdjustImage(matchedFile, 3 / 4);
              const formData = new FormData();
              formData.append("image", adjustedFile);
              
              const uploadRes = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
                method: "POST",
                body: formData
              });
              const uploadData = await uploadRes.json();
              if (uploadData.success) {
                uploadedUrls.push(uploadData.data.url);
              } else {
                log(`Failed uploading image "${filename}": ${uploadData.error?.message || "Unknown error"}`);
              }
            } catch (err) {
              log(`Error uploading image "${filename}": ${err instanceof Error ? err.message : String(err)}`);
            }
          } else {
            log(`Warning: Local image file "${filename}" not found in selected photos.`);
          }
        }
        
        const priceNum = Number(rowPrice);
        const mrpNum = rowMrp ? Number(rowMrp) : Math.round(priceNum * 1.5);
        
        const docData = {
          brand: rowBrand.trim(),
          title: rowTitle.trim(),
          category: rowCategory.trim() || availableCategories[0] || "Home",
          subCategory: rowSubCategory.trim(),
          homeSection: "Standard",
          gstRate: 18,
          price: priceNum,
          mrp: mrpNum,
          quantity: Number(rowQuantity) || 0,
          purchasePrice: null,
          packingCharges: null,
          courierCharges: null,
          otherExpenses: null,
          profit: null,
          sku: rowSku.trim(),
          shortDescription: rowShortDesc.trim(),
          fullDescription: rowFullDesc.trim(),
          status: "Active",
          countryOfOrigin: rowOrigin.trim() || "India",
          manufacturer: "",
          packer: "",
          hsnCode: rowHsn.trim(),
          metaTitle: "",
          metaDescription: "",
          keywords: "",
          slug: "",
          shipping: { weight: null, length: null, width: null, height: null },
          size: rowSize.trim(),
          sizeUnit: rowSizeUnit.trim(),
          color: rowColor.trim(),
          material: rowMaterial.trim(),
          hasVariants: false,
          variants: [],
          images: uploadedUrls,
          image: uploadedUrls[0] || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await addDoc(collection(db, "products"), docData);
        log(`Product "${rowTitle}" added successfully!`);
        successCount++;
      }
      
      setCsvUploadProgress(100);
      setSuccess(`Bulk upload complete! Successfully added ${successCount} products.`);
      log(`Bulk upload finished! Total added: ${successCount}`);
      setCsvFile(null);
    } catch (err) {
      console.error(err);
      setError("An error occurred during bulk parsing or uploading.");
      log(`Fatal Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCsvIsUploading(false);
    }
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

        const isFashion = item.category?.toLowerCase() === "fashion";
        const itemQuantity = Number(item.quantity || 0);

        if (item.mrp && Number(item.mrp) < calculatedBulkPrice) {
          throw new Error(`MRP (₹${item.mrp}) for "${item.brand} - ${item.title}" cannot be less than calculated Selling Price (₹${calculatedBulkPrice})`);
        }

        const docData: any = {
          brand: item.brand,
          title: item.title,
          price: calculatedBulkPrice,
          mrp: item.mrp ? Number(item.mrp) : Math.round(calculatedBulkPrice * 1.5),
          purchasePrice: Number(item.purchasePrice),
          packingCharges: Number(item.packingCharges),
          courierCharges: Number(item.courierCharges),
          otherExpenses: Number(item.otherExpenses),
          profit: Number(item.profit),
          quantity: itemQuantity,
          category: item.category,
          homeSection: item.homeSection,
          gstRate: Number(item.gstRate),
          image: finalUrl,
          sku: `${item.brand ? item.brand.trim().substring(0, 3).toUpperCase() : "CS"}-${item.category ? item.category.trim().substring(0, 3).toUpperCase() : "GEN"}-${Math.floor(100000 + Math.random() * 900000)}`,
          createdAt: serverTimestamp(),
        };

        if (isFashion) {
          const baseQty = Math.floor(itemQuantity / 5);
          const remainder = itemQuantity % 5;
          docData.sizesInventory = {
            S: baseQty,
            M: baseQty,
            L: baseQty + remainder,
            XL: baseQty,
            XXL: baseQty
          };
        }

        const docRef = await addDoc(collection(db, "products"), docData);

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
            const localSubs = JSON.parse(localStorage.getItem("craftstyle_stock_subscriptions") || "[]");
            const pendingSubs = localSubs.filter((s: any) => s.productId === docRef.id && s.status === "Pending");
            if (pendingSubs.length > 0) {
              const localNotifications = JSON.parse(localStorage.getItem("craftstyle_local_notifications") || "[]");
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
              localStorage.setItem("craftstyle_local_notifications", JSON.stringify(localNotifications));

              const updatedSubs = localSubs.map((s: any) => {
                if (s.productId === docRef.id && s.status === "Pending") {
                  return { ...s, status: "Notified", notifiedAt: new Date().toISOString() };
                }
                return s;
              });
              localStorage.setItem("craftstyle_stock_subscriptions", JSON.stringify(updatedSubs));
            }
          } catch (localErr) {
            console.error("Failed to process bulk local notifications:", localErr);
          }
        }
        count++;
      }
      setSuccess(`Successfully uploaded ${count} products!`);
      setBulkFiles([]);
      setViewMode("inventory");
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
        <div className="bg-slate-900/60 p-1 rounded-xl flex space-x-1 shadow-inner border border-slate-800 tracking-wider font-semibold uppercase text-[10px]">
          <button 
            onClick={() => setViewMode("inventory")}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === "inventory" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/15" : "text-slate-400 hover:text-slate-200"}`}
          >
            Catalog Inventory
          </button>
          <button 
            onClick={() => { setViewMode("add-product"); resetForm(); }}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === "add-product" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/15" : "text-slate-400 hover:text-slate-200"}`}
          >
            {editingId ? "Edit Store Item" : "Add Store Item"}
          </button>
          <button 
            onClick={() => { setViewMode("bulk"); resetForm(); }}
            className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${viewMode === "bulk" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/15" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Layers size={14} />
            <span>Bulk Upload Mode</span>
          </button>
        </div>
      </div>

      {success && <div className="mb-6 max-w-2xl mx-auto bg-emerald-500/10 text-emerald-400 p-4 rounded-xl border border-emerald-500/20 text-center font-bold shadow-md shadow-emerald-500/5 animate-pulse">{success}</div>}
      {error && <div className="mb-6 max-w-2xl mx-auto bg-rose-500/10 text-rose-400 p-4 rounded-xl border border-rose-500/20 text-center font-bold shadow-md shadow-rose-500/5">{error}</div>}

      {/* Database Category Migration Utility */}
      <div className="mb-8 max-w-2xl mx-auto bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 shadow-md">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start space-x-3 text-left">
            <div className="p-2 bg-pink-500/10 text-pink-500 rounded-lg border border-pink-500/20 mt-1 flex-shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Category Database Migration Utility</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Automatically maps legacy category names (e.g. "DIY", "MDF Crafts", "Fashion") to the new hierarchical parent-sub category structure for all products currently in the database.
              </p>
              {migrationStatus && (
                <div className={`mt-2.5 p-2 rounded-lg text-xs font-bold ${migrationStatus.includes("Successfully") ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-950 text-slate-350"}`}>
                  {migrationStatus}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleMigrateProducts}
            disabled={migrating}
            className="w-full sm:w-auto bg-slate-800 hover:bg-pink-600 active:scale-[0.98] text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all border border-slate-700 hover:border-pink-500/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {migrating ? "Migrating..." : "Run Migration"}
          </button>
        </div>
      </div>

      {viewMode !== "bulk" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Add/Edit Form */}
          {viewMode === "add-product" && (
            <div className="lg:col-span-8">
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
                        <div key={img.id} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex flex-col justify-end shadow-md hover:border-pink-500/30 transition-all">
                          <img src={img.preview} alt={`Angle ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                          
                          {/* Dark overlay for actions */}
                          <div className="absolute inset-0 bg-black/45 flex flex-col justify-between p-1.5 opacity-100 transition-opacity">
                            {/* Top row: Delete */}
                            <div className="flex justify-between items-center w-full">
                              {idx === 0 ? (
                                <span className="bg-pink-650 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm">
                                  Primary
                                </span>
                              ) : (
                                <span></span>
                              )}
                              <button 
                                type="button" 
                                onClick={() => removeProductImage(img.id)}
                                className="bg-rose-650 text-white p-1 rounded-full hover:bg-rose-700 transition-colors cursor-pointer shadow-sm"
                                title="Remove photo"
                              >
                                <X size={10} />
                              </button>
                            </div>
                            
                            {/* Bottom row: Crop/Rotate, Move Left, Move Right */}
                            <div className="flex justify-between items-center w-full">
                              <button 
                                type="button" 
                                onClick={() => {
                                  setEditingImageIdx(idx);
                                  setEditorImageUrl(img.preview);
                                  setIsEditingBulkImage(false);
                                }}
                                className="bg-slate-900/90 text-white p-1 rounded hover:bg-black transition-colors cursor-pointer shadow-sm text-[9px] flex items-center gap-0.5"
                                title="Crop/Edit photo"
                              >
                                <Edit2 size={9} />
                                <span>Crop</span>
                              </button>
                              
                              <div className="flex space-x-0.5">
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setProductImages(prev => {
                                        const updated = [...prev];
                                        const temp = updated[idx];
                                        updated[idx] = updated[idx - 1];
                                        updated[idx - 1] = temp;
                                        return updated;
                                      });
                                    }}
                                    className="bg-slate-900/90 hover:bg-black text-white px-1.5 py-0.5 rounded text-[10px] font-extrabold cursor-pointer"
                                    title="Move Left"
                                  >
                                    &lsaquo;
                                  </button>
                                )}
                                {idx < productImages.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setProductImages(prev => {
                                        const updated = [...prev];
                                        const temp = updated[idx];
                                        updated[idx] = updated[idx + 1];
                                        updated[idx + 1] = temp;
                                        return updated;
                                      });
                                    }}
                                    className="bg-slate-900/90 hover:bg-black text-white px-1.5 py-0.5 rounded text-[10px] font-extrabold cursor-pointer"
                                    title="Move Right"
                                  >
                                    &rsaquo;
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
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

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">SKU CODE</label>
                      <button
                        type="button"
                        onClick={() => {
                          setSkuEdited(false);
                          const randomNum = Math.floor(100000 + Math.random() * 900000);
                          const b = brand ? brand.trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "") : "CS";
                          const c = category ? category.trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "") : "GEN";
                          setSku(`${b || "CS"}-${c || "GEN"}-${randomNum}`);
                        }}
                        className="text-[9px] font-bold text-pink-500 hover:text-pink-400 cursor-pointer uppercase"
                      >
                        Auto-Generate
                      </button>
                    </div>
                    <input 
                      type="text" 
                      value={sku} 
                      onChange={(e) => {
                        setSku(e.target.value);
                        setSkuEdited(true);
                      }} 
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-750" 
                      placeholder="e.g. NEE-GR-001" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">STATUS</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all">
                      <option value="Active">Active</option>
                      <option value="Draft">Draft</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">BRAND</label>
                  <input type="text" required value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705" placeholder="e.g. Neelamaa" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">TITLE</label>
                  <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705" placeholder="e.g. Black Granite Chopping Board" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">SHORT DESCRIPTION</label>
                  <textarea rows={3} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705" placeholder="• Heat resistant board&#10;• Non-slip silicone base&#10;• Easy grip handle" />
                  <span className="text-[10px] text-slate-500 mt-1 block leading-normal">Enter each point on a new line or start with a bullet (•, -, *). They will be separated by a vertical line '|' for customers.</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">FULL DESCRIPTION</label>
                  <textarea rows={4} value={fullDescription} onChange={(e) => setFullDescription(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705" placeholder="Detailed product specifications, materials used, size metrics, etc." />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">COUNTRY OF ORIGIN</label>
                    <input type="text" value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705" placeholder="India" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">HSN CODE</label>
                    <input type="text" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705" placeholder="e.g. 6802" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">MANUFACTURER</label>
                    <input type="text" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705" placeholder="Neelamaa Stones" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">PACKER</label>
                    <input type="text" value={packer} onChange={(e) => setPacker(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705" placeholder="Neelamaa Stones" />
                  </div>
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
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-sans">PARENT CATEGORY</label>
                    <select 
                      value={category} 
                      onChange={(e) => {
                        const newParent = e.target.value;
                        setCategory(newParent);
                        const parentObj = categoriesSchema.find(c => c.name === newParent);
                        if (parentObj && parentObj.subCategories && parentObj.subCategories.length > 0) {
                          setSubCategory(parentObj.subCategories[0].name);
                        } else {
                          setSubCategory("");
                        }
                      }} 
                      className="w-full bg-slate-950/60 border border-slate-805 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all cursor-pointer"
                    >
                      {categoriesSchema.map(c => (
                        <option key={c.name} value={c.name} className="bg-slate-950 text-white">{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-sans">SUB CATEGORY</label>
                    {(() => {
                      const parentObj = categoriesSchema.find(c => c.name === category);
                      const subs = parentObj?.subCategories || [];
                      
                      return (
                        <select 
                          value={subCategory} 
                          onChange={(e) => setSubCategory(e.target.value)} 
                          disabled={subs.length === 0}
                          className="w-full bg-slate-950/60 border border-slate-805 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {subs.length === 0 ? (
                            <option value="" className="bg-slate-950 text-white">No sub-categories</option>
                          ) : (
                            subs.map(s => (
                              <option key={s.name} value={s.name} className="bg-slate-950 text-white">{s.name}</option>
                            ))
                          )}
                        </select>
                      );
                    })()}
                  </div>
                </div>

                {/* Base Product Options (Size, Size Unit, Color, Material) */}
                <div className="bg-slate-950/30 p-3.5 border border-slate-900 rounded-xl space-y-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Base Product Options</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Size & Unit</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={size}
                          onChange={(e) => setSize(e.target.value)}
                          placeholder="e.g. 12 / S"
                          className="flex-1 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705"
                        />
                        <select
                          value={sizeUnit}
                          onChange={(e) => setSizeUnit(e.target.value)}
                          className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all cursor-pointer w-28"
                        >
                          <option value="">None</option>
                          <option value="cm">cm</option>
                          <option value="mm">mm</option>
                          <option value="inches">inches</option>
                          <option value="ft.">ft.</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Color</label>
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        placeholder="e.g. Red"
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Material</label>
                    <input
                      type="text"
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                      placeholder="e.g. Granite"
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705"
                    />
                  </div>
                </div>

                {/* Variants toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-950/30 border border-slate-800 rounded-xl">
                  <div>
                    <label className="block text-xs font-bold text-slate-200">Enable Product Variants</label>
                    <span className="text-[10px] text-slate-500 block">Create multiple size, color, or material options</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasVariants}
                    onChange={(e) => {
                      setHasVariants(e.target.checked);
                      if (e.target.checked && variantRows.length === 0) {
                        setVariantRows([{
                          id: `var_${Date.now()}_${Math.random()}`,
                          size: "",
                          sizeUnit: "",
                          color: "",
                          material: "",
                          price: calculatedPrice ? calculatedPrice.toString() : "",
                          mrp: mrp || "",
                          stock: quantity || "10",
                          sku: "",
                          image: ""
                        }]);
                      }
                    }}
                    className="w-4 h-4 text-pink-650 accent-pink-600 border-slate-800 bg-slate-950 rounded cursor-pointer"
                  />
                </div>

                {hasVariants ? (
                  <div className="bg-slate-950/30 p-4 border border-slate-900 rounded-xl space-y-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Configure Variants</span>
                    <div className="space-y-4">
                      {variantRows.map((variant, idx) => (
                        <div key={variant.id} className="bg-slate-950/50 p-4 border border-slate-850 rounded-xl space-y-3.5 relative shadow-inner">
                          {/* Variant header */}
                          <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                            <span className="text-xs font-bold text-pink-500 uppercase tracking-wider">Variant #{idx + 1}</span>
                            {variantRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setVariantRows(prev => prev.filter(v => v.id !== variant.id))}
                                className="text-xs font-bold text-rose-500 hover:text-rose-400 cursor-pointer transition-colors"
                              >
                                Remove Option
                              </button>
                            )}
                          </div>
                          
                          {/* Spaced out grid for Variant Details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Column 1: Option Specifications */}
                            <div className="space-y-3">
                              {/* Size & Unit in its own row */}
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Size & Unit</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={variant.size}
                                    onChange={(e) => {
                                      const newVars = [...variantRows];
                                      newVars[idx].size = e.target.value;
                                      setVariantRows(newVars);
                                    }}
                                    placeholder="e.g. 12 / S"
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-pink-500 transition-all"
                                  />
                                  <select
                                    value={variant.sizeUnit || ""}
                                    onChange={(e) => {
                                      const newVars = [...variantRows];
                                      newVars[idx].sizeUnit = e.target.value;
                                      setVariantRows(newVars);
                                    }}
                                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-pink-500 w-28 cursor-pointer transition-all"
                                  >
                                    <option value="">None</option>
                                    <option value="cm">cm</option>
                                    <option value="mm">mm</option>
                                    <option value="inches">inches</option>
                                    <option value="ft.">ft.</option>
                                  </select>
                                </div>
                              </div>

                              {/* Color and Material side by side */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Color</label>
                                  <input
                                    type="text"
                                    value={variant.color}
                                    onChange={(e) => {
                                      const newVars = [...variantRows];
                                      newVars[idx].color = e.target.value;
                                      setVariantRows(newVars);
                                    }}
                                    placeholder="Black"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-pink-500 transition-all"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Material</label>
                                  <input
                                    type="text"
                                    value={variant.material}
                                    onChange={(e) => {
                                      const newVars = [...variantRows];
                                      newVars[idx].material = e.target.value;
                                      setVariantRows(newVars);
                                    }}
                                    placeholder="Granite"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-pink-500 transition-all"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Column 2: Variant Image Uploader (Optional) */}
                            <div className="space-y-1.5 flex flex-col justify-between">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Variant Photo (Optional)</label>
                              <div className="flex items-center gap-3 bg-slate-950/20 border border-slate-900 rounded-xl p-3 flex-1 min-h-[90px]">
                                {variant.image ? (
                                  <div className="relative w-16 h-20 rounded-lg overflow-hidden border border-slate-800 bg-black shadow-inner flex-shrink-0 group">
                                    <img src={variant.image} alt={`Variant #${idx + 1}`} className="w-full h-full object-cover" />
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        const newVars = [...variantRows];
                                        newVars[idx].image = "";
                                        setVariantRows(newVars);
                                      }}
                                      className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white rounded-full p-0.5 transition-colors cursor-pointer"
                                      title="Remove Image"
                                    >
                                      &times;
                                    </button>
                                  </div>
                                ) : (
                                  <div className="w-16 h-20 rounded-lg border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-650 flex-shrink-0 bg-slate-950/40">
                                    <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                  </div>
                                )}
                                
                                <div className="flex-1 flex flex-col gap-1.5 justify-center">
                                  <label className="bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-pink-500/30 px-3 py-1.5 rounded-lg text-xs font-bold text-center cursor-pointer transition-all">
                                    {uploadingVariantIdx === idx ? "Uploading..." : "Upload Photo"}
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleVariantImageChange(idx, file);
                                      }}
                                      className="hidden" 
                                      disabled={uploadingVariantIdx !== null}
                                    />
                                  </label>
                                  <span className="text-[9px] text-slate-500 leading-normal">Allows displaying correct photo color when selected</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Price, MRP, Stock, SKU */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Price (₹)</label>
                              <input
                                type="number"
                                required
                                value={variant.price}
                                onChange={(e) => {
                                  const newVars = [...variantRows];
                                  newVars[idx].price = e.target.value;
                                  setVariantRows(newVars);
                                }}
                                placeholder="799"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-pink-500 transition-all font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">MRP (₹)</label>
                              <input
                                type="number"
                                required
                                value={variant.mrp}
                                onChange={(e) => {
                                  const newVars = [...variantRows];
                                  newVars[idx].mrp = e.target.value;
                                  setVariantRows(newVars);
                                }}
                                placeholder="999"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-pink-500 transition-all font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Stock</label>
                              <input
                                type="number"
                                required
                                value={variant.stock}
                                onChange={(e) => {
                                  const newVars = [...variantRows];
                                  newVars[idx].stock = e.target.value;
                                  setVariantRows(newVars);
                                }}
                                placeholder="50"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-pink-500 transition-all font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">SKU</label>
                              <input
                                type="text"
                                value={variant.sku}
                                onChange={(e) => {
                                  const newVars = [...variantRows];
                                  newVars[idx].sku = e.target.value;
                                  setVariantRows(newVars);
                                }}
                                placeholder="SKU"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-pink-500 transition-all font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setVariantRows(prev => [...prev, {
                        id: `var_${Date.now()}_${Math.random()}`,
                        size: "",
                        sizeUnit: "",
                        color: "",
                        material: "",
                        price: calculatedPrice ? calculatedPrice.toString() : "",
                        mrp: mrp || "",
                        stock: "10",
                        sku: "",
                        image: ""
                      }])}
                      className="w-full py-2.5 bg-slate-900 border border-slate-850 hover:bg-slate-850 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer block text-center uppercase tracking-wide shadow-sm"
                    >
                      + Add Variant Option
                    </button>
                  </div>
                ) : (
                  category.toLowerCase() === "fashion" ? (
                    <div className="bg-slate-950/30 p-3.5 border border-slate-900 rounded-xl space-y-2.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Sizes Inventory</span>
                      <div className="grid grid-cols-5 gap-2">
                        {["S", "M", "L", "XL", "XXL"].map((size) => (
                          <div key={size}>
                            <label className="block text-[9px] font-extrabold text-slate-500 text-center mb-1">{size}</label>
                            <input 
                              type="number" 
                              min="0"
                              required
                              value={sizesInventory[size as keyof typeof sizesInventory] || ""} 
                              onChange={(e) => handleSizeInventoryChange(size, e.target.value)} 
                              className="w-full text-center bg-slate-950 border border-slate-850 rounded px-1.5 py-1 text-xs outline-none text-white focus:border-pink-500" 
                              placeholder="0" 
                            />
                          </div>
                        ))}
                      </div>
                      <div className="text-right text-[10px] text-slate-400 font-semibold mt-1">
                        Total calculated stock: <span className="text-white font-extrabold">{quantity || "0"}</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Stock Quantity</label>
                      <input 
                        type="number" 
                        required 
                        min="0"
                        value={quantity} 
                        onChange={(e) => setQuantity(e.target.value)} 
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705" 
                        placeholder="e.g. 50" 
                      />
                    </div>
                  )
                )}

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

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Maximum Retail Price (MRP) (₹) *</label>
                    <input 
                      type="number" 
                      required
                      value={mrp} 
                      onChange={(e) => setMrp(e.target.value)} 
                      className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs outline-none text-white transition-all
                        ${mrp === "" ? 'border-amber-500/40 focus:border-amber-500' : 'border-slate-800 focus:border-pink-500'}`} 
                      placeholder="e.g. 1500" 
                    />
                    {mrp === "" && <span className="text-[8px] text-amber-500 font-bold block mt-0.5">Not Entered</span>}
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

                {/* Collapsible Section: Technical Specifications */}
                <details className="group border border-slate-800 rounded-xl bg-slate-950/20">
                  <summary className="list-none flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-900/40 select-none">
                    <span className="text-[10px] font-bold text-slate-350 uppercase tracking-widest">Technical Specifications</span>
                    <span className="text-slate-500 text-xs font-bold transition-transform group-open:rotate-180">&darr;</span>
                  </summary>
                  <div className="p-3.5 border-t border-slate-900 space-y-3">
                    <span className="text-[9px] text-slate-500 block">Add custom key-value pairs (e.g. Finish: Polished, Thickness: 20mm, Battery Type: Lithium-ion)</span>
                    <div className="space-y-2">
                      {attributeRows.map((row, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => {
                              const newRows = [...attributeRows];
                              newRows[idx].name = e.target.value;
                              setAttributeRows(newRows);
                            }}
                            placeholder="Specification Key"
                            className="flex-1 bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500"
                          />
                          <input
                            type="text"
                            value={row.value}
                            onChange={(e) => {
                              const newRows = [...attributeRows];
                              newRows[idx].value = e.target.value;
                              setAttributeRows(newRows);
                            }}
                            placeholder="Specification Value"
                            className="flex-1 bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500"
                          />
                          <button
                            type="button"
                            onClick={() => setAttributeRows(prev => prev.filter((_, i) => i !== idx))}
                            className="bg-rose-950/20 text-rose-400 border border-rose-900/30 px-3 py-1.5 rounded hover:bg-rose-900/30 text-xs cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAttributeRows(prev => [...prev, { name: "", value: "" }])}
                        className="text-xs text-pink-500 font-bold hover:underline cursor-pointer block"
                      >
                        + Add Custom Specification
                      </button>
                    </div>
                  </div>
                </details>

                {/* Collapsible Section: SEO Optimization */}
                <details className="group border border-slate-800 rounded-xl bg-slate-950/20">
                  <summary className="list-none flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-900/40 select-none">
                    <span className="text-[10px] font-bold text-slate-350 uppercase tracking-widest">SEO Optimization</span>
                    <span className="text-slate-500 text-xs font-bold transition-transform group-open:rotate-180">&darr;</span>
                  </summary>
                  <div className="p-3.5 border-t border-slate-900 space-y-3.5">
                    <div>
                      <div className="flex justify-between items-center">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Slug / URL path</label>
                        <button
                          type="button"
                          onClick={() => setSlug(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""))}
                          className="text-[8px] font-extrabold text-pink-500 hover:text-pink-400 cursor-pointer"
                        >
                          Auto-generate from Title
                        </button>
                      </div>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="black-granite-chopping-board"
                        className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500 mt-1 placeholder-slate-750"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase">Meta Title</label>
                      <input
                        type="text"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        placeholder="Premium Black Granite Chopping Board | Neelamaa"
                        className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500 mt-1 placeholder-slate-750"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase">Meta Description</label>
                      <textarea
                        rows={2}
                        value={metaDescription}
                        onChange={(e) => setMetaDescription(e.target.value)}
                        placeholder="Buy heat resistant, polished natural black granite chopping boards by Neelamaa Stones."
                        className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500 mt-1 placeholder-slate-750"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase">Keywords (Comma separated)</label>
                      <input
                        type="text"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="chopping board, granite, kitchen tools, neelamaa"
                        className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500 mt-1 placeholder-slate-750"
                      />
                    </div>
                  </div>
                </details>

                {/* Collapsible Section: Shipping & Weight Specs */}
                <details className="group border border-slate-800 rounded-xl bg-slate-950/20">
                  <summary className="list-none flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-900/40 select-none">
                    <span className="text-[10px] font-bold text-slate-350 uppercase tracking-widest">Shipping & Physical Specs</span>
                    <span className="text-slate-500 text-xs font-bold transition-transform group-open:rotate-180">&darr;</span>
                  </summary>
                  <div className="p-3.5 border-t border-slate-900 space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Package Weight (kg)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={packageWeight}
                          onChange={(e) => setPackageWeight(e.target.value)}
                          placeholder="3.5"
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500 mt-1"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Length (cm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={packageLength}
                          onChange={(e) => setPackageLength(e.target.value)}
                          placeholder="45"
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500 mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Width (cm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={packageWidth}
                          onChange={(e) => setPackageWidth(e.target.value)}
                          placeholder="30"
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500 mt-1"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Height (cm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={packageHeight}
                          onChange={(e) => setPackageHeight(e.target.value)}
                          placeholder="2"
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500 mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </details>

                <div className="pt-4 border-t border-slate-900">
                  <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-extrabold py-3 rounded-xl hover:opacity-90 disabled:opacity-75 transition-all shadow-md shadow-pink-500/10 cursor-pointer text-xs uppercase tracking-wider">
                    {loading ? "SAVING..." : editingId ? "UPDATE ITEM" : "CREATE ITEM"}
                  </button>
                </div>
              </form>
            </div>
          </div>
          )}

          {/* Settings Column */}
          {viewMode === "add-product" && (
            <div className="lg:col-span-4 space-y-6">

            {/* Flash Sale Settings Panel */}
            <div className="bg-slate-900/40 backdrop-blur p-6 rounded-2xl border border-slate-900 mt-6 shadow-xl">
              <h2 className="text-base font-extrabold text-white mb-4">Flash Sale Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">START TIME</label>
                  <input 
                    type="datetime-local" 
                    value={flashSaleStart} 
                    onChange={(e) => setFlashSaleStart(e.target.value)} 
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">END TIME</label>
                  <input 
                    type="datetime-local" 
                    value={flashSaleEnd} 
                    onChange={(e) => setFlashSaleEnd(e.target.value)} 
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all" 
                  />
                </div>
                <button 
                  onClick={saveFlashSaleTimer} 
                  disabled={flashSaleLoading} 
                  className="w-full bg-slate-850 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl disabled:opacity-75 transition-all cursor-pointer text-xs uppercase tracking-wider border border-slate-800 mt-2"
                >
                  {flashSaleLoading ? "SAVING..." : "SET TIMER"}
                </button>
              </div>
            </div>

            {/* Promo Ticker Settings Panel */}
            <div className="bg-slate-900/40 backdrop-blur p-6 rounded-2xl border border-slate-900 mt-6 shadow-xl">
              <h2 className="text-base font-extrabold text-white mb-4">Promo Ticker Settings</h2>
              <div className="space-y-3">
                {promoMessages.map((msg, index) => (
                  <div key={index}>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-bold text-pink-500">Message {index + 1}</label>
                    <input 
                      type="text" 
                      value={msg} 
                      onChange={(e) => updatePromoMessage(index, e.target.value)} 
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:border-pink-500 outline-none text-white transition-all" 
                      placeholder={`e.g. Promo Message ${index + 1}`}
                    />
                  </div>
                ))}
                
                <div className="flex justify-between items-center pt-2">
                  {promoMessages.length < 5 ? (
                    <button 
                      type="button"
                      onClick={() => setPromoMessages(prev => [...prev, ""])}
                      className="text-[10px] font-bold text-pink-500 hover:text-pink-400 transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      + Add Message
                    </button>
                  ) : <div></div>}

                  {promoMessages.length > 1 ? (
                    <button 
                      type="button"
                      onClick={() => setPromoMessages(prev => prev.slice(0, -1))}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-450 transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      - Remove Message
                    </button>
                  ) : <div></div>}
                </div>

                <button 
                  onClick={savePromoTicker} 
                  disabled={promoLoading} 
                  className="w-full bg-slate-850 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl disabled:opacity-75 transition-all cursor-pointer text-xs uppercase tracking-wider border border-slate-800 mt-4 block"
                >
                  {promoLoading ? "SAVING..." : "UPDATE TICKER"}
                </button>
              </div>
            </div>

            {/* Global Store Discount Panel */}
            <div className="bg-slate-900/40 backdrop-blur p-6 rounded-2xl border border-slate-900 mt-6 shadow-xl">
              <h2 className="text-base font-extrabold text-white mb-4">Store Discount Settings</h2>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 text-pink-500">Global Store Discount (%)</label>
                <input 
                  type="number" 
                  min="0"
                  max="100"
                  value={discountPercent} 
                  onChange={(e) => setDiscountPercent(Number(e.target.value))} 
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all mb-4" 
                  placeholder="e.g. 33"
                />
                <button 
                  onClick={saveStoreDiscount} 
                  disabled={discountLoading} 
                  className="w-full bg-slate-850 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl disabled:opacity-75 transition-all cursor-pointer text-xs uppercase tracking-wider border border-slate-800"
                >
                  {discountLoading ? "SAVING..." : "UPDATE DISCOUNT"}
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Catalog Inventory Column */}
          {viewMode === "inventory" && (
            <div className="lg:col-span-12">
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
                              {product.category?.toLowerCase() === "fashion" && product.sizesInventory ? (
                                <div className="text-[10px] text-slate-400 font-semibold space-y-1">
                                  <div className="flex gap-1.5 flex-wrap">
                                    {Object.entries(product.sizesInventory).map(([size, qty]: any) => (
                                      <span 
                                        key={size} 
                                        className={`px-1.5 py-0.5 rounded text-[9px] border 
                                          ${Number(qty) <= 0 
                                            ? 'bg-rose-950/30 text-rose-400 border-rose-900/40 line-through' 
                                            : Number(qty) <= 2 
                                              ? 'bg-orange-950/30 text-orange-400 border-orange-900/40' 
                                              : 'bg-slate-800 text-slate-350 border-slate-700/50'}`}
                                      >
                                        {size}: {qty}
                                      </span>
                                    ))}
                                  </div>
                                  <span className="text-[9px] text-slate-500 block">Total: {stockQuantity} units</span>
                                </div>
                              ) : stockQuantity <= 0 ? (
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
                            <td className="px-5 py-4">
                              <span className="font-black text-white text-sm block">₹{product.price}</span>
                              {product.mrp && (
                                <span className="text-[10px] text-slate-500 line-through block mt-0.5">MRP: ₹{product.mrp}</span>
                              )}
                            </td>
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
          )}
        </div>
      ) : (
        /* BULK UPLOAD VIEW */
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Sub-tab selection inside Bulk view */}
          <div className="bg-slate-900/60 p-1 rounded-xl flex space-x-1 border border-slate-800 max-w-sm mb-6">
            <button 
              type="button"
              onClick={() => setBulkSubMode("csv")}
              className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${bulkSubMode === "csv" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
            >
              Spreadsheet (CSV) Upload
            </button>
            <button 
              type="button"
              onClick={() => setBulkSubMode("images")}
              className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${bulkSubMode === "images" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
            >
              Image Files List
            </button>
          </div>

          {bulkSubMode === "csv" ? (
            /* CSV SPREADSHEET UPLOADER CONTENT */
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-6 shadow-xl text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">Bulk Spreadsheet Upload</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">Upload product details in bulk using Excel/CSV templates.</p>
                </div>
                <button 
                  type="button"
                  onClick={downloadCSVTemplate}
                  className="bg-slate-800 hover:bg-slate-700 text-pink-500 font-extrabold px-4 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all border border-slate-700 cursor-pointer text-center"
                >
                  Download CSV Template
                </button>
              </div>

              <form onSubmit={handleBulkCsvUploadSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* CSV spreadsheet file selector */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select CSV Spreadsheet *</label>
                    <div className="relative border border-slate-850 bg-slate-950 rounded-xl px-4 py-6 text-center hover:border-slate-700 transition-all">
                      <input 
                        type="file" 
                        required={!csvFile}
                        accept=".csv" 
                        onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <UploadCloud size={28} className="mx-auto mb-2 text-slate-500" />
                      <span className="text-xs font-bold text-slate-300 block">
                        {csvFile ? csvFile.name : "Choose CSV File"}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 block">Supported format: .csv</span>
                    </div>
                  </div>

                  {/* Photos selector */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Product Photos (Multiple)</label>
                    <div className="relative border border-slate-850 bg-slate-950 rounded-xl px-4 py-6 text-center hover:border-slate-700 transition-all">
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={(e) => setCsvImages(Array.from(e.target.files || []))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <UploadCloud size={28} className="mx-auto mb-2 text-slate-500" />
                      <span className="text-xs font-bold text-slate-300 block">
                        {csvImages.length > 0 ? `${csvImages.length} photos selected` : "Choose Image Files"}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 block">File names should match CSV ImageFileNames column</span>
                    </div>
                  </div>
                </div>

                {csvImages.length > 0 && (
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-2 tracking-wider">Selected Image List:</span>
                    <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-2">
                      {csvImages.map((f, idx) => (
                        <span key={idx} className="bg-slate-900 border border-slate-800 text-[10px] font-semibold text-slate-300 px-2 py-1 rounded">
                          {f.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress reporting & console logs */}
                {csvIsUploading && (
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-850 space-y-3.5">
                    <div className="flex justify-between items-center text-xs font-bold text-white">
                      <span>Uploading product {csvCurrentRow} of {csvTotalRows}...</span>
                      <span>{csvUploadProgress}%</span>
                    </div>
                    {/* Progress bar container */}
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-pink-500 to-orange-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${csvUploadProgress}%` }}
                      ></div>
                    </div>
                    
                    {/* Console Logs */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Activity logs:</span>
                      <div className="bg-black border border-slate-905 rounded-lg p-3 max-h-36 overflow-y-auto text-[10px] font-mono text-slate-400 space-y-1 select-text scrollbar-thin">
                        {csvLogs.slice().reverse().map((l, idx) => (
                          <div key={idx} className="leading-relaxed">{l}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={csvIsUploading}
                  className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-extrabold py-4 rounded-xl shadow-xl hover:opacity-95 disabled:opacity-75 transition-all text-xs uppercase tracking-wider flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {csvIsUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>UPLOADING & CREATING PRODUCTS...</span>
                    </>
                  ) : (
                    <span>START BULK UPLOAD</span>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* ORIGINAL BULK IMAGE UPLOAD VIEW */
            <>
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
                <div className="space-y-6 mb-8 text-left">
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
                        <div className="w-full sm:w-40 h-40 sm:h-auto bg-slate-950 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-850 relative group">
                          <img src={item.preview} alt={`Upload ${index}`} className="w-full h-full object-contain" />
                          <button 
                            type="button" 
                            onClick={() => {
                              setEditingImageIdx(index);
                              setEditorImageUrl(item.preview);
                              setIsEditingBulkImage(true);
                            }}
                            className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur text-white p-1.5 rounded-lg hover:bg-black opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                            title="Edit Image"
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>
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

                          {/* MRP */}
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">MRP (₹)</label>
                            <input 
                              type="number" 
                              value={item.mrp || ""} 
                              onChange={(e) => updateBulkItem(index, "mrp", e.target.value)} 
                              className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none" 
                              placeholder="Leave blank for 1.5x" 
                            />
                          </div>

                          {/* Home Section */}
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">HOME SECTION</label>
                            <select value={item.homeSection} onChange={(e) => updateBulkItem(index, "homeSection", e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none">
                              <option value="Standard">Standard</option>
                              <option value="Flash Sale">Flash Sale</option>
                              <option value="New Arrivals">New Arrivals</option>
                              <option value="Trending">Trending</option>
                            </select>
                          </div>

                          {/* GST Rate */}
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

                          {/* Category */}
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">CATEGORY *</label>
                            <select 
                              value={item.category} 
                              onChange={(e) => updateBulkItem(index, "category", e.target.value)} 
                              className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:border-pink-500 outline-none cursor-pointer"
                            >
                              {availableCategories.map(c => (
                                <option key={c} value={c} className="bg-slate-950 text-white">{c}</option>
                              ))}
                            </select>
                          </div>

                          {/* Display calculated price */}
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
            </>
          )}
        </div>
      )}

      {editorImageUrl && (
        <ImageEditorModal
          imageUrl={editorImageUrl}
          aspectRatio={3 / 4}
          onClose={handleCloseEditor}
          onSave={handleSaveEditedImage}
        />
      )}
    </div>
  );
}
