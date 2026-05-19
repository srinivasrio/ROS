import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dine in one - Restaurant OS",
  description: "Next-generation high-end restaurant operating system with real-time POS, KDS, and waitstaff management.",
  icons: {
    icon: "/favicon.png",
  }
};

import { ThemeProvider } from "@/app/components/ThemeProvider";
import { RestaurantProvider } from "@/app/context/RestaurantContext";
import { GlobalContextProvider } from "@/app/context/GlobalContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="en" 
      suppressHydrationWarning 
      className={`${geistMono.variable} ${inter.variable}`}
    >
      <body
        className="antialiased bg-background text-foreground transition-colors duration-300"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <GlobalContextProvider>
            <RestaurantProvider>
              {children}
              <Toaster position="top-center" richColors />
            </RestaurantProvider>
          </GlobalContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
