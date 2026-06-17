"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Bell, Trash2, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        // 1. Get local storage notifications
        let localNotifs: any[] = [];
        try {
          const stored = localStorage.getItem("craftstyle_local_notifications");
          if (stored) {
            const parsed = JSON.parse(stored);
            // If logged in, filter by user.uid. Otherwise, show all guest notifications.
            localNotifs = parsed.filter((n: any) => !user || n.userId === user.uid || !n.userId);
          }
        } catch (e) {
          console.error("Failed to parse local notifications", e);
        }

        // 2. Fetch remote notifications from Firestore if logged in
        let remoteNotifs: any[] = [];
        if (user && !user.uid.startsWith("mock_")) {
          try {
            const q = query(
              collection(db, "notifications"),
              where("userId", "==", user.uid)
            );
            const querySnapshot = await getDocs(q);
            remoteNotifs = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
          } catch (firestoreErr) {
            console.error("Failed to fetch Firestore notifications:", firestoreErr);
          }
        }

        // 2b. Fetch broadcast notifications from Firestore (available to all users)
        let broadcastNotifs: any[] = [];
        try {
          const bQuery = collection(db, "broadcast_notifications");
          const bSnapshot = await getDocs(bQuery);
          broadcastNotifs = bSnapshot.docs.map(doc => ({
            id: doc.id,
            isBroadcast: true,
            ...doc.data()
          }));
        } catch (bErr) {
          console.error("Failed to fetch Firestore broadcast notifications:", bErr);
        }

        // 3. Combine and sort by createdAt descending
        const combined = [...localNotifs, ...remoteNotifs, ...broadcastNotifs];
        combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(combined);
      } catch (err) {
        console.error("Error loading notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [user]);

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!confirm("Are you sure you want to clear all notifications?")) return;

    try {
      // 1. Clear local notifications
      try {
        const stored = localStorage.getItem("craftstyle_local_notifications");
        if (stored) {
          const parsed = JSON.parse(stored);
          // Keep notifications that belong to other users
          const remaining = parsed.filter((n: any) => user && n.userId !== user.uid && n.userId);
          localStorage.setItem("craftstyle_local_notifications", JSON.stringify(remaining));
        }
      } catch (e) {
        console.error(e);
      }

      // 2. Clear remote Firestore notifications
      if (user && !user.uid.startsWith("mock_")) {
        const q = query(
          collection(db, "notifications"),
          where("userId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const deletePromises = querySnapshot.docs.map(d => deleteDoc(doc(db, "notifications", d.id)));
        await Promise.all(deletePromises);
      }

      setNotifications([]);
    } catch (err) {
      console.error("Error clearing notifications:", err);
      alert("Failed to clear notifications.");
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 600);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return "Recently";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-24 border-x border-gray-200 shadow-md">
      {/* Header */}
      <div className="bg-white p-4 flex items-center justify-between border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 cursor-pointer">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Notifications</h1>
        </div>
        {notifications.length > 0 && (
          <button 
            onClick={handleClearAll}
            className="text-gray-400 hover:text-rose-600 transition-colors p-1.5 cursor-pointer rounded-full hover:bg-slate-50"
            title="Clear All"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 border border-gray-200/50 shadow-inner">
              <Bell size={32} className="text-gray-400" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1.5">No new notifications</h2>
            <p className="text-xs text-gray-500 max-w-[240px]">We'll let you know when desired items are back in stock or other updates arrive.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => notif.productId && router.push(`/product/${notif.productId}`)}
                className={`bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3 transition-all hover:border-pink-200/60
                  ${notif.productId ? 'cursor-pointer hover:shadow-md' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border
                  ${notif.isBroadcast 
                    ? 'bg-amber-50 text-amber-500 border-amber-100' 
                    : 'bg-pink-50 text-pink-500 border-pink-100'}`}
                >
                  <Bell size={16} className={notif.isBroadcast ? "fill-amber-500/10" : "fill-pink-500/10"} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-gray-900 text-xs tracking-wide">{notif.title}</h3>
                    <div className="flex items-center text-[10px] text-gray-400 font-semibold space-x-1 flex-shrink-0">
                      <Clock size={10} />
                      <span>{formatTime(notif.createdAt)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-650 mt-1 leading-relaxed">{notif.message}</p>
                  
                  {notif.productId && (
                    <div className="mt-2.5 flex items-center text-[10px] text-pink-600 font-bold uppercase tracking-wider gap-0.5 hover:underline">
                      <span>View Product</span>
                      <ChevronRight size={10} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
