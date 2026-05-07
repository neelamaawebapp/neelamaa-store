import { ChevronLeft, Bell } from "lucide-react";
import Link from "next/link";

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-md mx-auto relative pb-24">
      {/* Header */}
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </Link>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Notifications</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-10">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Bell size={32} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">No new notifications</h2>
        <p className="text-sm text-gray-500">We'll let you know when there's something new for you.</p>
      </div>
    </div>
  );
}
