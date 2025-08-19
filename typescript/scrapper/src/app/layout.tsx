import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Browser Use Scrapper",
  description: "Web Intelligence Gathering Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center">
          <div className="absolute inset-0 w-full max-w-11/12 md:max-w-5xl mx-auto h-full border-l border-r border-dashed border-stone-400"></div>

          <div className="z-1 w-full">
            <div className="max-w-11/12 md:max-w-5xl mx-auto h-[calc(100vh-4rem)] md:h-[640px]">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
