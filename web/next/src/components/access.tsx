"use client"

import { RiGithubFill } from "@remixicon/react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth/client"
import { cn } from "@/lib/utils"

// GitHub is the only login method for this app: no email/password, no Google, no
// guest mode. A player's identity is their GitHub account, which is what enforces
// "you can't act as, or confirm for, another player".
export function Access({
  labelClassName,
  callbackURL = "/dashboard",
  className,
}: {
  labelClassName?: string
  callbackURL?: string
  className?: string
}) {
  const [loading, setLoading] = useState(false)

  const signIn = async () => {
    setLoading(true)
    const { error } = await authClient.signIn.social({ provider: "github", callbackURL })
    if (error) {
      setLoading(false)
      toast.error(error.message ?? "Could not start GitHub sign-in")
    }
    // On success the browser is redirected to GitHub, so we keep the spinner.
  }

  return (
    <Button className={cn("gap-2", className)} onClick={signIn} disabled={loading}>
      {loading ? (
        <Spinner />
      ) : (
        <span className={cn("inline-flex items-center gap-2", labelClassName)}>
          <RiGithubFill className="size-4" />
          Sign in with GitHub
        </span>
      )}
    </Button>
  )
}
