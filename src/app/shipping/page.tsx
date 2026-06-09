import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function ShippingPolicy() {
  return (
    <div className="min-h-screen bg-white w-full max-w-md mx-auto relative pb-24 shadow-sm">
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </Link>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Shipping & Delivery</h1>
      </div>
      <div className="p-6 text-gray-600 text-sm leading-relaxed space-y-4">
        <p className="text-xs text-gray-400 font-medium">Last Updated: June 2026</p>
        
        <h3 className="font-bold text-gray-900 text-base mt-6">3.1 Order Processing Time</h3>
        <p>
          All orders are processed within 2 to 5 business days (excluding weekends and public holidays) after receiving your order confirmation email. You will receive another notification when your order has shipped.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">3.2 Shipping Rates & Estimates</h3>
        <p>
          Shipping charges for your order will be calculated and displayed at checkout.
        </p>
        <p>
          For bulk, custom, or heavy cargo freight items, shipping costs will be quoted separately by our logistics team via email.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">3.3 Delivery Timelines</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Domestic Shipping (India):</strong> Estimated delivery within 5 to 7 business days depending on the location.
          </li>
          <li>
            <strong>International Shipping:</strong> Estimated delivery timelines range from 15 to 30 business days depending on customs clearance and regional transport constraints.
          </li>
        </ul>
        <p className="text-xs text-gray-500 italic">
          Note: Delays due to customs procedures or regional carrier overloads are outside of our direct control.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">3.4 Customs, Duties, and Taxes</h3>
        <p>
          Neelamaa Enterprises is not responsible for any customs and taxes applied to your order. All fees imposed during or after shipping are the sole responsibility of the customer (tariffs, taxes, etc.).
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">3.5 Contact Us</h3>
        <p>
          For tracking or shipment issues, you can contact our logistics support at:
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
