import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trader-Pro Quant Platform | Institutional Scalping Engine",
  description: "Institutional cryptocurrency scalping platform with real-time TradingView sync, +0.30R Breakeven Ratchets, and dynamic S/R radar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-chrome-bg text-chrome-ink antialiased">
        {children}
      </body>
    </html>
  );
}
