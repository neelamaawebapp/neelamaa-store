import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white w-full max-w-md mx-auto relative pb-24 shadow-sm">
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </Link>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Privacy Policy</h1>
      </div>
      <div className="p-6 text-gray-600 text-sm leading-relaxed space-y-4">
        <p className="text-xs text-gray-400 font-medium">Last Updated: June 2026</p>
        <p>
          We respect your privacy and are committed to protecting your personal data. This Privacy Policy outlines how we collect, use, and safeguard your information.
        </p>
        
        <h3 className="font-bold text-gray-900 text-base mt-6">2.1 Information We Collect</h3>
        <p>
          <strong>Personal Information:</strong> Name, billing address, shipping address, email address, phone number, and tax identification numbers (if applicable) when you place an order.
        </p>
        <p>
          <strong>Payment Information:</strong> All payments are processed securely through our payment gateway partner, <strong>Razorpay</strong>. We do not store your credit card, debit card, or net banking credentials on our servers.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">2.2 How We Use Your Information</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>To process and fulfill your orders, including tracking delivery.</li>
          <li>To communicate with you regarding your account, orders, or support queries.</li>
          <li>To improve our web application user experience and security.</li>
        </ul>

        <h3 className="font-bold text-gray-900 text-base mt-6">2.3 Data Security</h3>
        <p>
          We implement robust commercial security measures, including SSL encryption, to secure your personal data against unauthorized access, alteration, or disclosure.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">2.4 Contact Us</h3>
        <p>
          For privacy-related inquiries or data access requests, please contact us at:
        </p>
        <div className="bg-gray-50 border border-gray-150 rounded-xl p-4 mt-2 space-y-1">
          <p className="font-semibold text-gray-800">Neelamaa Enterprises</p>
          <p>Email: <a href="mailto:neelsutra1@gmail.com" className="text-pink-600 font-bold hover:underline">neelsutra1@gmail.com</a></p>
          <p>Call/WhatsApp: <a href="tel:+919828120484" className="text-pink-600 font-bold hover:underline">+91-9828120484</a></p>
        </div>
      </div>
    </div>
  );
}
