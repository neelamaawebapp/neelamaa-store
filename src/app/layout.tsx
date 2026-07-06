import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import WhatsAppButton from "@/components/WhatsAppButton";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import NotificationListener from "@/components/NotificationListener";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Craft Style",
  description: "High-performance E-commerce Web Application",
  manifest: "/manifest.json",
  openGraph: {
    title: "Craft Style",
    description: "Shop premium fashion and get ₹100 signup bonus instantly credited to your wallet!",
    url: "https://myntra-clone-delta-blue.vercel.app",
    siteName: "Craft Style",
    images: [
      {
        url: "https://myntra-clone-delta-blue.vercel.app/icon.png",
        width: 512,
        height: 512,
        alt: "Craft Style Logo"
      }
    ],
    locale: "en_IN",
    type: "website"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${playfair.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#F9F9F9]">
        <AuthProvider>
          <CartProvider>
            {children}
            <NotificationListener />
            <Footer />
            <BottomNav />
            <WhatsAppButton />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
