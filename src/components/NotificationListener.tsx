"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Bell, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationListener() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [toast, setToast] = useState<{ title: string; message: string; image?: string } | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>("default");

  const subscribeUserToPush = async (registration: ServiceWorkerRegistration) => {
    try {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BLJ_RRhI-sKmy-22UPm-9N6m6z1jfLv24cyIhl-Vuw0tOnldeija31Fj68JV136QRx8SNs6Xrl2NBFJv9c0SWy0";
      const applicationServerKey = urlBase64ToUint8Array(publicVapidKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      console.log("Push Subscription generated:", subscription);
      
      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys) {
        console.error("Subscription details are incomplete:", subJson);
        return;
      }

      // Save/merge to Firestore push_subscriptions using endpoint as key (encoded)
      const encodedEndpoint = encodeURIComponent(subJson.endpoint);
      const subRef = doc(db, "push_subscriptions", encodedEndpoint);
      await setDoc(subRef, {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        userId: user ? user.uid : "guest",
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.log("Subscription successfully synchronized with Firestore");
    } catch (err) {
      console.error("Failed to subscribe user to push notifications:", err);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermissionStatus(Notification.permission);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) return;

    // Register service worker
    navigator.serviceWorker.register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered scope:", registration.scope);
        // If permission is already granted, subscribe/update
        if (Notification.permission === "granted") {
          subscribeUserToPush(registration);
        }
      })
      .catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
  }, [user]);

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return;
    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      if (permission === "granted") {
        const registration = await navigator.serviceWorker.ready;
        await subscribeUserToPush(registration);
      }
    } catch (e) {
      console.error("Failed to request notification permission:", e);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Listen to real-time broadcast notifications
    const broadcastRef = collection(db, "broadcast_notifications");
    
    const unsubscribe = onSnapshot(broadcastRef, (snapshot) => {
      if (snapshot.empty) return;

      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      // Sort in JS memory to avoid index requirements
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const latestBroadcast = docs[0];
      if (!latestBroadcast) return;

      // Check last seen timestamp in localStorage
      const lastSeenStr = localStorage.getItem("craftstyle_last_seen_broadcast");
      const lastSeenTime = lastSeenStr ? new Date(lastSeenStr).getTime() : 0;
      const broadcastTime = new Date(latestBroadcast.createdAt).getTime();

      // If this is a new broadcast
      if (broadcastTime > lastSeenTime) {
        // Update last seen
        localStorage.setItem("craftstyle_last_seen_broadcast", latestBroadcast.createdAt);

        // Only show if the broadcast was sent within the last 15 minutes to prevent showing stale ones
        const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
        if (broadcastTime > fifteenMinsAgo) {
          // 1. Trigger OS system notification if permission is granted
          if (Notification.permission === "granted") {
            try {
              new Notification(latestBroadcast.title, {
                body: latestBroadcast.message,
                icon: "/icon.svg"
              });
            } catch (err) {
              console.warn("Native OS Notification failed, falling back to Service Worker", err);
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.ready.then((registration) => {
                  registration.showNotification(latestBroadcast.title, {
                    body: latestBroadcast.message,
                    icon: "/icon.svg"
                  });
                });
              }
            }
          }

          // 2. Trigger active in-app Toast
          setToast({
            title: latestBroadcast.title,
            message: latestBroadcast.message,
            image: latestBroadcast.image
          });

          // Auto-hide in-app toast after 8 seconds
          const timer = setTimeout(() => {
            setToast(null);
          }, 8000);

          return () => clearTimeout(timer);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to real-time personal user notifications (like back-in-stock alerts)
  useEffect(() => {
    if (typeof window === "undefined" || !user || user.uid.startsWith("mock_")) return;

    const notificationsRef = collection(db, "notifications");
    const q = query(notificationsRef, where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const oneMinuteAgo = Date.now() - 60 * 1000;
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const createdAtTime = new Date(data.createdAt).getTime();

          // Only alert for brand new notifications that are unread
          if (createdAtTime > oneMinuteAgo && !data.read) {
            // 1. Trigger OS system notification if permission is granted
            if (Notification.permission === "granted") {
              try {
                new Notification(data.title, {
                  body: data.message,
                  icon: "/icon.svg"
                });
              } catch (err) {
                console.warn("Native OS Notification failed", err);
              }
            }

            // 2. Trigger active in-app Toast
            setToast({
              title: data.title,
              message: data.message,
              image: data.image
            });

            // Auto-hide in-app toast after 8 seconds
            const timer = setTimeout(() => {
              setToast(null);
            }, 8000);

            return () => clearTimeout(timer);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);


  // Show a permission prompt subtly on the home / catalog pages if they haven't decided
  const shouldShowPrompt = 
    permissionStatus === "default" && 
    (pathname === "/" || pathname === "/categories" || pathname?.startsWith("/profile"));

  if (!toast && !shouldShowPrompt) return null;

  return (
    <>
      {/* Floating Broadcast Toast Alert */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4 animate-fade-in-down">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3 relative">
            <div className="w-8 h-8 bg-pink-500/10 rounded-full flex items-center justify-center text-pink-500 border border-pink-500/25 flex-shrink-0 animate-bounce">
              <Bell size={16} className="fill-pink-500/15" />
            </div>
            <div className="flex-1 pr-6 min-w-0">
              <h4 className="font-extrabold text-xs tracking-wide text-white uppercase">{toast.title}</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{toast.message}</p>
              {toast.image && (
                <div className="mt-2 rounded-lg overflow-hidden border border-slate-800">
                  <img src={toast.image} alt="Notification Banner" className="w-full h-auto object-cover max-h-24" />
                </div>
              )}
            </div>
            <button 
              onClick={() => setToast(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Subtle Permission Request Prompt */}
      {shouldShowPrompt && !toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4">
          <div className="bg-white/95 backdrop-blur border border-slate-200 text-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3 relative">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-pink-500 border border-pink-200 flex-shrink-0">
                <Bell size={16} />
              </div>
              <div>
                <h4 className="font-extrabold text-xs tracking-wide text-gray-900">Enable Mobile Notifications</h4>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                  Get instant alerts on mobile when sales go live or desired items are restocked!
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end text-xs font-bold mt-1">
              <button 
                onClick={() => setPermissionStatus("denied")} 
                className="px-3 py-1.5 text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                Later
              </button>
              <button 
                onClick={requestPermission} 
                className="px-4 py-1.5 bg-pink-500 text-white rounded-lg hover:bg-pink-650 transition-colors shadow-sm cursor-pointer"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
