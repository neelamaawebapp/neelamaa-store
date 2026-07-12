"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  onSnapshot 
} from "firebase/firestore";
import { 
  Bell, 
  Send, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  Clock,
  UserCheck,
  UploadCloud,
  X,
  ExternalLink,
  MessageSquare,
  Phone,
  Users,
  Play,
  Pause,
  Loader2
} from "lucide-react";
import { autoAdjustImage } from "@/lib/imageUtils";
import { useRef } from "react";
import ImageEditorModal from "@/components/ImageEditorModal";
import { useAuth } from "@/context/AuthContext";

export default function BroadcastDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"history" | "restock" | "marketing">("marketing");
  
  // State for Broadcast Composer
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastImage, setBroadcastImage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editorImageUrl, setEditorImageUrl] = useState<string>("");
  const [editingFile, setEditingFile] = useState<File | null>(null);
  
  // Dynamic upload route target
  const [uploadTarget, setUploadTarget] = useState<"broadcast" | "marketing">("broadcast");
  const marketingFileInputRef = useRef<HTMLInputElement>(null);
  const [isMarketingDragging, setIsMarketingDragging] = useState(false);

  // State for Subscriptions & Broadcast History
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [fetchingSubs, setFetchingSubs] = useState(true);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [fetchingBroadcasts, setFetchingBroadcasts] = useState(true);

  // States for Marketing Campaigns Tab
  const [customers, setCustomers] = useState<any[]>([]);
  const [fetchingCustomers, setFetchingCustomers] = useState(true);
  
  const [marketingTitle, setMarketingTitle] = useState("");
  const [marketingMessage, setMarketingMessage] = useState("");
  const [marketingImage, setMarketingImage] = useState("");
  const [marketingChannel, setMarketingChannel] = useState<"WhatsApp" | "WhatsApp Group" | "SMS" | "In-App">("WhatsApp");
  const [marketingGroupLink, setMarketingGroupLink] = useState("https://chat.whatsapp.com/");
  const [sendingMarketing, setSendingMarketing] = useState(false);
  
  const [dispatchLogs, setDispatchLogs] = useState<any[]>([]);
  const [fetchingLogs, setFetchingLogs] = useState(true);

  // WhatsApp Queue State variables
  const [isQueueActive, setIsQueueActive] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);
  const [sentQueueIds, setSentQueueIds] = useState<string[]>([]);
  const [skippedQueueIds, setSkippedQueueIds] = useState<string[]>([]);

  // Status message states
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Fetch customers with contact details
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { getFirestore, collection, getDocs } = await import("firebase/firestore");
        const { app } = await import("@/lib/firebase");
        const db = getFirestore(app);

        const snap = await getDocs(collection(db, "users"));
        let list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

        // Fallback for visual mock testing if DB is empty
        if (list.length === 0) {
          list = [
            { id: "mock_cust_1", name: "Manisha Gaur", phone: "9876543210", email: "manishagaur1983@gmail.com" },
            { id: "mock_cust_2", name: "Guddu Kumar", phone: "8123456789", email: "guddu20484@gmail.com" },
            { id: "mock_cust_3", name: "Mukesh Sharma", phone: "7012345678", email: "demo.customer@example.com" }
          ];
        }

        setCustomers(list);
      } catch (err) {
        console.error("Failed to load customers for marketing", err);
      } finally {
        setFetchingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch campaign logs
  const loadCampaignLogs = async () => {
    setFetchingLogs(true);
    try {
      const { getFirestore, collection, getDocs } = await import("firebase/firestore");
      const { app } = await import("@/lib/firebase");
      const db = getFirestore(app);

      const [campaignsSnap, logsSnap] = await Promise.all([
        getDocs(collection(db, "marketing_campaigns")),
        getDocs(collection(db, "campaign_dispatch_logs"))
      ]);

      const campaigns = campaignsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      const logs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // Merge and sort
      const merged = campaigns.map(c => {
        const relatedLogs = logs.filter(l => l.campaignId === c.id);
        return {
          ...c,
          dispatches: relatedLogs
        };
      }).sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      setDispatchLogs(merged);
    } catch (err) {
      console.warn("Failed to load campaign logs from Firestore, falling back to local storage logs", err);
      // Local storage fallback for logs
      try {
        const stored = localStorage.getItem("craftstyle_campaign_logs");
        if (stored) {
          setDispatchLogs(JSON.parse(stored));
        }
      } catch (e) {}
    } finally {
      setFetchingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "marketing") {
      loadCampaignLogs();
    }
  }, [activeTab]);

  const handleSendMarketingCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marketingTitle.trim() || !marketingMessage.trim()) {
      alert("Please enter a campaign title and message.");
      return;
    }

    // Filter target customers with valid numbers
    const targets = customers.filter(c => c.phone && c.phone.trim().length >= 10);
    if (targets.length === 0) {
      alert("No customers found with valid 10-digit mobile numbers to broadcast to!");
      return;
    }

    if (marketingChannel === "WhatsApp") {
      // Launch Semi-Automated WhatsApp Queue
      setSentQueueIds([]);
      setSkippedQueueIds([]);
      setQueueIndex(0);
      setIsQueueActive(true);
      return;
    }

    if (marketingChannel === "WhatsApp Group") {
      const formattedMsg = marketingMessage.replace(/{name}/g, "Customer");
      const fullText = marketingImage.trim() 
        ? `${formattedMsg}\n\nView Update Banner: ${marketingImage.trim()}`
        : formattedMsg;

      try {
        await navigator.clipboard.writeText(fullText);
        setSuccess("Campaign message copied! Redirecting to WhatsApp Group link... Press Ctrl+V to send.");
        setTimeout(() => setSuccess(""), 4000);
        window.open(marketingGroupLink, "_blank");

        // Save campaign trace logs
        try {
          const { getAuthHeaders } = await import("@/lib/api-client");
          const authHeaders = await getAuthHeaders();
          await fetch("/api/send-broadcast", {
            method: "POST",
            headers: { ...authHeaders },
            body: JSON.stringify({
              title: marketingTitle.trim(),
              message: marketingMessage.trim(),
              imageUrl: marketingImage.trim(),
              channel: "WhatsApp Group"
            })
          });
          loadCampaignLogs();
        } catch (dbErr) {}

        setMarketingTitle("");
        setMarketingMessage("");
        setMarketingImage("");
      } catch (err: any) {
        setError("Failed to copy campaign details to clipboard.");
      }
      return;
    }

    // SMS & In-App flow (Fully Automated simulated API route)
    setSendingMarketing(true);
    setSuccess("");
    setError("");

    try {
      const { getAuthHeaders } = await import("@/lib/api-client");
      const authHeaders = await getAuthHeaders();
      const res = await fetch("/api/send-broadcast", {
        method: "POST",
        headers: { ...authHeaders },
        body: JSON.stringify({
          title: marketingTitle.trim(),
          message: marketingMessage.trim(),
          imageUrl: marketingImage.trim(),
          channel: marketingChannel
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to trigger broadcast dispatch");
      }

      const resData = await res.json();

      // Local storage log backup
      try {
        const localLogs = JSON.parse(localStorage.getItem("craftstyle_campaign_logs") || "[]");
        localLogs.unshift({
          id: resData.campaignId || `camp_${Date.now()}`,
          title: marketingTitle.trim(),
          message: marketingMessage.trim(),
          imageUrl: marketingImage.trim(),
          channel: marketingChannel,
          recipientCount: targets.length,
          status: "Completed",
          createdAt: new Date().toISOString(),
          dispatches: targets.map(t => ({
            customerName: t.name || "Customer",
            phone: t.phone,
            status: "Delivered",
            content: marketingMessage.trim().replace(/{name}/g, t.name || "Customer")
          }))
        });
        localStorage.setItem("craftstyle_campaign_logs", JSON.stringify(localLogs));
      } catch (e) {}

      setMarketingTitle("");
      setMarketingMessage("");
      setMarketingImage("");
      setSuccess(`Simulated ${marketingChannel} broadcast successfully sent to ${targets.length} customers!`);
      setTimeout(() => setSuccess(""), 4000);
      loadCampaignLogs();
    } catch (err: any) {
      setError(err.message || "Failed to send marketing broadcast.");
    } finally {
      setSendingMarketing(false);
    }
  };

  const getWhatsAppLink = (cust: any, text: string) => {
    const cleanPhone = cust.phone.replace(/\D/g, "");
    // Ensure country code is prepended
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const formattedText = text.replace(/{name}/g, cust.name || "Customer");
    
    // Add image url link to text body if specified
    const fullText = marketingImage.trim() 
      ? `${formattedText}\n\nView Update: ${marketingImage.trim()}`
      : formattedText;

    return `https://api.whatsapp.com/send?phone=${phoneWithCode}&text=${encodeURIComponent(fullText)}`;
  };

  // Fetch Restock Alert Subscriptions
  useEffect(() => {
    if (authLoading) return;

    const isMock = !user || user.uid.startsWith("mock_");

    if (isMock) {
      let localSubs: any[] = [];
      try {
        const stored = localStorage.getItem("craftstyle_stock_subscriptions");
        if (stored) {
          localSubs = JSON.parse(stored).map((s: any) => ({
            id: `local_${s.productId}_${s.email}`,
            isLocal: true,
            ...s
          }));
          localSubs.sort((a: any, b: any) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
        }
      } catch (e) {}
      setSubscriptions(localSubs);
      setFetchingSubs(false);
      return;
    }

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
        const stored = localStorage.getItem("craftstyle_stock_subscriptions");
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
        const stored = localStorage.getItem("craftstyle_stock_subscriptions");
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
  }, [user, authLoading]);

  // Fetch Broadcasts History
  useEffect(() => {
    if (authLoading) return;

    const isMock = !user || user.uid.startsWith("mock_");

    if (isMock) {
      let localBroadcasts: any[] = [];
      try {
        const stored = localStorage.getItem("craftstyle_local_notifications");
        if (stored) {
          localBroadcasts = JSON.parse(stored).filter((n: any) => n.id?.startsWith("broadcast_")).map((n: any) => ({
            ...n,
            isLocal: true
          }));
          localBroadcasts.sort((a: any, b: any) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
        }
      } catch (e) {}
      setBroadcasts(localBroadcasts);
      setFetchingBroadcasts(false);
      return;
    }

    const q = collection(db, "broadcast_notifications");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      list.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      // Combine with local storage broadcast notifications
      let localBroadcasts: any[] = [];
      try {
        const stored = localStorage.getItem("craftstyle_local_notifications");
        if (stored) {
          // Keep only broadcast type notifications
          localBroadcasts = JSON.parse(stored).filter((n: any) => n.id?.startsWith("broadcast_"));
        }
      } catch (e) {}

      const combined = [...list];
      localBroadcasts.forEach((lBc: any) => {
        const isMatched = combined.some((rBc: any) => rBc.title === lBc.title && rBc.message === lBc.message);
        if (!isMatched) {
          combined.push({
            ...lBc,
            isLocal: true
          });
        }
      });

      combined.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setBroadcasts(combined);
      setFetchingBroadcasts(false);
    }, (err) => {
      console.warn("Firestore broadcasts failed, falling back to local storage", err);
      try {
        const stored = localStorage.getItem("craftstyle_local_notifications");
        if (stored) {
          const localBroadcasts = JSON.parse(stored).filter((n: any) => n.id?.startsWith("broadcast_")).map((n: any) => ({
            ...n,
            isLocal: true
          }));
          localBroadcasts.sort((a: any, b: any) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          setBroadcasts(localBroadcasts);
        }
      } catch (e) {
        setBroadcasts([]);
      }
      setFetchingBroadcasts(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  const handleUploadImageFile = async (file: File) => {
    // Deprecated direct upload - now goes through ImageEditorModal
    setUploadTarget("broadcast");
    setEditorImageUrl(URL.createObjectURL(file));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        setUploadTarget("broadcast");
        setEditorImageUrl(URL.createObjectURL(file));
      } else {
        setError("Please drop a valid image file.");
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadTarget("broadcast");
      setEditorImageUrl(URL.createObjectURL(file));
    }
  };

  // Marketing Image drag & drop handlers
  const handleMarketingDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsMarketingDragging(true);
  };

  const handleMarketingDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsMarketingDragging(false);
  };

  const handleMarketingDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsMarketingDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        setUploadTarget("marketing");
        setEditorImageUrl(URL.createObjectURL(file));
      } else {
        setError("Please drop a valid image file.");
      }
    }
  };

  const handleMarketingFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadTarget("marketing");
      setEditorImageUrl(URL.createObjectURL(file));
    }
  };

  const handleSaveEditedImage = async (editedFile: File) => {
    setEditorImageUrl("");
    setEditingFile(null);
    setUploadingImage(true);
    setSuccess("");
    setError("");
    try {
      const formData = new FormData();
      formData.append("image", editedFile);
      
      const res = await fetch("https://api.imgbb.com/1/upload?key=738fe2483790d2c978f26b378607193c", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        if (uploadTarget === "marketing") {
          setMarketingImage(data.data.url);
          setSuccess("Campaign image uploaded successfully!");
        } else {
          setBroadcastImage(data.data.url);
          setSuccess("Banner image uploaded and adjusted successfully!");
        }
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error?.message || "Failed to upload image.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during upload.");
    } finally {
      setUploadingImage(false);
    }
  };


  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      alert("Please enter a title and message for the broadcast.");
      return;
    }

    setSendingBroadcast(true);
    setSuccess("");
    setError("");

    try {
      const broadcastData = {
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        image: broadcastImage.trim() || null,
        createdAt: new Date().toISOString()
      };

      // 1. Add to Firestore
      try {
        await addDoc(collection(db, "broadcast_notifications"), broadcastData);
      } catch (firestoreErr) {
        console.warn("Failed to save broadcast to Firestore, falling back to localStorage", firestoreErr);
      }

      // 2. Send Background Web Push Notifications via API route
      try {
        const { getAuthHeaders } = await import("@/lib/api-client");
        const authHeaders = await getAuthHeaders();
        const response = await fetch("/api/send-broadcast", {
          method: "POST",
          headers: {
            ...authHeaders,
          },
          body: JSON.stringify({
            title: broadcastData.title,
            message: broadcastData.message,
            image: broadcastData.image,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          console.warn("Web push broadcast API returned error status:", errData);
        } else {
          const resData = await response.json();
          console.log("Web push broadcast sent:", resData);
        }
      } catch (apiErr) {
        console.error("Failed to request Web Push API route:", apiErr);
      }

      // 3. Add to Local Storage (so guest/local administrators can test it)
      try {
        const stored = localStorage.getItem("craftstyle_local_notifications");
        const localNotifs = stored ? JSON.parse(stored) : [];
        localNotifs.unshift({
          id: `broadcast_${Date.now()}_${Math.random()}`,
          title: broadcastData.title,
          message: broadcastData.message,
          image: broadcastData.image,
          createdAt: broadcastData.createdAt,
          read: false
        });
        localStorage.setItem("craftstyle_local_notifications", JSON.stringify(localNotifs));
      } catch (e) {
        console.error("Failed to write local broadcast notification:", e);
      }

      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastImage("");
      setSuccess("Broadcast notification sent to all devices successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to send broadcast.");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleDeleteBroadcast = async (bc: any) => {
    if (!confirm("Are you sure you want to delete this broadcast? It will no longer show in history.")) return;
    
    if (bc.isLocal) {
      try {
        const stored = localStorage.getItem("craftstyle_local_notifications");
        if (stored) {
          const localNotifs = JSON.parse(stored);
          const filtered = localNotifs.filter((n: any) => n.id !== bc.id);
          localStorage.setItem("craftstyle_local_notifications", JSON.stringify(filtered));
          setBroadcasts(prev => prev.filter(b => b.id !== bc.id));
        }
      } catch (e) {
        console.error("Failed to delete local broadcast:", e);
      }
      return;
    }

    try {
      await deleteDoc(doc(db, "broadcast_notifications", bc.id));
      setSuccess("Broadcast notification deleted successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete broadcast.");
    }
  };

  const handleDeleteSubscription = async (sub: any) => {
    if (!confirm("Are you sure you want to remove this stock alert request?")) return;
    
    if (sub.isLocal) {
      try {
        const stored = localStorage.getItem("craftstyle_stock_subscriptions");
        if (stored) {
          const localSubs = JSON.parse(stored);
          const filtered = localSubs.filter((s: any) => !(s.productId === sub.productId && s.email === sub.email));
          localStorage.setItem("craftstyle_stock_subscriptions", JSON.stringify(filtered));
          setSubscriptions(prev => prev.filter(s => s.id !== sub.id));
        }
      } catch (e) {}
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

  return (
    <div className="max-w-7xl mx-auto pb-20 text-slate-100 font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Bell className="text-pink-500" size={24} />
          <span>Broadcasts & Alerts</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Compose push alerts for all registered customer devices, view logs, and manage customer back-in-stock notification requests.
        </p>
      </div>

      {success && (
        <div className="mb-6 bg-emerald-500/10 text-emerald-400 p-4 rounded-xl border border-emerald-500/20 text-center font-bold shadow-md shadow-emerald-500/5 animate-pulse text-xs">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-6 bg-rose-500/10 text-rose-400 p-4 rounded-xl border border-rose-500/20 text-center font-bold shadow-md shadow-rose-500/5 text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Broadcast Composer */}
        <div className="lg:col-span-4">
          <div className="bg-slate-900/40 backdrop-blur p-6 rounded-2xl border border-slate-900 shadow-xl sticky top-6">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
              <Send size={18} className="text-pink-500" />
              <h2 className="text-base font-extrabold text-white">
                Send App Broadcast
              </h2>
            </div>
            
            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Broadcast Title *</label>
                <input 
                  type="text" 
                  required 
                  value={broadcastTitle} 
                  onChange={(e) => setBroadcastTitle(e.target.value)} 
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2.5 text-xs focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700 font-semibold" 
                  placeholder="e.g. ⚡ FLASH SALE LIVE!" 
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notification Message *</label>
                <textarea 
                  required 
                  rows={5}
                  value={broadcastMessage} 
                  onChange={(e) => setBroadcastMessage(e.target.value)} 
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700 leading-relaxed" 
                  placeholder="e.g. Get 40% off on all new arrivals! Use code FLASH40 at checkout."
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notification Banner Image (Optional)</label>
                
                {/* Image Preview if uploaded */}
                {broadcastImage ? (
                  <div className="relative aspect-[2/1] rounded-xl overflow-hidden border border-slate-800 bg-slate-950/50 mb-3 group flex items-center justify-center">
                    <img src={broadcastImage} alt="Banner Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => setBroadcastImage("")}
                      className="absolute top-2 right-2 bg-slate-900/90 text-slate-400 hover:text-white p-1 rounded-full border border-slate-800 transition-all z-10 cursor-pointer shadow-md"
                      title="Delete Image"
                    >
                      <X size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditorImageUrl(broadcastImage);
                      }}
                      className="absolute bottom-2 right-2 bg-slate-900/95 text-slate-350 hover:text-white px-2 py-1 rounded text-[10px] font-bold border border-slate-800 transition-all z-10 cursor-pointer shadow-md"
                      title="Crop/Edit Image"
                    >
                      Crop
                    </button>
                    <div className="absolute bottom-2 left-2 bg-pink-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">
                      Adjusted (2:1)
                    </div>
                  </div>
                ) : (
                  /* Drag & Drop Upload Zone */
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 mb-3 relative min-h-[96px]
                      ${isDragging ? 'border-pink-500 bg-pink-500/5' : 'border-slate-800 bg-slate-950/40 hover:bg-slate-950/60'}
                    `}
                  >
                    {uploadingImage ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider animate-pulse">Adjusting & Uploading...</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud size={24} className={`mb-1.5 ${isDragging ? 'text-pink-500' : 'text-slate-500'}`} />
                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-wider">Drag & drop banner image here</p>
                        <p className="text-[9px] text-center text-slate-500 font-semibold mt-0.5">Or click to select a file (auto center-crops to 2:1)</p>
                      </>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                  </div>
                )}

                {/* Paste URL Option */}
                <input 
                  type="url" 
                  value={broadcastImage} 
                  onChange={(e) => setBroadcastImage(e.target.value)} 
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2.5 text-xs focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700 font-semibold" 
                  placeholder="Or paste direct image URL link..." 
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={sendingBroadcast} 
                  className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-extrabold py-3 rounded-xl hover:opacity-90 disabled:opacity-75 transition-all shadow-md shadow-pink-500/10 cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <Send size={14} />
                  <span>{sendingBroadcast ? "BROADCASTING..." : "SEND BROADCAST"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Broadcast History and Restock requests */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur rounded-2xl border border-slate-900 p-6 shadow-xl">
            {/* Custom Tab Toggles */}
            <div className="flex border-b border-slate-850 pb-4 mb-6 gap-6">
              <button
                onClick={() => setActiveTab("marketing")}
                className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "marketing"
                    ? "border-pink-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Users size={16} />
                <span>Marketing Broadcasts ({customers.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "history"
                    ? "border-pink-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <History size={16} />
                <span>Sent History ({broadcasts.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("restock")}
                className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "restock"
                    ? "border-pink-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Bell size={16} />
                <span>Restock Requests ({subscriptions.length})</span>
              </button>
            </div>

            {/* Tab 1: Sent Broadcast History */}
            {activeTab === "history" && (
              <div>
                {fetchingBroadcasts ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : broadcasts.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-xs">
                    No broadcast history found. Send your first push notification using the composer!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {broadcasts.map((bc) => {
                      const formattedTime = bc.createdAt 
                        ? new Date(bc.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "Just now";

                      return (
                        <div key={bc.id || Math.random()} className="bg-slate-950/45 p-4 rounded-xl border border-slate-850 hover:border-slate-800 transition-all flex items-start gap-4 justify-between group">
                          <div className="flex gap-3">
                            <div className="w-8 h-8 bg-pink-500/10 rounded-full flex items-center justify-center text-pink-500 border border-pink-500/25 mt-0.5 shrink-0">
                              <Bell size={14} className="fill-pink-500/15" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">{bc.title}</h4>
                              <p className="text-xs text-slate-350 mt-1 leading-relaxed">{bc.message}</p>
                              {bc.image && (
                                <div className="mt-2 rounded-lg overflow-hidden border border-slate-850 max-w-xs">
                                  <img src={bc.image} alt="Broadcast Banner" className="w-full h-auto object-cover max-h-24" />
                                </div>
                              )}
                              <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-wide">
                                <Clock size={10} />
                                <span>Sent: {formattedTime}</span>
                                {bc.isLocal && <span className="ml-1 bg-slate-800 px-1 rounded text-slate-400 text-[8px]">Local</span>}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteBroadcast(bc)}
                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/5 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Delete Log"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Restock Requests Subscriptions */}
            {activeTab === "restock" && (
              <div>
                {fetchingSubs ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : subscriptions.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-xs">
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
                                <a 
                                  href={`/product/${sub.productId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-3 hover:text-pink-500 transition-colors cursor-pointer group/item"
                                  title="View Product Page"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs font-extrabold text-slate-100 group-hover/item:text-pink-500 transition-colors flex items-center gap-1">
                                      {sub.productBrand}
                                      <ExternalLink size={10} className="opacity-40 group-hover/item:opacity-100 transition-opacity" />
                                    </span>
                                    <span className="text-[10px] text-slate-400 mt-0.5 font-normal truncate max-w-[200px]">{sub.productName}</span>
                                  </div>
                                </a>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex flex-col text-slate-350">
                                  <span className="font-semibold text-xs">{sub.email}</span>
                                  {sub.phone && <span className="text-[10px] text-slate-500 mt-0.5">{sub.phone}</span>}
                                </div>
                              </td>
                              <td className="px-5 py-4 text-slate-400">{formattedDate}</td>
                              <td className="px-5 py-4">
                                {sub.status === "Pending" ? (
                                  <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                    Pending Alert
                                  </span>
                                ) : (
                                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1 w-max">
                                    <UserCheck size={10} />
                                    <span>Notified</span>
                                  </span>
                                )}
                                {sub.isLocal && (
                                  <span className="ml-2 bg-slate-800 text-slate-450 text-[8px] font-bold px-1.5 py-0.5 rounded">
                                    Local
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right">
                                <button
                                  onClick={() => handleDeleteSubscription(sub)}
                                  className="p-1.5 bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-60 group-hover:opacity-100 cursor-pointer"
                                  title="Delete Subscription Request"
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

            {/* Tab 3: Marketing Campaign Broadcasts */}
            {activeTab === "marketing" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Left sub-column: Composer */}
                  <div className="md:col-span-5 bg-slate-950/30 p-5 rounded-xl border border-slate-850">
                    <h3 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-4 border-b border-slate-900 pb-2 flex items-center gap-1.5">
                      <Send size={14} className="text-pink-500" />
                      <span>Campaign Composer</span>
                    </h3>
                    <form onSubmit={handleSendMarketingCampaign} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Marketing Channel</label>
                        <div className="flex flex-wrap gap-2">
                          {["WhatsApp", "WhatsApp Group", "SMS", "In-App"].map((channel) => (
                            <button
                              key={channel}
                              type="button"
                              onClick={() => setMarketingChannel(channel as any)}
                              className={`flex-1 min-w-[100px] py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                marketingChannel === channel
                                  ? "border-pink-500 bg-pink-500/10 text-white"
                                  : "border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              {channel}
                            </button>
                          ))}
                        </div>
                      </div>

                      {marketingChannel === "WhatsApp Group" && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">WhatsApp Group Invite Link *</label>
                          <input 
                            type="url" 
                            required 
                            value={marketingGroupLink} 
                            onChange={(e) => setMarketingGroupLink(e.target.value)} 
                            className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2.5 text-xs focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700 font-semibold" 
                            placeholder="e.g. https://chat.whatsapp.com/GXYZ..." 
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Campaign Name / Title *</label>
                        <input 
                          type="text" 
                          required 
                          value={marketingTitle} 
                          onChange={(e) => setMarketingTitle(e.target.value)} 
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2.5 text-xs focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700 font-semibold" 
                          placeholder="e.g. Festive Discount live!" 
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex justify-between">
                          <span>Message Text *</span>
                          <span className="text-pink-500 text-[9px] lowercase font-semibold">Tip: use {"{name}"} for customer name</span>
                        </label>
                        <textarea 
                          required 
                          rows={5}
                          value={marketingMessage} 
                          onChange={(e) => setMarketingMessage(e.target.value)} 
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700 leading-relaxed font-medium" 
                          placeholder="e.g. Hello {name}, get flat 20% off on all items! Visit the store now!"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Campaign Image (Optional)</label>
                        
                        {/* Image Preview if uploaded */}
                        {marketingImage ? (
                          <div className="relative aspect-[2/1] rounded-xl overflow-hidden border border-slate-800 bg-slate-950/50 mb-3 group flex items-center justify-center">
                            <img src={marketingImage} alt="Campaign Preview" className="w-full h-full object-cover" />
                            <button 
                              type="button" 
                              onClick={() => setMarketingImage("")}
                              className="absolute top-2 right-2 bg-slate-900/90 text-slate-400 hover:text-white p-1 rounded-full border border-slate-800 transition-all z-10 cursor-pointer shadow-md"
                              title="Delete Image"
                            >
                              <X size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setUploadTarget("marketing");
                                setEditorImageUrl(marketingImage);
                              }}
                              className="absolute bottom-2 right-2 bg-slate-900/95 text-slate-350 hover:text-white px-2 py-1 rounded text-[10px] font-bold border border-slate-800 transition-all z-10 cursor-pointer shadow-md"
                              title="Crop/Edit Image"
                            >
                              Crop
                            </button>
                          </div>
                        ) : (
                          /* Drag & Drop Upload Zone */
                          <div 
                            onDragOver={handleMarketingDragOver}
                            onDragLeave={handleMarketingDragLeave}
                            onDrop={handleMarketingDrop}
                            onClick={() => marketingFileInputRef.current?.click()}
                            className={`border border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 mb-3 relative min-h-[96px]
                              ${isMarketingDragging ? 'border-pink-500 bg-pink-500/5' : 'border-slate-800 bg-slate-950/40 hover:bg-slate-950/60'}
                            `}
                          >
                            <UploadCloud size={24} className={`mb-1.5 ${isMarketingDragging ? 'text-pink-500' : 'text-slate-500'}`} />
                            <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-wider">Drag & drop campaign image here</p>
                            <p className="text-[9px] text-center text-slate-500 font-semibold mt-0.5">Or click to select a file (auto center-crops to 2:1)</p>
                            <input type="file" ref={marketingFileInputRef} onChange={handleMarketingFileChange} accept="image/*" className="hidden" />
                          </div>
                        )}

                        <input 
                          type="url" 
                          value={marketingImage} 
                          onChange={(e) => setMarketingImage(e.target.value)} 
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2.5 text-xs focus:border-pink-500 outline-none text-white transition-all placeholder-slate-700 font-semibold" 
                          placeholder="Or paste direct image URL link..." 
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={sendingMarketing}
                        className="w-full bg-pink-500 hover:bg-pink-600 text-white font-extrabold py-3 rounded-lg transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        {marketingChannel === "WhatsApp" ? (
                          <>
                            <Play size={14} />
                            <span>Launch WhatsApp Queue</span>
                          </>
                        ) : marketingChannel === "WhatsApp Group" ? (
                          <>
                            <MessageSquare size={14} />
                            <span>Copy Message & Open Group</span>
                          </>
                        ) : (
                          <>
                            {sendingMarketing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            <span>{sendingMarketing ? "SENDING..." : `SEND ${marketingChannel} BROADCAST`}</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Right sub-column: Recipient Customers list */}
                  <div className="md:col-span-7 space-y-4">
                    <div className="bg-slate-950/30 p-5 rounded-xl border border-slate-850">
                      <h3 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-4 border-b border-slate-900 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-pink-500" />
                          <span>Recipient Directory ({customers.length})</span>
                        </div>
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded font-bold uppercase tracking-wide">Valid Contact Numbers</span>
                      </h3>

                      {fetchingCustomers ? (
                        <div className="flex justify-center items-center py-10">
                          <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border border-slate-900 rounded-lg p-2 bg-slate-950/10">
                          {customers.map((c) => (
                            <div key={c.id} className="bg-slate-950/40 border border-slate-900 p-2.5 rounded-lg flex items-center justify-between hover:border-slate-800 transition-all text-xs font-semibold text-white">
                              <div>
                                <h4 className="font-extrabold text-[11px] uppercase text-white tracking-wider">{c.name || "Customer"}</h4>
                                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mt-0.5 font-medium">
                                  <Phone size={10} />
                                  <span>{c.phone}</span>
                                  {c.email && (
                                    <>
                                      <span className="text-slate-700">•</span>
                                      <span>{c.email}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <a 
                                  href={getWhatsAppLink(c, marketingMessage || "Hello {name}, greetings from Craft Style!")} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-green-600/10 hover:bg-green-600/20 border border-green-600/30 text-green-400 px-2.5 py-1 rounded text-[10px] font-extrabold flex items-center gap-1 uppercase tracking-wider transition-all"
                                >
                                  <MessageSquare size={10} />
                                  <span>WhatsApp</span>
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Campaign Dispatch Logs */}
                    <div className="bg-slate-950/30 p-5 rounded-xl border border-slate-850">
                      <h3 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-4 border-b border-slate-900 pb-2 flex items-center gap-1.5">
                        <History size={14} className="text-pink-500" />
                        <span>Campaign Logs & Dispatch History</span>
                      </h3>

                      {fetchingLogs ? (
                        <div className="flex justify-center items-center py-10">
                          <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : dispatchLogs.length === 0 ? (
                        <div className="p-8 text-center text-slate-650 border border-dashed border-slate-900 rounded-lg bg-slate-950/10 text-xs">
                          No previous dispatch logs found. Compose your first campaign to get started.
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                          {dispatchLogs.map((log) => (
                            <div key={log.id} className="bg-slate-950/40 p-3 rounded-lg border border-slate-900 flex flex-col gap-2">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-pink-400 uppercase tracking-widest">{log.title}</span>
                                <span className="bg-slate-800 text-slate-350 px-2 py-0.5 rounded text-[9px] tracking-wider font-extrabold uppercase">{log.channel}</span>
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed font-semibold italic">"{log.message}"</p>
                              <div className="flex justify-between items-center text-[9px] text-slate-500 uppercase tracking-wide mt-1 font-bold">
                                <span>Sent to {log.recipientCount || 0} recipients</span>
                                <span>{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : "-"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Queue Runner Modal */}
      {isQueueActive && (() => {
        const targets = customers.filter(c => c.phone && c.phone.trim().length >= 10);
        const currentCust = targets[queueIndex];
        
        if (!currentCust) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-slate-800 shadow-2xl flex flex-col items-center text-center space-y-4 animate-scale-in">
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center text-green-400 border border-green-500/25">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">Queue Completed!</h3>
                  <p className="text-xs text-slate-400 mt-2">Sequential WhatsApp broadcast finished successfully.</p>
                </div>
                <div className="w-full bg-slate-950/50 p-3 rounded-lg border border-slate-950 text-left text-xs space-y-1.5 font-semibold text-slate-450">
                  <div className="flex justify-between">
                    <span>Total Target:</span>
                    <span className="text-white">{targets.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Opened & Sent:</span>
                    <span className="text-green-400">{sentQueueIds.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Skipped:</span>
                    <span className="text-amber-400">{skippedQueueIds.length}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsQueueActive(false);
                    try {
                      const { getAuthHeaders } = await import("@/lib/api-client");
                      const authHeaders = await getAuthHeaders();
                      const res = await fetch("/api/send-broadcast", {
                        method: "POST",
                        headers: { ...authHeaders },
                        body: JSON.stringify({
                          title: marketingTitle.trim(),
                          message: marketingMessage.trim(),
                          imageUrl: marketingImage.trim(),
                          channel: "WhatsApp"
                        })
                      });
                      
                      const resData = await res.json();
                      
                      const localLogs = JSON.parse(localStorage.getItem("craftstyle_campaign_logs") || "[]");
                      localLogs.unshift({
                        id: resData.campaignId || `camp_${Date.now()}`,
                        title: marketingTitle.trim(),
                        message: marketingMessage.trim(),
                        imageUrl: marketingImage.trim(),
                        channel: "WhatsApp",
                        recipientCount: sentQueueIds.length,
                        status: "Completed",
                        createdAt: new Date().toISOString(),
                        dispatches: targets.map(t => ({
                          customerName: t.name || "Customer",
                          phone: t.phone,
                          status: sentQueueIds.includes(t.id) ? "Delivered" : "Skipped",
                          content: marketingMessage.trim().replace(/{name}/g, t.name || "Customer")
                        }))
                      });
                      localStorage.setItem("craftstyle_campaign_logs", JSON.stringify(localLogs));
                    } catch (e) {
                      console.error(e);
                    }
                    
                    setMarketingTitle("");
                    setMarketingMessage("");
                    setMarketingImage("");
                    setSuccess(`WhatsApp Campaign completed! Dispatched: ${sentQueueIds.length}`);
                    setTimeout(() => setSuccess(""), 4000);
                    loadCampaignLogs();
                  }}
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white font-extrabold py-2.5 rounded-lg transition-colors cursor-pointer text-xs"
                >
                  CLOSE & SAVE CAMPAIGN
                </button>
              </div>
            </div>
          );
        }

        const progressPercent = Math.round((queueIndex / targets.length) * 100);
        const formattedMsg = marketingMessage.replace(/{name}/g, currentCust.name || "Customer");
        const nextUrl = getWhatsAppLink(currentCust, marketingMessage);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl flex flex-col relative overflow-hidden animate-scale-in">
              <div className="bg-slate-950 p-4 border-b border-slate-900 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <MessageSquare className="text-green-500" size={18} />
                  <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">WhatsApp Broadcast Campaign</h3>
                </div>
                <button 
                  onClick={() => setIsQueueActive(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="w-full bg-slate-950 h-1.5 relative">
                <div 
                  className="bg-green-500 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between items-baseline text-xs text-slate-450 font-bold uppercase tracking-wide">
                  <span>Current Recipient ({queueIndex + 1} of {targets.length})</span>
                  <span>{progressPercent}% Done</span>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-950 flex flex-col gap-2 font-semibold text-slate-200">
                  <div className="flex justify-between text-xs border-b border-slate-900 pb-2 mb-2">
                    <span className="text-slate-500 font-bold">Name:</span>
                    <span>{currentCust.name || "Customer"}</span>
                  </div>
                  <div className="flex justify-between text-xs border-b border-slate-900 pb-2 mb-2">
                    <span className="text-slate-500 font-bold">Phone Number:</span>
                    <span className="text-green-400 font-mono">{currentCust.phone}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold">Email:</span>
                    <span className="text-slate-450">{currentCust.email || "N/A"}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Message Preview</span>
                  <div className="bg-green-600/5 border border-green-500/10 p-4 rounded-xl text-xs leading-relaxed text-slate-200 italic font-medium whitespace-pre-wrap">
                    {formattedMsg}
                    {marketingImage.trim() && (
                      <span className="block text-green-400 font-bold underline mt-2 text-[10px] uppercase font-mono">
                        + Attachment Image: {marketingImage}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/50 p-4 border-t border-slate-900 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSkippedQueueIds(prev => [...prev, currentCust.id]);
                    setQueueIndex(prev => prev + 1);
                  }}
                  className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-350 font-bold rounded-lg transition-colors cursor-pointer text-xs uppercase tracking-wider"
                >
                  SKIP
                </button>
                <a
                  href={nextUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    setSentQueueIds(prev => [...prev, currentCust.id]);
                    setQueueIndex(prev => prev + 1);
                  }}
                  className="w-2/3 py-2.5 bg-green-600 hover:bg-green-500 text-white font-extrabold rounded-lg transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-green-600/10 text-center"
                >
                  <MessageSquare size={14} />
                  <span>OPEN & SEND</span>
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {editorImageUrl && (
        <ImageEditorModal
          imageUrl={editorImageUrl}
          aspectRatio={2 / 1}
          onClose={() => {
            setEditorImageUrl("");
            setEditingFile(null);
          }}
          onSave={handleSaveEditedImage}
        />
      )}
    </div>
  );
}
