"use client"

import { RiLogoutBoxRLine } from "@remixicon/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth/client"

export function AppHeader({ user }: { user: { name: string; image: string | null } }) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await authClient.signOut()
    router.replace("/")
  }

  return (
    <header className="bg-background sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/dashboard" className="font-bold">
          Match Tracker
        </Link>
        <div className="flex items-center gap-3">
          <ModeToggle />
          <div className="flex items-center gap-2">
            <Avatar src={user.image} name={user.name} />
            <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Sign out"
            onClick={signOut}
            disabled={signingOut}
          >
            {signingOut ? <Spinner /> : <RiLogoutBoxRLine />}
          </Button>
        </div>
      </div>
    </header>
  )
}

export function Avatar({
  src,
  name,
  size = 28,
}: {
  src: string | null
  name: string
  size?: number
}) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?"
  if (src) {
    return (
      // GitHub avatars are external; a plain img keeps this simple and avoids
      // next/image remote-host config.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="border-border rounded-full border object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-semibold"
      style={{ width: size, height: size }}
    >
      {initial}
    </span>
  )
}
