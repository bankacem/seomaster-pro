import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SEO Master Pro",
    template: "%s | SEO Master Pro",
  },
  description:
    "Analyze, optimize, and grow your website with SEO Master Pro's intelligent SEO tools.",
  keywords: ["SEO", "website analysis", "search optimization", "SEO reports"],
  authors: [{ name: "SEO Master Pro" }],
  creator: "SEO Master Pro",
  metadataBase: new URL("https://seomaster.pro"),
  openGraph: {
    type: "website",
    title: "SEO Master Pro",
    description:
      "Analyze, optimize, and grow your website with intelligent SEO tools.",
    siteName: "SEO Master Pro",
  },
  twitter: {
    card: "summary_large_image",
    title: "SEO Master Pro",
    description:
      "Analyze, optimize, and grow your website with intelligent SEO tools.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
