"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut, Package, Heart, Settings, UserCircle, MapPin, Wallet, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const { user, isAdmin, logout, loading } = useAuth();
  const router = useRouter();

  // Address States
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Multi-address states
  interface SavedAddress {
    id: string;
    name: string;
    phone: string;
    street: string;
    city: string;
    pin: string;
    isDefault?: boolean;
  }
  const [addressesList, setAddressesList] = useState<SavedAddress[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<string>(""); // "" (list view), "new", or address ID
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPin, setEditPin] = useState("");
  const [editIsDefault, setEditIsDefault] = useState(false);

  useEffect(() => {
    if (loading) return;
    // If somehow a non-logged in user reaches here, redirect
    if (user === null) {
      router.push("/login?redirect=/profile");
    }
  }, [user, loading, router]);

  // Fetch address list on mount
  useEffect(() => {
    if (!user) return;

    const fetchAddressList = async () => {
      let loadedAddresses: SavedAddress[] = [];
      let legacyAddress: SavedAddress | null = null;

      // 1. Local Storage
      const localAddressesStr = localStorage.getItem("craftstyle_mock_user_addresses");
      const localAddrLegacyStr = localStorage.getItem("craftstyle_mock_user_address");

      if (localAddressesStr) {
        try {
          loadedAddresses = JSON.parse(localAddressesStr);
        } catch (e) {
          console.error(e);
        }
      }
      if (localAddrLegacyStr) {
        try {
          const parsed = JSON.parse(localAddrLegacyStr);
          if (parsed.street || parsed.city) {
            legacyAddress = {
              id: "base",
              name: user.displayName || user.email?.split("@")[0] || "Customer",
              phone: parsed.phone || "",
              street: parsed.street || "",
              city: parsed.city || "",
              pin: parsed.pin || "",
              isDefault: true,
            };
          }
        } catch (e) {
          console.error(e);
        }
      }

      // 2. Firestore
      let firestoreAddresses: SavedAddress[] = [];
      let firestoreLegacyAddress: SavedAddress | null = null;
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.birthday) {
            setBirthday(data.birthday);
          }
          if (Array.isArray(data.addresses)) {
            firestoreAddresses = data.addresses;
          }
          if (data.street || data.city) {
            firestoreLegacyAddress = {
              id: "base",
              name: data.name || user.displayName || user.email?.split("@")[0] || "Customer",
              phone: data.phone || "",
              street: data.street || "",
              city: data.city || "",
              pin: data.pin || "",
              isDefault: true,
            };
          }
        }
      } catch (err) {
        console.error(err);
      }

      let finalAddresses = firestoreAddresses.length > 0 ? firestoreAddresses : loadedAddresses;

      if (finalAddresses.length === 0) {
        const fallbackLegacy = firestoreLegacyAddress || legacyAddress;
        if (fallbackLegacy) {
          finalAddresses = [fallbackLegacy];
          try {
            localStorage.setItem("craftstyle_mock_user_addresses", JSON.stringify(finalAddresses));
            const { doc, updateDoc } = await import("firebase/firestore");
            const { db } = await import("@/lib/firebase");
            await updateDoc(doc(db, "users", user.uid), { addresses: finalAddresses });
          } catch (e) {
            console.error(e);
          }
        }
      }

      setAddressesList(finalAddresses);

      // Set the legacy top-level values for displaying on page (compatibility fallback)
      if (finalAddresses.length > 0) {
        const defaultAddr = finalAddresses.find(a => a.isDefault) || finalAddresses[0];
        setStreet(defaultAddr.street);
        setCity(defaultAddr.city);
        setPin(defaultAddr.pin);
        setPhone(defaultAddr.phone);
      }
    };

    fetchAddressList();
  }, [user]);

  const handleSaveAddressList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!editName.trim() || !editPhone.trim() || !editStreet.trim() || !editCity.trim() || !editPin.trim()) {
      alert("Please fill all fields.");
      return;
    }

    setSavingAddress(true);

    try {
      let updatedList = [...addressesList];
      
      const addressData: SavedAddress = {
        id: editingAddressId === "new" ? "addr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6) : editingAddressId,
        name: editName.trim(),
        phone: editPhone.trim(),
        street: editStreet.trim(),
        city: editCity.trim(),
        pin: editPin.trim(),
        isDefault: editIsDefault || addressesList.length === 0 || (editingAddressId !== "new" && addressesList.find(a => a.id === editingAddressId)?.isDefault),
      };

      if (addressData.isDefault) {
        updatedList = updatedList.map(a => ({ ...a, isDefault: false }));
      }

      if (editingAddressId === "new") {
        updatedList.push(addressData);
      } else {
        updatedList = updatedList.map(a => a.id === editingAddressId ? addressData : a);
      }

      // Save list to local storage
      localStorage.setItem("craftstyle_mock_user_addresses", JSON.stringify(updatedList));

      // Save list to Firestore
      const { doc, setDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      const userRef = doc(db, "users", user.uid);

      const payload: any = { addresses: updatedList };
      
      // Sync legacy/base fields if this is default
      if (addressData.isDefault) {
        payload.name = addressData.name;
        payload.phone = addressData.phone;
        payload.street = addressData.street;
        payload.city = addressData.city;
        payload.pin = addressData.pin;
        payload.address = `${addressData.street}, ${addressData.city}, ${addressData.pin}`;

        // Sync legacy localStorage
        localStorage.setItem("craftstyle_mock_user_address", JSON.stringify({
          phone: addressData.phone,
          street: addressData.street,
          city: addressData.city,
          pin: addressData.pin
        }));

        // Update local states
        setStreet(addressData.street);
        setCity(addressData.city);
        setPin(addressData.pin);
        setPhone(addressData.phone);
      }

      await setDoc(userRef, payload, { merge: true });
      setAddressesList(updatedList);

      // If we didn't set a default, but updated list, let's sync local states from current default
      const currentDefault = updatedList.find(a => a.isDefault) || updatedList[0];
      if (currentDefault) {
        setStreet(currentDefault.street);
        setCity(currentDefault.city);
        setPin(currentDefault.pin);
        setPhone(currentDefault.phone);
      }

      setEditingAddressId("");
    } catch (err) {
      console.error("Failed to save address details", err);
      alert("Failed to save address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    if (!user) return;

    try {
      const updatedList = addressesList.map(a => ({
        ...a,
        isDefault: a.id === addressId,
      }));

      const targetAddress = updatedList.find(a => a.id === addressId);
      if (!targetAddress) return;

      // Save to local storage
      localStorage.setItem("craftstyle_mock_user_addresses", JSON.stringify(updatedList));

      // Save to Firestore
      const { doc, setDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      const userRef = doc(db, "users", user.uid);

      const payload = {
        addresses: updatedList,
        name: targetAddress.name,
        phone: targetAddress.phone,
        street: targetAddress.street,
        city: targetAddress.city,
        pin: targetAddress.pin,
        address: `${targetAddress.street}, ${targetAddress.city}, ${targetAddress.pin}`,
      };

      // Sync legacy localStorage
      localStorage.setItem("craftstyle_mock_user_address", JSON.stringify({
        phone: targetAddress.phone,
        street: targetAddress.street,
        city: targetAddress.city,
        pin: targetAddress.pin
      }));

      await setDoc(userRef, payload, { merge: true });

      setAddressesList(updatedList);
      setStreet(targetAddress.street);
      setCity(targetAddress.city);
      setPin(targetAddress.pin);
      setPhone(targetAddress.phone);
    } catch (err) {
      console.error("Failed to set default address", err);
      alert("Failed to update default address.");
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!user) return;
    const confirmDelete = window.confirm("Are you sure you want to delete this address?");
    if (!confirmDelete) return;

    try {
      const target = addressesList.find(a => a.id === addressId);
      let updatedList = addressesList.filter(a => a.id !== addressId);

      // If we deleted the default address, and we have remaining ones, make the first remaining default
      if (target?.isDefault && updatedList.length > 0) {
        updatedList[0].isDefault = true;
      }

      // Save to local storage
      localStorage.setItem("craftstyle_mock_user_addresses", JSON.stringify(updatedList));

      // Save to Firestore
      const { doc, setDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      const userRef = doc(db, "users", user.uid);

      if (updatedList.length > 0) {
        const defaultAddr = updatedList.find(a => a.isDefault) || updatedList[0];
        const payload = {
          addresses: updatedList,
          name: defaultAddr.name,
          phone: defaultAddr.phone,
          street: defaultAddr.street,
          city: defaultAddr.city,
          pin: defaultAddr.pin,
          address: `${defaultAddr.street}, ${defaultAddr.city}, ${defaultAddr.pin}`,
        };

        // Sync legacy localStorage
        localStorage.setItem("craftstyle_mock_user_address", JSON.stringify({
          phone: defaultAddr.phone,
          street: defaultAddr.street,
          city: defaultAddr.city,
          pin: defaultAddr.pin
        }));

        await setDoc(userRef, payload, { merge: true });
        
        setStreet(defaultAddr.street);
        setCity(defaultAddr.city);
        setPin(defaultAddr.pin);
        setPhone(defaultAddr.phone);
      } else {
        // No addresses left, clear all fields
        const payload = {
          addresses: [],
          phone: "",
          street: "",
          city: "",
          pin: "",
          address: "",
        };
        localStorage.removeItem("craftstyle_mock_user_address");
        await setDoc(userRef, payload, { merge: true });
        
        setStreet("");
        setCity("");
        setPin("");
        setPhone("");
      }

      setAddressesList(updatedList);
    } catch (err) {
      console.error("Failed to delete address", err);
      alert("Failed to delete address.");
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

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete your account? This action is irreversible and all your profile and address data will be erased.");
    if (!confirmDelete) return;

    setDeletingAccount(true);
    try {
      if (user) {
        const { doc, deleteDoc } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        await deleteDoc(doc(db, "users", user.uid));
        
        if (user.delete && typeof user.delete === "function") {
          await user.delete();
        }
      }
      
      localStorage.removeItem("craftstyle_mock_user");
      localStorage.removeItem("craftstyle_mock_user_address");
      
      await logout();
      alert("Your account has been deleted successfully.");
      router.push("/");
    } catch (err: any) {
      console.error("Account deletion error:", err);
      if (err.code === "auth/requires-recent-login") {
        alert("For security reasons, please log out, log back in, and try deleting your account again.");
      } else {
        localStorage.removeItem("craftstyle_mock_user");
        localStorage.removeItem("craftstyle_mock_user_address");
        await logout();
        alert("Your profile has been removed from local storage and you have been logged out.");
        router.push("/");
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-24">
      {/* Header */}
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.push("/")} className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Profile</h1>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        
        {/* User Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center mb-6">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <UserCircle size={40} className="text-pink-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{user.displayName || user.email?.split("@")[0]}</h2>
          <p className="text-sm text-gray-500">{user.email}</p>
          
          {birthday ? (
            <p className="text-xs text-gray-500 mt-2 font-semibold">
              🎂 Date of Birth: <span className="font-bold text-gray-800">{new Date(birthday).toLocaleDateString("en-IN", { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </p>
          ) : (
            <p className="text-xs text-pink-600 mt-2.5 font-bold bg-pink-50 border border-pink-100 px-3 py-1.5 rounded-full select-none">
              🎁 Claim ₹200 Birthday Gift via Aarohi Chatbot! 🎂
            </p>
          )}
          
          {isAdmin && (
            <span className="mt-2 bg-slate-100 text-pink-800 text-xs font-bold px-2.5 py-0.5 rounded border border-slate-200">
              Admin Account
            </span>
          )}
        </div>

        {/* Address Card */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-2 mb-3">
            <MapPin size={18} className="text-pink-600" />
            <h3 className="font-bold text-xs text-gray-850 uppercase tracking-wide">Delivery & Billing Address Book</h3>
          </div>
          {editingAddressId ? (
            <form onSubmit={handleSaveAddressList} className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-gray-100 mb-2">
                <span className="font-bold text-xs text-pink-600 uppercase">
                  {editingAddressId === "new" ? "Add Address" : "Edit Address"}
                </span>
                <button 
                  type="button" 
                  onClick={() => setEditingAddressId("")} 
                  className="text-xs text-gray-400 font-bold hover:text-gray-650"
                >
                  Cancel
                </button>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Receiver's Name</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none text-gray-900 focus:border-pink-500 transition-colors" 
                  placeholder="Full Name"
                  required 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Street Address</label>
                <input 
                  type="text" 
                  value={editStreet} 
                  onChange={e => setEditStreet(e.target.value)} 
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none text-gray-900 focus:border-pink-500 transition-colors" 
                  placeholder="House No., Building, Street Name"
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">City</label>
                  <input 
                    type="text" 
                    value={editCity} 
                    onChange={e => setEditCity(e.target.value)} 
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none text-gray-900 focus:border-pink-500 transition-colors" 
                    placeholder="e.g. Jodhpur"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Pincode</label>
                  <input 
                    type="text" 
                    value={editPin} 
                    onChange={e => setEditPin(e.target.value)} 
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none text-gray-900 focus:border-pink-500 transition-colors" 
                    placeholder="6-digit PIN"
                    required 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Contact Phone Number</label>
                <input 
                  type="tel" 
                  value={editPhone} 
                  onChange={e => setEditPhone(e.target.value)} 
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none text-gray-900 focus:border-pink-500 transition-colors" 
                  placeholder="10-digit mobile number"
                  required 
                />
              </div>
              {addressesList.length > 0 && !(editingAddressId !== "new" && addressesList.find(a => a.id === editingAddressId)?.isDefault) && (
                <div className="flex items-center space-x-2 pt-1 select-none">
                  <input 
                    type="checkbox" 
                    id="edit-default-check"
                    checked={editIsDefault} 
                    onChange={e => setEditIsDefault(e.target.checked)} 
                    className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500 cursor-pointer" 
                  />
                  <label htmlFor="edit-default-check" className="text-xs text-gray-600 cursor-pointer font-medium">
                    Make default (base) address
                  </label>
                </div>
              )}
              <div className="flex space-x-2 pt-2">
                <button 
                  type="submit" 
                  disabled={savingAddress}
                  className="flex-grow bg-pink-500 text-white font-bold py-2 rounded text-xs hover:bg-pink-600 transition-colors shadow-sm cursor-pointer disabled:opacity-50 uppercase tracking-wider"
                >
                  {savingAddress ? "SAVING..." : "SAVE ADDRESS"}
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingAddressId("")} 
                  className="flex-grow bg-gray-100 text-gray-700 font-bold py-2 rounded text-xs hover:bg-gray-200 transition-colors cursor-pointer uppercase tracking-wider"
                >
                  CANCEL
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {addressesList.length > 0 ? (
                <div className="space-y-3">
                  {addressesList.map((addr) => (
                    <div key={addr.id} className="p-3 border border-gray-200 rounded-lg hover:border-pink-200 transition-colors bg-white relative">
                      <div className="flex items-center justify-between pb-1 border-b border-gray-50 mb-1.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-sm text-gray-900">{addr.name}</span>
                          {addr.isDefault && (
                            <span className="bg-pink-100 text-pink-700 text-[8px] font-extrabold px-1 rounded uppercase tracking-wider">
                              Default (Base)
                            </span>
                          )}
                        </div>
                        <div className="flex space-x-3 text-xs font-bold uppercase text-pink-600">
                          {!addr.isDefault && (
                            <button 
                              onClick={() => handleSetDefaultAddress(addr.id)}
                              className="hover:underline cursor-pointer text-pink-500"
                            >
                              Set Default
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setEditingAddressId(addr.id);
                              setEditName(addr.name);
                              setEditPhone(addr.phone);
                              setEditStreet(addr.street);
                              setEditCity(addr.city);
                              setEditPin(addr.pin);
                              setEditIsDefault(addr.isDefault || false);
                            }}
                            className="hover:underline cursor-pointer text-gray-500"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="hover:underline cursor-pointer text-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-650 mt-1">{addr.street}</p>
                      <p className="text-xs text-gray-650">{addr.city} - {addr.pin}</p>
                      <p className="text-xs text-gray-850 font-semibold mt-1">
                        <span className="text-gray-500 font-normal">Contact:</span> {addr.phone}
                      </p>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => {
                      setEditingAddressId("new");
                      setEditName(user.displayName || user.email?.split("@")[0] || "Customer");
                      setEditPhone("");
                      setEditStreet("");
                      setEditCity("");
                      setEditPin("");
                      setEditIsDefault(addressesList.length === 0);
                    }} 
                    className="w-full bg-slate-50 border border-dashed border-gray-300 text-pink-600 font-bold text-xs py-2.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <MapPin size={14} />
                    <span>+ Add New Address</span>
                  </button>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-gray-500 italic text-xs mb-3">No delivery address saved yet.</p>
                  <button 
                    onClick={() => {
                      setEditingAddressId("new");
                      setEditName(user.displayName || user.email?.split("@")[0] || "Customer");
                      setEditPhone("");
                      setEditStreet("");
                      setEditCity("");
                      setEditPin("");
                      setEditIsDefault(true);
                    }} 
                    className="bg-pink-500 text-white font-bold text-xs px-5 py-2.5 rounded-md hover:bg-pink-600 transition-colors cursor-pointer uppercase tracking-wider shadow-sm"
                  >
                    + Add Base Address
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Menu Options */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden mb-6">
          <button onClick={() => router.push("/profile/orders")} className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left cursor-pointer">
            <div className="flex items-center space-x-3 text-gray-800">
              <Package size={20} className="text-gray-400" />
              <span className="font-medium text-sm">Orders</span>
            </div>
            <ChevronLeft size={16} className="text-gray-400 rotate-180" />
          </button>

          <button onClick={() => router.push("/profile/wallet")} className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left cursor-pointer">
            <div className="flex items-center space-x-3 text-gray-800">
              <Wallet size={20} className="text-gray-400" />
              <span className="font-medium text-sm">My Wallet</span>
            </div>
            <ChevronLeft size={16} className="text-gray-400 rotate-180" />
          </button>
          
          <button 
            onClick={() => router.push("/wishlist")}
            className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3 text-gray-800">
              <Heart size={20} className="text-gray-400" />
              <span className="font-medium text-sm">Wishlist</span>
            </div>
            <ChevronLeft size={16} className="text-gray-400 rotate-180" />
          </button>
 
          <button 
            onClick={() => router.push("/settings")}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3 text-gray-800">
              <Settings size={20} className="text-gray-400" />
              <span className="font-medium text-sm">Settings</span>
            </div>
            <ChevronLeft size={16} className="text-gray-400 rotate-180" />
          </button>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="w-full bg-white border border-red-200 text-red-500 font-bold py-3.5 rounded-lg shadow-sm flex items-center justify-center space-x-2 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut size={18} />
          <span>LOGOUT</span>
        </button>

        {/* Account Deletion (Google Play Compliance) */}
        <div className="mt-8 border-t border-gray-200 pt-6 text-center">
          <p className="text-xs text-gray-400 mb-2">Want to close your account? This will permanently delete your user profile and address details.</p>
          <button 
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
            className="text-xs text-red-600 font-bold hover:underline tracking-wide uppercase disabled:opacity-50 cursor-pointer"
          >
            {deletingAccount ? "Deleting Account..." : "Delete Account"}
          </button>
        </div>

      </div>
    </div>
  );
}
