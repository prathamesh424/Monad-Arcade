// arcade/slots/page.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, History, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Import wagmi hooks
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent } from 'wagmi';
import { parseEther, formatEther } from 'viem'; // For converting between MON and wei

// Import contract constants
import { MONAD_ARCADE_CONTRACT_ADDRESS, MONAD_ARCADE_CONTRACT_ABI } from "@/lib/contracts";

// Mapping for SymbolType enum in Solidity (Order matters!)
enum SymbolTypeSolidity { BTC, ETH, MON, USDC, STAR, ANY }
// Mapping for GameResult enum in Solidity (Order matters!)
enum GameResultSolidity { Pending, Win, Lose }


// Define slot symbols (client-side representation, map to contract SymbolType)
const symbols = [
  { id: "btc", symbol: "₿", color: "text-amber-500", contractValue: SymbolTypeSolidity.BTC },
  { id: "eth", symbol: "Ξ", color: "text-blue-500", contractValue: SymbolTypeSolidity.ETH },
  { id: "mon", symbol: "M", color: "text-purple-500", contractValue: SymbolTypeSolidity.MON },
  { id: "usdc", symbol: "₵", color: "text-green-500", contractValue: SymbolTypeSolidity.USDC },
  { id: "star", symbol: "★", color: "text-pink-500", contractValue: SymbolTypeSolidity.STAR },
  // Note: ANY symbol is only used in winning combinations, not for reel results
]

// Define winning combinations and multipliers (mirroring contract, or fetch from contract if exposed)
// For this example, we'll hardcode them here and assume they match the contract.
// For a trustless approach, fetch these from the contract if possible (requires contract modification).
const winningCombinationsFrontend = [
  { symbols: ["btc", "btc", "btc"], multiplier: 50 },
  { symbols: ["eth", "eth", "eth"], multiplier: 25 },
  { symbols: ["mon", "mon", "mon"], multiplier: 15 },
  { symbols: ["usdc", "usdc", "usdc"], multiplier: 10 },
  { symbols: ["star", "star", "star"], multiplier: 5 },
  { symbols: ["btc", "btc", "any"], multiplier: 4 },
  { symbols: ["eth", "eth", "any"], multiplier: 3 },
  { symbols: ["mon", "mon", "any"], multiplier: 2 },
  { symbols: ["usdc", "usdc", "any"], multiplier: 1.5 },
  { symbols: ["star", "star", "any"], multiplier: 1 },
]

// Helper to map contract SymbolType enum value to client-side symbol data
const getSymbolByContractValue = (value: SymbolTypeSolidity) => {
    // Find the symbol definition that matches the contract value
     const symbolData = symbols.find(s => s.contractValue === value);
    // Fallback if value is unexpected (e.g., ANY, or invalid)
    if (!symbolData) {
         return { id: "unknown", symbol: "?", color: "text-gray-500", contractValue: value };
    }
    return symbolData;
};

// Define type for local spin history derived from events
type SpinHistoryEntry = {
  gameId: bigint;
  reels: string[]; // Client-side symbol IDs
  bet: number; // in MON
  win: boolean;
  winAmount: number; // in MON
  timestamp: string; // Placeholder
}


