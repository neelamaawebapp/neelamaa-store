"use client";

import { useState, useEffect, useRef } from "react";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from "firebase/firestore";
import { UploadCloud, Edit2, Trash2, X, Layers, AlertTriangle, CheckCircle2, Package, Coins, BarChart3, Search, Filter, Bell, ArrowUpDown, ChevronUp, ChevronDown, Calendar } from "lucide-react";
import { STORE_CATEGORIES, ParentCategory } from "@/lib/constants";
import ImageEditorModal from "@/components/ImageEditorModal";
import { autoAdjustImage } from "@/lib/imageUtils";

const getDirectVideoUrl = (url: string) => {
  if (!url) return "";
  let cleanUrl = url.trim();
  if (cleanUrl.includes("dropbox.com")) {
    return cleanUrl.replace("?dl=0", "?raw=1").replace("?dl=1", "?raw=1");
  }
  if (cleanUrl.includes("drive.google.com") || cleanUrl.includes("docs.google.com")) {
    const gdRegex1 = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const gdRegex2 = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
    const gdRegex3 = /drive\.google\.com\/uc\?.*?id=([a-zA-Z0-9_-]+)/;
    const match1 = cleanUrl.match(gdRegex1);
    const match2 = cleanUrl.match(gdRegex2);
    const match3 = cleanUrl.match(gdRegex3);
    const docId = (match1 && match1[1]) || (match2 && match2[1]) || (match3 && match3[1]);
    if (docId) {
      return `https://drive.google.com/uc?export=download&id=${docId}`;
    }
  }
  return cleanUrl;
};

