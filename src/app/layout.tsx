import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Trader-Pro: BTC Strategy Research & Paper-Trading Dashboard",
  description: "Live out-of-sample paper trading and walk-forward research dashboard for BTC trading strategies evaluated after realistic taker fees and slippage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-chrome-bg text-chrome-ink antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
