import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white w-full max-w-md mx-auto relative pb-24">
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </Link>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Privacy Policy</h1>
      </div>
      <div className="p-6 prose prose-sm text-gray-600">
        <p><strong>Last Updated: May 2026</strong></p>
        <p>Aura Indian respects your privacy. This Privacy Policy describes how we collect, use, and disclose your personal information when you visit or make a purchase from our store.</p>
        
        <h3 className="font-bold text-gray-900 mt-4 mb-2">1. Personal Information We Collect</h3>
        <p>When you make a purchase, we collect certain information from you, including your name, billing address, shipping address, payment details, email address, and phone number.</p>

        <h3 className="font-bold text-gray-900 mt-4 mb-2">2. How We Use Your Information</h3>
        <p>We use the Order Information to fulfill any orders placed through the Site (including processing your payment information, arranging for shipping, and providing you with invoices and/or order confirmations).</p>
      </div>
    </div>
  );
}
