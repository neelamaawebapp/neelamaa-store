import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function ShippingPolicy() {
  return (
    <div className="min-h-screen bg-white w-full max-w-md mx-auto relative pb-24">
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </Link>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Shipping & Refunds</h1>
      </div>
      <div className="p-6 prose prose-sm text-gray-600">
        <p><strong>Last Updated: May 2026</strong></p>
        
        <h3 className="font-bold text-gray-900 mt-4 mb-2">Shipping Policy</h3>
        <p>All orders are processed within 1-2 business days. Estimated delivery times are typically 5-7 business days across India.</p>
        <p>You will receive a Shipment Confirmation email once your order has shipped containing your tracking number(s).</p>

        <h3 className="font-bold text-gray-900 mt-4 mb-2">Refunds & Returns</h3>
        <p>We have a 7-day return policy, which means you have 7 days after receiving your item to request a return.</p>
        <p>To be eligible for a return, your item must be in the same condition that you received it, unworn or unused, with tags, and in its original packaging.</p>
      </div>
    </div>
  );
}
