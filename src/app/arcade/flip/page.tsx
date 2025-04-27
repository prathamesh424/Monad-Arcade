// arcade/flip/page.tsx
"use client"

import { useState, useEffect } from "react" // Import useEffect
import Link from "next/link"
import { ArrowLeft, Coins, History, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Import wagmi hooks
import { useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent, useAccount, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem'; // For converting between MON and wei

// Import contract constants
import { MONAD_ARCADE_CONTRACT_ADDRESS, MONAD_ARCADE_CONTRACT_ABI } from "@/lib/contracts";

// Mapping for FlipBetType enum in Solidity (Order matters: 0 for Heads, 1 for Tails)
enum FlipBetTypeSolidity { Heads, Tails }
// Mapping for GameResult enum in Solidity (Order matters: 0 for Pending, 1 for Win, 2 for Lose)
enum GameResultSolidity { Pending, Win, Lose }


export default function PredictionFlip() {
   const { address, isConnected } = useAccount(); // Get connected account details

  const [betAmount, setBetAmount] = useState("0.05") // Use MON for input
  const [prediction, setPrediction] = useState<"heads" | "tails" | null>(null)
  const [isFlipping, setIsFlipping] = useState(false) // UI state for animation
  const [flipResult, setFlipResult] = useState<"heads" | "tails" | null>(null) // Result from contract event
  const [flipRotation, setFlipRotation] = useState(0) // For animation
  const [gameResult, setGameResult] = useState<"win" | "lose" | null>(null) // Outcome from contract event
  const [lastPayout, setLastPayout] = useState<number | null>(null); // Payout from contract event

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
        gameId: bigint;
        prediction: "heads" | "tails";
        result: "heads" | "tails";
        bet: number; // Store bet in MON for display
        outcome: "win" | "lose";
        payout: number; // Store payout in MON for display
        timestamp: string; // Placeholder, ideally use block timestamp or fetch from explorer
      }>
    >([]);

    // --- Read Contract Data (Optional, for displaying contract info like min bet) ---
     const { data: minBetWei } = useReadContract({
       address: MONAD_ARCADE_CONTRACT_ADDRESS,
       abi: MONAD_ARCADE_CONTRACT_ABI,
       functionName: 'MIN_BET',
     });
     const minBetMon = minBetWei ? parseFloat(formatEther(minBetWei)) : null;
     // You could display minBetMon to the user


    // --- Watch for FlipResult Event ---
    // This event fires after the contract resolves the Flip game
    useWatchContractEvent({
        address: MONAD_ARCADE_CONTRACT_ADDRESS,
        abi: MONAD_ARCADE_CONTRACT_ABI,
        eventName: 'FlipResult',
        onLogs(logs) {
            // Process the latest Flip result event
            if (logs && logs.length > 0) {
                 // Find the result for the transaction we just sent
                 const ourGameLog = logs.find(log => log.transactionHash === hash);

                if (ourGameLog && ourGameLog.args) {
                  const { gameId, player, betAmount: betAmountWei, prediction: predictionSolidity, result: resultSolidity, outcome: gameOutcomeSolidity, payout: payoutWei } = ourGameLog.args;

                   console.log("FlipResult Event Received:", ourGameLog.args);

                   const result = resultSolidity === FlipBetTypeSolidity.Heads ? "heads" : "tails"; // Map Solidity enum
                   const outcome = gameOutcomeSolidity === GameResultSolidity.Win ? "win" : "lose"; // Map Solidity enum
                    const payoutMon = parseFloat(formatEther(payoutWei || 0));
                     const betMon = parseFloat(formatEther(betAmountWei || 0));
                     const predictionString = predictionSolidity === FlipBetTypeSolidity.Heads ? "heads" : "tails";


                   setFlipResult(result);
                   setGameResult(outcome);
                   setLastPayout(payoutMon);

                   // Add to history
                   setGameHistory(prevHistory => [
                     {
                       gameId: gameId as bigint,
                       prediction: predictionString as "heads" | "tails",
                       result: result as "heads" | "tails",
                       bet: betMon,
                       outcome,
                       payout: payoutMon,
                       timestamp: "Just now", // Update with actual time or block number if needed
                     },
                     ...prevHistory.slice(0, 3), // Keep only last 4 games
                   ]);

                   setIsFlipping(false); // Game resolved, stop flipping state
                   // You can trigger the coin flip animation here or based on isConfirming state
                   // For simplicity, the animation is tied to isFlipping state.
                   triggerCoinFlipAnimation(result); // Trigger animation after result is known
                } else {
                   // If no matching log found for our hash, maybe it was an older game or an error
                   console.warn("Received FlipResult but no matching transaction hash found in logs.");
                    setIsFlipping(false); // Stop flipping state if something went wrong or didn't match
                }
            }
        },
        // Optional: filter by player address or gameId
        // args: { player: address },
    });


    // --- Handle Transaction Status Changes ---
    useEffect(() => {
        if (isPending) {
            console.log("Transaction pending...");
            // Update UI state to show transaction is being sent
            setIsFlipping(true); // Indicate flipping state while tx is pending
            setGameResult(null);
            setFlipResult(null);
            setLastPayout(null);
        }
        if (isConfirming) {
             console.log("Transaction confirming (mined)...", hash);
             // Update UI state to show transaction is mined, waiting for events
             // Animation can continue here
        }
        if (isConfirmed) {
            console.log("Transaction confirmed!", hash);
             // Event listener should handle the result
        }
        if (writeError) {
            console.error("Transaction write error:", writeError);
             // Show error message to user
            setIsFlipping(false); // Stop flipping state on error
            setGameResult("lose"); // Assume lose on error for UI simplicity
            setFlipResult(null); // Clear result
            setLastPayout(0); // Payout is 0 on error
             alert(`Error placing bet: ${writeError.message}`); // Simple error display
        }
         if (confirmError) {
            console.error("Transaction confirmation error:", confirmError);
             // Show error message to user
            setIsFlipping(false); // Stop flipping state on error
            setGameResult("lose"); // Assume lose on error for UI simplicity
            setFlipResult(null); // Clear result
            setLastPayout(0); // Payout is 0 on error
             alert(`Error confirming bet: ${confirmError.message}`); // Simple error display
        }
    }, [isPending, isConfirming, isConfirmed, writeError, confirmError, hash]);


    // --- Coin Flip Animation Logic ---
    // Keep the animation logic separate from the blockchain state
    const triggerCoinFlipAnimation = (finalResult: "heads" | "tails") => {
         // Ensure we start from a known rotation state
        setFlipRotation(0); // Reset rotation

        const numberOfFlips = 10; // Number of full 180-degree flips
        const finalRotation = finalResult === "heads" ? 0 : 180; // Final position for heads (0) or tails (180)
        const totalRotation = (numberOfFlips * 180) + finalRotation; // Total degrees to rotate

        let currentRotation = 0;
        const intervalTime = 50; // Milliseconds per step (adjust for animation speed)
        const steps = numberOfFlips * 2 + (finalResult === "heads" ? 0 : 1); // Total 180-degree steps

        const animationInterval = setInterval(() => {
            currentRotation += 180 / (intervalTime / 50); // Increment rotation based on step size and interval

            if (currentRotation >= totalRotation) {
                clearInterval(animationInterval);
                setFlipRotation(totalRotation % 360); // Set the final rotation (0 or 180)
            } else {
                setFlipRotation(currentRotation);
            }
        }, intervalTime);
    };


  const handlePlaceBet = () => {
    if (!isConnected) {
       alert("Please connect your wallet first.");
       return;
    }
     if (isPending || isConfirming || isFlipping || !prediction || Number(betAmount) <= 0) return // Prevent multiple actions


    const betAmountWei = parseEther(betAmount); // Convert MON string to wei (BigInt)

     // Convert string prediction ("heads" or "tails") to Solidity enum value
     const predictionSolidity = prediction === "heads" ? FlipBetTypeSolidity.Heads : FlipBetTypeSolidity.Tails;


     console.log("Placing Flip bet:", {
       address: MONAD_ARCADE_CONTRACT_ADDRESS,
       abi: MONAD_ARCADE_CONTRACT_ABI,
       functionName: 'placeFlipBet',
       args: [predictionSolidity], // Pass the prediction enum
       value: betAmountWei, // Send MON as value
     });

    // Use wagmi's writeContract function
    writeContract({
      address: MONAD_ARCADE_CONTRACT_ADDRESS,
      abi: MONAD_ARCADE_CONTRACT_ABI,
      functionName: 'placeFlipBet',
      args: [predictionSolidity], // Pass the prediction
      value: betAmountWei, // Send the bet amount as value
    });

    // State updates are now primarily driven by events and transaction status
    // setIsFlipping(true); // Set when tx is pending (handled in useEffect)
    // setGameResult(null); // Cleared in useEffect
    // setFlipResult(null); // Cleared in useEffect
     // Animation will be triggered by the FlipResult event handler
  }

  // Determine button disabled state
   const isButtonDisabled = isFlipping || isPending || isConfirming || !prediction || Number(betAmount) <= 0 || !isConnected;


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
              <CardTitle>Prediction Flip</CardTitle>
              <CardDescription>Predict heads or tails and double your tokens (On-chain)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-8 flex flex-col items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-4">
                  {/* Coin */}
                  <div
                    className={cn(
                      "relative h-40 w-40 rounded-full transition-transform duration-150",
                      (isFlipping || isPending || isConfirming) ? "transform" : "", // Animate while pending/confirming/flipping
                    )}
                    style={{ transform: `rotateY(${flipRotation}deg)` }}
                  >
                    {/* Heads side */}
                    <div
                      className={cn(
                        "absolute inset-0 flex items-center justify-center rounded-full border-4 border-amber-500/50 bg-gradient-to-br from-amber-300 to-amber-600 text-white backface-hidden",
                        // Show heads side when rotation is near 0 or 360
                        (flipRotation % 360 > 350 || flipRotation % 360 < 10) ? "" : "invisible",
                         "flex" // Ensure flex is always applied for centering
                      )}
                       style={{ transform: "rotateY(0deg)" }} // Explicitly set for heads side
                    >
                      <Coins className="h-16 w-16" />
                    </div>

                    {/* Tails side */}
                    <div
                      className={cn(
                        "absolute inset-0 flex items-center justify-center rounded-full border-4 border-amber-500/50 bg-gradient-to-br from-amber-600 to-amber-800 text-white backface-hidden",
                        // Show tails side when rotation is near 180
                        (flipRotation % 360 > 170 && flipRotation % 360 < 190) ? "" : "invisible",
                         "flex" // Ensure flex is always applied for centering
                      )}
                      style={{ transform: "rotateY(180deg)" }} // Explicitly set for tails side
                    >
                      <div className="text-4xl font-bold">M</div>
                    </div>
                  </div>

                  {isPending || isConfirming || isFlipping ? ( // Show loading state while tx is pending, confirming, or flipping animation is running
                    <div className="mt-4 flex items-center gap-2 text-lg font-medium">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                       {isPending ? "Confirm in Wallet" : isConfirming ? "Confirming Transaction..." : "Flipping coin on-chain..."}
                    </div>
                  ) : flipResult ? ( // Show result after the coin flip animation is done
                    <div className="mt-4 text-center">
                      <div className="text-2xl font-bold capitalize">Result: {flipResult}!</div>
                      <div
                        className={cn(
                          "mt-1 text-lg font-medium",
                          gameResult === "win" ? "text-green-500" : "text-red-500",
                        )}
                      >
                        {gameResult === "win" ? <>You Win! +{lastPayout} MON</> : <>You Lose! -{gameHistory.length > 0 ? gameHistory[0].bet : parseFloat(betAmount)} MON</>}
                      </div>
                       {(writeError || confirmError) && ( // Display errors if any
                          <div className="mt-2 text-sm text-destructive">{writeError?.message || confirmError?.message}</div>
                       )}
                    </div>
                  ) : (
                    <div className="mt-4 text-lg font-medium text-muted-foreground">
                      Choose heads or tails and place your bet
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
                      // min={minBetMon || "0.05"} // Use minBetMon if fetched
                       min="0.00000000000000001" // Small min fallback
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
                       disabled={isButtonDisabled || parseFloat(betAmount) <= 0}
                    >
                      2x
                    </Button>
                  </div>
                   {minBetMon !== null && minBetMon > 0 && (
                      <p className="mt-1 text-sm text-muted-foreground">Min bet: {minBetMon} MON</p>
                   )}
                </div>

                <div>
                  <Label>Potential Payout</Label>
                  <div className="mt-1.5 rounded-md border border-muted bg-muted/40 p-2.5 text-lg font-medium">
                    {(parseFloat(betAmount) || 0) * 2} MON (2x)
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <Button
                  size="lg"
                  variant={prediction === "heads" ? "default" : "outline"}
                  className={cn("h-20 gap-3", prediction === "heads" && "border-2 border-primary")}
                  onClick={() => setPrediction("heads")}
                   disabled={isButtonDisabled}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                    <Coins className="h-6 w-6 text-amber-500" />
                  </div>
                  <span className="text-lg">Heads</span>
                </Button>

                <Button
                  size="lg"
                  variant={prediction === "tails" ? "default" : "outline"}
                  className={cn("h-20 gap-3", prediction === "tails" && "border-2 border-primary")}
                  onClick={() => setPrediction("tails")}
                   disabled={isButtonDisabled}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-700/20">
                    <div className="text-2xl font-bold text-amber-700">M</div>
                  </div>
                  <span className="text-lg">Tails</span>
                </Button>
              </div>

              <Button
                className="mt-6 w-full"
                size="lg"
                 disabled={isButtonDisabled || parseFloat(betAmount) < (minBetMon || 0.00000000000000001)} // Disable if bet less than min
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
                ) : isFlipping ? ( // Show flipping state while waiting for events after confirmation
                   <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Flipping On-Chain...
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
                <CardTitle>Game History (Last 4)</CardTitle>
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
                        <div className="flex items-center gap-2 font-medium capitalize">
                          <span>Bet: {game.prediction}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>Result: {game.result}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {game.bet} MON {/* Timestamp is placeholder now */}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "text-right font-medium",
                          game.outcome === "win" ? "text-green-500" : "text-red-500",
                        )}
                      >
                        {game.outcome === "win" ? <>+{game.payout} MON</> : <>-{game.bet} MON</>}
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