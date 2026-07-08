"use client"

import {
  RiAddLine,
  RiArrowLeftLine,
  RiCheckLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiHourglassLine,
  RiRestartLine,
  RiSubtractLine,
  RiTrophyFill,
  RiUserAddLine,
} from "@remixicon/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import {
  type EventItem,
  type Member,
  type TournamentDetail,
  useTournament,
  useTournamentActions,
} from "@/components/app/api"
import { Avatar } from "@/components/app/app-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const MEMBER_BAR = ["bg-player-1", "bg-player-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"]
const MEMBER_TEXT = [
  "text-player-1",
  "text-player-2",
  "text-chart-3",
  "text-chart-4",
  "text-chart-5",
]

export function TournamentView({ initial, meId }: { initial: TournamentDetail; meId: string }) {
  const query = useTournament(initial.id)
  const t = query.data ?? initial
  const actions = useTournamentActions(t.id)
  const router = useRouter()

  const me = t.members.find((m) => m.userId === meId)
  const winner = t.winnerUserId ? t.members.find((m) => m.userId === t.winnerUserId) : null
  const isCompleted = t.status === "completed"
  const isOwner = t.ownerId === meId
  const busy = actions.createRequest.isPending || actions.resolve.isPending
  const canAct = !isCompleted && !t.pending && Boolean(me)

  const onDelete = () => {
    if (
      window.confirm(
        `Delete "${t.name}" and its match history? This cannot be undone and removes it for everyone.`,
      )
    ) {
      actions.remove.mutate(undefined, { onSuccess: () => router.push("/dashboard") })
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 cursor-pointer"
        render={<Link href="/dashboard" />}
      >
        <RiArrowLeftLine />
        Dashboard
      </Button>

      <header className="text-center">
        <div className="flex items-center justify-center gap-2">
          {t.gameName && (
            <Badge variant="secondary" className="gap-1.5">
              {t.gameName}
            </Badge>
          )}
          <Badge variant="outline">First to {t.target}</Badge>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{t.name}</h1>
      </header>

      {isCompleted && winner && (
        <Card className="border-success/30 bg-success/5 mt-6">
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <RiTrophyFill className="text-success size-9" />
            <p className="text-xl font-bold">
              <span className="text-success">{winner.name}</span> won this tournament
            </p>
            <Button
              variant="outline"
              className="mt-1"
              disabled={actions.rematch.isPending}
              onClick={() =>
                actions.rematch.mutate(undefined, {
                  onSuccess: (detail) => detail?.id && router.push(`/tournaments/${detail.id}`),
                })
              }
            >
              <RiRestartLine />
              Start a rematch
            </Button>
          </CardContent>
        </Card>
      )}

      {t.pending && (
        <PendingBanner
          pending={t.pending}
          members={t.members}
          meId={meId}
          busy={busy}
          onResolve={(action) => actions.resolve.mutate(action)}
        />
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {t.members.map((m, i) => (
          <PlayerCard
            key={m.userId}
            member={m}
            index={i}
            target={t.target}
            isMe={m.userId === meId}
            isWinner={t.winnerUserId === m.userId}
            canClaim={canAct && m.userId === meId}
            busy={busy}
            onClaim={() => actions.createRequest.mutate("win")}
            onUndo={() => actions.createRequest.mutate("undo")}
          />
        ))}
      </div>

      {!me && (
        <p className="text-muted-foreground mt-4 text-center text-sm">
          You are viewing this tournament but are not a player in it.
        </p>
      )}

      {!isCompleted && <InviteRow code={t.joinCode} getInvite={actions.getInvite} />}

      <EventLog events={t.events} members={t.members} />

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {!isCompleted && me && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={!canAct}
            onClick={() => actions.createRequest.mutate("reset")}
          >
            <RiRestartLine />
            Request a reset
          </Button>
        )}
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={actions.remove.isPending}
            onClick={onDelete}
          >
            <RiDeleteBinLine />
            Delete tournament
          </Button>
        )}
      </div>
    </main>
  )
}

