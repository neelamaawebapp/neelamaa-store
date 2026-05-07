import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white w-full max-w-md mx-auto relative pb-24">
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </Link>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Terms of Service</h1>
      </div>
      <div className="p-6 prose prose-sm text-gray-600">
        <p><strong>Last Updated: May 2026</strong></p>
        <p>Welcome to Aura Indian. By using our website and services, you agree to these Terms of Service.</p>
        
        <h3 className="font-bold text-gray-900 mt-4 mb-2">1. General Conditions</h3>
        <p>We reserve the right to refuse service to anyone for any reason at any time. You understand that your content may be transferred unencrypted over various networks.</p>

        <h3 className="font-bold text-gray-900 mt-4 mb-2">2. Products or Services</h3>
        <p>Certain products or services may be available exclusively online through the website. These products or services may have limited quantities and are subject to return or exchange only according to our Return Policy.</p>
      </div>
    </div>
  );
}
