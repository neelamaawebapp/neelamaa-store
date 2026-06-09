import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white w-full max-w-md mx-auto relative pb-24 shadow-sm">
      <div className="bg-white p-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="mr-4">
          <ChevronLeft size={24} className="text-gray-800" />
        </Link>
        <h1 className="font-bold text-gray-900 leading-tight uppercase tracking-wide text-sm">Terms & Conditions</h1>
      </div>
      <div className="p-6 text-gray-600 text-sm leading-relaxed space-y-4">
        <p className="text-xs text-gray-400 font-medium">Last Updated: June 2026</p>
        <p>
          Welcome to <strong>NeelSutra</strong> (a platform operated by <strong>Neelamaa Enterprises</strong>). 
          By accessing or using our web application, you agree to be bound by these Terms and Conditions. Please read them carefully.
        </p>
        
        <h3 className="font-bold text-gray-900 text-base mt-6">1.1 Use of the Platform</h3>
        <p>
          To use this webapp, you must be at least 18 years of age or accessing it under the supervision of a parent or legal guardian.
        </p>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and password.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">1.2 Intellectual Property</h3>
        <p>
          All content included on this site, such as text, graphics, logos, button icons, images, digital downloads, and data compilations, is the property of Neelamaa Enterprises or its content suppliers and is protected by international copyright laws.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">1.3 Limitation of Liability</h3>
        <p>
          Neelamaa Enterprises shall not be liable for any special or consequential damages that result from the use of, or the inability to use, the materials on this site or the performance of the products, even if Neelamaa Enterprises has been advised of the possibility of such damages.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">1.4 Governing Law</h3>
        <p>
          These terms are governed by and construed in accordance with the laws of India, and any disputes will be subject to the exclusive jurisdiction of the courts in Jodhpur, Rajasthan.
        </p>

        <h3 className="font-bold text-gray-900 text-base mt-6">1.5 Contact Us</h3>
        <p>
          For any questions regarding these Terms, please reach out to us at:
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
