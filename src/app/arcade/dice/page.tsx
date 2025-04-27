// arcade/dice/page.tsx
"use client"

import { useState, useEffect } from "react" // Import useEffect
import Link from "next/link"
import { ArrowLeft, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, History, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Import wagmi hooks
import { useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent, useAccount, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem'; // For converting between MON and wei

// Import contract constants
import { MONAD_ARCADE_CONTRACT_ADDRESS, MONAD_ARCADE_CONTRACT_ABI } from "@/lib/contracts";

// Mapping for BetTypeDice enum in Solidity (Order matters!)
enum BetTypeDiceSolidity { Over, Under, Exactly }


export default function DiceGame() {
  const { address, isConnected } = useAccount(); // Get connected account details

  const [betAmount, setBetAmount] = useState("0.1") // Use MON for input, convert to wei for contract
  const [betType, setBetType] = useState<"over" | "under" | "exactly">("over")
  const [targetNumber, setTargetNumber] = useState("7")
  const [isRolling, setIsRolling] = useState(false)
  const [lastRoll, setLastRoll] = useState<number | null>(null)
  const [lastResult, setLastResult] = useState<"win" | "lose" | null>(null)
  const [lastPayout, setLastPayout] = useState<number | null>(null) // Store last payout

  // State to track ongoing transaction
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();

  // State to wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } =
    useWaitForTransactionReceipt({
      hash,
    });

    // State for game history fetched from events (simplified)
    const [gameHistory, setGameHistory] = useState<
      Array<{
        gameId: bigint; // Use bigint for contract event IDs
        roll: number;
        bet: number; // Store bet in MON for display
        type: string;
        target: number;
        result: "win" | "lose";
        payout: number; // Store payout in MON for display
      }>
    >([]);

    // --- Read Contract Data (Optional, for displaying contract info like min bet) ---
     const { data: minBetWei } = useReadContract({
       address: MONAD_ARCADE_CONTRACT_ADDRESS,
       abi: MONAD_ARCADE_CONTRACT_ABI,
       functionName: 'MIN_BET',
     });
    const minBetMon = typeof minBetWei === "bigint" ? parseFloat(formatEther(minBetWei)) : null;
 
    useWatchContractEvent({
        address: MONAD_ARCADE_CONTRACT_ADDRESS,
        abi: MONAD_ARCADE_CONTRACT_ABI,
        eventName: 'DiceBetPlaced',
        onLogs(logs) {
            // Process the latest bet placed event
            if (logs && logs.length > 0) {
                // Assuming the last log is the most recent bet
                const latestBetEvent = logs[logs.length - 1];
                 if (latestBetEvent) {
                   console.log("DiceBetPlaced Event Received:", latestBetEvent);
                    setIsRolling(true); // Set rolling state when bet is placed on-chain
                   setLastResult(null); // Clear previous result
                   setLastRoll(null); // Clear previous roll
                   setLastPayout(null); // Clear previous payout
                 }
            }
        }, 
    });
    useWatchContractEvent({
        address: MONAD_ARCADE_CONTRACT_ADDRESS,
        abi: MONAD_ARCADE_CONTRACT_ABI,
        eventName: 'DiceRollResult',
        onLogs(logs) {
            // Process the latest roll result event
            if (logs && logs.length > 0) {
                 // Find the result for the transaction we just sent
                 const ourGameLog = logs.find(log => log.transactionHash === hash);

                if (ourGameLog && ourGameLog.args) {
                  const { gameId, roll, result: gameResultSolidity, payout: payoutWei } = ourGameLog.args;

                   console.log("DiceRollResult Event Received:", ourGameLog);

                    const result = gameResultSolidity === 1 ? "win" : "lose"; // Map Solidity enum to string
                    const payoutMon = parseFloat(formatEther(payoutWei || 0)); // Convert payout from wei to MON

                   setLastRoll(Number(roll)); // Cast bigint roll to number (be cautious with very large numbers)
                   setLastResult(result);
                   setLastPayout(payoutMon);

                   // Add to history
                   setGameHistory(prevHistory => [
                     {
                       gameId: gameId as bigint,
                       roll: Number(roll),
                       bet: parseFloat(betAmount), // Use the local bet amount
                       type: betType,
                       target: Number.parseInt(targetNumber),
                       result,
                       payout: payoutMon,
                     },
                     ...prevHistory.slice(0, 4), // Keep only last 5 games
                   ]);

                   setIsRolling(false); // Game resolved, stop rolling state
                } else {
                   // If no matching log found for our hash, maybe it was an older game or an error
                   console.warn("Received DiceRollResult but no matching transaction hash found in logs.");
                    // You might still want to update state or show an error here
                    setIsRolling(false); // Stop rolling state if something went wrong or didn't match
                }
            }
        }, 
    });


    // --- Handle Transaction Status Changes ---
    useEffect(() => {
        if (isPending) {
            console.log("Transaction pending...");
            // Update UI state to show transaction is being sent
            setIsRolling(true); // Indicate rolling state while tx is pending
            setLastResult(null);
            setLastRoll(null);
            setLastPayout(null);
        }
        if (isConfirming) {
             console.log("Transaction confirming (mined)...", hash);
             // Update UI state to show transaction is mined, waiting for events
        }
        if (isConfirmed) {
            console.log("Transaction confirmed!", hash); 
        }
        if (writeError) {
            console.error("Transaction write error:", writeError);
             // Show error message to user
            setIsRolling(false); // Stop rolling state on error
            setLastResult("lose"); // Assume lose on error for UI simplicity
            setLastRoll(null); // Clear roll
            setLastPayout(0); // Payout is 0 on error
             alert(`Error placing bet: ${writeError.message}`); // Simple error display
        }
         if (confirmError) {
            console.error("Transaction confirmation error:", confirmError);
             // Show error message to user
            setIsRolling(false); // Stop rolling state on error
            setLastResult("lose"); // Assume lose on error for UI simplicity
            setLastRoll(null); // Clear roll
            setLastPayout(0); // Payout is 0 on error
             alert(`Error confirming bet: ${confirmError.message}`); // Simple error display
        }
    }, [isPending, isConfirming, isConfirmed, writeError, confirmError, hash]);


  const handlePlaceBet = () => {
    if (!isConnected) {
       alert("Please connect your wallet first.");
       return;
    }
     if (isPending || isConfirming || isRolling) return // Prevent multiple bets

    const betAmountWei = parseEther(betAmount); // Convert MON string to wei (BigInt)

     // Convert string betType to Solidity enum value
     const betTypeSolidity = BetTypeDiceSolidity[betType.charAt(0).toUpperCase() + betType.slice(1)] as BetTypeDiceSolidity;
     const targetNum = Number.parseInt(targetNumber);


     console.log("Placing bet:", {
       address: MONAD_ARCADE_CONTRACT_ADDRESS,
       abi: MONAD_ARCADE_CONTRACT_ABI,
       functionName: 'placeDiceBet',
       args: [betTypeSolidity, targetNum],
       value: betAmountWei, // Send MON as value
     });

    // Use wagmi's writeContract function
    writeContract({
      address: MONAD_ARCADE_CONTRACT_ADDRESS,
      abi: MONAD_ARCADE_CONTRACT_ABI,
      functionName: 'placeDiceBet',
      args: [betTypeSolidity, targetNum], // Pass bet type (enum) and target number
      value: betAmountWei, // Send the bet amount as value
    });
 
  }

  const getDiceIcon = (value: number) => {
    switch (value) {
      case 1: return <Dice1 className="h-full w-full" />
      case 2: return <Dice2 className="h-full w-full" />
      case 3: return <Dice3 className="h-full w-full" />
      case 4: return <Dice4 className="h-full w-full" />
      case 5: return <Dice5 className="h-full w-full" />
      case 6: return <Dice6 className="h-full w-full" />
      default: return <Dice1 className="h-full w-full" /> // Fallback
    }
  }

  // For dice values > 6, we show two dice
  const renderDice = (value: number | null) => {
    if (value === null) {
      return (
        <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/50 text-muted-foreground">
          ?
        </div>
      )
    }

    if (value >= 2 && value <= 12) { // Ensure value is within expected range for two dice
       if (value <= 6) {
         // Single die for values 1-6 (though contract rolls 2-12)
          return (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-white/10 p-2 text-primary">
              {getDiceIcon(value)}
            </div>
          );
       } 
       const dice1 = Math.min(6, Math.floor(value / 2));
       const dice2 = Math.min(6, value - dice1);
       // Basic validation to ensure dice sum up to value and are within 1-6
       if (dice1 + dice2 !== value || dice1 < 1 || dice2 < 1) {
           // Fallback or alternative representation if splitting doesn't work perfectly for the value
           return (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-white/10 p-2 text-primary text-3xl font-bold">
                   {value} {/* Just show the number if splitting is awkward */}
                </div>
           );
       }


      return (
        <div className="flex gap-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-white/10 p-2 text-primary">
            {getDiceIcon(dice1)}
          </div>
          <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-white/10 p-2 text-primary">
            {getDiceIcon(dice2)}
          </div>
        </div>
      );
    }

     // Fallback for unexpected values
     return (
        <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/50 text-muted-foreground text-xl">
          Err
        </div>
     );

  }

  const isButtonDisabled = isRolling || isPending || isConfirming || Number(betAmount) <= 0 || !isConnected;


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
              <CardTitle>Monad Dice</CardTitle>
              <CardDescription>Roll the dice and win based on your prediction (On-chain)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-8 flex flex-col items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  {renderDice(lastRoll)}

                  {isRolling || isPending || isConfirming ? ( // Show loading while rolling or tx is pending/confirming
                    <div className="mt-4 flex items-center gap-2 text-lg font-medium">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {isPending ? "Waiting for wallet confirmation..." : isConfirming ? "Confirming transaction..." : "Rolling dice on-chain..."}
                    </div>
                  ) : lastRoll !== null ? (
                    <div className="mt-4 text-center">
                      <div className="text-2xl font-bold">You rolled a {lastRoll}!</div>
                      <div
                        className={cn(
                          "mt-1 text-lg font-medium",
                          lastResult === "win" ? "text-green-500" : "text-red-500",
                        )}
                      >
                        {lastResult === "win" ? <>You Win! +{lastPayout} MON</> : <>You Lose! -{gameHistory.length > 0 ? gameHistory[0].bet : parseFloat(betAmount)} MON</>} {/* Display last bet if history is empty */}
                      </div>
                       {(writeError || confirmError) && ( // Display errors if any
                          <div className="mt-2 text-sm text-destructive">{writeError?.message || confirmError?.message}</div>
                       )}
                    </div>
                  ) : (
                    <div className="mt-4 text-lg font-medium text-muted-foreground">
                      Place your bet to roll the dice
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <Label htmlFor="bet-amount">Bet Amount (MON)</Label>
                  <div className="mt-1.5 flex">
                    <Input
                      id="bet-amount"
                      type="number"
                      // min={minBetMon || "0.1"} // Use minBetMon if fetched
                      min="0.0000000000000001" // Small minimum to allow flexibility if minBetMon isn't loaded
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="rounded-r-none"
                      disabled={isButtonDisabled}
                    />
                    <Button
                      variant="outline"
                      className="rounded-l-none border-l-0"
                       onClick={() => {
                         const currentBet = parseFloat(betAmount) || 0;
                         if (currentBet > 0) setBetAmount((currentBet * 2).toString());
                       }}
                      disabled={isButtonDisabled || parseFloat(betAmount) <= 0} // Disable if betAmount is 0 or less
                    >
                      2x
                    </Button>
                  </div>
                   {minBetMon !== null && minBetMon > 0 && (
                      <p className="mt-1 text-sm text-muted-foreground">Min bet: {minBetMon} MON</p>
                   )}
                </div>

                <div>
                  <Label>Bet Type</Label>
                  <Tabs defaultValue="over" className="mt-1.5" onValueChange={(value) => setBetType(value as "over" | "under" | "exactly")}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="over" disabled={isButtonDisabled}>Over</TabsTrigger>
                      <TabsTrigger value="under" disabled={isButtonDisabled}>Under</TabsTrigger>
                      <TabsTrigger value="exactly" disabled={isButtonDisabled}>Exactly</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div>
                  <Label>Target Number</Label>
                  <RadioGroup
                    defaultValue="7"
                    className="mt-1.5 grid grid-cols-6 gap-2"
                    onValueChange={setTargetNumber}
                     disabled={isButtonDisabled}
                  >
                    {[2, 4, 6, 7, 8, 10].map((num) => (
                      <div key={num} className="flex items-center space-x-2">
                        <RadioGroupItem value={num.toString()} id={`target-${num}`} className="peer sr-only" disabled={isButtonDisabled} />
                        <Label
                          htmlFor={`target-${num}`}
                          className={cn(
                            "flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-muted bg-popover p-2 text-center peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary",
                             isButtonDisabled && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {num}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label>Potential Payout</Label>
                   {/* Calculate potential payout based on current bet amount and contract multipliers (if fetched) */}
                   {/* Using hardcoded multipliers as fallback if not fetched */}
                  <div className="mt-1.5 rounded-md border border-muted bg-muted/40 p-2.5 text-lg font-medium">
                    {betType === "exactly" ? (
                       <>{(parseFloat(betAmount) || 0) * 5} MON (5x)</>
                    ) : (
                       <>{(parseFloat(betAmount) || 0) * 1.5} MON (1.5x)</>
                    )}
                  </div>
                </div>
              </div>

              <Button
                className="mt-6 w-full"
                size="lg"
                disabled={isButtonDisabled || parseFloat(betAmount) < (minBetMon || 0.0000000000000001)} // Disable if bet is less than min
                onClick={handlePlaceBet}
              >
                {isPending ? (
                   <>
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Confirm in Wallet
                   </>
                ) : isConfirming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Confirming...
                  </>
                ) : isRolling ? ( // Show rolling state while waiting for events after confirmation
                   <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Rolling On-Chain...
                   </>
                ) : (
                  "Place Bet"
                )}
                 {!isConnected && (
                    <span className="ml-2 text-sm">(Connect Wallet)</span>
                 )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <CardTitle>Game History (Last 5)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {gameHistory.length === 0 ? (
                   <p className="text-muted-foreground text-center">No games played yet.</p>
                ) : (
                  gameHistory.map((game, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium">Rolled: {game.roll}</div>
                        <div className="text-sm text-muted-foreground">
                          Bet: {game.bet} MON {game.type} {game.target}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "text-right font-medium",
                          game.result === "win" ? "text-green-500" : "text-red-500",
                        )}
                      >
                        {game.result === "win" ? <>+{game.payout} MON</> : <>-{game.bet} MON</>}
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