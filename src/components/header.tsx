// components/header.tsx
"use client"

// import { useState } from "react" // Remove local state
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Gamepad2, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

import { useAccount } from 'wagmi'; // Import a wagmi hook
import { Account } from '../lib/profile';
import { WalletOptions } from '../lib/wallet-options'

 
 
export default function Header() {
  const pathname = usePathname()
  const { isConnected, address } = useAccount();  
function ConnectWallet() {
  const { isConnected } = useAccount()
  if (isConnected) return <Account />
  return <WalletOptions />
}
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="pr-0">
              <div className="px-7">
                <Link href="/" className="flex items-center gap-2 font-bold">
                  <Gamepad2 className="h-5 w-5 text-primary" />
                  <span>Monad Arcade</span>
                </Link>
              </div>
              <nav className="flex flex-col gap-4 px-2 pt-8">
                <Link
                  href="/"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground",
                    pathname === "/" && "bg-accent text-foreground",
                  )}
                >
                  Home
                </Link>
                <Link
                  href="/arcade"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground",
                    pathname.startsWith("/arcade") && "bg-accent text-foreground",
                  )}
                >
                  Arcade
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
          <Link href="/" className="hidden items-center gap-2 font-bold md:flex">
            <Gamepad2 className="h-6 w-6 text-primary" />
            <span>Monad Arcade</span>
          </Link>
          <nav className="hidden md:flex md:gap-6 lg:gap-10">
            <Link
              href="/"
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground/80",
                pathname === "/" ? "text-foreground" : "text-foreground/60",
              )}
            >
              Home
            </Link>
            <Link
              href="/arcade"
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground/80",
                pathname.startsWith("/arcade") ? "text-foreground" : "text-foreground/60",
              )}
            >
              Arcade
            </Link>
          </nav>
        </div>
        <div className="flex items-center  gap-4">
           <ConnectWallet />
      {/* <h2>Account</h2>
      <Account/> */}
     
        </div>
      </div>
    </header>
  )
}