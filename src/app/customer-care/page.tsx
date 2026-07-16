"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MessageSquare, ChevronDown, Search, HelpCircle } from "lucide-react";

interface FAQItem {
  id: string;
  category: "orders" | "shipping" | "refunds" | "general";
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: "faq-1",
    category: "orders",
    question: "How can I track my order?",
    answer: "You can track your order in real-time by visiting the \"Profile > Orders\" section. Once your order is shipped, you will also receive confirmation emails and SMS alerts containing the tracking number and courier link."
  },
  {
    id: "faq-2",
    category: "shipping",
    question: "What is the shipping delivery timeline?",
    answer: "Standard delivery takes 3 to 5 business days across India. Remote locations or high-demand sale periods might take up to 7 business days. You can monitor the progress directly from your profile dashboard."
  },
  {
    id: "faq-3",
    category: "refunds",
    question: "How do I request a return or refund?",
    answer: "Go to your \"Profile > Orders\" section, select the corresponding order, and click the \"Request Return/Refund\" button. Our customer care support team will review the request and respond within 24 to 48 hours."
  },
  {
    id: "faq-4",
    category: "orders",
    question: "Can I modify my delivery address after placing an order?",
    answer: "Address modifications are only supported before your order is handed over to the courier. Please contact our support hotline (+91-7665020484) or email us immediately with your order ID to update shipping coordinates."
  },
  {
    id: "faq-5",
    category: "orders",
    question: "What payment methods are accepted?",
    answer: "We support a wide array of payment methods, including secure credit/debit card processing, UPI apps (Google Pay, PhonePe, Paytm), Netbanking, and Cash on Delivery (COD)."
  },
  {
    id: "faq-6",
    category: "shipping",
    question: "Are there any shipping costs?",
    answer: "We offer free standard shipping on all orders over ₹999. For orders below ₹999, a nominal shipping charge of ₹49 is applied at checkout."
  },
  {
    id: "faq-7",
    category: "refunds",
    question: "How long does a refund take to process?",
    answer: "Once a return is approved and the product is inspected, the refund is initiated. UPI and card refunds generally take 5 to 7 business days to reflect in your original payment source account."
  },
  {
    id: "faq-8",
    category: "general",
    question: "What should I do if a product is out of stock?",
    answer: "On the product details page, you can click on the \"Notify Me\" button. If the product is restocked, you will receive an automatic email and PWA push alert instantly."
  }
];

