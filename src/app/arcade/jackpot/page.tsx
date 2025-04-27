// arcade/jackpot/page.tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Clock, History, Loader2, Trophy, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { config } from "@/lib/wagmi"

// Import wagmi hooks
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent } from 'wagmi';
import { parseEther, formatEther } from 'viem'; // For converting between MON and wei

// Import contract constants
import { MONAD_ARCADE_CONTRACT_ADDRESS, MONAD_ARCADE_CONTRACT_ABI } from "@/lib/contracts";


// Define types for local state derived from contract data/events
type JackpotEntry = {
  address: string;
  amount: number; // in MON
  timestamp: string; // Placeholder for display (ideally block timestamp or fetched)
  chance: number; // Calculated chance
  roundId: bigint;
  entryIndex?: number; // Optional: index in contract's entries array
}

type WinnerEntry = {
  address: string;
  amount: number; // in MON (prize amount)
  timestamp: string; // Placeholder for display (ideally block timestamp or fetched)
  roundId: bigint;
}


export default function MonadJackpot() {
  const { address, isConnected } = useAccount(); // Get connected account details
  const { data: accountBalance } = useBalance({ address }); // Fetch user's balance

  const [entryAmount, setEntryAmount] = useState("0.1") // Use MON for input
  const [isEntering, setIsEntering] = useState(false) // State for frontend button loading

  // State for fetched contract data (will update via useReadContract)
  const [jackpotPool, setJackpotPool] = useState(0); // Total pool in MON
  const [nextDrawTime, setNextDrawTime] = useState<bigint | null>(null); // Next draw time as timestamp
  const [currentRoundId, setCurrentRoundId] = useState<bigint | null>(null); // Current jackpot round ID

  // State for local lists derived from events/reads
  // Note: Fetching large arrays from contract view functions is inefficient.
  // These local states will be populated primarily by listening to events.
  const [recentEntries, setRecentEntries] = useState<JackpotEntry[]>([]); // Entries for the current round from events
  const [previousWinners, setPreviousWinners] = useState<WinnerEntry[]>([]); // Recent winners from events
  const [userEntriesInRound, setUserEntriesInRound] = useState<JackpotEntry[]>([]); // User's entries in the current round from events
  const [userTotalAmountInRound, setUserTotalAmountInRound] = useState(0); // User's total amount in current round (in MON)
  const [userWinChanceInRound, setUserWinChanceInRound] = useState(0); // User's win chance in current round

  // State for countdown timer
  const [timeRemaining, setTimeRemaining] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // State to track ongoing transaction for entering jackpot
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();

  // State to wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } =
    useWaitForTransactionReceipt({
      hash,
    });

    // --- Read Contract Data ---
    // Fetch current jackpot pool size
    const { data: poolWei, refetch: refetchPool } = useReadContract({
      address: MONAD_ARCADE_CONTRACT_ADDRESS,
      abi: MONAD_ARCADE_CONTRACT_ABI,
      functionName: 'currentJackpotPool',
      chainId: config.chains[0].id, // Specify chain ID (assuming Monad is the first chain in your wagmi config)
      query: {
        refetchInterval: 5000, // Poll every 5 seconds to update pool size
      },
    });

     // Fetch next jackpot draw time
    const { data: nextDrawTimestamp, refetch: refetchDrawTime } = useReadContract({
      address: MONAD_ARCADE_CONTRACT_ADDRESS,
      abi: MONAD_ARCADE_CONTRACT_ABI,
      functionName: 'nextJackpotDrawTime',
       chainId: config.chains[0].id,
      query: {
        refetchInterval: 10000, // Poll less frequently for time, countdown is local
      },
    });

     // Fetch current jackpot round ID
    const { data: roundId, refetch: refetchRoundId } = useReadContract({
      address: MONAD_ARCADE_CONTRACT_ADDRESS,
      abi: MONAD_ARCADE_CONTRACT_ABI,
      functionName: 'currentJackpotRoundId',
       chainId: config.chains[0].id,
       query: {
        refetchInterval: 15000, // Poll for round ID changes
      },
    });

     // Fetch user's total entry amount for the current round
     const { data: userTotalEntryWei, refetch: refetchUserTotalEntry } = useReadContract({
       address: MONAD_ARCADE_CONTRACT_ADDRESS,
       abi: MONAD_ARCADE_CONTRACT_ABI,
       functionName: 'jackpotPlayerTotalEntries',
        chainId: config.chains[0].id,
       args: [currentRoundId || 0n, address || "0x0000000000000000000000000000000000000000"], // Pass roundId and user address
       account: address, // Associate with the connected account
       enabled: isConnected && currentRoundId !== null && !!address, // Only fetch if connected and roundId/address are available
        query: {
          refetchInterval: 5000, // Poll every 5 seconds
        },
     });


    // --- Update State from Contract Reads ---
    useEffect(() => {
      if (poolWei !== undefined) {
        setJackpotPool(parseFloat(formatEther(poolWei)));
      }
      if (nextDrawTimestamp !== undefined) {
        setNextDrawTime(nextDrawTimestamp);
      }
       if (roundId !== undefined) {
         // If round ID changes, it means a new round started.
         // Clear local entries/winners lists for the new round.
         if (currentRoundId !== null && roundId !== currentRoundId) {
             setRecentEntries([]);
             setUserEntriesInRound([]);
              // Previous winners are handled by event listener, no need to clear that list
         }
         setCurrentRoundId(roundId);
       }
       // Update user's total entry and win chance based on fetched data
       if (userTotalEntryWei !== undefined && currentRoundId !== null) {
         const totalMon = parseFloat(formatEther(userTotalEntryWei));
         setUserTotalAmountInRound(totalMon);

         // Recalculate user win chance when total amount or pool changes
          if (jackpotPool > 0) {
             setUserWinChanceInRound(parseFloat(((totalMon / jackpotPool) * 100).toFixed(2)));
          } else {
             setUserWinChanceInRound(0); // Chance is 0 if pool is empty
          }
       } else {
          // Reset user stats if not connected, roundId changes, or userTotalEntryWei is undefined
          setUserTotalAmountInRound(0);
          setUserWinChanceInRound(0);
       }

    }, [poolWei, nextDrawTimestamp, roundId, userTotalEntryWei, jackpotPool, isConnected, currentRoundId]);


    // --- Countdown Timer Effect ---
    useEffect(() => {
        if (nextDrawTime === null || nextDrawTime === 0n) {
             setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
             return; // Stop timer if nextDrawTime is not set
        }

        const timerInterval = setInterval(() => {
            const now = BigInt(Math.floor(Date.now() / 1000)); // Current time in seconds as BigInt
            if (nextDrawTime > now) {
                const timeDiff = nextDrawTime - now;
                const hours = Number(timeDiff / 3600n);
                const minutes = Number((timeDiff % 3600n) / 60n);
                const seconds = Number(timeDiff % 60n);
                setTimeRemaining({ hours, minutes, seconds });
            } else {
                // Timer has reached zero or passed
                setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
                 // Trigger refetch of relevant data when timer hits zero
                 refetchPool();
                 refetchDrawTime();
                 refetchRoundId();
                 refetchUserTotalEntry();
            }
        }, 1000); // Update every second

        return () => clearInterval(timerInterval); // Clean up interval
    }, [nextDrawTime, refetchPool, refetchDrawTime, refetchRoundId, refetchUserTotalEntry]);


    // --- Watch for Contract Events ---
    // Watch for new entries
    useWatchContractEvent({
        address: MONAD_ARCADE_CONTRACT_ADDRESS,
        abi: MONAD_ARCADE_CONTRACT_ABI,
        eventName: 'JackpotEntered',
        onLogs(logs) {
            if (logs && logs.length > 0) {
                logs.forEach(log => {
                    const { roundId: eventRoundId, entryIndex, player, amount: amountWei, totalPool: totalPoolWei } = log.args;
                     // Only add entries for the current round displayed by the UI
                     if (currentRoundId !== null && eventRoundId === currentRoundId) {
                         const amountMon = parseFloat(formatEther(amountWei || 0));
                         const totalPoolMon = parseFloat(formatEther(totalPoolWei || 0));
                         const chance = totalPoolMon > 0 ? parseFloat(((amountMon / totalPoolMon) * 100).toFixed(2)) : 0;

                         const newEntry: JackpotEntry = {
                            address: player ? `${player.slice(0, 6)}...${player.slice(-4)}` : "Unknown", // Shorten address
                            amount: amountMon,
                            timestamp: "Just now", // Placeholder (get block timestamp if needed)
                            chance: chance,
                            roundId: eventRoundId as bigint,
                            entryIndex: entryIndex ? Number(entryIndex) : undefined,
                         };

                         // Add to recent entries list
                         setRecentEntries(prevEntries => {
                             // Prevent duplicates if event is received multiple times
                             if (prevEntries.some(e => e.roundId === newEntry.roundId && e.entryIndex === newEntry.entryIndex && e.address === newEntry.address && e.amount === newEntry.amount)) {
                                 return prevEntries;
                             }
                             return [newEntry, ...prevEntries].slice(0, 10); // Keep recent entries limited
                         });


                         // If the entry is from the current user, update userEntriesInRound
                         if (player === address) {
                            setUserEntriesInRound(prevUserEntries => {
                                // Prevent duplicates
                                 if (prevUserEntries.some(e => e.roundId === newEntry.roundId && e.entryIndex === newEntry.entryIndex && e.address === newEntry.address && e.amount === newEntry.amount)) {
                                    return prevUserEntries;
                                }
                                return [newEntry, ...prevUserEntries];
                            });
                            // UserTotalAmountInRound and UserWinChanceInRound will be updated by refetchUserTotalEntry triggered after tx confirmation
                         }
                     }
                });
            }
        },
         // Only listen if we know the current round ID
         enabled: currentRoundId !== null,
    });

     // Watch for jackpot draws
    useWatchContractEvent({
        address: MONAD_ARCADE_CONTRACT_ADDRESS,
        abi: MONAD_ARCADE_CONTRACT_ABI,
        eventName: 'JackpotDrawn',
        onLogs(logs) {
            if (logs && logs.length > 0) {
                logs.forEach(log => {
                    const { roundId: eventRoundId, winner, prizeAmount: prizeAmountWei } = log.args;
                     const prizeAmountMon = parseFloat(formatEther(prizeAmountWei || 0));

                    const newWinner: WinnerEntry = {
                        address: winner ? `${winner.slice(0, 6)}...${winner.slice(-4)}` : "Unknown", // Shorten address
                        amount: prizeAmountMon,
                        timestamp: "Just now", // Placeholder
                        roundId: eventRoundId as bigint,
                    };

                    // Add to previous winners list
                    setPreviousWinners(prevWinners => {
                         // Prevent duplicates
                         if (prevWinners.some(w => w.roundId === newWinner.roundId && w.address === newWinner.address)) {
                              return prevWinners;
                         }
                         return [newWinner, ...prevWinners].slice(0, 5); // Keep recent winners limited
                    });


                    // Check if the current user won
                    if (winner === address) {
                        alert(`Congratulations! You won ${prizeAmountMon.toLocaleString()} MON in round ${eventRoundId}!`); // Notify user
                    }

                    // A draw happened, clear current entries and trigger refetch for new round state
                    setRecentEntries([]);
                     setUserEntriesInRound([]);
                    // Refetches for the new round state will be triggered by the timer hitting zero
                    // or you could trigger them explicitly here.
                     // refetchRoundId();
                     // refetchPool();
                     // refetchDrawTime();
                });
            }
        },
    });

     // Watch for new round start
    useWatchContractEvent({
        address: MONAD_ARCADE_CONTRACT_ADDRESS,
        abi: MONAD_ARCADE_CONTRACT_ABI,
        eventName: 'NewJackpotRound',
        onLogs(logs) {
             // When a new round starts, the draw has finished.
             // This event confirms the start of a new round and provides new round details.
             // The JackpotDrawn event listener and timer hitting zero also handle state updates.
             // This listener provides an additional trigger and access to new round data directly from the event.
             if (logs && logs.length > 0) {
                 const { roundId: newRoundId, startTime: newStartTime, drawTime: newDrawTime } = logs[0].args;
                 console.log(`New Jackpot Round Started: Round ${newRoundId}, Draw Time: ${newDrawTime}`);
                 // Update local state based on event data
                 setCurrentRoundId(newRoundId as bigint);
                 setNextDrawTime(newDrawTime as bigint);
                 setJackpotPool(0); // New pool starts at 0
                 setRecentEntries([]); // New round, clear entries
                 setUserEntriesInRound([]); // New round, clear user entries
                 setUserTotalAmountInRound(0); // Reset user totals
                 setUserWinChanceInRound(0); // Reset user chance

                 // No need to refetch if we set state directly from event args
                 // refetchPool();
                 // refetchDrawTime();
                 // refetchRoundId();
                 // refetchUserTotalEntry();
             }
        },
    });


    // --- Handle Transaction Status Changes ---
    useEffect(() => {
        if (isPending) {
            console.log("Jackpot entry transaction pending...");
            setIsEntering(true); // Indicate processing state
             // Clear previous results/statuses if needed
        }
        if (isConfirming) {
             console.log("Jackpot entry transaction confirming...", hash);
             // Update UI state
        }
        if (isConfirmed) {
            console.log("Jackpot entry transaction confirmed!", hash);
             // Transaction sent and confirmed.
             setIsEntering(false);
             // The entry will appear in the Recent Entries list and update user stats
             // when the JackpotEntered event is received and processed by useWatchContractEvent.
             refetchUserTotalEntry(); // Explicitly refetch user's total entry after confirmation
             refetchPool(); // Refetch pool to see total updated by your entry
        }
        if (writeError) {
            console.error("Jackpot entry transaction write error:", writeError);
             setIsEntering(false); // Stop processing state on error
             alert(`Error entering jackpot: ${writeError.message}`); // Simple error display
        }
         if (confirmError) {
            console.error("Jackpot entry transaction confirmation error:", confirmError);
             setIsEntering(false); // Stop processing state on error
             alert(`Error confirming jackpot entry: ${confirmError.message}`); // Simple error display
        }
    }, [isPending, isConfirming, isConfirmed, writeError, confirmError, hash, refetchUserTotalEntry, refetchPool]);


  const handleEnterJackpot = () => {
    if (!isConnected) {
       alert("Please connect your wallet first.");
       return;
    }
     if (isPending || isConfirming || isEntering || Number(entryAmount) <= 0 || !accountBalance) return // Prevent multiple actions or if balance is zero/not loaded

    const entryAmountFloat = parseFloat(entryAmount);
    if (isNaN(entryAmountFloat) || entryAmountFloat <= 0) {
        alert("Please enter a valid entry amount.");
        return;
    }

    const entryAmountWei = parseEther(entryAmount); // Convert MON string to wei (BigInt)

     // Optional: Check if entry amount is less than min bet (if you fetch MIN_BET)
     // const minBetMon = minBetWei ? parseFloat(formatEther(minBetWei)) : 0;
     // if (minBetMon > 0 && entryAmountFloat < minBetMon) {
     //    alert(`Entry amount must be at least ${minBetMon} MON.`);
     //    return;
     // }

     // Check if user has enough balance
      if (accountBalance.value < entryAmountWei) {
         alert("Insufficient balance.");
         return;
      }

     // Check if draw time has passed
      if (nextDrawTime !== null && nextDrawTime <= BigInt(Math.floor(Date.now() / 1000))) {
          alert("The current jackpot round has ended. Please wait for the next round.");
          // Trigger refetch to get new round details
          refetchPool();
          refetchDrawTime();
          refetchRoundId();
          refetchUserTotalEntry(); // Refetch user entry for the new round
          return;
      }


     console.log("Entering Jackpot:", {
       address: MONAD_ARCADE_CONTRACT_ADDRESS,
       abi: MONAD_ARCADE_CONTRACT_ABI,
       functionName: 'enterJackpot',
       args: [], // enterJackpot function takes no args, only value
       value: entryAmountWei, // Send MON as value
     });

    // Use wagmi's writeContract function
    writeContract({
      address: MONAD_ARCADE_CONTRACT_ADDRESS,
      abi: MONAD_ARCADE_CONTRACT_ABI,
      functionName: 'enterJackpot',
      // args: [], // No args for enterJackpot
      value: entryAmountWei, // Send the entry amount as value
    });

    // State updates are now primarily driven by events and transaction status
    // setIsEntering(true); // Set when tx is pending (handled in useEffect)
  }

  // Determine button disabled state
   const isButtonDisabled = isPending || isConfirming || isEntering || parseFloat(entryAmount) <= 0 || !isConnected || (accountBalance && parseEther(entryAmount || '0') > accountBalance.value) || nextDrawTime === null || nextDrawTime <= BigInt(Math.floor(Date.now() / 1000));


    // Format time remaining
    const formattedTime = `${String(timeRemaining.hours).padStart(2, "0")}:${String(timeRemaining.minutes).padStart(2, "0")}:${String(timeRemaining.seconds).padStart(2, "0")}`;

    // Calculate potential win chance for the input amount (based on current pool fetched from contract)
    const potentialWinChance = (jackpotPool > 0 || parseFloat(entryAmount) > 0)
        ? parseFloat(((parseFloat(entryAmount) || 0) / (jackpotPool + (parseFloat(entryAmount) || 0))) * 100).toFixed(2)
        : "0.00";


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
              <CardTitle>Monad Jackpot</CardTitle>
              <CardDescription>Enter the pool for a chance to win the jackpot (On-chain)</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Jackpot Display */}
              <div className="mb-8 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-6 text-center">
                <div className="mb-2 text-sm font-medium text-green-600 dark:text-green-400">Current Jackpot Pool (Round {currentRoundId !== null ? Number(currentRoundId) : '-'})</div>
                <div className="mb-4 text-4xl font-bold tracking-tight text-green-700 dark:text-green-300">
                  {jackpotPool.toLocaleString()} MON
                </div>

                <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <Clock className="h-4 w-4" />
                  Next Draw In
                </div>
                <div className="flex items-center justify-center gap-3 text-xl font-bold text-green-700 dark:text-green-300">
                   {formattedTime} {/* Display formatted countdown */}
                </div>
              </div>

              {/* User Stats */}
              {(userTotalAmountInRound > 0 || isConnected) && ( // Show user stats area if connected or has entries
                <div className="mb-6 rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-medium">Your Total Entry (Round {currentRoundId !== null ? Number(currentRoundId) : '-'})</div>
                    <div className="font-medium">{userTotalAmountInRound.toLocaleString()} MON</div>
                  </div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <div className="text-muted-foreground">Your Win Chance</div>
                    <div>{userWinChanceInRound.toFixed(2)}%</div> {/* Display user's calculated chance */}
                  </div>
                   {userWinChanceInRound > 0 && ( // Only show progress if chance > 0
                      <Progress value={userWinChanceInRound} className="h-2" />
                   )}
                </div>
              )}


              {/* Entry Form */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <Label htmlFor="entry-amount">Entry Amount (MON)</Label>
                  <div className="mt-1.5 flex">
                    <Input
                      id="entry-amount"
                      type="number"
                      min={0.000000000000000001} // Small min for wei conversion
                      value={entryAmount}
                      onChange={(e) => setEntryAmount(e.target.value)}
                      className="rounded-r-none"
                      disabled={isButtonDisabled}
                    />
                    <Button
                      variant="outline"
                      className="rounded-l-none border-l-0"
                       onClick={() => {
                         const currentAmount = parseFloat(entryAmount) || 0;
                         if (currentAmount > 0) setEntryAmount((currentAmount * 2).toString());
                       }}
                      disabled={isButtonDisabled || parseFloat(entryAmount || '0') <= 0}
                    >
                      2x
                    </Button>
                  </div>
                   {/* Optional: Display MIN_BET if fetched */}
                     {/* {minBetMon !== null && minBetMon > 0 && (
                       <p className="mt-1 text-sm text-muted-foreground">Min entry: {minBetMon} MON</p>
                    )} */}
                     {accountBalance && ( // Display user's current wallet balance
                       <p className="mt-1 text-sm text-muted-foreground">Wallet Balance: {parseFloat(formatEther(accountBalance.value)).toFixed(4)} MON</p>
                    )}
                </div>

                <div>
                  <Label>Potential Win Chance (This Entry)</Label>
                  <div className="mt-1.5 rounded-md border border-muted bg-muted/40 p-2.5 text-lg font-medium">
                    {potentialWinChance}%
                  </div>
                </div>
              </div>

              <Button
                className="mt-6 w-full"
                size="lg"
                 disabled={isButtonDisabled || parseFloat(entryAmount || '0') <= 0 || (accountBalance && parseEther(entryAmount || '0') > accountBalance.value) || nextDrawTime === null || nextDrawTime <= BigInt(Math.floor(Date.now() / 1000)) } // Disable if draw time passed
                onClick={handleEnterJackpot}
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
                ) : isEntering ? ( // Use isEntering for general processing state if needed
                   <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Processing Entry...
                   </>
                ) : (
                  "Enter Jackpot"
                )}
                {!isConnected && (
                    <span className="ml-2 text-sm">(Connect Wallet)</span>
                 )}
                  {nextDrawTime !== null && nextDrawTime <= BigInt(Math.floor(Date.now() / 1000)) && (
                     <span className="ml-2 text-sm">(Draw in Progress or Ended)</span>
                  )}
              </Button>

              {(writeError || confirmError) && ( // Display errors if any
                  <div className="mt-2 text-sm text-destructive text-center">{writeError?.message || confirmError?.message}</div>
               )}


            </CardContent>
          </Card>

          {/* Recent Entries */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>Recent Entries (Current Round)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentEntries.length === 0 ? (
                    <p className="text-muted-foreground text-center">No entries yet for this round.</p>
                 ) : (
                   recentEntries.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium">{entry.address}</div>
                        <div className="text-sm text-muted-foreground">{entry.timestamp}</div> {/* Timestamp is placeholder */}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{entry.amount.toLocaleString()} MON</div>
                        <div className="text-sm text-green-500">{entry.chance.toFixed(2)}% chance</div>
                      </div>
                    </div>
                  ))
                 )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          {/* Previous Winners */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                <CardTitle>Previous Winners (Recent)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                 {previousWinners.length === 0 ? (
                    <p className="text-muted-foreground text-center">No recent winners.</p>
                 ) : (
                   previousWinners.map((winner, index) => (
                    <div key={index} className="rounded-lg border p-4">
                      <div className="mb-1 flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <div className="font-medium">{winner.address}</div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-muted-foreground">{winner.timestamp}</div> {/* Timestamp is placeholder */}
                        <div className="font-medium text-green-500">+{winner.amount.toLocaleString()} MON</div>
                      </div>
                    </div>
                  ))
                 )}
              </div>
            </CardContent>
          </Card>

          {/* Your History (Current Round) */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <CardTitle>Your Entries (Current Round)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {userEntriesInRound.length > 0 ? (
                <div className="space-y-3">
                  {userEntriesInRound.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="text-sm text-muted-foreground">{entry.timestamp}</div> {/* Timestamp is placeholder */}
                      <div className="font-medium">{entry.amount.toLocaleString()} MON</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <div className="mb-2">No entries yet in this round</div>
                  <div className="text-sm">Enter the jackpot to see your entries</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}