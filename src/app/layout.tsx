import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "sirax · Identity & Risk Intelligence Platform",
  description:
    "sirax by Synkdata — Verificación de identidad, background checks, compliance e inteligencia de riesgo para México y LATAM. Know More. Risk Less.",
  keywords: [
    "sirax",
    "Synkdata",
    "Identity Intelligence",
    "Risk Intelligence",
    "KYC",
    "AML",
    "Background Checks",
    "México",
    "LATAM",
  ],
  icons: {
    icon:
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%230A192F'/><g stroke='%2300D1A0' stroke-width='5' stroke-linecap='round' stroke-dasharray='6 5'><line x1='50' y1='50' x2='20' y2='20'/><line x1='50' y1='50' x2='80' y2='20'/><line x1='50' y1='50' x2='20' y2='80'/><line x1='50' y1='50' x2='80' y2='80'/></g><circle cx='50' cy='50' r='6' fill='white'/><circle cx='20' cy='20' r='4' fill='white'/><circle cx='80' cy='20' r='4' fill='white'/><circle cx='20' cy='80' r='4' fill='white'/><circle cx='80' cy='80' r='4' fill='white'/></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
