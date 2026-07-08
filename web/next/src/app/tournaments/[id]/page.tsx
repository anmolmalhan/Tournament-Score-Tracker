"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { useTournament } from "@/components/app/api"
import { AppHeader } from "@/components/app/app-header"
import { TournamentView } from "@/components/app/tournament-view"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth/client"

export default function TournamentPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()
  const query = useTournament(id)

  useEffect(() => {
    if (!isPending && !session?.user) router.replace("/")
  }, [isPending, session, router])

  if (isPending || !session?.user || query.isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (query.isError || !query.data) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground max-w-sm">
          This tournament is private, or you are not one of its players.
        </p>
        <Button variant="outline" render={<Link href="/dashboard" />}>
          Back to dashboard
        </Button>
      </main>
    )
  }

  const user = session.user as { name: string; image?: string | null; id: string }

  return (
    <div className="min-h-svh">
      <AppHeader user={{ name: user.name, image: user.image ?? null }} />
      <TournamentView initial={query.data} meId={user.id} />
    </div>
  )
}
