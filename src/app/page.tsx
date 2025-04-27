// app/page.tsx
"use client"; // Must be a client component

import { useAccount } from 'wagmi'; // Import a wagmi hook
import { Account } from '../lib/profile';
import { WalletOptions } from '../lib/wallet-options'
import Link from "next/link"
import { Gamepad2 } from "lucide-react"
import { Button } from "@/components/ui/button"


export default function Home() {
  const { isConnected, address } = useAccount();  
function ConnectWallet() {
  const { isConnected } = useAccount()
  if (isConnected) return <Account />
  return <WalletOptions />
}
  return (
  <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="animate-float-slow mb-8 flex items-center justify-center rounded-full bg-primary/10 p-6">
        <Gamepad2 className="h-16 w-16 text-primary" />
      </div>

      <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">Monad Arcade</h1>

      <p className="mb-6 max-w-[42rem] text-xl text-muted-foreground sm:text-2xl">Experience fast on-chain gaming</p>

      <p className="mb-12 max-w-[42rem] text-muted-foreground">
        Play simple, fair mini-games with outcomes verified on the Monad blockchain. Fast transactions, transparent
        results, and instant payouts.
      </p>

      <div>
         <h2>Connect your wallet</h2>
      <ConnectWallet />
 
      {isConnected ? (
           <div className=" mt-2 flex flex-col gap-4 sm:flex-row items-center justify-center">
           <Link href="/arcade">
            <Button size="lg" className="gap-2">
              <Gamepad2 className="h-5 w-5" />
              Enter Arcade
            </Button>
          </Link>
       </div>
      ) : (
        <h4 className='mb-2 text-red-500'> ( Not Connected  )</h4>
      )} 
     </div>

   
    </div>
  );
}