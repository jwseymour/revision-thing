import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/ThemeProvider";
import "../polyfills";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tripos Revision System",
  description:
    "A performance-optimisation revision system for Cambridge CS Tripos. Transform incomplete understanding into exam-ready competence.",
  keywords: ["Cambridge", "Computer Science", "Tripos", "revision", "spaced repetition", "active recall"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body style={{ fontFamily: "var(--font-geist-sans)" }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
