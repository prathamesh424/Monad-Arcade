"use client"

import Link from "next/link"
import { Dice5, Coins, Zap, Trophy, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ArcadePage() {
  const games = [
    {
      id: "dice",
      title: "Monad Dice",
      description: "Roll the dice and win based on your prediction",
      icon: Dice5,
      color: "bg-purple-500/10",
      iconColor: "text-purple-500",
    },
    {
      id: "flip",
      title: "Prediction Flip",
      description: "Predict heads or tails and double your tokens",
      icon: Coins,
      color: "bg-amber-500/10",
      iconColor: "text-amber-500",
    },
    {
      id: "lightning",
      title: "Lightning Race",
      description: "Bet on the fastest lightning bolt to win big",
      icon: Zap,
      color: "bg-blue-500/10",
      iconColor: "text-blue-500",
    },
    {
      id: "jackpot",
      title: "Monad Jackpot",
      description: "Enter the pool for a chance to win the jackpot",
      icon: Trophy,
      color: "bg-green-500/10",
      iconColor: "text-green-500",
    },
    {
      id: "slots",
      title: "Crypto Slots",
      description: "Spin the reels for a chance at the big prize",
      icon: Sparkles,
      color: "bg-pink-500/10",
      iconColor: "text-pink-500",
    },
  ]

  return (
    <div className="container py-10">
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Monad Arcade</h1>
        <p className="text-muted-foreground">Select a game to play. All games run on-chain for provable fairness.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <Card key={game.id} className="overflow-hidden transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <div
                className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ background: `var(--${game.color})` }}
              >
                <game.icon className={`h-6 w-6 ${game.iconColor}`} />
              </div>
              <CardTitle>{game.title}</CardTitle>
              <CardDescription>{game.description}</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  <span>Up to 10x</span>
                </div>
                <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <div>Min bet: 10 MON</div>
              </div>
            </CardContent>
            <CardFooter>
              <Link href={`/arcade/${game.id}`} className="w-full">
                <Button className="w-full">Play Now</Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