export default function CustomerCare() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "orders" | "shipping" | "refunds" | "general">("all");
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(prev => (prev === id ? null : id));
  };

  // Filter FAQs based on category filter and search query
  const filteredFAQs = FAQ_DATA.filter(faq => {
    const matchesCategory = activeFilter === "all" || faq.category === activeFilter;
    const matchesSearch = 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen pb-24 font-sans text-gray-800">
      {/* Header Navigation */}
      <header className="sticky top-0 bg-white border-b border-gray-150 px-4 py-4 z-50 flex items-center gap-3">
        <Link href="/" className="p-1 rounded-full hover:bg-slate-100 transition-colors text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-extrabold text-base tracking-wide text-gray-900 uppercase">Customer Care</h1>
          <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5 tracking-wider">Help & Support Center</p>
        </div>
      </header>

      {/* Hero Intro with Aarohi mascot */}
      <div className="bg-gradient-to-br from-pink-500 to-orange-500 px-5 py-6 text-white rounded-b-3xl shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="text-left flex-1">
            <h2 className="font-sans text-xl font-extrabold tracking-wide leading-tight">How can we help you?</h2>
            <p className="text-xs text-white/90 mt-1.5 leading-relaxed font-medium">
              Hi, I'm Aarohi! I am here 24/7 to help resolve your shopping and delivery queries.
            </p>
          </div>
          <div className="relative w-20 h-20 rounded-full border-2 border-white/90 overflow-hidden shrink-0 p-1 bg-white shadow-md animate-fade-in flex items-center justify-center">
            <img 
              src="/mascot/aarohi_waving.png" 
              alt="Aarohi mascot" 
              className="w-full h-full object-contain object-center"
            />
          </div>
        </div>
      </div>

      {/* Direct Contact Cards Grid */}
      <div className="px-4 -mt-6">
        <div className="grid grid-cols-2 gap-3.5">
          {/* Phone Call Card */}
          <a 
            href="tel:+917665020484"
            className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm hover:border-pink-500/35 hover:shadow transition-all duration-300 flex flex-col items-center text-center group cursor-pointer"
          >
            <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform mb-3">
              <Phone size={18} className="fill-pink-500/10" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Call Helpline</span>
            <span className="text-xs font-extrabold text-gray-900 mt-1 block">+91 7665020484</span>
          </a>

          {/* Email Support Card */}
          <a 
            href="mailto:customercarecraftstyle@gmail.com"
            className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm hover:border-pink-500/35 hover:shadow transition-all duration-300 flex flex-col items-center text-center group cursor-pointer"
          >
            <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform mb-3">
              <Mail size={18} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Support</span>
            <span className="text-[9px] font-extrabold text-gray-900 mt-1 truncate max-w-full block">customercarecraftstyle@gmail.com</span>
          </a>
        </div>

        {/* WhatsApp Card */}
        <a 
          href="https://wa.me/917665020484"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3.5 bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm hover:border-emerald-500/35 hover:shadow transition-all duration-300 flex items-center gap-4 group cursor-pointer w-full"
        >
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform shrink-0">
            <MessageSquare size={18} className="fill-emerald-500/10" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Chat on WhatsApp</span>
            <span className="text-xs font-extrabold text-gray-900 mt-0.5 block">Instant Messaging support</span>
          </div>
        </a>
      </div>

      {/* Inbuilt FAQ Section */}
      <div className="px-4 mt-8">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={18} className="text-pink-500" />
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Frequently Asked Questions</h3>
        </div>

        {/* Search Bar */}
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search questions or answers..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-250 rounded-xl pl-10 pr-4 py-3 text-xs outline-none focus:border-pink-500/50 shadow-sm transition-all"
          />
        </div>

        {/* Category Filters scroll */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-3 mb-4 -mx-4 px-4">
          {[
            { label: "All Topics", value: "all" },
            { label: "Orders", value: "orders" },
            { label: "Shipping", value: "shipping" },
            { label: "Refunds", value: "refunds" },
            { label: "General", value: "general" }
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                activeFilter === tab.value 
                  ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* FAQ Accordion List */}
        {filteredFAQs.length === 0 ? (
          <div className="bg-white p-8 text-center text-gray-400 rounded-2xl border border-gray-200 shadow-sm text-xs">
            No FAQ questions match your search query. Try typing another keyword.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFAQs.map(faq => {
              const isExpanded = expandedFAQ === faq.id;

              return (
                <div 
                  key={faq.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all shadow-sm"
                >
                  <button
                    onClick={() => toggleFAQ(faq.id)}
                    className="w-full p-4 flex items-center justify-between text-left gap-3 focus:outline-none cursor-pointer"
                  >
                    <span className="text-xs font-extrabold text-gray-800 leading-normal">{faq.question}</span>
                    <ChevronDown 
                      size={16} 
                      className={`text-gray-400 shrink-0 transition-transform duration-350 ${
                        isExpanded ? "transform rotate-180 text-pink-500" : ""
                      }`} 
                    />
                  </button>

                  <div 
                    className={`transition-all duration-350 ease-in-out ${
                      isExpanded ? "max-h-48 border-t border-gray-100" : "max-h-0 pointer-events-none"
                    } overflow-hidden`}
                  >
                    <p className="p-4 text-xs leading-relaxed text-gray-500 font-medium bg-slate-50/50">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