export default function CryptoSlots() {
  const { address, isConnected } = useAccount(); // Get connected account details
  const { data: accountBalance, refetch: refetchBalance } = useBalance({ address }); // Fetch user's balance

  const [betAmount, setBetAmount] = useState("0.02") // Use MON for input
  const [isSpinning, setIsSpinning] = useState(false) // State for UI animation/loading
  const [reels, setReels] = useState<string[]>(["star", "star", "star"]) // Client-side reel symbols for display
  const [spinResult, setSpinResult] = useState<{ win: boolean; winAmount: number; multiplier: number } | null>(null) // Result from contract event

  // State for local spin history derived from events
  const [spinHistory, setSpinHistory] = useState<SpinHistoryEntry[]>([]);

  // Refs for reel elements (for client-side animation)
  const reelRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]

  // State to track ongoing transaction for spinning
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();

  // State to wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } =
    useWaitForTransactionReceipt({
      hash,
    });

    // --- Read Contract Data ---
    // Optional: Fetch MIN_BET if needed
     // const { data: minBetWei } = useReadContract({ ... });
     // const minBetMon = minBetWei ? parseFloat(formatEther(minBetWei)) : null;

     // Optional: Fetch winning combinations from contract if exposed as public view variable
     // Note: Fetching arrays from contract can be inefficient for large arrays.
     // const { data: contractWinCombos } = useReadContract({
     //    address: MONAD_ARCADE_CONTRACT_ADDRESS,
     //    abi: MONAD_ARCADE_CONTRACT_ABI,
     //    functionName: 'slotsWinningCombinations',
     //     chainId: config.chains[0].id,
     // });


    // --- Watch for Contract Events ---
    // Watch for spins being placed
    useWatchContractEvent({
        address: MONAD_ARCADE_CONTRACT_ADDRESS,
        abi: MONAD_ARCADE_CONTRACT_ABI,
        eventName: 'SlotsSpun',
        onLogs(logs) {
            if (logs && logs.length > 0) {
                logs.forEach(log => {
                   console.log("SlotsSpun Event Received:", log.args);
                    // You could update UI here, e.g., show a list of recent spins by others
                });
            }
        },
    });

     // Watch for spin results
    useWatchContractEvent({
        address: MONAD_ARCADE_CONTRACT_ADDRESS,
        abi: MONAD_ARCADE_CONTRACT_ABI,
        eventName: 'SlotsResult',
        onLogs(logs) {
            if (logs && logs.length > 0) {
                 // Find the result for the transaction we just sent
                 const ourSpinLog = logs.find(log => log.transactionHash === hash);

                if (ourSpinLog && ourSpinLog.args) {
                  const { gameId, player, reelResults: reelResultsSolidity, outcome: gameOutcomeSolidity, payout: payoutWei } = ourSpinLog.args;

                   console.log("SlotsResult Event Received:", ourSpinLog.args);

                    // Convert Solidity enum values back to client-side symbol IDs
                    const reelResultsIds: string[] = reelResultsSolidity.map((solidityValue: SymbolTypeSolidity) => getSymbolByContractValue(solidityValue).id);

                    const outcome = gameOutcomeSolidity === GameResultSolidity.Win ? "win" : "lose"; // Map Solidity enum
                    const payoutMon = parseFloat(formatEther(payoutWei || 0));
                     const betMon = parseFloat(betAmount); // Use the local bet amount for history


                    // Update state to show the results and outcome
                    setReels(reelResultsIds); // Set the final reel display based on contract result
                    setSpinResult({
                        win: outcome === "win",
                        winAmount: payoutMon,
                         multiplier: betMon > 0 ? payoutMon / betMon : 0, // Calculate multiplier based on bet and payout
                    });


                   // Add to history
                   setSpinHistory(prevHistory => [
                     {
                       gameId: gameId as bigint,
                       reels: reelResultsIds,
                       bet: betMon,
                       win: outcome === "win",
                       winAmount: payoutMon,
                       timestamp: "Just now", // Placeholder
                     },
                     ...prevHistory.slice(0, 3), // Keep only last 4 spins
                   ]);

                   setIsSpinning(false); // Stop loading state after result is processed
                    refetchBalance(); // Refetch user's balance to reflect win/loss
                } else {
                    // If no matching log found for our hash, maybe it was an older spin resolved
                    console.warn("Received SlotsResult but no matching transaction hash found in logs.");
                     setIsSpinning(false); // Stop spinning state
                     // You might want to show a generic result or error here
                      setSpinResult({ win: false, winAmount: 0, multiplier: 0 }); // Show a loss result
                      refetchBalance(); // Still refetch balance in case it changed
                }
            }
        },
        // Optional: filter by player address or gameId
        // args: { player: address },
    });


    // --- Handle Transaction Status Changes ---
    useEffect(() => {
        if (isPending) {
            console.log("Slots spin transaction pending...");
            setIsSpinning(true); // Indicate processing state
             setSpinResult(null); // Clear previous result display
             // Reset reel animation to a spinning state if needed
             triggerSpinAnimation(); // Start client-side animation
        }
        if (isConfirming) {
             console.log("Slots spin transaction confirming...", hash);
             // Update UI state
             // Animation continues
        }
        if (isConfirmed) {
            console.log("Slots spin transaction confirmed!", hash);
             // Transaction sent and confirmed.
             // The result will be processed when the SlotsResult event is received.
             // Keep isSpinning/animation state until event is handled.
        }
        if (writeError) {
            console.error("Slots spin transaction write error:", writeError);
             setIsSpinning(false); // Stop processing state on error
              setSpinResult({ win: false, winAmount: 0, multiplier: 0 }); // Show a loss result
              refetchBalance(); // Refetch balance
             alert(`Error spinning reels: ${writeError.message}`); // Simple error display
        }
         if (confirmError) {
            console.error("Slots spin transaction confirmation error:", confirmError);
             setIsSpinning(false); // Stop processing state on error
              setSpinResult({ win: false, winAmount: 0, multiplier: 0 }); // Show a loss result
              refetchBalance(); // Refetch balance
             alert(`Error confirming spin: ${confirmError.message}`); // Simple error display
        }
    }, [isPending, isConfirming, isConfirmed, writeError, confirmError, hash, refetchBalance]);


    // --- Client-Side Slot Animation Logic ---
    // This is a visual effect independent of the on-chain randomness and result.
    // It should transition to the final reels determined by the contract event.
     const triggerSpinAnimation = () => {
         // Add spinning class to reels
         reelRefs.forEach((reelRef, index) => {
             if (reelRef.current) {
                 reelRef.current.classList.add("spinning");
                  // Optional: Set animation duration/speed per reel
                  reelRef.current.style.animationDuration = `${0.8 + index * 0.2}s`; // Example varying speed
             }
         });

         // The actual stopping and setting of final reel results is done
         // in the useWatchContractEvent for SlotsResult.
         // The CSS transition/animation will handle the visual stopping.
     };


     // Clean up spinning class when isSpinning becomes false
     useEffect(() => {
         if (!isSpinning) {
             reelRefs.forEach(reelRef => {
                 if (reelRef.current) {
                     reelRef.current.classList.remove("spinning");
                 }
             });
         }
     }, [isSpinning]);


  const handleSpinReels = () => {
    if (!isConnected) {
       alert("Please connect your wallet first.");
       return;
    }
     // Disable spinning if a transaction is pending, confirming, or animation is running
     if (isPending || isConfirming || isSpinning || parseFloat(betAmount) <= 0 || !accountBalance) return

    const betAmountFloat = parseFloat(betAmount);
     if (isNaN(betAmountFloat) || betAmountFloat <= 0) {
         alert("Please enter a valid bet amount.");
         return;
     }


    const betAmountWei = parseEther(betAmount); // Convert MON string to wei (BigInt)

     // Optional: Check if bet amount is less than min bet (if you fetch MIN_BET)
     // const minBetMon = minBetWei ? parseFloat(formatEther(minBetWei)) : 0;
     // if (minBetMon > 0 && betAmountFloat < minBetMon) {
     //    alert(`Bet amount must be at least ${minBetMon} MON.`);
     //    return;
     // }


     // Check if user has enough balance (using fetched balance)
      if (accountBalance.value < betAmountWei) {
         alert("Insufficient balance.");
         return;
      }


     console.log("Spinning Slots with bet:", {
       address: MONAD_ARCADE_CONTRACT_ADDRESS,
       abi: MONAD_ARCADE_CONTRACT_ABI,
       functionName: 'spinSlots',
       args: [], // spinSlots function takes no args, only value
       value: betAmountWei, // Send MON as value
     });

    // Use wagmi's writeContract function
    writeContract({
      address: MONAD_ARCADE_CONTRACT_ADDRESS,
      abi: MONAD_ARCADE_CONTRACT_ABI,
      functionName: 'spinSlots',
      // args: [], // No args for spinSlots
      value: betAmountWei, // Send the bet amount as value
    });

    // State updates are now primarily driven by events and transaction status
     // setIsSpinning(true); // Set when tx is pending (handled in useEffect)
     // Animation is triggered in useEffect when isSpinning becomes true
  }

  // Determine button disabled state
   const isButtonDisabled = isPending || isConfirming || isSpinning || parseFloat(betAmount || '0') <= 0 || !isConnected || (accountBalance && parseEther(betAmount || '0') > accountBalance.value);


    // Map SymbolTypeSolidity enum value back to client-side symbol data for rendering
    const renderSymbol = (solidityValue: SymbolTypeSolidity | string, key: any) => {
        // If the reels state temporarily holds strings (from initial state or simulation), handle that
        if (typeof solidityValue === 'string') {
            const symbolData = symbols.find(s => s.id === solidityValue);
             if (symbolData) {
                 return (
                     <div
                        key={key}
                        className={cn(
                           "flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-5xl font-bold",
                            symbolData.color,
                        )}
                      >
                         {symbolData.symbol}
                       </div>
                 );
             } else {
                 return ( // Fallback for unknown strings
                     <div key={key} className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-5xl font-bold text-gray-500">
                         ?
                     </div>
                 );
             }
        }


        // Handle SymbolTypeSolidity enum values from contract events
        const symbolData = getSymbolByContractValue(solidityValue as SymbolTypeSolidity); // Cast to SymbolTypeSolidity

         return (
             <div
                key={key}
                className={cn(
                   "flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-5xl font-bold",
                   symbolData.color,
                )}
              >
                 {symbolData.symbol}
               </div>
         );
    };


     // Map SymbolTypeSolidity enum value or string id to client-side symbol data for payout table
     const renderPayoutSymbol = (symbolOrId: SymbolTypeSolidity | string, key: any) => {
         let symbolData = { symbol: '?', color: 'text-gray-500' };
         if (typeof symbolOrId === 'string') {
              if (symbolOrId === "any") {
                 symbolData = { symbol: '?', color: 'text-muted-foreground' };
              } else {
                const found = symbols.find(s => s.id === symbolOrId);
                if (found) symbolData = { symbol: found.symbol, color: found.color };
              }
         } else { // Assuming it's SymbolTypeSolidity
             const found = getSymbolByContractValue(symbolOrId);
             if (found) symbolData = { symbol: found.symbol, color: found.color };
         }

         return (
              <div
                key={key}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xl font-bold",
                  symbolData.color,
                )}
              >
                {symbolData.symbol}
              </div>
         );
     };


  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center">
        <Link href="/arcade">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Arcade
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Crypto Slots</CardTitle>
              <CardDescription>Spin the reels for a chance at the big prize (On-chain)</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Balance Display */}
              <div className="mb-6 flex items-center justify-between rounded-lg border p-3">
                <div className="text-sm font-medium text-muted-foreground">Your Balance</div>
                 {/* Use fetched balance */}
                <div className="text-xl font-bold">{accountBalance ? parseFloat(formatEther(accountBalance.value)).toLocaleString() : '-'} MON</div>
              </div>

              {/* Slot Machine */}
              <div className="mb-8">
                 {/* Apply spinning class when processing transaction or animating */}
                <div className={cn("relative mx-auto mb-6 flex h-40 max-w-md overflow-hidden rounded-lg border bg-black/80", (isPending || isConfirming || isSpinning) && 'spinning-container')}>
                  {/* Reels */}
                  {[0, 1, 2].map((reelIndex) => (
                    <div
                      key={reelIndex}
                      ref={reelRefs[reelIndex]}
                      className="flex flex-1 items-center justify-center border-r last:border-r-0 reel" // Added reel class for animation
                    >
                      {/* Render the symbol using the helper, reels state contains symbol IDs or contract enum values */}
                       {renderSymbol(reels[reelIndex], reelIndex)}
                    </div>
                  ))}

                  {/* Win Line */}
                  <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-pink-500/50" />

                  {/* Win Overlay */}
                  {spinResult?.win && !(isPending || isConfirming || isSpinning) && ( // Show win overlay only when finished and win
                    <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 backdrop-blur-sm">
                      <div className="animate-bounce rounded-full bg-white/90 p-4 text-center">
                        <div className="text-xl font-bold text-green-600">You Win!</div>
                        <div className="text-2xl font-bold text-green-700">+{spinResult.winAmount.toLocaleString()} MON</div>
                      </div>
                    </div>
                  )}

                  {/* Spinning Overlay */}
                  {(isPending || isConfirming || isSpinning) && ( // Show loading while processing or animating
                    <div className="absolute right-2 top-2 rounded-full bg-background/80 px-3 py-1 text-sm backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isPending ? "Confirm in Wallet" : isConfirming ? "Confirming transaction..." : "Spinning On-Chain..."}
                      </div>
                    </div>
                  )}
                </div>

                {/* Result Message */}
                {spinResult && !(isPending || isConfirming || isSpinning) && ( // Show result message only when finished
                  <div className="text-center">
                    {spinResult.win ? (
                      <div className="text-lg font-medium text-green-500">
                        You won {spinResult.winAmount.toLocaleString()} MON ({spinResult.multiplier.toFixed(1)}x)!
                      </div>
                    ) : (
                      <div className="text-lg font-medium text-muted-foreground">No win this time. Try again!</div>
                    )}
                   {(writeError || confirmError) && ( // Display errors if any
                       <div className="mt-2 text-sm text-destructive">{writeError?.message || confirmError?.message}</div>
                    )}
                  </div>
                )}

                {/* Initial message or error if not connected */}
                 {!isConnected && !(isPending || isConfirming || isSpinning) && (
                     <div className="text-center text-lg font-medium text-muted-foreground">
                       Connect your wallet to spin the reels
                     </div>
                 )}

              </div>

              {/* Betting Controls */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <Label htmlFor="bet-amount">Bet Amount (MON)</Label>
                  <div className="mt-1.5 flex">
                    <Input
                      id="bet-amount"
                      type="number"
                      min={0.000000000000000001} // Small min for wei conversion
                     step="any" // Allow decimal input
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="rounded-r-none"
                      disabled={isButtonDisabled}
                    />
                    <Button
                      variant="outline"
                      className="rounded-l-none border-l-0"
                      onClick={() => {
                         const currentAmount = parseFloat(betAmount) || 0;
                         if (currentAmount > 0 && accountBalance) {
                             const doubleAmount = currentAmount * 2;
                             // Ensure doubling doesn't exceed balance
                            setBetAmount(Math.min(doubleAmount, parseFloat(formatEther(accountBalance.value))).toString());
                         }
                       }}
                       disabled={isButtonDisabled || parseFloat(betAmount || '0') <= 0 || !accountBalance || parseFloat(formatEther(accountBalance.value)) <= 0}
                    >
                      2x
                    </Button>
                  </div>
                   {/* Optional: Display MIN_BET if fetched */}
                     {/* {minBetMon !== null && minBetMon > 0 && (
                       <p className="mt-1 text-sm text-muted-foreground">Min bet: {minBetMon} MON</p>
                    )} */}
                </div>

                <div>
                  <Label>Max Potential Win</Label>
                   {/* Using hardcoded frontend winning combinations for display */}
                  <div className="mt-1.5 rounded-md border border-muted bg-muted/40 p-2.5 text-lg font-medium">
                    {(parseFloat(betAmount || '0') * 50).toLocaleString()} MON (50x)
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => {
                         if (accountBalance) {
                             setBetAmount(Math.min(10, parseFloat(formatEther(accountBalance.value))).toString());
                         } else {
                             setBetAmount("10"); // Set 10 if balance not loaded, will be checked on bet
                         }
                       }}
                  disabled={isButtonDisabled || (accountBalance && parseFloat(formatEther(accountBalance.value)) < 10)}
                >
                  Bet 10
                </Button>
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => {
                          if (accountBalance) {
                             setBetAmount(Math.min(50, parseFloat(formatEther(accountBalance.value))).toString());
                         } else {
                             setBetAmount("50"); // Set 50 if balance not loaded
                         }
                       }}
                  disabled={isButtonDisabled || (accountBalance && parseFloat(formatEther(accountBalance.value)) < 50)}
                >
                  Bet 50
                </Button>
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => {
                         if (accountBalance) {
                             setBetAmount(Math.min(100, parseFloat(formatEther(accountBalance.value))).toString());
                         } else {
                             setBetAmount("100"); // Set 100 if balance not loaded
                         }
                       }}
                  disabled={isButtonDisabled || (accountBalance && parseFloat(formatEther(accountBalance.value)) < 100)}
                >
                  Bet 100
                </Button>
              </div>

              <Button
                className="mt-6 h-14 w-full"
                size="lg"
                 // Disable based on processing state, bet amount, connection, and balance
                disabled={isButtonDisabled || parseFloat(betAmount || '0') <= 0 || (accountBalance && parseEther(betAmount || '0') > accountBalance.value)}
                onClick={handleSpinReels} // Call the wagmi function handler
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Confirm in Wallet
                  </>
                ) : isConfirming ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Confirming...
                  </>
                ) : isSpinning ? ( // Use isSpinning for general processing state (animation)
                   <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                     Spinning On-Chain...
                   </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Spin Reels
                  </>
                )}
                 {!isConnected && (
                    <span className="ml-2 text-sm">(Connect Wallet)</span>
                 )}
              </Button>

                {(writeError || confirmError) && ( // Display errors if any
                   <div className="mt-2 text-sm text-destructive text-center">{writeError?.message || confirmError?.message}</div>
                )}

            </CardContent>
          </Card>

          {/* Payout Table */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Payout Table</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {winningCombinationsFrontend.slice(0, 5).map((combo, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      {combo.symbols.map((symbol, i) => renderPayoutSymbol(symbol, i))}
                    </div>
                    <div className="font-medium">{combo.multiplier}x</div>
                  </div>
                ))}
                {winningCombinationsFrontend.slice(5).map((combo, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      {combo.symbols.map((symbol, i) => renderPayoutSymbol(symbol, i))}
                    </div>
                    <div className="font-medium">{combo.multiplier}x</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          {/* Spin History */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <CardTitle>Spin History (Recent)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                 {spinHistory.length === 0 ? (
                     <p className="text-muted-foreground text-center">No recent spins.</p>
                 ) : (
                    spinHistory.map((spin, index) => (
                      <div key={index} className="rounded-lg border p-3">
                        <div className="mb-3 flex items-center justify-center gap-2">
                           {spin.reels.map((reelId, i) => renderPayoutSymbol(reelId, i))} {/* Use renderPayoutSymbol for history display */}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Bet:</span>
                            <span className="font-medium">{spin.bet.toLocaleString()} MON</span>
                          </div>
                          <div className="text-muted-foreground">{spin.timestamp}</div> {/* Timestamp is placeholder */}
                        </div>
                        <div className="mt-1 text-right">
                          {spin.win ? (
                            <div className="font-medium text-green-500">+{spin.winAmount.toLocaleString()} MON</div>
                          ) : (
                            <div className="font-medium text-red-500">-{spin.bet.toLocaleString()} MON</div>
                          )}
                        </div>
                      </div>
                    ))
                 )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}