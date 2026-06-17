import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function CancellationPolicy() {
  return (
    <div className="min-h-screen bg-white w-full max-w-md mx-auto relative pb-24 shadow-sm">
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </Link>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Cancellation & Refund</h1>
      </div>
      <div className="p-6 text-gray-600 text-sm leading-relaxed space-y-4">
        <p className="text-xs text-gray-400 font-medium">Last Updated: June 2026</p>
        
        <h3 className="font-bold text-gray-900 text-base mt-6">4.1 Order Cancellation</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Standard Orders:</strong> You may cancel your order within 24 hours of purchase without any penalty, provided the item has not yet been dispatched.
          </li>
          <li>
            <strong>Custom/Bespoke Orders:</strong> Once a custom-cut stone, custom fabrication, or specific bulk production run has begun, the order cannot be canceled.
          </li>
        </ul>

        <h3 className="font-bold text-gray-900 text-base mt-6">4.2 Return Windows & Eligibility</h3>
        <p>
          Customers have 14 days from the date of delivery to request a return or report discrepancies.
        </p>
        <p>
          To be eligible for a return, your item must be unused, unaltered, in the same condition that you received it, and must be in its original packaging.
        </p>
        <p>
          <strong>Non-Returnable Items:</strong> Perishable agricultural products (unless arriving damaged/spoiled) and custom-fabricated items.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">4.3 Damaged or Defective Items</h3>
        <p>
          If an item arrives damaged or defective, you must notify us through the Craft Style webapp portal within 48 hours of delivery. Photographic or video evidence of the damage and original packaging is strictly required to process a claim. For approved merchant-fault claims, we will arrange a replacement or issue a full/partial refund at no cost to the buyer.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">4.4 Return Shipping & Fees</h3>
        <p>
          For "Buyer Remorse" returns (e.g., changing mind, ordering incorrect specifications), the customer is responsible for booking and paying all return shipping, freight, and import customs duties.
        </p>
        <p>
          A 15% restocking fee will be deducted from the total refund amount for returned heavy materials or bulk cargo shipments.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">4.5 Refund Processing</h3>
        <p>
          Once your return is received and inspected at our warehouse facility, we will notify you via email of the approval or rejection of your refund.
        </p>
        <p>
          If approved, your refund will be automatically processed back to your original payment method via <strong>Razorpay</strong> within 5 to 10 business days.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">4.6 Contact Us</h3>
        <p>
          To check on your return request status, write to us at:
        </p>
        <div className="bg-gray-50 border border-gray-150 rounded-xl p-4 mt-2 space-y-1">
          <p className="font-semibold text-gray-800">Neelamaa Enterprises</p>
          <p>Email: <a href="mailto:admincraftstyle@gmail.com" className="text-pink-600 font-bold hover:underline">admincraftstyle@gmail.com</a></p>
          <p>Call/WhatsApp: <a href="tel:+919828120484" className="text-pink-600 font-bold hover:underline">+91-9828120484</a></p>
        </div>
      </div>
    </div>
  );
}
