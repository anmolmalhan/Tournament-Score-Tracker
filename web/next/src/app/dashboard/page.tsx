"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useMe } from "@/components/app/api"
import { AppHeader } from "@/components/app/app-header"
import { Dashboard } from "@/components/app/dashboard"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth/client"

export default function DashboardPage() {
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()
  const meQuery = useMe()

  useEffect(() => {
    if (!isPending && !session?.user) router.replace("/")
  }, [isPending, session, router])

  if (isPending || !session?.user || meQuery.isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Could not load your dashboard.</p>
        <Button variant="outline" onClick={() => meQuery.refetch()}>
          Try again
        </Button>
      </main>
    )
  }

  return (
    <div className="min-h-svh">
      <AppHeader user={meQuery.data.user} />
      <Dashboard me={meQuery.data} />
    </div>
  )
}
