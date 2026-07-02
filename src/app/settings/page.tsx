"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ChevronLeft, Bell, Shield, Info, LogOut, Trash2, Smartphone, Mail, Sparkles, Languages } from "lucide-react";
import { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // Settings States
  const [displayName, setDisplayName] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);
  const [language, setLanguage] = useState("English");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (user === null) {
      router.push("/login");
    } else {
      setDisplayName(user.displayName || user.email?.split("@")[0] || "");
    }
  }, [user, router]);

  // Load preferences from localStorage if any
  useEffect(() => {
    try {
      const stored = localStorage.getItem("craftstyle_settings_prefs");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.emailNotifications !== undefined) setEmailNotifications(parsed.emailNotifications);
        if (parsed.pushNotifications !== undefined) setPushNotifications(parsed.pushNotifications);
        if (parsed.whatsappNotifications !== undefined) setWhatsappNotifications(parsed.whatsappNotifications);
        if (parsed.language !== undefined) setLanguage(parsed.language);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const prefs = {
      emailNotifications,
      pushNotifications,
      whatsappNotifications,
      language
    };

    localStorage.setItem("craftstyle_settings_prefs", JSON.stringify(prefs));

    try {
      // If we can update displayName in Firebase auth or Firestore
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        name: displayName,
        preferences: prefs
      }, { merge: true });

      // Trigger standard Firebase Auth display name update if available, or just mock it locally
      showToast("Settings updated successfully!");
    } catch (err) {
      console.error("Failed to sync settings with DB:", err);
      showToast("Saved locally successfully!");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("Failed to log out", err);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-24">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg z-50 animate-fade-in flex items-center space-x-1.5 backdrop-blur-sm border border-white/10">
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm justify-between">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">
            Settings
          </h1>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="p-4 space-y-5 overflow-y-auto flex-1">
        
        {/* Profile Card Edit */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-gray-50 pb-2.5">
            <Sparkles size={18} className="text-pink-500" />
            <h2 className="font-bold text-xs uppercase text-gray-850 tracking-wider">Profile Information</h2>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Display Name</label>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none text-gray-900 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-medium"
              placeholder="Your display name"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Registered Email (Read Only)</label>
            <input 
              type="email" 
              value={user.email || ""}
              disabled
              className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm outline-none text-gray-400 cursor-not-allowed font-medium"
            />
          </div>
        </div>

        {/* Notifications Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-gray-50 pb-2.5">
            <Bell size={18} className="text-pink-500" />
            <h2 className="font-bold text-xs uppercase text-gray-850 tracking-wider">Notifications</h2>
          </div>

          {/* Push notification toggle */}
          <div className="flex justify-between items-center py-1">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-pink-50 text-pink-500 rounded-lg">
                <Smartphone size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">Push Notifications</p>
                <p className="text-[10px] text-gray-400">Receive order updates on device</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={pushNotifications} 
                onChange={(e) => setPushNotifications(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
            </label>
          </div>

          {/* Email newsletter toggle */}
          <div className="flex justify-between items-center py-1">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-pink-50 text-pink-500 rounded-lg">
                <Mail size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">Email Newsletters</p>
                <p className="text-[10px] text-gray-400">Offers, news and restock notifications</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={emailNotifications} 
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
            </label>
          </div>

          {/* WhatsApp toggle */}
          <div className="flex justify-between items-center py-1">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-pink-50 text-pink-500 rounded-lg">
                <span className="text-[13px] font-bold">💬</span>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">WhatsApp Updates</p>
                <p className="text-[10px] text-gray-400">Order receipts and shipping alerts</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={whatsappNotifications} 
                onChange={(e) => setWhatsappNotifications(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
            </label>
          </div>
        </div>

        {/* Preferences Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-gray-50 pb-2.5">
            <Languages size={18} className="text-pink-500" />
            <h2 className="font-bold text-xs uppercase text-gray-850 tracking-wider">Preferences</h2>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">App Language</label>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none bg-white text-gray-850 font-medium focus:border-pink-500 transition-all"
            >
              <option value="English">English</option>
              <option value="Hindi">हिन्दी (Hindi)</option>
              <option value="Spanish">Español (Spanish)</option>
              <option value="French">Français (French)</option>
            </select>
          </div>
        </div>

        {/* Support & Privacy Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 border-b border-gray-50 pb-2.5 mb-1">
            <Shield size={18} className="text-pink-500" />
            <h2 className="font-bold text-xs uppercase text-gray-850 tracking-wider">Privacy & Policy</h2>
          </div>
          <button 
            type="button"
            onClick={() => router.push("/privacy")}
            className="w-full flex items-center justify-between text-left text-xs font-semibold text-gray-700 py-1.5 hover:text-pink-600 transition-colors"
          >
            <span>Privacy Policy</span>
            <ChevronLeft size={14} className="rotate-180 text-gray-400" />
          </button>
          <button 
            type="button"
            onClick={() => router.push("/terms")}
            className="w-full flex items-center justify-between text-left text-xs font-semibold text-gray-700 py-1.5 hover:text-pink-600 transition-colors"
          >
            <span>Terms of Service</span>
            <ChevronLeft size={14} className="rotate-180 text-gray-400" />
          </button>
          <button 
            type="button"
            onClick={() => router.push("/cancellation")}
            className="w-full flex items-center justify-between text-left text-xs font-semibold text-gray-700 py-1.5 hover:text-pink-600 transition-colors"
          >
            <span>Cancellation & Refund Policy</span>
            <ChevronLeft size={14} className="rotate-180 text-gray-400" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button 
            type="submit"
            disabled={saving}
            className="w-full bg-pink-500 text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 hover:bg-pink-600 transition-colors shadow-sm disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer"
          >
            {saving ? "SAVING SETTINGS..." : "SAVE SETTINGS"}
          </button>

          <button 
            type="button"
            onClick={handleLogout}
            className="w-full bg-white border border-gray-200 text-gray-600 font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors text-xs uppercase tracking-wider cursor-pointer"
          >
            <LogOut size={14} />
            Log Out
          </button>
        </div>

      </form>
    </div>
  );
}
