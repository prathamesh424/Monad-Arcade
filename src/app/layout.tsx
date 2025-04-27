// app/layout.tsx
 "use client"; // Must be a client component
import "./globals.css";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

import { config } from "../lib/wagmi";
import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
 
const queryClient = new QueryClient()
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body  >
        {/* ✅ Use client instead of config */}
    <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
                    <ThemeProvider >

            <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1 mx-4">{children}</main>
              </div>
            </ThemeProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