function PlayerCard({
  member,
  index,
  target,
  isMe,
  isWinner,
  canClaim,
  busy,
  onClaim,
  onUndo,
}: {
  member: Member
  index: number
  target: number
  isMe: boolean
  isWinner: boolean
  canClaim: boolean
  busy: boolean
  onClaim: () => void
  onUndo: () => void
}) {
  const bar = MEMBER_BAR[index % MEMBER_BAR.length]
  const text = MEMBER_TEXT[index % MEMBER_TEXT.length]
  const pct = Math.min(100, target > 0 ? (member.score / target) * 100 : 0)
  const remaining = Math.max(0, target - member.score)

  return (
    <Card className={cn("relative gap-0 overflow-hidden", isWinner && "ring-success/40 ring-4")}>
      <div className={cn("absolute inset-x-0 top-0 h-1", bar)} />
      <CardContent className="flex flex-col items-center gap-3 px-5 py-6 text-center">
        <div className="flex items-center gap-2">
          <Avatar src={member.image} name={member.name} size={24} />
          <span className="font-semibold">{member.name}</span>
          {isMe && <Badge variant="outline">You</Badge>}
          {isWinner && <RiTrophyFill className={cn("size-4", text)} />}
        </div>
        <div>
          <div className={cn("text-6xl font-bold tabular-nums", text)}>{member.score}</div>
          <div className="text-muted-foreground text-xs tracking-widest uppercase">wins</div>
        </div>
        <div className="w-full">
          <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", bar)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-muted-foreground mt-1.5 text-xs">
            {remaining === 0 ? "Target reached" : `${remaining} to go`}
          </div>
        </div>
        {isMe && (
          <div className="flex w-full flex-col gap-2">
            <Button disabled={!canClaim || busy} onClick={onClaim} className="w-full">
              <RiAddLine />
              I won this match
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canClaim || busy || member.score <= 0}
              onClick={onUndo}
            >
              <RiSubtractLine />
              Fix a miscount (-1)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PendingBanner({
  pending,
  members,
  meId,
  busy,
  onResolve,
}: {
  pending: NonNullable<TournamentDetail["pending"]>
  members: Member[]
  meId: string
  busy: boolean
  onResolve: (action: "confirm" | "reject") => void
}) {
  const claimant = members.find((m) => m.userId === pending.claimantUserId)
  const claimantName = claimant?.name ?? "A player"
  const iAmClaimant = pending.claimantUserId === meId
  const kindLabel =
    pending.kind === "reset" ? "reset" : pending.kind === "undo" ? "correction" : "win"

  const headline =
    pending.kind === "reset"
      ? `${claimantName} requested a reset`
      : pending.kind === "undo"
        ? `${claimantName} wants to remove one of their wins`
        : `${claimantName} claimed a win`

  return (
    <Card className="border-primary/30 bg-muted/40 mt-6">
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <Badge variant="secondary" className="gap-1.5">
          <RiHourglassLine />
          Pending {kindLabel}
        </Badge>
        <p className="text-lg font-semibold">{headline}</p>
        {iAmClaimant ? (
          <p className="text-muted-foreground text-sm">
            Waiting for another player to confirm or reject. You cannot confirm your own claim.
          </p>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => onResolve("reject")}>
              <RiCloseLine />
              Reject
            </Button>
            <Button disabled={busy} onClick={() => onResolve("confirm")}>
              <RiCheckLine />
              Confirm
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InviteRow({
  code,
  getInvite,
}: {
  code: string | null
  getInvite: ReturnType<typeof useTournamentActions>["getInvite"]
}) {
  const [url, setUrl] = useState("")

  const loadLink = () => {
    getInvite.mutate(undefined, { onSuccess: (data) => data?.url && setUrl(data.url) })
  }
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error("Could not copy")
    }
  }

  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <RiUserAddLine className="size-4" />
          Invite a player
        </div>
        {code ? (
          <>
            <p className="text-muted-foreground text-sm">
              Share this 4-digit code. They enter it on their dashboard.
            </p>
            <button
              type="button"
              onClick={() => copy(code, "Code")}
              className="bg-muted hover:bg-muted/70 rounded-xl px-6 py-3 text-4xl font-bold tracking-[0.3em] tabular-nums transition-colors"
              title="Click to copy"
            >
              {code}
            </button>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">No join code available.</p>
        )}
        {url ? (
          <div className="flex w-full max-w-md gap-2">
            <Input readOnly value={url} className="h-9" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" onClick={() => copy(url, "Link")}>
              <RiFileCopyLine />
              Copy
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={loadLink} disabled={getInvite.isPending}>
            <RiFileCopyLine />
            or copy an invite link
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

const KIND_VERB: Record<string, string> = {
  win: "claimed a win",
  undo: "removed a win",
  reset: "requested a reset",
}
const STATUS_STYLE: Record<string, string> = {
  confirmed: "text-success",
  rejected: "text-destructive",
  pending: "text-muted-foreground",
}

function EventLog({ events, members }: { events: EventItem[]; members: Member[] }) {
  if (events.length === 0) return null
  const nameOf = (id: string | null) =>
    id ? (members.find((m) => m.userId === id)?.name ?? "Someone") : null

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-base">Match history</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {events.map((e, i) => (
          <div key={e.id}>
            {i > 0 && <Separator className="my-2" />}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">{e.claimantName}</span> {KIND_VERB[e.kind] ?? e.kind}
                {e.resolvedByUserId && e.status !== "pending" && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({e.status} by {nameOf(e.resolvedByUserId)})
                  </span>
                )}
              </span>
              <span className={cn("text-xs font-medium capitalize", STATUS_STYLE[e.status])}>
                {e.status}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
