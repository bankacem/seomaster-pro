import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata = {
  metadataBase: new URL("https://seomaster.pro"),
  title: {
    default: "SEOMaster Pro — All-in-one SEO Platform",
    template: "%s · SEOMaster Pro",
  },
  description:
    "Professional SEO toolkit: site audits, keyword research, backlink analysis, rank tracking, competitor insights and AI-powered content analysis — built for agencies and in-house teams.",
  keywords: [
    "SEO",
    "SEO tool",
    "keyword research",
    "site audit",
    "backlink analysis",
    "rank tracking",
    "competitor analysis",
    "SEMrush alternative",
  ],
  openGraph: {
    title: "SEOMaster Pro — All-in-one SEO Platform",
    description: "Audit, research, track and outrank — all in one place.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SEOMaster Pro",
    description: "Professional SEO toolkit for modern teams.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
