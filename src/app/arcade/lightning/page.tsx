// arcade/lightning/page.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, History, Loader2, Trophy, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { config } from "@/lib/wagmi"
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { MONAD_ARCADE_CONTRACT_ADDRESS, MONAD_ARCADE_CONTRACT_ABI } from "@/lib/contracts";

const getRacerDetailsById = (id: number) => {
  const allRacers = [
    { id: 1, name: "Blue Bolt", color: "bg-blue-500", odds: 2.5 },
    { id: 2, name: "Red Flash", color: "bg-red-500", odds: 3.0 },
    { id: 3, name: "Green Spark", color: "bg-green-500", odds: 2.0 },
    { id: 4, name: "Purple Surge", color: "bg-purple-500", odds: 4.0 },
    { id: 5, name: "Yellow Strike", color: "bg-yellow-500", odds: 3.5 },
  ];
  return allRacers.find(r => r.id === id);
};

type RaceHistoryEntry = {
  gameId: bigint;
  racerId: number;
  racerName: string;
  bet: number;
  winnerId: number;
  winnerName: string;
  outcome: "win" | "lose";
  payout: number;
  timestamp: string;
}

export default function LightningRace() {
  const { address, isConnected } = useAccount();
  const { data: accountBalance, refetch: refetchBalance } = useBalance({ address });
  const [betAmount, setBetAmount] = useState("0.05")
  const [selectedRacer, setSelectedRacer] = useState<number | null>(null)
  const [isRacing, setIsRacing] = useState(false)
  const [raceStarted, setRaceStarted] = useState(false)
  const [raceFinished, setRaceFinished] = useState(false)
  const [winnerRacerId, setWinnerRacerId] = useState<number | null>(null)
  const [gameResult, setGameResult] = useState<"win" | "lose" | null>(null)
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [racersPositions, setRacersPositions] = useState([0, 0, 0, 0, 0]);
  const [raceHistory, setRaceHistory] = useState<RaceHistoryEntry[]>([]);
  const raceTrackRef = useRef<HTMLDivElement>(null)
  const raceIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } =
    useWaitForTransactionReceipt({
      hash,
    });

  const { data: oddsDataWei, refetch: refetchOdds } = useReadContract({
    address: MONAD_ARCADE_CONTRACT_ADDRESS,
    abi: MONAD_ARCADE_CONTRACT_ABI,
    functionName: 'lightningRaceOdds',
    chainId: config.chains[0].id,
    args: [selectedRacer || 0],
    enabled: selectedRacer !== null,
    // query: { // NOTE: Removed 'query' as it might not be standard in useReadContract
    //   refetchInterval: 60000,
    // },
  });

  // Assuming odds are returned as uint scaled by 100 (e.g., 250 for 2.5x)
  // Adjust divisor if contract returns odds differently (e.g., scaled by 10^18 like currency)
  const selectedRacerOdds = oddsDataWei !== undefined ? Number(oddsDataWei) / 100 : null;

  useWatchContractEvent({
    address: MONAD_ARCADE_CONTRACT_ADDRESS,
    abi: MONAD_ARCADE_CONTRACT_ABI,
    eventName: 'LightningRaceBetPlaced',
    onLogs(logs) {
      if (logs && logs.length > 0) {
        logs.forEach(log => {
          console.log("LightningRaceBetPlaced Event Received:", log.args);
        });
      }
    },
    chainId: config.chains[0].id,
  });

  useWatchContractEvent({
    address: MONAD_ARCADE_CONTRACT_ADDRESS,
    abi: MONAD_ARCADE_CONTRACT_ABI,
    eventName: 'LightningRaceResolved',
    onLogs(logs) {
      if (logs && logs.length > 0) {
        console.log("LightningRaceResolved Logs:", logs);
        const ourRaceLog = hash ? logs.find(log => log.transactionHash === hash) : undefined;

        if (ourRaceLog && ourRaceLog.args) {
          const gameId = ourRaceLog.args.gameId as bigint | undefined;
          const eventWinnerRacerId = ourRaceLog.args.winnerRacerId as number | undefined;
          const eventWinnerAddress = ourRaceLog.args.winnerAddress as `0x${string}` | undefined;
          const payoutWei = ourRaceLog.args.payout as bigint | undefined;
          console.log("LightningRaceResolved Event (Matching Tx Hash) Received:", ourRaceLog.args);

          if (gameId === undefined || eventWinnerRacerId === undefined || eventWinnerAddress === undefined || payoutWei === undefined) {
            console.error("Received incomplete LightningRaceResolved event args for our transaction.");
            setRaceFinished(true);
            setIsRacing(false);
            setGameResult("lose");
            setLastPayout(0);
            setWinnerRacerId(null);
            alert("Received incomplete race result from contract.");
            return;
          }

          const payoutMon = parseFloat(formatEther(payoutWei));
          const winnerDetails = getRacerDetailsById(Number(eventWinnerRacerId));

          setWinnerRacerId(Number(eventWinnerRacerId));
          setLastPayout(payoutMon);
          const outcome = (eventWinnerAddress === address) ? "win" : "lose";
          setGameResult(outcome);
          const selectedRacerDetails = getRacerDetailsById(selectedRacer || 0);

          setRaceHistory(prevHistory => {
            const newEntry: RaceHistoryEntry = {
              gameId: gameId as bigint,
              racerId: selectedRacer || 0,
              racerName: selectedRacerDetails?.name || "Unknown",
              bet: parseFloat(betAmount),
              winnerId: Number(eventWinnerRacerId),
              winnerName: winnerDetails?.name || "Unknown",
              outcome: outcome,
              payout: payoutMon,
              timestamp: new Date().toLocaleTimeString(),
            };
            if (prevHistory.some(entry => entry.gameId === newEntry.gameId)) {
              return prevHistory;
            }
            return [newEntry, ...prevHistory].slice(0, 3);
          });

          setRaceFinished(true);
          setIsRacing(false);

          if (refetchBalance) {
            refetchBalance();
          } else {
            console.warn("refetchBalance function not available from useBalance hook.");
          }

          triggerRaceAnimation(Number(eventWinnerRacerId));

          // Keep selection and bet amount visible after race result
          // setSelectedRacer(null);
          // setBetAmount("0.05");
        } else {
          console.log("Received LightningRaceResolved event for a different transaction.");
        }
      }
    },
    chainId: config.chains[0].id,
  });

  useEffect(() => {
    let alertShown = false;
    if (isPending) {
      console.log("Lightning race bet transaction pending...");
      setIsRacing(true);
      setRaceStarted(false);
      setRaceFinished(false);
      setWinnerRacerId(null);
      setGameResult(null);
      setLastPayout(null);
      setRacersPositions([0, 0, 0, 0, 0]);
    } else if (isConfirming) {
      console.log("Lightning race bet transaction confirming...", hash);
      setRaceStarted(true);
    } else if (isConfirmed) {
      console.log("Lightning race bet transaction confirmed!", hash);
    }

    if (writeError && !alertShown) {
      console.error("Lightning race bet transaction write error:", writeError);
      setIsRacing(false);
      setRaceStarted(false);
      setRaceFinished(true);
      setGameResult("lose");
      setLastPayout(0);
      setWinnerRacerId(null);
      alert(`Error placing bet: ${writeError.message}`);
      alertShown = true;
    }
    if (confirmError && !alertShown) {
      console.error("Lightning race bet transaction confirmation error:", confirmError);
      setIsRacing(false);
      setRaceStarted(false);
      setRaceFinished(true);
      setGameResult("lose");
      setLastPayout(0);
      setWinnerRacerId(null);
      alert(`Error confirming bet: ${confirmError.message}`);
      alertShown = true;
    }
    if (!isPending && !isConfirming && !hash && !raceFinished && !writeError && !confirmError) {
        setIsRacing(false);
    }
  }, [isPending, isConfirming, isConfirmed, writeError, confirmError, hash, address]);

  const triggerRaceAnimation = (finalWinnerId: number) => {
    if (!raceTrackRef.current) {
        console.warn("Race track ref not available for animation.");
        return;
    }
    const trackWidth = raceTrackRef.current.clientWidth;
    if (trackWidth <= 0) {
        console.warn("Race track width is zero, cannot start animation.");
        return;
    }

    const finishLine = trackWidth - 40;

    if (raceIntervalRef.current) {
      clearInterval(raceIntervalRef.current);
      raceIntervalRef.current = null;
    }

    setRacersPositions([0, 0, 0, 0, 0]);

    setTimeout(() => {
        raceIntervalRef.current = setInterval(() => {
            setRacersPositions(prevPositions => {
              const currentPositions = prevPositions.length === 5 ? [...prevPositions] : [0, 0, 0, 0, 0];
              let raceInProgress = false;

              for (let i = 0; i < currentPositions.length; i++) {
                const racerId = i + 1;
                let currentPosition = currentPositions[i];

                if (currentPosition < finishLine) {
                  raceInProgress = true;
                  const baseSpeed = Math.random() * (trackWidth / 100);
                  const distanceToEnd = finishLine - currentPosition;
                  const winningSpeedBonus = (racerId === finalWinnerId && distanceToEnd < trackWidth / 2)
                      ? (distanceToEnd / (trackWidth / 10))
                      : Math.random() * (trackWidth / 200);
                  const speed = baseSpeed + winningSpeedBonus;
                  currentPosition = Math.min(currentPosition + speed, finishLine);
                  currentPositions[i] = currentPosition;
                }
              }

              if (!raceInProgress) {
                if (raceIntervalRef.current) {
                  clearInterval(raceIntervalRef.current);
                  raceIntervalRef.current = null;
                  console.log("Race animation finished.");
                }
              }
              return currentPositions;
            });
        }, 50);
    }, 10);
  };

  useEffect(() => {
    return () => {
      if (raceIntervalRef.current) {
        clearInterval(raceIntervalRef.current);
      }
    }
  }, [])

  const handlePlaceBet = () => {
    if (!isConnected) {
      alert("Please connect your wallet first.");
      return;
    }
    if (!selectedRacer) {
      alert("Please select a racer first.");
      return;
    }
    const betAmountFloat = parseFloat(betAmount);
    if (isNaN(betAmountFloat) || betAmountFloat <= 0) {
      alert("Please enter a valid positive bet amount.");
      return;
    }
    if (!accountBalance) {
      alert("Could not read account balance. Please try again.");
      return;
    }
    const betAmountWei = parseEther(betAmount);
    if (accountBalance.value < betAmountWei) {
      alert("Insufficient balance.");
      return;
    }
    if (isPending || isConfirming || isRacing) {
      console.warn("Race/Transaction already in progress.");
      return;
    }

    setRaceFinished(false);
    setWinnerRacerId(null);
    setGameResult(null);
    setLastPayout(null);
    setRacersPositions([0, 0, 0, 0, 0]);

    console.log("Placing Lightning Race bet:", {
      address: MONAD_ARCADE_CONTRACT_ADDRESS,
      abi: MONAD_ARCADE_CONTRACT_ABI,
      functionName: 'placeLightningRaceBet',
      args: [selectedRacer],
      value: betAmountWei,
    });

    writeContract({
      address: MONAD_ARCADE_CONTRACT_ADDRESS,
      abi: MONAD_ARCADE_CONTRACT_ABI,
      functionName: 'placeLightningRaceBet',
      args: [selectedRacer],
      value: betAmountWei,
    });
  }

  const racers = [1, 2, 3, 4, 5].map(id => getRacerDetailsById(id)).filter((r): r is Exclude<typeof r, undefined> => r !== undefined);

  const selectRacer = (id: number) => {
    if (!isPending && !isConfirming && !isRacing) {
        setSelectedRacer(id);
        if (refetchOdds) refetchOdds();
    }
  };

  const isBetInputDisabled = isPending || isConfirming || isRacing;
  const canPlaceBet = isConnected && selectedRacer !== null && parseFloat(betAmount || '0') > 0 && accountBalance !== undefined && accountBalance.value >= parseEther(betAmount || '0');
  const isPlaceBetButtonDisabled = isBetInputDisabled || !canPlaceBet;
  const selectedRacerDetails = getRacerDetailsById(selectedRacer || 0);
  const potentialPayout = selectedRacerDetails
    ? parseFloat(betAmount || '0') * (selectedRacerOdds !== null ? selectedRacerOdds : selectedRacerDetails.odds)
    : 0;
  const potentialMultiplier = selectedRacerDetails
    ? (selectedRacerOdds !== null ? selectedRacerOdds : selectedRacerDetails.odds)
    : 0;

  return (
    <div className="container py-8 mx-auto px-4">
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
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
                 <Zap className="h-7 w-7 text-yellow-400" /> Lightning Race
              </CardTitle>
              <CardDescription>Bet on the fastest lightning bolt to win big (On-chain Bet)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 p-4 sm:p-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground px-4">
                    <span>Start</span>
                    <span>Finish</span>
                </div>
                <div
                  ref={raceTrackRef}
                  className="relative mb-8 h-64 rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 overflow-hidden"
                >
                  <div className="absolute right-8 top-0 bottom-0 w-1 border-r-2 border-dashed border-primary z-10"></div>
                  {racers.map((racer, index) => {
                    if (!racer) return null;
                    const currentPosition = racersPositions[index];
                    return (
                      <div
                        key={racer.id}
                        className="absolute left-0 flex h-10 items-center transition-transform duration-75 ease-linear"
                        style={{
                          top: `${index * 48 + 12}px`,
                          transform: `translateX(${currentPosition}px)`,
                          zIndex: 5,
                        }}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full shadow-md",
                            racer.color,
                            racer.id === selectedRacer ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                            raceFinished && racer.id === winnerRacerId ? "ring-4 ring-yellow-400" : ""
                          )}
                        >
                          <Zap className="h-5 w-5 text-white" />
                        </div>
                        <span className="ml-2 text-xs font-medium bg-background/80 px-1 rounded">
                          {racer.name}
                        </span>
                      </div>
                    )
                  })}

                 <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-sm rounded-lg z-20 p-4">
                    {!raceStarted && !(isPending || isConfirming || isRacing) && (
                        <p className="text-lg font-semibold text-center text-primary-foreground bg-primary/80 px-4 py-2 rounded">Select a bolt and place your bet to start the race</p>
                    )}
                    {(isPending || isConfirming || isRacing) && !raceFinished && (
                        <div className="flex flex-col items-center gap-2 text-lg font-semibold text-primary-foreground bg-primary/80 px-4 py-2 rounded">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p>{isPending ? "Waiting for wallet..." : isConfirming ? "Confirming Tx..." : "Race in progress..."}</p>
                        </div>
                    )}
                    {raceFinished && winnerRacerId !== null && (
                        <div className="flex flex-col items-center gap-2 text-center bg-background/90 rounded-lg shadow-lg p-4 sm:p-6">
                            <Trophy className="w-12 h-12 text-yellow-500" />
                            <p className="text-xl font-bold">
                                {getRacerDetailsById(winnerRacerId)?.name} wins!
                            </p>
                            <div
                                className={cn(
                                    "text-lg font-medium",
                                    gameResult === "win" ? "text-green-500" : "text-red-500",
                                )}
                            >
                                {gameResult === "win" ? (
                                    <>You Win! +{lastPayout?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} MON</>
                                ) : gameResult === "lose" ? (
                                    <>You Lose! -{(parseFloat(betAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} MON</>
                                ) : null }
                            </div>
                            {(writeError || confirmError) && (
                               <p className="text-sm text-destructive mt-2">
                                   Error: {writeError?.message || confirmError?.message}
                               </p>
                            )}
                        </div>
                    )}
                 </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div className="space-y-2">
                  <Label htmlFor="bet-amount">Bet Amount (MON)</Label>
                  <div className="flex">
                    <Input
                      id="bet-amount"
                      type="number"
                      min={0.000000000000000001}
                      step="any"
                      value={betAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || parseFloat(val) >= 0) {
                          setBetAmount(val);
                        }
                      }}
                      className="rounded-r-none"
                      disabled={isBetInputDisabled}
                      placeholder="0.05"
                    />
                    <Button
                      variant="outline"
                      className="rounded-l-none border-l-0 px-3"
                      onClick={() => {
                        const currentAmount = parseFloat(betAmount) || 0;
                        if (currentAmount > 0) setBetAmount((currentAmount * 2).toString());
                      }}
                      disabled={isBetInputDisabled || parseFloat(betAmount || '0') <= 0}
                    >
                      2x
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground h-4">
                    {accountBalance ? (
                      <>Wallet Balance: {parseFloat(formatEther(accountBalance.value)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} MON</>
                    ) : isConnected ? (
                      "Loading balance..."
                    ) : (
                      "Connect wallet to see balance"
                    )}
                  </p>
                </div>
                <div className="space-y-2 text-left md:text-right">
                  <Label>Potential Payout</Label>
                  <p className="text-lg font-semibold h-7">
                    {selectedRacerDetails ? (
                      <>
                        {potentialPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} MON ({potentialMultiplier}x)
                      </>
                    ) : (
                      <span className="text-muted-foreground">Select a bolt</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-center">Select Your Bolt</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {racers.map((racer) => {
                    if (!racer) return null;
                    const isSelected = racer.id === selectedRacer;
                    const currentOdds = (isSelected && selectedRacerOdds !== null) ? selectedRacerOdds : racer.odds;
                    return (
                      <Button
                        key={racer.id}
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "h-auto justify-start gap-3 p-3 flex flex-col items-center text-center",
                          isSelected && "ring-2 ring-primary",
                        )}
                        onClick={() => selectRacer(racer.id)}
                        disabled={isBetInputDisabled}
                      >
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full mb-2", racer.color)}>
                          <Zap className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="font-semibold text-sm">{racer.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Odds: {currentOdds}x
                          </span>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Button
                className="mt-6 w-full"
                size="lg"
                disabled={isPlaceBetButtonDisabled}
                onClick={handlePlaceBet}
              >
                {isPending ? (
                  <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirm in Wallet </>
                ) : isConfirming ? (
                  <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming... </>
                ) : isRacing ? (
                   <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing... </>
                ) : !isConnected ? (
                  "Connect Wallet to Bet"
                ) : !selectedRacer ? (
                  "Select a Bolt"
                ) : parseFloat(betAmount || '0') <= 0 ? (
                  "Enter Bet Amount"
                ) : accountBalance && parseEther(betAmount || '0') > accountBalance.value ? (
                  "Insufficient Balance"
                ) : (
                  "Place Bet"
                )}
              </Button>
              {(writeError || confirmError) && !raceFinished && (
                <p className="text-sm text-destructive text-center mt-2">
                  Error: {writeError?.message || confirmError?.message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" /> Race History (Recent)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {raceHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center">No recent races recorded for this session.</p>
                ) : (
                  raceHistory.map((game, index) => (
                    <div key={`${game.gameId}-${index}`} className="flex justify-between items-center p-3 border rounded-lg bg-muted/50">
                      <div className="flex flex-col text-sm">
                        <span className="font-medium">
                          Bet on: <span className="font-bold text-primary">{game.racerName}</span> ({game.bet.toLocaleString()} MON)
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Winner: {game.winnerName} ({game.timestamp})
                        </span>
                      </div>
                      <div
                        className={cn(
                          "text-right font-medium",
                          game.outcome === "win" ? "text-green-500" : "text-red-500",
                        )}
                      >
                        {game.outcome === "win" ? `+${game.payout.toLocaleString()}` : `-${game.bet.toLocaleString()}`} MON
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