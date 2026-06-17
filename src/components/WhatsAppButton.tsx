"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function WhatsAppButton() {
  const pathname = usePathname();
  const phoneNumber = "917665020484"; // Placeholder
  const [productTitle, setProductTitle] = useState("");

  useEffect(() => {
    // We update this dynamically in case the document title changes
    if (typeof window !== "undefined") {
      setProductTitle(document.title);

      // Observer to catch title changes by React
      const observer = new MutationObserver(() => {
        setProductTitle(document.title);
      });
      const titleElement = document.querySelector('title');
      if (titleElement) observer.observe(titleElement, { childList: true });
      return () => observer.disconnect();
    }
  }, [pathname]);

  if (pathname?.startsWith("/admin")) return null;

  const getWhatsAppLink = () => {
    let text = "Hi Craft Style, I'm interested in your products!";
    if (pathname?.startsWith("/product/") && productTitle !== "Craft Style") {
      text = `Hi Craft Style, I'm interested in ${productTitle}. Is it available?`;
    }
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`;
  };

  const isProductPage = pathname?.startsWith("/product/");
  const isCartOrCheckout = pathname === "/bag" || pathname === "/checkout";

  return (
    <a
      href={getWhatsAppLink()}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed right-4 z-50 bg-[#25D366] text-white p-3.5 rounded-full shadow-lg shadow-green-500/30 hover:bg-green-600 hover:scale-110 transition-all duration-300 flex items-center justify-center
        ${isProductPage ? 'bottom-36' : isCartOrCheckout ? 'bottom-24' : 'bottom-20'}`}
      style={{
        // On desktop, keep it bound near the max-w-md container
        transform: "translateX(calc(min(0px, 50vw - 224px - 16px)))"
      }}
    >
      <MessageCircle size={28} />
    </a>
  );
}
