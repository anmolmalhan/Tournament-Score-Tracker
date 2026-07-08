"use client"

import { RiGamepadLine, RiShieldCheckLine, RiTrophyLine } from "@remixicon/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { Access } from "@/components/access"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth/client"

export default function Home() {
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()

  useEffect(() => {
    if (session?.user) router.replace("/dashboard")
  }, [session, router])

  if (isPending || session?.user) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner />
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
      <Badge variant="secondary" className="gap-1.5">
        <RiGamepadLine />
        Any game, any tournament
      </Badge>
      <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Match Tracker</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-base sm:text-lg">
        Track head-to-head wins for chess, cricket, carrom, Monster, or anything else. Invite a
        friend, claim your wins, and crown a champion, with every result confirmed by the other
        player.
      </p>

      <div className="mt-8">
        <Access callbackURL="/dashboard" />
      </div>

      <div className="text-muted-foreground mt-12 grid gap-4 text-left text-sm sm:grid-cols-3">
        <Feature icon={<RiShieldCheckLine className="size-5" />} title="Confirmed results">
          A win only counts after your opponent confirms it. No one edits scores alone.
        </Feature>
        <Feature icon={<RiTrophyLine className="size-5" />} title="Permanent history">
          Every tournament, match, and stat is saved to your GitHub account forever.
        </Feature>
        <Feature icon={<RiGamepadLine className="size-5" />} title="Private tournaments">
          Only invited GitHub users can view or play. Everyone else is locked out.
        </Feature>
      </div>

      <p className="text-muted-foreground mt-10 text-xs">
        Already have a tournament link?{" "}
        <Button variant="link" className="h-auto p-0 text-xs" render={<Link href="/dashboard" />}>
          Sign in to open it
        </Button>
      </p>
    </main>
  )
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="text-foreground flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      <p className="mt-1.5">{children}</p>
    </div>
  )
}
