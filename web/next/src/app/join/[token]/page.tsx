"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

import { Access } from "@/components/access"
import { useJoin } from "@/components/app/api"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth/client"

export default function JoinPage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()
  const join = useJoin()
  const attempted = useRef(false)

  // Once signed in, auto-join and go straight to the tournament.
  useEffect(() => {
    if (isPending || !session?.user || attempted.current) return
    attempted.current = true
    join.mutate(
      { token },
      {
        onSuccess: (data) => {
          if (data?.tournamentId) router.replace(`/tournaments/${data.tournamentId}`)
        },
      },
    )
  }, [isPending, session, token, join, router])

  if (isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">You have been invited</h1>
        <p className="text-muted-foreground">
          Sign in with GitHub to join this tournament. Only invited players can view or play.
        </p>
        <Access callbackURL={`/join/${token}`} />
      </main>
    )
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      {join.isError ? (
        <>
          <p className="text-muted-foreground">This invite is not valid.</p>
          <Button variant="outline" onClick={() => router.replace("/dashboard")}>
            Go to dashboard
          </Button>
        </>
      ) : (
        <>
          <Spinner />
          <p className="text-muted-foreground text-sm">Joining tournament...</p>
        </>
      )}
    </main>
  )
}
