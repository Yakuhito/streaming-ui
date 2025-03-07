import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import StoreProvider from "./StoreProvider";
import WalletInitializer from "./components/WalletInitializer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Streaming Dashboard",
  description: "Easily view, create, and manage CAT streams on Chia",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StoreProvider>
          <WalletInitializer />
          <Navbar />
          <div className="pt-16">
            {children}
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