export default function AdminDashboard() {
  const [viewMode, setViewMode] = useState<"inventory" | "add-product" | "bulk" | "bulk-pricing" | "reports" | "scheduler" | "alerts">("inventory");

  // Scheduler States
  const [promotions, setPromotions] = useState<any[]>([]);
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(10);
  const [promoStartDate, setPromoStartDate] = useState("");
  const [promoEndDate, setPromoEndDate] = useState("");
  const [promoCategory, setPromoCategory] = useState("All");
  const [promoBannerFile, setPromoBannerFile] = useState<File | null>(null);
  const [promoBannerUrl, setPromoBannerUrl] = useState("");
  const [promoIsActive, setPromoIsActive] = useState(true);
  const [savingPromo, setSavingPromo] = useState(false);
  const [uploadingPromoBanner, setUploadingPromoBanner] = useState(false);

  // Stock alerts / notifications state
  const [backInStockSubs, setBackInStockSubs] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [subsFilter, setSubsFilter] = useState<"All" | "Pending" | "Sent">("Pending");

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
  const [price, setPrice] = useState("");
  const [homeSection, setHomeSection] = useState("Standard");
  const [gstRate, setGstRate] = useState("18");
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [skuEdited, setSkuEdited] = useState(false);
  
  // Migration State
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState("");
  
  // Sorting State
  const [sortKey, setSortKey] = useState<"item" | "category" | "subcategory" | "quantity" | "pricing" | "price" | "none">("none");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
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
  const [oneLiner, setOneLiner] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [status, setStatus] = useState("Active");
  const [countryOfOrigin, setCountryOfOrigin] = useState("India");
  const [manufacturer, setManufacturer] = useState("");
  const [packer, setPacker] = useState("");
  const [hsnCode, setHsnCode] = useState("");

  // Product Showcase Video (Reel) States
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    images: string[];
  }[]>([]);
  const [uploadingVariantIdx, setUploadingVariantIdx] = useState<number | null>(null);

  // Bulk pricing states
  const [bulkPricingRows, setBulkPricingRows] = useState<any[]>([]);
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);
  const [savingBulkPricing, setSavingBulkPricing] = useState(false);

  const handleVariantImagesUpload = async (idx: number, files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadingVariantIdx(idx);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
          method: "POST",
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          const url = data.data.url;
          setVariantRows(prev => {
            const updated = [...prev];
            const currentImages = updated[idx].images || [];
            const newImages = [...currentImages, url];
            updated[idx].images = newImages;
            if (!updated[idx].image) {
              updated[idx].image = url;
            }
            return updated;
          });
        } else {
          alert("Image upload failed: " + (data.error?.message || "Unknown error"));
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading image");
    } finally {
      setUploadingVariantIdx(null);
    }
  };
  
  // Reports State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [salesReportType, setSalesReportType] = useState<"monthly" | "yearly" | "custom">("monthly");
  const [salesReportMonth, setSalesReportMonth] = useState(new Date().toISOString().substring(0, 7)); // e.g. "2026-07"
  const [salesReportYear, setSalesReportYear] = useState(new Date().getFullYear().toString());
  const [salesReportStartDate, setSalesReportStartDate] = useState("");
  const [salesReportEndDate, setSalesReportEndDate] = useState("");
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [fetchingOrders, setFetchingOrders] = useState(false);

  useEffect(() => {
    if (viewMode === "reports" && ordersList.length === 0) {
      const fetchOrders = async () => {
        setFetchingOrders(true);
        try {
          const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
          const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
          const snap = await getDocs(q);
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setOrdersList(list);
        } catch (e) {
          console.error("Failed to fetch orders for reports", e);
        } finally {
          setFetchingOrders(false);
        }
      };
      fetchOrders();
    }
  }, [viewMode, ordersList.length]);

  const getFinancialYear = (dateInput?: any) => {
    if (!dateInput) return "25-26";
    const d = typeof dateInput.toDate === "function" ? dateInput.toDate() : new Date(dateInput);
    const date = isNaN(d.getTime()) ? new Date() : d;
    const year = date.getFullYear();
    const month = date.getMonth();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;
    const startYY = String(startYear).substring(2);
    const endYY = String(endYear).substring(2);
    return `${startYY}-${endYY}`;
  };

  const getInvoiceNo = (order: any) => {
    if (order.invoiceNo) return order.invoiceNo;
    const idStr = order.id || "";
    const cleanId = idStr.startsWith("mock_") ? idStr.replace("mock_", "") : idStr;
    const shortId = cleanId.substring(0, 5).toUpperCase();
    return `CS-${shortId}/${getFinancialYear(order.createdAt)}`;
  };

  const handleDownloadPricingReport = (items: any[]) => {
    let html = `
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
          th { background-color: #ec4899; color: white; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 10px; vertical-align: middle; text-align: left; font-size: 13px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .price { font-weight: bold; color: #db2777; }
          .header { background-color: #0f172a; color: white; text-align: center; font-size: 16px; font-weight: bold; padding: 14px; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <th colspan="13" class="header">PRICING BREAKDOWN DETAILS REPORT</th>
          </tr>
          <tr>
            <th>Picture</th>
            <th>SKU</th>
            <th>Item Title</th>
            <th>Category</th>
            <th>Sub-Category</th>
            <th>Purchase Price (₹)</th>
            <th>Packing Charges (₹)</th>
            <th>Courier Charges (₹)</th>
            <th>Other Expenses (₹)</th>
            <th>Expected Profit (₹)</th>
            <th>Base Cost (₹)</th>
            <th>GST Rate (%)</th>
            <th>Final Selling Price (₹)</th>
          </tr>
    `;

    items.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach((v: any) => {
          const specLabel = [v.size ? `${v.size}${v.sizeUnit || ''}` : '', v.color, v.material].filter(Boolean).join(" / ");
          const titleStr = `${product.title} (${specLabel})`;
          const imgUrl = v.image || product.image || "";
          
          html += `
            <tr style="height: 60px;">
              <td>${imgUrl ? `<img src="${imgUrl}" width="40" height="50" style="object-fit: cover; display: block;" />` : '—'}</td>
              <td>${v.sku || product.sku || '—'}</td>
              <td>${titleStr}</td>
              <td>${product.category || '—'}</td>
              <td>${product.subCategory || '—'}</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>${product.gstRate || 18}%</td>
              <td class="price">₹${v.price || 0}</td>
            </tr>
          `;
        });
      } else {
        const base = 
          Number(product.purchasePrice || 0) + 
          Number(product.packingCharges || 0) + 
          Number(product.courierCharges || 0) + 
          Number(product.otherExpenses || 0) + 
          Number(product.profit || 0);
        
        const imgUrl = product.image || "";
        
        html += `
          <tr style="height: 60px;">
            <td>${imgUrl ? `<img src="${imgUrl}" width="40" height="50" style="object-fit: cover; display: block;" />` : '—'}</td>
            <td>${product.sku || '—'}</td>
            <td>${product.title || '—'}</td>
            <td>${product.category || '—'}</td>
            <td>${product.subCategory || '—'}</td>
            <td>₹${product.purchasePrice || 0}</td>
            <td>₹${product.packingCharges || 0}</td>
            <td>₹${product.courierCharges || 0}</td>
            <td>₹${product.otherExpenses || 0}</td>
            <td>₹${product.profit || 0}</td>
            <td>₹${base || product.price || 0}</td>
            <td>${product.gstRate || 18}%</td>
            <td class="price">₹${product.price || 0}</td>
          </tr>
        `;
      }
    });

    html += `
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pricing_breakdown_report_${new Date().toISOString().substring(0,10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSalesReport = () => {
    let filteredOrders = [...ordersList];
    let label = "";

    if (salesReportType === "monthly") {
      const [year, month] = salesReportMonth.split("-");
      const targetYear = parseInt(year);
      const targetMonth = parseInt(month) - 1;
      
      filteredOrders = ordersList.filter(order => {
        if (!order.createdAt) return false;
        const d = typeof order.createdAt.toDate === "function" ? order.createdAt.toDate() : new Date(order.createdAt);
        return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
      });
      
      const monthName = new Date(targetYear, targetMonth).toLocaleString('default', { month: 'long' });
      label = `${monthName} ${targetYear}`;
    } else if (salesReportType === "yearly") {
      const targetYear = parseInt(salesReportYear);
      filteredOrders = ordersList.filter(order => {
        if (!order.createdAt) return false;
        const d = typeof order.createdAt.toDate === "function" ? order.createdAt.toDate() : new Date(order.createdAt);
        return d.getFullYear() === targetYear;
      });
      label = `Year ${targetYear}`;
    } else if (salesReportType === "custom") {
      const start = salesReportStartDate ? new Date(salesReportStartDate) : new Date(0);
      const end = salesReportEndDate ? new Date(salesReportEndDate) : new Date();
      end.setHours(23, 59, 59, 999);
      
      filteredOrders = ordersList.filter(order => {
        if (!order.createdAt) return false;
        const d = typeof order.createdAt.toDate === "function" ? order.createdAt.toDate() : new Date(order.createdAt);
        return d >= start && d <= end;
      });
      
      label = `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
    }

    if (filteredOrders.length === 0) {
      alert("No sales records found for the selected time period.");
      return;
    }

    let html = `
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
          th { background-color: #ec4899; color: white; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 10px; vertical-align: middle; text-align: left; font-size: 13px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .header { background-color: #0f172a; color: white; text-align: center; font-size: 16px; font-weight: bold; padding: 14px; }
          .summary { background-color: #f1f5f9; font-weight: bold; }
          .value { font-weight: bold; color: #db2777; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <th colspan="10" class="header">SALES & GST TAX REPORT (${label})</th>
          </tr>
          <tr>
            <th>Order Date</th>
            <th>Order ID</th>
            <th>Invoice Number</th>
            <th>SKU</th>
            <th>Item Title</th>
            <th>Quantity</th>
            <th>Base Price (₹)</th>
            <th>GST Rate (%)</th>
            <th>GST Amount (₹)</th>
            <th>Total Price (₹)</th>
          </tr>
    `;

    let grandTotalGst = 0;
    let grandTotalSales = 0;

    filteredOrders.forEach(order => {
      const formattedDate = order.createdAt 
        ? (typeof order.createdAt.toDate === "function" ? order.createdAt.toDate().toLocaleDateString() : new Date(order.createdAt).toLocaleDateString())
        : '—';
      const invoiceNo = getInvoiceNo(order);
      
      (order.items || []).forEach((item: any) => {
        const currentPrice = Number(item.price || 0);
        const rate = typeof item.gstRate === 'number' ? item.gstRate : 18;
        
        const totalAmount = currentPrice * item.quantity;
        const basePrice = item.basePrice || (currentPrice / (1 + rate/100));
        const gstAmount = item.gstAmount || (currentPrice - basePrice);
        
        const totalBase = basePrice * item.quantity;
        const totalGst = gstAmount * item.quantity;

        grandTotalGst += totalGst;
        grandTotalSales += totalAmount;

        html += `
          <tr>
            <td>${formattedDate}</td>
            <td>${order.id}</td>
            <td>${invoiceNo}</td>
            <td>${item.sku || '—'}</td>
            <td>${item.title || '—'}</td>
            <td>${item.quantity}</td>
            <td>₹${Math.round(totalBase)}</td>
            <td>${rate}%</td>
            <td>₹${Math.round(totalGst)}</td>
            <td class="value">₹${Math.round(totalAmount)}</td>
          </tr>
        `;
      });
    });

    html += `
          <tr class="summary">
            <td colspan="8" style="text-align: right; padding-right: 15px;">GRAND TOTALS:</td>
            <td class="value">₹${Math.round(grandTotalGst)}</td>
            <td class="value" style="background-color: #fbcfe8;">₹${Math.round(grandTotalSales)}</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_report_${label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // Fetch promotions and stock alerts
  useEffect(() => {
    // 1. Fetch promotions
    const unsubscribePromos = onSnapshot(query(collection(db, "promotions"), orderBy("createdAt", "desc")), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPromotions(list);
    });

    // 2. Fetch stock subscriptions
    const unsubscribeSubs = onSnapshot(query(collection(db, "back_in_stock_subscriptions"), orderBy("createdAt", "desc")), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBackInStockSubs(list);
    });

    return () => {
      unsubscribePromos();
      unsubscribeSubs();
    };
  }, []);

  const handlePromoBannerUpload = async (file: File) => {
    setUploadingPromoBanner(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      
      const res = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
        method: "POST",
        body: formData
      });
      
      if (res.ok) {
        const resJson = await res.json();
        const url = resJson?.data?.url;
        if (url) {
          setPromoBannerUrl(url);
          setSuccess("Promo banner uploaded successfully!");
          setTimeout(() => setSuccess(""), 3000);
        } else {
          setError("Failed to resolve uploaded banner image link.");
        }
      } else {
        setError("ImgBB server upload rejected.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to upload promo banner image: " + err.message);
    } finally {
      setUploadingPromoBanner(false);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoTitle.trim()) {
      alert("Please enter a title for the promotion.");
      return;
    }
    if (!promoStartDate || !promoEndDate) {
      alert("Please select start and end dates.");
      return;
    }
    if (promoStartDate >= promoEndDate) {
      alert("Start date must be before end date.");
      return;
    }
    if (!promoBannerUrl) {
      alert("Please upload a promo banner first.");
      return;
    }

    setSavingPromo(true);
    try {
      const newPromo = {
        title: promoTitle.trim(),
        discountPercent: Number(promoDiscount),
        bannerUrl: promoBannerUrl,
        targetCategory: promoCategory,
        startDate: new Date(promoStartDate).toISOString(),
        endDate: new Date(promoEndDate).toISOString(),
        isActive: promoIsActive,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "promotions"), newPromo);
      setSuccess("Promotion scheduled successfully!");
      setTimeout(() => setSuccess(""), 3000);

      // Reset fields
      setPromoTitle("");
      setPromoDiscount(10);
      setPromoStartDate("");
      setPromoEndDate("");
      setPromoCategory("All");
      setPromoBannerFile(null);
      setPromoBannerUrl("");
      setPromoIsActive(true);
    } catch (err: any) {
      console.error("Failed to schedule promotion:", err);
      setError("Failed to schedule promotion: " + err.message);
    } finally {
      setSavingPromo(false);
    }
  };

  const handleTogglePromo = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "promotions", id), {
        isActive: !currentStatus
      });
      setSuccess("Promotion status updated!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err: any) {
      console.error(err);
      setError("Failed to update status: " + err.message);
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (!confirm("Are you sure you want to delete this scheduled promotion?")) return;
    try {
      await deleteDoc(doc(db, "promotions", id));
      setSuccess("Promotion deleted successfully!");
      setTimeout(() => setSuccess(""), 2500);
    } catch (err: any) {
      console.error(err);
      setError("Failed to delete promotion: " + err.message);
    }
  };

  // Initialize Bulk Pricing Spreadsheet Rows
  useEffect(() => {
    if (viewMode === "bulk-pricing" && products.length > 0) {
      setBulkPricingRows(products.map(p => ({
        id: p.id,
        image: p.image || "",
        title: p.title || "",
        brand: p.brand || "",
        sku: p.sku || "",
        purchasePrice: p.purchasePrice !== undefined && p.purchasePrice !== null ? p.purchasePrice.toString() : "",
        packingCharges: p.packingCharges !== undefined && p.packingCharges !== null ? p.packingCharges.toString() : "",
        courierCharges: p.courierCharges !== undefined && p.courierCharges !== null ? p.courierCharges.toString() : "",
        otherExpenses: p.otherExpenses !== undefined && p.otherExpenses !== null ? p.otherExpenses.toString() : "",
        profit: p.profit !== undefined && p.profit !== null ? p.profit.toString() : "",
        gstRate: p.gstRate !== undefined && p.gstRate !== null ? p.gstRate.toString() : "18",
        price: p.price !== undefined && p.price !== null ? p.price.toString() : "",
        mrp: p.mrp !== undefined && p.mrp !== null ? p.mrp.toString() : "",
        quantity: p.quantity !== undefined && p.quantity !== null ? p.quantity.toString() : "0",
        hasVariants: !!(p.variants && p.variants.length > 0),
        variants: p.variants ? p.variants.map((v: any) => ({
          id: v.id || `var_${Date.now()}_${Math.random()}`,
          size: v.size || "",
          sizeUnit: v.sizeUnit || "",
          color: v.color || "",
          material: v.material || "",
          price: v.price !== undefined && v.price !== null ? v.price.toString() : "",
          mrp: v.mrp !== undefined && v.mrp !== null ? v.mrp.toString() : "",
          stock: v.stock !== undefined && v.stock !== null ? v.stock.toString() : "0",
          sku: v.sku || "",
          image: v.image || "",
          images: v.images || []
        })) : []
      })));
    } else if (viewMode !== "bulk-pricing") {
      // Clear rows when switching away
      setBulkPricingRows([]);
      setExpandedProductIds([]);
    }
  }, [viewMode, products]);



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

  // Bulk Pricing Spreadsheet Handlers
  const handleBulkPricingChange = (idx: number, field: string, value: string) => {
    setBulkPricingRows(prev => {
      const updated = [...prev];
      const updatedItem = { ...updated[idx] };
      
      updatedItem[field] = value;
      
      // Auto-calculate Selling Price using expected profit if cost details are changed
      const costFields = ["purchasePrice", "packingCharges", "courierCharges", "otherExpenses", "profit"];
      if (costFields.includes(field) || field === "gstRate") {
        const base = 
          Number(updatedItem.purchasePrice || 0) + 
          Number(updatedItem.packingCharges || 0) + 
          Number(updatedItem.courierCharges || 0) + 
          Number(updatedItem.otherExpenses || 0) + 
          Number(updatedItem.profit || 0);
        const rate = Number(updatedItem.gstRate || 0);
        const computed = base + Math.round(base * (rate / 100));
        updatedItem.price = computed > 0 ? computed.toString() : updatedItem.price;
      }
      
      updated[idx] = updatedItem;
      return updated;
    });
  };

  const handleBulkPricingVariantChange = (prodIdx: number, varIdx: number, field: string, value: string) => {
    setBulkPricingRows(prev => {
      const updated = [...prev];
      const updatedItem = { ...updated[prodIdx] };
      const updatedVariants = [...updatedItem.variants];
      
      updatedVariants[varIdx] = {
        ...updatedVariants[varIdx],
        [field]: value
      };
      
      updatedItem.variants = updatedVariants;
      
      // Update total stock from the variant stock totals
      const totalStock = updatedVariants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
      updatedItem.quantity = totalStock.toString();
      
      updated[prodIdx] = updatedItem;
      return updated;
    });
  };

  const handleBulkPricingSyncCalculated = (idx: number) => {
    setBulkPricingRows(prev => {
      const updated = [...prev];
      const updatedItem = { ...updated[idx] };
      const base = 
        Number(updatedItem.purchasePrice || 0) + 
        Number(updatedItem.packingCharges || 0) + 
        Number(updatedItem.courierCharges || 0) + 
        Number(updatedItem.otherExpenses || 0) + 
        Number(updatedItem.profit || 0);
      const rate = Number(updatedItem.gstRate || 0);
      const computed = base + Math.round(base * (rate / 100));
      
      if (computed > 0) {
        updatedItem.price = computed.toString();
      }
      updated[idx] = updatedItem;
      return updated;
    });
  };

  const handleBulkPricingSave = async () => {
    setSavingBulkPricing(true);
    setError("");
    setSuccess("");
    
    try {
      const { doc: fsDoc, writeBatch } = await import("firebase/firestore");
      const batch = writeBatch(db);
      let changedCount = 0;
      
      for (const row of bulkPricingRows) {
        const original = products.find(p => p.id === row.id);
        if (!original) continue;
        
        const hasVariants = !!(row.variants && row.variants.length > 0);
        
        const isChanged = 
          row.sku !== (original.sku || "") ||
          Number(row.purchasePrice || 0) !== Number(original.purchasePrice || 0) ||
          Number(row.packingCharges || 0) !== Number(original.packingCharges || 0) ||
          Number(row.courierCharges || 0) !== Number(original.courierCharges || 0) ||
          Number(row.otherExpenses || 0) !== Number(original.otherExpenses || 0) ||
          Number(row.profit || 0) !== Number(original.profit || 0) ||
          Number(row.gstRate || 0) !== Number(original.gstRate || 18) ||
          Number(row.price || 0) !== Number(original.price || 0) ||
          Number(row.mrp || 0) !== Number(original.mrp || 0) ||
          Number(row.quantity || 0) !== Number(original.quantity || 0) ||
          JSON.stringify(row.variants) !== JSON.stringify(original.variants || []);
          
        if (isChanged) {
          const docRef = fsDoc(db, "products", row.id);
          const updateData: any = {
            sku: row.sku,
            purchasePrice: row.purchasePrice !== "" ? Number(row.purchasePrice) : null,
            packingCharges: row.packingCharges !== "" ? Number(row.packingCharges) : null,
            courierCharges: row.courierCharges !== "" ? Number(row.courierCharges) : null,
            otherExpenses: row.otherExpenses !== "" ? Number(row.otherExpenses) : null,
            profit: row.profit !== "" ? Number(row.profit) : null,
            gstRate: Number(row.gstRate),
            price: Number(row.price || 0),
            mrp: row.mrp !== "" ? Number(row.mrp) : null,
            quantity: Number(row.quantity || 0),
          };
          
          if (hasVariants) {
            updateData.variants = row.variants.map((v: any) => ({
              id: v.id,
              size: v.size,
              sizeUnit: v.sizeUnit || "",
              color: v.color || "",
              material: v.material || "",
              price: Number(v.price || 0),
              mrp: Number(v.mrp || 0),
              stock: Number(v.stock || 0),
              sku: v.sku || "",
              image: v.image || "",
              images: v.images || []
            }));
          }
          
          batch.update(docRef, updateData);
          changedCount++;
        }
      }
      
      if (changedCount > 0) {
        await batch.commit();
        setSuccess(`Successfully saved bulk pricing modifications for ${changedCount} item(s)!`);
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setSuccess("No modifications detected in catalog spreadsheet.");
        setTimeout(() => setSuccess(""), 3000);
      }
      
      setViewMode("inventory");
    } catch (err: any) {
      console.error("Bulk pricing save failed:", err);
      setError(err.message || "Failed to batch save product rate updates.");
    } finally {
      setSavingBulkPricing(false);
    }
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
  const basePrice = 
    Number(purchasePrice || 0) + 
    Number(packingCharges || 0) + 
    Number(courierCharges || 0) + 
    Number(otherExpenses || 0) + 
    Number(profit || 0);

  const calculatedPrice = basePrice + Math.round(basePrice * (Number(gstRate || 0) / 100));

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

  // Synchronize price state when pricing breakdown fields change
  useEffect(() => {
    const hasBreakdown = 
      purchasePrice !== "" || 
      packingCharges !== "" || 
      courierCharges !== "" || 
      otherExpenses !== "" || 
      profit !== "";
      
    if (hasBreakdown) {
      const base = 
        Number(purchasePrice || 0) + 
        Number(packingCharges || 0) + 
        Number(courierCharges || 0) + 
        Number(otherExpenses || 0) + 
        Number(profit || 0);
      const rate = Number(gstRate || 0);
      const computed = base + Math.round(base * (rate / 100));
      setPrice(computed > 0 ? computed.toString() : "");
    }
  }, [purchasePrice, packingCharges, courierCharges, otherExpenses, profit, gstRate]);

  const handleMigrateProducts = async () => {
    if (!confirm("Are you sure you want to migrate all products and orders? This will update category schemas, update product prices to be GST-inclusive, and update existing orders/invoices to apply the new GST calculation.")) {
      return;
    }
    setMigrating(true);
    setMigrationStatus("Migrating products and recalculating prices...");
    try {
      const { getDocs, collection, updateDoc, doc: firestoreDoc } = await import("firebase/firestore");
      
      // 1. Migrate Products
      const productsSnap = await getDocs(collection(db, "products"));
      let productCount = 0;
      
      for (const productDoc of productsSnap.docs) {
        const data = productDoc.data();
        const docUpdates: any = {};
        
        // Category schema migration
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
          docUpdates.category = newCategory;
          docUpdates.subCategory = newSubCategory;
        }

        // Price migration (add GST to base cost)
        const rate = typeof data.gstRate === 'number' ? data.gstRate : 18;
        
        // Calculate base price
        const base = 
          Number(data.purchasePrice || 0) + 
          Number(data.packingCharges || 0) + 
          Number(data.courierCharges || 0) + 
          Number(data.otherExpenses || 0) + 
          Number(data.profit || 0);
          
        const basePrice = base > 0 ? base : Number(data.price || 0);
        const newPrice = basePrice + Math.round(basePrice * (rate / 100));
        const newMrp = (data.mrp && Number(data.mrp) >= newPrice) ? Number(data.mrp) : Math.round(newPrice * 1.5);
        
        if (newPrice !== Number(data.price || 0) || newMrp !== Number(data.mrp || 0)) {
          docUpdates.price = newPrice;
          docUpdates.mrp = newMrp;
        }

        // Variant price migration
        if (data.variants && data.variants.length > 0) {
          let variantsUpdated = false;
          const newVariants = data.variants.map((v: any) => {
            const vBasePrice = Number(v.price || 0);
            const vNewPrice = vBasePrice + Math.round(vBasePrice * (rate / 100));
            const vNewMrp = (v.mrp && Number(v.mrp) >= vNewPrice) ? Number(v.mrp) : Math.round(vNewPrice * 1.5);
            if (vNewPrice !== v.price || vNewMrp !== v.mrp) {
              variantsUpdated = true;
            }
            return {
              ...v,
              price: vNewPrice,
              mrp: vNewMrp
            };
          });
          
          if (variantsUpdated) {
            docUpdates.variants = newVariants;
          }
        }
        
        if (Object.keys(docUpdates).length > 0) {
          const docRef = firestoreDoc(db, "products", productDoc.id);
          await updateDoc(docRef, docUpdates);
          productCount++;
        }
      }

      // 2. Migrate Orders
      setMigrationStatus("Migrating existing orders/invoices...");
      const ordersSnap = await getDocs(collection(db, "orders"));
      let orderCount = 0;
      
      for (const orderDoc of ordersSnap.docs) {
        const data = orderDoc.data();
        if (!data.items || data.items.length === 0) continue;
        
        let orderSubtotal = 0;
        let orderTotalGst = 0;
        let orderTotalAmount = 0;
        let orderUpdated = false;
        
        const updatedItems = data.items.map((item: any) => {
          const rate = typeof item.gstRate === 'number' ? item.gstRate : 18;
          
          const currentPrice = Number(item.price || 0);
          const currentBasePrice = Number(item.basePrice || 0);
          
          if (currentBasePrice < currentPrice) {
            orderUpdated = true;
            const newBasePrice = currentPrice;
            const newGstAmount = newBasePrice * (rate / 100);
            const newPrice = newBasePrice + newGstAmount;
            
            const mrp = item.mrp || Math.round(newPrice * 1.5);
            const newMrp = mrp >= newPrice ? mrp : Math.round(newPrice * 1.5);
            
            orderSubtotal += newBasePrice * item.quantity;
            orderTotalGst += newGstAmount * item.quantity;
            orderTotalAmount += newPrice * item.quantity;
            
            return {
              ...item,
              price: Math.round(newPrice),
              basePrice: Math.round(newBasePrice),
              gstAmount: Math.round(newGstAmount),
              mrp: Math.round(newMrp)
            };
          } else {
            orderSubtotal += currentBasePrice * item.quantity;
            orderTotalGst += Number(item.gstAmount || 0) * item.quantity;
            orderTotalAmount += currentPrice * item.quantity;
            return item;
          }
        });
        
        if (orderUpdated) {
          const courierFee = data.courierCharges || 0;
          const finalTotalAmount = orderTotalAmount + courierFee;
          
          const docRef = firestoreDoc(db, "orders", orderDoc.id);
          await updateDoc(docRef, {
            items: updatedItems,
            subtotal: Math.round(orderSubtotal),
            totalGst: Math.round(orderTotalGst),
            totalAmount: Math.round(finalTotalAmount)
          });
          orderCount++;
        }
      }
      
      setMigrationStatus(`Successfully migrated and updated pricing for ${productCount} products and ${orderCount} orders/invoices.`);
    } catch (err: any) {
      setMigrationStatus(`Migration failed: ${err.message}`);
    } finally {
      setMigrating(false);
    }
  };

  const handleSort = (key: "item" | "category" | "subcategory" | "quantity" | "pricing" | "price") => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (key: "item" | "category" | "subcategory" | "quantity" | "pricing" | "price") => {
    if (sortKey !== key) {
      return <ArrowUpDown size={11} className="opacity-30" />;
    }
    if (sortDirection === "asc") {
      return <ChevronUp size={11} className="text-pink-500" />;
    }
    return <ChevronDown size={11} className="text-pink-500" />;
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
    setPrice("");
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
    setOneLiner("");
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
    setVideoUrl("");
    setVideoFile(null);
    setVideoPreview("");
    setUploadingVideo(false);
    setUploadProgress(0);
  };

  const handleEditClick = (product: any) => {
    setViewMode("add-product");
    setEditingId(product.id);
    setBrand(product.brand || "");
    setTitle(product.title || "");
    setCategory(product.category || STORE_CATEGORIES[0].name);
    setSubCategory(product.subCategory || "");
    setPrice(product.price !== undefined && product.price !== null ? product.price.toString() : "");
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
    setOneLiner(product.oneLiner || "");
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
        image: v.image || "",
        images: v.images || (v.image ? [v.image] : [])
      })));
    } else {
      setHasVariants(false);
      setVariantRows([]);
    }

    setSize(product.size || "");
    setSizeUnit(product.sizeUnit || "");
    setColor(product.color || "");
    setMaterial(product.material || "");
    setVideoUrl(product.videoUrl || "");
    setVideoFile(null);
    setVideoPreview("");
    setUploadingVideo(false);
    setUploadProgress(0);
    
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

      let finalVideoUrl = videoUrl;

      // Upload local video file if present (with local fallback if Firebase Storage fails)
      if (videoFile) {
        setUploadingVideo(true);
        setUploadProgress(20);
        try {
          // Attempt Firebase Storage upload first
          const storageRef = ref(storage, `products/videos/${Date.now()}_${videoFile.name}`);
          setUploadProgress(50);
          const snapshot = await uploadBytes(storageRef, videoFile);
          setUploadProgress(80);
          finalVideoUrl = await getDownloadURL(snapshot.ref);
          setVideoUrl(finalVideoUrl);
          setUploadProgress(100);
        } catch (uploadErr: any) {
          console.warn("Firebase Storage failed, attempting local server upload fallback...", uploadErr);
          setUploadProgress(60);
          try {
            const formData = new FormData();
            formData.append("file", videoFile);
            
            const response = await fetch("/api/upload-video", {
              method: "POST",
              body: formData,
            });
            
            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.error || "Server upload endpoint failed");
            }
            
            const resData = await response.json();
            if (resData.success && resData.url) {
              finalVideoUrl = resData.url;
              setVideoUrl(finalVideoUrl);
              setUploadProgress(100);
            } else {
              throw new Error("Invalid response from upload server");
            }
          } catch (fallbackErr: any) {
            setUploadingVideo(false);
            throw new Error(`Video upload failed. Firebase error: ${uploadErr.message}. Local upload fallback error: ${fallbackErr.message}`);
          }
        } finally {
          setUploadingVideo(false);
        }
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
        image: v.image || "",
        images: v.images || (v.image ? [v.image] : [])
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
        const finalPrice = Number(price || 0);
        if (mrp !== "" && Number(mrp) < finalPrice) {
          throw new Error("Maximum Retail Price (MRP) cannot be less than the Selling Price (₹" + finalPrice + ").");
        }
      }

      const productData: any = {
        brand,
        title,
        price: Number(price || 0),
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
        videoUrl: finalVideoUrl ? getDirectVideoUrl(finalVideoUrl) : "",
        
        // Flexible model fields
        sku: sku.trim() || `${brand ? brand.trim().substring(0, 3).toUpperCase() : "CS"}-${category ? category.trim().substring(0, 3).toUpperCase() : "GEN"}-${Math.floor(100000 + Math.random() * 900000)}`,
        shortDescription: shortDescription.trim(),
        oneLiner: oneLiner.trim(),
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

      if (category.toLowerCase() === "fashion" || category.toLowerCase() === "lifestyle & fashion") {
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
          oneLiner: "",
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

        const baseBulkPrice = 
          Number(item.purchasePrice || 0) + 
          Number(item.packingCharges || 0) + 
          Number(item.courierCharges || 0) + 
          Number(item.otherExpenses || 0) + 
          Number(item.profit || 0);
        const calculatedBulkPrice = baseBulkPrice + Math.round(baseBulkPrice * (Number(item.gstRate || 0) / 100));

        const isFashion = item.category?.toLowerCase() === "fashion" || item.category?.toLowerCase() === "lifestyle & fashion";
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
          oneLiner: "",
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

  // Sort products for the table
  if (sortKey !== "none") {
    filteredProducts.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortKey === "item") {
        valA = ((a.brand || "") + " " + (a.title || "")).toLowerCase();
        valB = ((b.brand || "") + " " + (b.title || "")).toLowerCase();
      } else if (sortKey === "category") {
        valA = (a.category || "").toLowerCase();
        valB = (b.category || "").toLowerCase();
      } else if (sortKey === "subcategory") {
        valA = (a.subCategory || "").toLowerCase();
        valB = (b.subCategory || "").toLowerCase();
      } else if (sortKey === "quantity") {
        valA = Number(a.quantity || 0);
        valB = Number(b.quantity || 0);
      } else if (sortKey === "pricing") {
        valA = Number(a.profit || 0);
        valB = Number(b.profit || 0);
      } else if (sortKey === "price") {
        valA = Number(a.price || 0);
        valB = Number(b.price || 0);
      }

      if (typeof valA === "string") {
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }
    });
  }

  // Real-time Pricing Simulator calculations
  const simPurchaseCost = Number(purchasePrice || 0);
  const simPackingCost = Number(packingCharges || 0);
  const simCourierCost = Number(courierCharges || 0);
  const simOtherCost = Number(otherExpenses || 0);
  const simLandedCost = simPurchaseCost + simPackingCost + simCourierCost + simOtherCost;
  
  const simSellingPrice = Number(price || 0);
  const simGstRate = Number(gstRate || 0);
  
  const simGstAmount = Math.round(simSellingPrice * (simGstRate / (100 + simGstRate)));
  const simNetRevenue = simSellingPrice - simGstAmount;
  const simNetProfit = simNetRevenue - simLandedCost;
  
  const simNetMargin = simNetRevenue > 0 ? (simNetProfit / simNetRevenue) * 100 : 0;
  const simMarkup = simLandedCost > 0 ? (simNetProfit / simLandedCost) * 100 : 0;

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
          <button 
            onClick={() => { setViewMode("bulk-pricing"); resetForm(); }}
            className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${viewMode === "bulk-pricing" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/15" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Coins size={14} />
            <span>Bulk Pricing Edit</span>
          </button>
          <button 
            onClick={() => { setViewMode("reports"); resetForm(); }}
            className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${viewMode === "reports" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/15" : "text-slate-400 hover:text-slate-200"}`}
          >
            <BarChart3 size={14} />
            <span>Reports & Downloads</span>
          </button>
          <button 
            onClick={() => { setViewMode("scheduler"); resetForm(); }}
            className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${viewMode === "scheduler" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/15" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Calendar size={14} />
            <span>Sale Scheduler</span>
          </button>
          <button 
            onClick={() => { setViewMode("alerts"); resetForm(); }}
            className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${viewMode === "alerts" ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/15" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Bell size={14} />
            <span>Stock Alerts</span>
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

                {/* Product Showcase Video (Reel) Section */}
                <div className="border-b border-slate-900 pb-5 pt-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Product Showcase Video (Reel)
                  </label>
                  
                  {/* Local Video Selection / Preview */}
                  {videoPreview ? (
                    <div className="relative aspect-[9/16] max-w-[150px] mx-auto rounded-lg overflow-hidden border border-slate-800 bg-slate-950 mb-3 shadow-md">
                      <video src={videoPreview} className="w-full h-full object-cover" controls />
                      <button 
                        type="button" 
                        onClick={() => {
                          setVideoFile(null);
                          setVideoPreview("");
                          if (videoUrl.startsWith("blob:") || !videoUrl.startsWith("http")) {
                            setVideoUrl("");
                          }
                        }}
                        className="absolute top-1.5 right-1.5 bg-rose-650 text-white p-1 rounded-full hover:bg-rose-700 transition-colors cursor-pointer shadow-sm z-10"
                        title="Remove video"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : videoUrl && (
                    <div className="relative aspect-[9/16] max-w-[150px] mx-auto rounded-lg overflow-hidden border border-slate-800 bg-slate-950 mb-3 shadow-md">
                      <video src={getDirectVideoUrl(videoUrl)} className="w-full h-full object-cover" controls />
                      <button 
                        type="button" 
                        onClick={() => {
                          setVideoUrl("");
                          setVideoFile(null);
                          setVideoPreview("");
                        }}
                        className="absolute top-1.5 right-1.5 bg-rose-650 text-white p-1 rounded-full hover:bg-rose-700 transition-colors cursor-pointer shadow-sm z-10"
                        title="Remove video link"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}

                  {/* Drag & Drop / Select Video from Local Drive */}
                  <div 
                    onClick={() => {
                      document.getElementById("admin-video-file-input")?.click();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith("video/")) {
                        setVideoFile(file);
                        setVideoPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="border border-dashed border-slate-800 bg-slate-950/40 hover:bg-slate-950/60 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 mb-3"
                  >
                    <UploadCloud size={24} className="mb-1 text-slate-500" />
                    <p className="text-[10px] text-center text-slate-400 font-medium">
                      Click or drag to upload vertical video reel from local drive
                    </p>
                    <p className="text-[8px] text-center text-slate-500 font-semibold mt-0.5 uppercase tracking-wide">
                      Supports MP4, MOV, WebM, AVI (Max 15s)
                    </p>
                  </div>
                  <input 
                    type="file" 
                    id="admin-video-file-input" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setVideoFile(file);
                        setVideoPreview(URL.createObjectURL(file));
                      }
                    }} 
                    accept="video/*" 
                    className="hidden" 
                  />

                  {/* Fallback Paste URL */}
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={videoUrl} 
                      onChange={(e) => {
                        setVideoUrl(e.target.value);
                        setVideoFile(null);
                        setVideoPreview("");
                      }} 
                      className="flex-1 bg-slate-950/60 border border-slate-855 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-pink-500 transition-all placeholder-slate-700" 
                      placeholder="Or paste video URL (e.g. Google Drive, Dropbox, Cloudinary)..." 
                    />
                    {videoUrl && (
                      <button 
                        type="button"
                        onClick={() => {
                          setVideoUrl("");
                          setVideoFile(null);
                          setVideoPreview("");
                        }}
                        className="bg-slate-850 hover:bg-slate-805 border border-slate-805 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-350 hover:text-white transition-all cursor-pointer flex-shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1 leading-normal">
                    💡 <strong>Google Drive Tip:</strong> Set your video's sharing settings to <strong>&quot;Anyone with the link can view&quot;</strong> so customers can stream it.
                  </p>

                  {/* Upload Progress Bar */}
                  {uploadingVideo && (
                    <div className="mt-3">
                      <div className="flex justify-between items-center text-[8px] font-extrabold text-pink-500 uppercase tracking-widest mb-1">
                        <span>Uploading Video Reel...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-pink-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  )}
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
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">ONE-LINER DESCRIPTION (1 LINE)</label>
                  <input type="text" value={oneLiner} onChange={(e) => setOneLiner(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all placeholder-slate-705" placeholder="e.g. Elegant handmade natural marble chopping board" maxLength={85} />
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
                          price: price ? price.toString() : (calculatedPrice ? calculatedPrice.toString() : ""),
                          mrp: mrp || "",
                          stock: quantity || "10",
                          sku: "",
                          image: "",
                          images: []
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

                            {/* Column 2: Variant Images Uploader */}
                            <div className="space-y-3 flex flex-col justify-between">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Variant Photos (Multiple Angles)</label>
                              
                              {/* Variant Image Previews Grid */}
                              {variant.images && variant.images.length > 0 && (
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                  {variant.images.map((imgUrl, imgIdx) => (
                                    <div key={`${variant.id}_img_${imgIdx}`} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex flex-col justify-end shadow-md hover:border-pink-500/30 transition-all">
                                      <img src={imgUrl} alt={`Variant #${idx + 1} Angle ${imgIdx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                                      
                                      {/* Actions Overlay */}
                                      <div className="absolute inset-0 bg-black/45 flex flex-col justify-between p-1 opacity-100 transition-opacity">
                                        <div className="flex justify-between items-center w-full">
                                          {imgIdx === 0 ? (
                                            <span className="bg-pink-650 text-white text-[7px] font-extrabold px-1 rounded uppercase tracking-wider shadow-sm">
                                              Primary
                                            </span>
                                          ) : (
                                            <span></span>
                                          )}
                                          <button 
                                            type="button" 
                                            onClick={() => {
                                              const newVars = [...variantRows];
                                              const filtered = (newVars[idx].images || []).filter((_, i) => i !== imgIdx);
                                              newVars[idx].images = filtered;
                                              newVars[idx].image = filtered[0] || "";
                                              setVariantRows(newVars);
                                            }}
                                            className="bg-rose-655 text-white p-0.5 rounded-full hover:bg-rose-700 transition-colors cursor-pointer shadow-sm"
                                            title="Remove photo"
                                          >
                                            <X size={8} />
                                          </button>
                                        </div>

                                        <div className="flex justify-end space-x-0.5 w-full">
                                          {imgIdx > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newVars = [...variantRows];
                                                const updatedImages = [...(newVars[idx].images || [])];
                                                const temp = updatedImages[imgIdx];
                                                updatedImages[imgIdx] = updatedImages[imgIdx - 1];
                                                updatedImages[imgIdx - 1] = temp;
                                                newVars[idx].images = updatedImages;
                                                newVars[idx].image = updatedImages[0] || "";
                                                setVariantRows(newVars);
                                              }}
                                              className="bg-slate-900/90 hover:bg-black text-white px-1 py-0.5 rounded text-[8px] font-extrabold cursor-pointer"
                                              title="Move Left"
                                            >
                                              &lsaquo;
                                            </button>
                                          )}
                                          {imgIdx < (variant.images.length - 1) && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newVars = [...variantRows];
                                                const updatedImages = [...(newVars[idx].images || [])];
                                                const temp = updatedImages[imgIdx];
                                                updatedImages[imgIdx] = updatedImages[imgIdx + 1];
                                                updatedImages[imgIdx + 1] = temp;
                                                newVars[idx].images = updatedImages;
                                                newVars[idx].image = updatedImages[0] || "";
                                                setVariantRows(newVars);
                                              }}
                                              className="bg-slate-900/90 hover:bg-black text-white px-1 py-0.5 rounded text-[8px] font-extrabold cursor-pointer"
                                              title="Move Right"
                                            >
                                              &rsaquo;
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Upload Zone */}
                              <div className="flex gap-2 items-center bg-slate-950/20 border border-slate-900 rounded-xl p-2.5 flex-1 min-h-[75px]">
                                <div className="flex-1 flex flex-col gap-1.5 justify-center">
                                  <div className="flex gap-1">
                                    <label className="bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-pink-500/30 px-3 py-1.5 rounded-lg text-xs font-bold text-center cursor-pointer transition-all flex-1">
                                      {uploadingVariantIdx === idx ? "Uploading..." : "Upload Photo(s)"}
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        multiple
                                        onChange={(e) => {
                                          const files = e.target.files;
                                          if (files) handleVariantImagesUpload(idx, files);
                                        }}
                                        className="hidden" 
                                      />
                                    </label>
                                  </div>

                                  {/* Paste variant photo URL */}
                                  <div className="flex gap-1">
                                    <input 
                                      type="text" 
                                      placeholder="Or paste photo URL..." 
                                      id={`var_url_${idx}`}
                                      className="flex-1 bg-slate-950 border border-slate-900 rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:border-pink-500 transition-all font-sans"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          const target = e.target as HTMLInputElement;
                                          const urlVal = target.value.trim();
                                          if (urlVal) {
                                            setVariantRows(prev => {
                                              const updated = [...prev];
                                              const currentImages = updated[idx].images || [];
                                              const newImages = [...currentImages, urlVal];
                                              updated[idx].images = newImages;
                                              if (!updated[idx].image) {
                                                updated[idx].image = urlVal;
                                              }
                                              return updated;
                                            });
                                            target.value = "";
                                          }
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const el = document.getElementById(`var_url_${idx}`) as HTMLInputElement;
                                        const urlVal = el?.value.trim();
                                        if (urlVal) {
                                          setVariantRows(prev => {
                                            const updated = [...prev];
                                            const currentImages = updated[idx].images || [];
                                            const newImages = [...currentImages, urlVal];
                                            updated[idx].images = newImages;
                                            if (!updated[idx].image) {
                                              updated[idx].image = urlVal;
                                            }
                                            return updated;
                                          });
                                          el.value = "";
                                        }
                                      }}
                                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-800 px-2.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                    >
                                      Add
                                    </button>
                                  </div>
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
                        price: price ? price.toString() : (calculatedPrice ? calculatedPrice.toString() : ""),
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
                  (category.toLowerCase() === "fashion" || category.toLowerCase() === "lifestyle & fashion") ? (
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
                    {/* Editable Selling Price Field */}
                    <div className="flex flex-col justify-center text-right bg-[#e11d48]/5 border border-pink-500/20 p-2 rounded-lg">
                      <label className="block text-[8px] font-bold text-pink-500 uppercase tracking-wider mb-0.5">Selling Price (₹) *</label>
                      <input 
                        type="number" 
                        required
                        value={price} 
                        onChange={(e) => setPrice(e.target.value)} 
                        className="w-full bg-transparent text-right font-extrabold text-white text-sm outline-none border-b border-transparent focus:border-pink-500/45 pb-0.5"
                        placeholder="0" 
                      />
                    </div>
                  </div>

                  {/* Dynamic Pricing Simulator Panel */}
                  <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-xl space-y-3.5 mt-4 shadow-inner">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                      <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest flex items-center gap-1">
                        <Coins size={12} />
                        Dynamic Price Simulator
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const base = simLandedCost + Number(profit || 0);
                          const computed = base + Math.round(base * (simGstRate / 100));
                          setPrice(computed > 0 ? computed.toString() : "");
                        }}
                        className="text-[9px] bg-pink-500/10 text-pink-500 hover:bg-pink-500 hover:text-white border border-pink-500/20 hover:border-transparent px-2 py-1 rounded-md uppercase font-extrabold transition-all cursor-pointer"
                        title="Auto-apply calculated expected profit + GST to Selling Price"
                      >
                        Apply Expected Price
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-400 font-semibold leading-relaxed">
                      <div className="flex justify-between">
                        <span>Landed Cost:</span>
                        <span className="text-slate-200 font-bold">₹{simLandedCost}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>GST portion:</span>
                        <span className="text-slate-200 font-bold">₹{simGstAmount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Net Revenue:</span>
                        <span className="text-slate-200 font-bold">₹{simNetRevenue}</span>
                      </div>
                      <div className="flex justify-between border-l border-slate-800 pl-2">
                        <span>Net Profit:</span>
                        <span className={`font-black ${simNetProfit > 0 ? 'text-emerald-400' : simNetProfit < 0 ? 'text-rose-405' : 'text-slate-300'}`}>
                          ₹{simNetProfit}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar of Margin Health */}
                    <div className="space-y-2 pt-2 border-t border-slate-900/60">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-slate-400">Margin vs Markup</span>
                        <span className={simNetProfit > 0 ? 'text-emerald-400' : simNetProfit < 0 ? 'text-rose-405' : 'text-slate-400'}>
                          Margin: {simNetMargin.toFixed(1)}% | Markup: {simMarkup.toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-850/30">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            simNetMargin >= 20 
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                              : simNetMargin > 0 
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-500' 
                                : simNetMargin < 0 
                                  ? 'bg-gradient-to-r from-rose-500 to-red-500' 
                                  : 'bg-slate-700'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, simNetMargin))}%` }}
                        ></div>
                      </div>

                      <span className="text-[10px] text-slate-500 block leading-relaxed font-medium">
                        {simNetMargin >= 20 
                          ? "✓ Healthy profit margin! Excellent pricing structure." 
                          : simNetMargin > 0 
                            ? "⚠ Thin margin. Ensure courier and packaging fees are exact." 
                            : simNetMargin < 0 
                              ? "✗ Selling at a net LOSS. Adjust Selling Price or reduce costs!" 
                              : "Enter purchase, expenses, and expected profit to simulate."}
                      </span>
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

          {/* Bulk Pricing Spreadsheet Column */}
          {viewMode === "bulk-pricing" && (
            <div className="lg:col-span-12 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Coins className="text-pink-500" />
                    Bulk Catalog Price Spreadsheet Editor
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Edit SKU, costs, margins, selling price, and stock levels across all catalog items in real-time. Expand variants to modify sub-sizes.
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Are you sure you want to overwrite all Selling Prices with their calculated base cost + expected profit + GST values?")) {
                        bulkPricingRows.forEach((_, idx) => handleBulkPricingSyncCalculated(idx));
                      }
                    }}
                    className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white border border-slate-800 hover:border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Sync All Calculated Rates
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setViewMode("inventory")}
                    className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white border border-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkPricingSave}
                    disabled={savingBulkPricing}
                    className="px-5 py-2 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg shadow-pink-500/10 transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                  >
                    {savingBulkPricing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save All Changes</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Table Wrapper */}
              <div className="bg-slate-900/40 backdrop-blur rounded-2xl border border-slate-900 overflow-hidden shadow-xl">
                <div className="overflow-x-auto select-none">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        <th className="px-3 py-4 w-12 text-center">Variants</th>
                        <th className="px-4 py-4 w-52">Item Details</th>
                        <th className="px-3 py-4 w-32">SKU Code</th>
                        <th className="px-3 py-4 w-20">Purchase (₹)</th>
                        <th className="px-3 py-4 w-20">Packing (₹)</th>
                        <th className="px-3 py-4 w-20">Courier (₹)</th>
                        <th className="px-3 py-4 w-20">Other Exp (₹)</th>
                        <th className="px-3 py-4 w-20">Expected Profit</th>
                        <th className="px-3 py-4 w-20">GST Rate</th>
                        <th className="px-3 py-4 w-24">Selling Price (₹)</th>
                        <th className="px-3 py-4 w-24">MRP (₹)</th>
                        <th className="px-3 py-4 w-20">Stock</th>
                        <th className="px-4 py-4 w-40 text-center">Net Margin / Markup</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/50">
                      {bulkPricingRows.map((row, idx) => {
                        const isExpanded = expandedProductIds.includes(row.id);
                        
                        // Simulator variables for this row
                        const landed = 
                          Number(row.purchasePrice || 0) + 
                          Number(row.packingCharges || 0) + 
                          Number(row.courierCharges || 0) + 
                          Number(row.otherExpenses || 0);
                        const sell = Number(row.price || 0);
                        const rate = Number(row.gstRate || 0);
                        const gstComponent = Math.round(sell * (rate / (100 + rate)));
                        const netRev = sell - gstComponent;
                        const netProf = netRev - landed;
                        const marginPercent = netRev > 0 ? (netProf / netRev) * 100 : 0;
                        
                        return (
                          <>
                            <tr key={row.id} className={`hover:bg-slate-900/20 transition-all ${isExpanded ? 'bg-slate-900/10' : ''}`}>
                              <td className="px-3 py-4 text-center">
                                {row.hasVariants ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpandedProductIds(prev => 
                                        isExpanded ? prev.filter(id => id !== row.id) : [...prev, row.id]
                                      );
                                    }}
                                    className="p-1 rounded bg-slate-800 hover:bg-pink-600 hover:text-white transition-colors cursor-pointer text-[10px] font-bold text-slate-350"
                                    title="View variants for this product"
                                  >
                                    {isExpanded ? 'Hide' : `Show (${row.variants.length})`}
                                  </button>
                                ) : (
                                  <span className="text-slate-600 font-bold">—</span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center space-x-2.5">
                                  <img src={row.image} alt={row.brand} className="w-8 h-10 object-cover rounded bg-slate-950 border border-slate-900 flex-shrink-0" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-extrabold text-slate-100 truncate w-32">{row.title}</span>
                                    <span className="text-[9px] text-slate-500 truncate w-32 mt-0.5">{row.brand}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-4">
                                <input
                                  type="text"
                                  value={row.sku}
                                  onChange={(e) => handleBulkPricingChange(idx, "sku", e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 rounded px-2 py-1.5 text-xs text-white font-mono outline-none"
                                  placeholder="SKU"
                                />
                              </td>
                              
                              {/* Cost Fields: Disabled if product has variants since variant pricing is specific */}
                              <td className="px-3 py-4">
                                <input
                                  type="number"
                                  disabled={row.hasVariants}
                                  value={row.purchasePrice}
                                  onChange={(e) => handleBulkPricingChange(idx, "purchasePrice", e.target.value)}
                                  className="w-full bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 focus:border-pink-500 rounded px-1.5 py-1 text-xs text-white text-center outline-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-4">
                                <input
                                  type="number"
                                  disabled={row.hasVariants}
                                  value={row.packingCharges}
                                  onChange={(e) => handleBulkPricingChange(idx, "packingCharges", e.target.value)}
                                  className="w-full bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 focus:border-pink-500 rounded px-1.5 py-1 text-xs text-white text-center outline-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-4">
                                <input
                                  type="number"
                                  disabled={row.hasVariants}
                                  value={row.courierCharges}
                                  onChange={(e) => handleBulkPricingChange(idx, "courierCharges", e.target.value)}
                                  className="w-full bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 focus:border-pink-500 rounded px-1.5 py-1 text-xs text-white text-center outline-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-4">
                                <input
                                  type="number"
                                  disabled={row.hasVariants}
                                  value={row.otherExpenses}
                                  onChange={(e) => handleBulkPricingChange(idx, "otherExpenses", e.target.value)}
                                  className="w-full bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 focus:border-pink-500 rounded px-1.5 py-1 text-xs text-white text-center outline-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-4">
                                <input
                                  type="number"
                                  disabled={row.hasVariants}
                                  value={row.profit}
                                  onChange={(e) => handleBulkPricingChange(idx, "profit", e.target.value)}
                                  className="w-full bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 focus:border-pink-500 rounded px-1.5 py-1 text-xs text-white text-center outline-none"
                                  placeholder="0"
                                />
                              </td>

                              <td className="px-3 py-4">
                                <select 
                                  value={row.gstRate} 
                                  onChange={(e) => handleBulkPricingChange(idx, "gstRate", e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 rounded px-1 py-1 text-[11px] text-white outline-none cursor-pointer"
                                >
                                  <option value="0">0%</option>
                                  <option value="5">5%</option>
                                  <option value="12">12%</option>
                                  <option value="18">18%</option>
                                  <option value="28">28%</option>
                                </select>
                              </td>

                              <td className="px-3 py-4">
                                <input
                                  type="number"
                                  disabled={row.hasVariants}
                                  value={row.price}
                                  onChange={(e) => handleBulkPricingChange(idx, "price", e.target.value)}
                                  className="w-full bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 focus:border-pink-500 rounded px-1.5 py-1 text-xs text-white text-center font-bold outline-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-4">
                                <input
                                  type="number"
                                  disabled={row.hasVariants}
                                  value={row.mrp}
                                  onChange={(e) => handleBulkPricingChange(idx, "mrp", e.target.value)}
                                  className="w-full bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 focus:border-pink-500 rounded px-1.5 py-1 text-xs text-white text-center font-semibold outline-none"
                                  placeholder="0"
                                />
                              </td>

                              <td className="px-3 py-4">
                                <input
                                  type="number"
                                  disabled={row.hasVariants}
                                  value={row.quantity}
                                  onChange={(e) => handleBulkPricingChange(idx, "quantity", e.target.value)}
                                  className="w-full bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 focus:border-pink-500 rounded px-1 py-1 text-xs text-white text-center outline-none"
                                  placeholder="0"
                                />
                              </td>

                              <td className="px-4 py-4 text-center font-sans">
                                {row.hasVariants ? (
                                  <span className="text-[10px] text-slate-500 font-semibold italic">Managed in variants</span>
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <span className={`font-extrabold ${netProf > 0 ? 'text-emerald-400' : netProf < 0 ? 'text-rose-405' : 'text-slate-400'}`}>
                                      ₹{netProf}
                                    </span>
                                    <span className={`text-[9px] font-bold ${netProf > 0 ? 'text-emerald-500/80' : netProf < 0 ? 'text-rose-500/80' : 'text-slate-500'}`}>
                                      ({marginPercent.toFixed(1)}%)
                                    </span>
                                  </div>
                                )}
                              </td>
                            </tr>
                            
                            {/* Nested Variants Expandable Block */}
                            {isExpanded && row.hasVariants && (
                              <tr className="bg-slate-950/40">
                                <td colSpan={13} className="px-6 py-3.5 border-l-4 border-pink-500">
                                  <div className="space-y-3">
                                    <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest block">Variant Listing ({row.variants.length})</span>
                                    
                                    <div className="bg-slate-950/90 rounded-xl border border-slate-900 overflow-hidden max-w-4xl shadow-inner">
                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-900 border-b border-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[8px]">
                                            <th className="px-4 py-3 w-44">Variant Specs</th>
                                            <th className="px-4 py-3 w-48">Variant SKU</th>
                                            <th className="px-4 py-3 w-28 text-center">Selling Price (₹)</th>
                                            <th className="px-4 py-3 w-28 text-center">MRP (₹)</th>
                                            <th className="px-4 py-3 w-24 text-center">Stock</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-950/45">
                                          {row.variants.map((v: any, varIdx: number) => {
                                            const specs = [
                                              v.size ? `${v.size}${v.sizeUnit || ''}` : '',
                                              v.color,
                                              v.material
                                            ].filter(Boolean).join(" / ");
                                            
                                            return (
                                              <tr key={v.id} className="hover:bg-slate-900/50">
                                                <td className="px-4 py-2.5 font-bold text-slate-300">{specs || "Default Option"}</td>
                                                <td className="px-4 py-2.5">
                                                  <input
                                                    type="text"
                                                    value={v.sku}
                                                    onChange={(e) => handleBulkPricingVariantChange(idx, varIdx, "sku", e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-850 focus:border-pink-500 rounded px-2.5 py-1 text-xs text-white font-mono outline-none"
                                                    placeholder="Variant SKU"
                                                  />
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                  <input
                                                    type="number"
                                                    value={v.price}
                                                    onChange={(e) => handleBulkPricingVariantChange(idx, varIdx, "price", e.target.value)}
                                                    className="w-24 bg-slate-950 border border-slate-850 focus:border-pink-500 rounded px-2 py-1 text-xs text-white text-center font-bold outline-none"
                                                    placeholder="Price"
                                                  />
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                  <input
                                                    type="number"
                                                    value={v.mrp}
                                                    onChange={(e) => handleBulkPricingVariantChange(idx, varIdx, "mrp", e.target.value)}
                                                    className="w-24 bg-slate-950 border border-slate-850 focus:border-pink-500 rounded px-2 py-1 text-xs text-white text-center font-semibold outline-none"
                                                    placeholder="MRP"
                                                  />
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                  <input
                                                    type="number"
                                                    value={v.stock}
                                                    onChange={(e) => handleBulkPricingVariantChange(idx, varIdx, "stock", e.target.value)}
                                                    className="w-20 bg-slate-950 border border-slate-850 focus:border-pink-500 rounded px-2 py-1 text-xs text-white text-center font-medium outline-none"
                                                    placeholder="0"
                                                  />
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
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
              <>
                {selectedProductIds.length > 0 && (
                  <div className="mb-6 p-4 bg-slate-950/80 backdrop-blur border border-slate-800 rounded-xl flex items-center justify-between shadow-lg max-w-4xl mx-auto animate-fade-in-up">
                    <span className="text-xs text-slate-350 font-semibold">
                      Selected <strong className="text-pink-500 font-extrabold">{selectedProductIds.length}</strong> product{selectedProductIds.length > 1 ? 's' : ''} for pricing report.
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedProductIds([])}
                        className="px-3.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-lg transition-all border border-slate-800 cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => {
                          const selectedProds = products.filter(p => selectedProductIds.includes(p.id));
                          handleDownloadPricingReport(selectedProds);
                        }}
                        className="px-4 py-1.5 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white text-xs font-bold rounded-lg shadow-md shadow-pink-500/10 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        Download Selected Excel
                      </button>
                    </div>
                  </div>
                )}
                <div className="bg-slate-900/40 backdrop-blur rounded-2xl border border-slate-900 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[9px] select-none">
                          <th className="px-5 py-4 w-10 text-left">
                            <input 
                              type="checkbox"
                              checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProductIds(filteredProducts.map(p => p.id));
                                } else {
                                  setSelectedProductIds([]);
                                }
                              }}
                              className="w-4 h-4 text-pink-650 accent-pink-600 border-slate-800 bg-slate-950 rounded cursor-pointer"
                            />
                          </th>
                        <th 
                          onClick={() => handleSort("item")} 
                          className="px-5 py-4 cursor-pointer hover:text-white transition-colors"
                          title="Sort by Item Details"
                        >
                          <div className="flex items-center space-x-1">
                            <span>Item Details</span>
                            {renderSortIcon("item")}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort("category")} 
                          className="px-5 py-4 cursor-pointer hover:text-white transition-colors"
                          title="Sort by Category"
                        >
                          <div className="flex items-center space-x-1">
                            <span>Category</span>
                            {renderSortIcon("category")}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort("subcategory")} 
                          className="px-5 py-4 cursor-pointer hover:text-white transition-colors"
                          title="Sort by Sub Category"
                        >
                          <div className="flex items-center space-x-1">
                            <span>Sub Category</span>
                            {renderSortIcon("subcategory")}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort("quantity")} 
                          className="px-5 py-4 cursor-pointer hover:text-white transition-colors"
                          title="Sort by Quantity"
                        >
                          <div className="flex items-center space-x-1">
                            <span>Quantity (Stock)</span>
                            {renderSortIcon("quantity")}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort("pricing")} 
                          className="px-5 py-4 cursor-pointer hover:text-white transition-colors"
                          title="Sort by Profit Margin"
                        >
                          <div className="flex items-center space-x-1">
                            <span>Pricing Breakdown</span>
                            {renderSortIcon("pricing")}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort("price")} 
                          className="px-5 py-4 cursor-pointer hover:text-white transition-colors"
                          title="Sort by Selling Price"
                        >
                          <div className="flex items-center space-x-1">
                            <span>Selling Price</span>
                            {renderSortIcon("price")}
                          </div>
                        </th>
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
                            <td className="px-5 py-4 w-10">
                              <input 
                                type="checkbox"
                                checked={selectedProductIds.includes(product.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProductIds(prev => [...prev, product.id]);
                                  } else {
                                    setSelectedProductIds(prev => prev.filter(id => id !== product.id));
                                  }
                                }}
                                className="w-4 h-4 text-pink-650 accent-pink-600 border-slate-800 bg-slate-950 rounded cursor-pointer"
                              />
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center space-x-3.5">
                                <img src={product.image} alt={product.brand} className="w-9 h-11 object-cover rounded bg-slate-950 border border-slate-900 group-hover:border-slate-800 transition-all flex-shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-extrabold text-slate-100 truncate w-32 sm:w-44">{product.title}</span>
                                  <span className="text-[10px] text-slate-400 truncate w-32 sm:w-44 mt-0.5">{product.brand}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-slate-400 font-medium">{product.category}</td>
                            <td className="px-5 py-4 text-slate-400 font-medium">{product.subCategory || "—"}</td>
                            <td className="px-5 py-4">
                              {(product.category?.toLowerCase() === "fashion" || product.category?.toLowerCase() === "lifestyle & fashion") && product.sizesInventory ? (
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
                                <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">
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
              </>
            )}
          </div>
          )}

          {/* Reports & Downloads Dashboard */}
          {viewMode === "reports" && (
            <div className="lg:col-span-12 space-y-8 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                  <h2 className="text-xl font-black text-white">Reports & Downloads</h2>
                  <p className="text-xs text-slate-400 mt-1">Generate and export formatted Excel sheets for sales records, taxes, and pricing structures.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* 1. Pricing Breakdown Details Card */}
                <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-900/80 shadow-xl flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 border border-pink-500/20 flex items-center justify-center">
                      <Coins size={20} />
                    </div>
                    <h3 className="text-base font-extrabold text-white">Pricing Breakdown Details</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Download a structured Excel sheet containing the full price breakdown (Purchase Price, Packing, Courier, Profit, GST Rate, and Selling Price) along with SKU, Title, Category, Subcategory, and a small preview thumbnail image.
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-900/60">
                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-900">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Selected for report:</span>
                        <span className="text-pink-500 font-extrabold">{selectedProductIds.length} item{selectedProductIds.length !== 1 ? 's' : ''}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Tip: You can select specific products using checkboxes in the "Catalog Inventory" tab, or download all products below.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        onClick={() => {
                          if (selectedProductIds.length === 0) {
                            alert("Please select at least one product in the Catalog Inventory tab first.");
                            return;
                          }
                          const selectedProds = products.filter(p => selectedProductIds.includes(p.id));
                          handleDownloadPricingReport(selectedProds);
                        }}
                        disabled={selectedProductIds.length === 0}
                        className="w-full bg-slate-850 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all border border-slate-800 disabled:cursor-not-allowed hover:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Selected ({selectedProductIds.length})
                      </button>
                      <button
                        onClick={() => handleDownloadPricingReport(products)}
                        className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-lg shadow-pink-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-transparent"
                      >
                        Download All ({products.length})
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Sales & GST Tax Report Card */}
                <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-900/80 shadow-xl flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 border border-pink-500/20 flex items-center justify-center">
                      <BarChart3 size={20} />
                    </div>
                    <h3 className="text-base font-extrabold text-white">Sales & GST Tax Report</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Download sales records including invoice number, order number, SKU, item title, purchase date, GST rate, GST amount, and total sale value. Includes total sales and GST amount summaries at the end of the sheet.
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-900/60">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Date Filtering Option</label>
                      <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-900">
                        <button
                          type="button"
                          onClick={() => setSalesReportType("monthly")}
                          className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${salesReportType === "monthly" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
                        >
                          Monthly
                        </button>
                        <button
                          type="button"
                          onClick={() => setSalesReportType("yearly")}
                          className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${salesReportType === "yearly" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
                        >
                          Yearly
                        </button>
                        <button
                          type="button"
                          onClick={() => setSalesReportType("custom")}
                          className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${salesReportType === "custom" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
                        >
                          Custom Range
                        </button>
                      </div>
                    </div>

                    {/* Report Type Fields */}
                    {salesReportType === "monthly" && (
                      <div className="animate-fade-in">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Select Month</label>
                        <input 
                          type="month"
                          value={salesReportMonth}
                          onChange={(e) => setSalesReportMonth(e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2.5 text-sm focus:border-pink-500 outline-none text-white transition-all cursor-pointer"
                        />
                      </div>
                    )}

                    {salesReportType === "yearly" && (
                      <div className="animate-fade-in">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Select Year</label>
                        <select 
                          value={salesReportYear}
                          onChange={(e) => setSalesReportYear(e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2.5 text-sm focus:border-pink-500 outline-none text-white transition-all cursor-pointer"
                        >
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                            <option key={year} value={year.toString()} className="bg-slate-950 text-white">{year}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {salesReportType === "custom" && (
                      <div className="grid grid-cols-2 gap-3.5 animate-fade-in">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
                          <input 
                            type="date"
                            value={salesReportStartDate}
                            onChange={(e) => setSalesReportStartDate(e.target.value)}
                            className="w-full bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">End Date</label>
                          <input 
                            type="date"
                            value={salesReportEndDate}
                            onChange={(e) => setSalesReportEndDate(e.target.value)}
                            className="w-full bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2 text-sm focus:border-pink-500 outline-none text-white transition-all cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {fetchingOrders ? (
                      <div className="flex justify-center items-center py-3 bg-slate-950/40 rounded-xl border border-slate-900">
                        <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-slate-450 ml-2 font-medium">Fetching orders database...</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleDownloadSalesReport}
                        className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-lg shadow-pink-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-transparent"
                      >
                        Download Sales Report
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Sale Scheduler Dashboard */}
          {viewMode === "scheduler" && (
            <div className="lg:col-span-12 space-y-8 animate-fade-in text-slate-350">
              <div>
                <h2 className="text-xl font-black text-white">Visual Banner & Sale Scheduler</h2>
                <p className="text-xs text-slate-400 mt-1">Queue storewide promotional discounts and custom slide banners for holiday campaigns or weekend sales.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Create Promo Form */}
                <div className="lg:col-span-5 bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-900/80 shadow-xl space-y-5">
                  <h3 className="text-base font-extrabold text-white border-b border-slate-850 pb-2 mb-4 uppercase tracking-wider text-xs">Create Promotion</h3>
                  
                  <form onSubmit={handleCreatePromo} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Promotion Title *</label>
                      <input
                        type="text"
                        required
                        value={promoTitle}
                        onChange={(e) => setPromoTitle(e.target.value)}
                        placeholder="E.g., Diwali Festive Bonanza"
                        className="w-full bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2.5 text-xs focus:border-pink-500 outline-none text-white transition-all font-semibold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Discount % *</label>
                        <input
                          type="number"
                          required
                          min={1}
                          max={90}
                          value={promoDiscount}
                          onChange={(e) => setPromoDiscount(Number(e.target.value))}
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2.5 text-xs focus:border-pink-500 outline-none text-white transition-all font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Target Category *</label>
                        <select
                          value={promoCategory}
                          onChange={(e) => setPromoCategory(e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2.5 text-xs focus:border-pink-500 outline-none text-white transition-all font-semibold cursor-pointer"
                        >
                          <option value="All" className="bg-slate-950 text-white">All Categories</option>
                          {availableCategories.map(cat => (
                            <option key={cat} value={cat} className="bg-slate-950 text-white">{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Start Date & Time *</label>
                        <input
                          type="datetime-local"
                          required
                          value={promoStartDate}
                          onChange={(e) => setPromoStartDate(e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2.5 text-xs focus:border-pink-500 outline-none text-white transition-all font-semibold cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">End Date & Time *</label>
                        <input
                          type="datetime-local"
                          required
                          value={promoEndDate}
                          onChange={(e) => setPromoEndDate(e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2.5 text-xs focus:border-pink-500 outline-none text-white transition-all font-semibold cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Banner upload section */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Holiday Slide Banner *</label>
                      <div className="flex items-center gap-3">
                        <label className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 font-bold px-4 py-2.5 rounded-lg text-[10px] uppercase cursor-pointer transition-all flex items-center gap-1.5">
                          <UploadCloud size={14} />
                          <span>Select Banner File</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handlePromoBannerUpload(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        {uploadingPromoBanner && <span className="text-[10px] text-pink-500 font-bold animate-pulse">Uploading to ImgBB...</span>}
                      </div>
                      {promoBannerUrl && (
                        <div className="mt-3 relative w-full aspect-[21/9] rounded-xl overflow-hidden border border-slate-850 shadow-inner bg-slate-950">
                          <img src={promoBannerUrl} alt="Promo banner preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="promoIsActive"
                        checked={promoIsActive}
                        onChange={(e) => setPromoIsActive(e.target.checked)}
                        className="w-4 h-4 text-pink-650 accent-pink-600 border-slate-850 bg-slate-950 rounded cursor-pointer"
                      />
                      <label htmlFor="promoIsActive" className="text-xs text-slate-350 font-bold select-none cursor-pointer">
                        Enable scheduled campaign immediately
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={savingPromo || uploadingPromoBanner}
                      className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 disabled:opacity-50 text-white font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-pink-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-transparent mt-4"
                    >
                      {savingPromo ? "Scheduling..." : "Schedule Sale Campaign"}
                    </button>
                  </form>
                </div>

                {/* Queue list */}
                <div className="lg:col-span-7 bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-900/80 shadow-xl overflow-x-auto space-y-4">
                  <h3 className="text-base font-extrabold text-white border-b border-slate-850 pb-2 uppercase tracking-wider text-xs">Scheduled Sales & Banners Queue ({promotions.length})</h3>
                  
                  {promotions.length > 0 ? (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 font-bold">
                          <th className="py-3 px-2">Campaign Details</th>
                          <th className="py-3 px-2">Date Range</th>
                          <th className="py-3 px-2 text-center">Status</th>
                          <th className="py-3 px-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/50">
                        {promotions.map((promo) => {
                          const nowIso = new Date().toISOString();
                          const isUpcoming = promo.startDate > nowIso;
                          const isExpired = promo.endDate < nowIso;
                          const isLive = promo.isActive && promo.startDate <= nowIso && promo.endDate >= nowIso;
                          
                          return (
                            <tr key={promo.id} className="hover:bg-slate-900/20 transition-colors">
                              <td className="py-3.5 px-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  {promo.bannerUrl && (
                                    <div className="w-12 h-6 rounded bg-slate-950 overflow-hidden border border-slate-800">
                                      <img src={promo.bannerUrl} alt="banner" className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                  <div className="flex flex-col">
                                    <span className="font-extrabold text-white">{promo.title}</span>
                                    <span className="text-[10px] text-pink-500 font-bold">{promo.discountPercent}% OFF | Category: {promo.targetCategory}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-2 text-slate-400 font-medium space-y-0.5">
                                <div className="text-[10px]">Start: {new Date(promo.startDate).toLocaleString("en-IN")}</div>
                                <div className="text-[10px]">End: {new Date(promo.endDate).toLocaleString("en-IN")}</div>
                              </td>
                              <td className="py-3.5 px-2 text-center">
                                {isLive ? (
                                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Live Now</span>
                                ) : isExpired ? (
                                  <span className="bg-slate-800 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Expired</span>
                                ) : isUpcoming ? (
                                  <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Scheduled</span>
                                ) : (
                                  <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Disabled</span>
                                )}
                              </td>
                              <td className="py-3.5 px-2 text-right space-x-2">
                                <button
                                  onClick={() => handleTogglePromo(promo.id, promo.isActive)}
                                  className={`px-2 py-1 rounded text-[9px] font-extrabold uppercase transition-all cursor-pointer border ${
                                    promo.isActive 
                                      ? "bg-slate-850 text-slate-400 border-slate-800 hover:text-white" 
                                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:border-transparent"
                                  }`}
                                >
                                  {promo.isActive ? "Pause" : "Resume"}
                                </button>
                                <button
                                  onClick={() => handleDeletePromo(promo.id)}
                                  className="bg-rose-500/10 text-rose-450 hover:bg-rose-500 hover:text-white border border-rose-500/20 hover:border-transparent p-1 rounded transition-all cursor-pointer inline-flex items-center justify-center"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
                      <span className="text-slate-500 text-xs font-semibold">No promotional campaigns scheduled in queue.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Low Stock & Restock alerts dashboard */}
          {viewMode === "alerts" && (
            <div className="lg:col-span-12 space-y-8 animate-fade-in text-slate-350">
              <div>
                <h2 className="text-xl font-black text-white">Low Stock & Restock Alerts</h2>
                <p className="text-xs text-slate-400 mt-1">Monitor catalog items with low stock counts (&lt; 5) and view user subscriptions requesting alerts when products return to availability.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* 1. Low stock catalog items */}
                <div className="lg:col-span-6 bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-900/80 shadow-xl space-y-4">
                  <h3 className="text-base font-extrabold text-white border-b border-slate-850 pb-2 uppercase tracking-wider text-xs">Low Stock Catalog Items (&lt; 5 units)</h3>
                  
                  {(() => {
                    const lowStockProds = products.filter(p => Number(p.quantity || 0) < 5);
                    if (lowStockProds.length > 0) {
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-850 text-slate-400 font-bold">
                                <th className="py-2.5 px-2">Item</th>
                                <th className="py-2.5 px-2">SKU</th>
                                <th className="py-2.5 px-2">Stock Level</th>
                                <th className="py-2.5 px-2 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/50">
                              {lowStockProds.map(product => {
                                const qty = Number(product.quantity || 0);
                                return (
                                  <tr key={product.id} className="hover:bg-slate-900/10 transition-colors">
                                    <td className="py-3 px-2 flex items-center gap-2">
                                      <img src={product.image} className="w-8 h-10 object-cover rounded bg-slate-950 border border-slate-800" />
                                      <div className="flex flex-col">
                                        <span className="font-extrabold text-white">{product.title}</span>
                                        <span className="text-[10px] text-slate-400">{product.brand}</span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-2 font-mono text-slate-450 font-bold">{product.sku || "—"}</td>
                                    <td className="py-3 px-2">
                                      {qty === 0 ? (
                                        <span className="bg-rose-500/10 border border-rose-500/20 text-rose-455 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Out of Stock</span>
                                      ) : (
                                        <span className="bg-rose-500/10 border border-rose-500/20 text-rose-455 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">{qty} left</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                      <button
                                        onClick={() => {
                                          setEditingId(product.id);
                                          setBrand(product.brand || "");
                                          setTitle(product.title || "");
                                          setCategory(product.category || "");
                                          setSubCategory(product.subCategory || "");
                                          setPrice(product.price ? product.price.toString() : "");
                                          setQuantity(product.quantity ? product.quantity.toString() : "0");
                                          setPurchasePrice(product.purchasePrice ? product.purchasePrice.toString() : "");
                                          setPackingCharges(product.packingCharges ? product.packingCharges.toString() : "");
                                          setCourierCharges(product.courierCharges ? product.courierCharges.toString() : "");
                                          setOtherExpenses(product.otherExpenses ? product.otherExpenses.toString() : "");
                                          setGstRate(product.gstRate ? product.gstRate.toString() : "18");
                                          setViewMode("add-product");
                                        }}
                                        className="bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-350 font-extrabold px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wide transition-all cursor-pointer"
                                      >
                                        Restock
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                    return (
                      <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
                        <span className="text-slate-500 text-xs font-semibold">All inventory items are restocked and healthy (5 or more units).</span>
                      </div>
                    );
                  })()}
                </div>

                {/* 2. Customer Restock Alerts subscriptions */}
                <div className="lg:col-span-6 bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-900/80 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-850 pb-2">
                    <h3 className="text-base font-extrabold text-white uppercase tracking-wider text-xs">Customer Restock Notifications</h3>
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850 text-[9px] font-bold uppercase select-none">
                      {(["All", "Pending", "Sent"] as const).map(tab => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setSubsFilter(tab)}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${subsFilter === tab ? "bg-slate-850 text-white" : "text-slate-500 hover:text-slate-350"}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const filteredSubs = backInStockSubs.filter(sub => {
                      if (subsFilter === "All") return true;
                      return sub.status === subsFilter;
                    });

                    if (filteredSubs.length > 0) {
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-850 text-slate-400 font-bold">
                                <th className="py-2.5 px-2">Customer Details</th>
                                <th className="py-2.5 px-2">Item Requested</th>
                                <th className="py-2.5 px-2 text-center">Status</th>
                                <th className="py-2.5 px-2 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/50">
                              {filteredSubs.map(sub => {
                                const requestDate = sub.createdAt ? new Date(sub.createdAt).toLocaleDateString("en-IN", {
                                  day: "numeric", month: "short"
                                }) : "—";
                                
                                return (
                                  <tr key={sub.id} className="hover:bg-slate-900/10 transition-colors">
                                    <td className="py-3 px-2 space-y-0.5 text-left">
                                      <div className="font-extrabold text-white leading-none">{sub.email}</div>
                                      {sub.phone && <div className="text-[10px] text-slate-400 font-mono font-medium">{sub.phone}</div>}
                                      <div className="text-[9px] text-slate-500">Subscribed: {requestDate}</div>
                                    </td>
                                    <td className="py-3 px-2 font-medium">
                                      <div className="text-slate-300 leading-tight">{sub.productName}</div>
                                      <div className="text-[10px] text-slate-500">{sub.productBrand}</div>
                                    </td>
                                    <td className="py-3 px-2 text-center">
                                      {sub.status === "Pending" ? (
                                        <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Pending</span>
                                      ) : (
                                        <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Notified</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                      {sub.status === "Pending" ? (
                                        <button
                                          onClick={async () => {
                                            const prod = products.find(p => p.id === sub.productId);
                                            const currentQty = prod ? Number(prod.quantity || 0) : 0;
                                            
                                            if (currentQty <= 0) {
                                              if (!confirm("Caution: This item is currently showing 0 units in stock. Do you still want to send the Restock email notification to the customer?")) {
                                                return;
                                              }
                                            }

                                            try {
                                              const apiRes = await fetch("/api/notify-restock", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                  productId: sub.productId,
                                                  brand: sub.productBrand,
                                                  title: sub.productName,
                                                  quantity: Math.max(1, currentQty)
                                                })
                                              });

                                              if (apiRes.ok) {
                                                await updateDoc(doc(db, "back_in_stock_subscriptions", sub.id), {
                                                  status: "Sent"
                                                });
                                                setSuccess("Stock alert email sent successfully to " + sub.email + "!");
                                                setTimeout(() => setSuccess(""), 3000);
                                              } else {
                                                alert("API failed to process mail: " + apiRes.statusText);
                                              }
                                            } catch (err: any) {
                                              console.error(err);
                                              alert("Failed to trigger notification: " + err.message);
                                            }
                                          }}
                                          className="bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 hover:border-transparent text-emerald-400 hover:text-white font-extrabold px-2 py-1 rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1"
                                        >
                                          Send Alert
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-slate-500 font-bold italic">Alert Sent</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                    return (
                      <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
                        <span className="text-slate-500 text-xs font-semibold">No back-in-stock alert subscriptions found in this tab.</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
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
                    const baseBulkPrice = 
                      Number(item.purchasePrice || 0) + 
                      Number(item.packingCharges || 0) + 
                      Number(item.courierCharges || 0) + 
                      Number(item.otherExpenses || 0) + 
                      Number(item.profit || 0);
                    const calculatedBulkPrice = baseBulkPrice + Math.round(baseBulkPrice * (Number(item.gstRate || 0) / 100));

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
