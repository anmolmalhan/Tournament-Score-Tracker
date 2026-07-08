"use client"

import {
  RiAddLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiCloseLine,
  RiNotification3Line,
  RiShuffleLine,
  RiTrophyFill,
} from "@remixicon/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  type Me,
  type PlayerStats,
  randomTopic,
  type TournamentSummary,
  useCreateTournament,
  useJoin,
  useMe,
  useMeMutations,
  useTournaments,
} from "@/components/app/api"
import { Avatar } from "@/components/app/app-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"

export function Dashboard({ me }: { me: Me }) {
  const meQuery = useMe()
  const tournamentsQuery = useTournaments()
  const current = meQuery.data ?? me
  const tournaments = tournamentsQuery.data ?? []

  const active = tournaments.filter((t) => t.status === "active")
  const completed = tournaments.filter((t) => t.status === "completed")
  const pending = tournaments.filter(
    (t) => t.pending && t.pending.claimantUserId !== current.user.id,
  )

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-16 sm:py-8">
      <p className="text-muted-foreground text-sm">Welcome back</p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{current.user.name}</h1>

      <StatsBar stats={current.stats} />

      {pending.length > 0 && (
        <section className="mt-5 flex flex-col gap-2">
          {pending.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className="border-primary/40 bg-primary/5 hover:bg-primary/10 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <RiCheckLine className="text-primary size-4 shrink-0" />
                Confirm a result in {t.name}
              </span>
              <RiArrowRightSLine className="text-muted-foreground size-5 shrink-0" />
            </Link>
          ))}
        </section>
      )}

      <Actions />

      <TournamentList
        title="Active"
        tournaments={active}
        meId={current.user.id}
        loading={tournamentsQuery.isPending}
        emptyHint
      />
      {completed.length > 0 && (
        <TournamentList
          title="Completed"
          tournaments={completed}
          meId={current.user.id}
          loading={false}
        />
      )}

      <NotificationSettings me={current} />
    </main>
  )
}

function StatsBar({ stats }: { stats: PlayerStats }) {
  const items = [
    { value: `${stats.matchesWon}-${stats.matchesLost}`, label: "Matches" },
    { value: stats.tournamentsWon, label: "Titles" },
    { value: stats.tournamentsPlayed, label: "Played" },
  ]
  return (
    <Card className="mt-4">
      <CardContent className="flex items-center gap-4 px-4 py-4">
        <div className="text-center">
          <div className="text-3xl leading-none font-bold tabular-nums sm:text-4xl">
            {stats.winPercentage}
            <span className="text-muted-foreground text-xl">%</span>
          </div>
          <div className="text-muted-foreground mt-1 text-xs">Win rate</div>
        </div>
        <div className="bg-border h-10 w-px" />
        <div className="grid flex-1 grid-cols-3 gap-2 text-center">
          {items.map((it) => (
            <div key={it.label}>
              <div className="text-xl font-bold tabular-nums">{it.value}</div>
              <div className="text-muted-foreground text-xs">{it.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Actions() {
  const create = useCreateTournament()
  const join = useJoin()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [game, setGame] = useState("")
  const [target, setTarget] = useState("11")
  const [code, setCode] = useState("")

  const submitCreate = () => {
    const parsed = Number.parseInt(target, 10)
    create.mutate(
      {
        name: name.trim() || undefined,
        gameName: game.trim() || undefined,
        target: Number.isFinite(parsed) ? parsed : undefined,
      },
      { onSuccess: (d) => d?.id && router.push(`/tournaments/${d.id}`) },
    )
  }
  const submitJoin = () => {
    if (code.length !== 4) return
    join.mutate(
      { code },
      { onSuccess: (d) => d?.tournamentId && router.push(`/tournaments/${d.tournamentId}`) },
    )
  }

  return (
    <section className="mt-5 flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button className="h-11 flex-1 text-base" onClick={() => setOpen((v) => !v)}>
          {open ? <RiCloseLine /> : <RiAddLine />}
          New tournament
        </Button>
        <div className="flex flex-1 gap-2">
          <Input
            inputMode="numeric"
            maxLength={4}
            value={code}
            placeholder="Join code"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && submitJoin()}
            className="h-11 text-center text-base font-semibold tracking-[0.3em] tabular-nums"
          />
          <Button
            variant="secondary"
            className="h-11"
            onClick={submitJoin}
            disabled={join.isPending || code.length !== 4}
          >
            {join.isPending ? <Spinner /> : "Join"}
          </Button>
        </div>
      </div>

      {open && (
        <Card className="animate-in fade-in slide-in-from-top-1 duration-200">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-name">Tournament name</Label>
              <Input
                id="t-name"
                maxLength={40}
                value={name}
                placeholder="Summer Showdown"
                onChange={(e) => setName(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="t-game">Game</Label>
                <Input
                  id="t-game"
                  maxLength={40}
                  value={game}
                  placeholder="Chess"
                  onChange={(e) => setGame(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="t-target">Wins to win</Label>
                <Input
                  id="t-target"
                  type="number"
                  min={1}
                  max={999}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
            <Button className="h-11" onClick={submitCreate} disabled={create.isPending}>
              {create.isPending ? <Spinner /> : "Create tournament"}
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function TournamentList({
  title,
  tournaments,
  meId,
  loading,
  emptyHint,
}: {
  title: string
  tournaments: TournamentSummary[]
  meId: string
  loading: boolean
  emptyHint?: boolean
}) {
  return (
    <section className="mt-6">
      <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-widest uppercase">
        {title}
      </h2>
      {loading && tournaments.length === 0 ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner /> Loading...
        </div>
      ) : tournaments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {emptyHint
            ? "No active tournaments. Tap “New tournament” to start one."
            : "Nothing here yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tournaments.map((t) => (
            <TournamentCard key={t.id} t={t} meId={meId} />
          ))}
        </div>
      )}
    </section>
  )
}

function TournamentCard({ t, meId }: { t: TournamentSummary; meId: string }) {
  const winner = t.winnerUserId ? t.members.find((m) => m.userId === t.winnerUserId) : null
  const needsMe = Boolean(t.pending && t.pending.claimantUserId !== meId)

  return (
    <Link
      href={`/tournaments/${t.id}`}
      className="bg-card hover:border-primary/40 active:bg-muted/40 flex items-center gap-3 rounded-xl border p-3.5 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{t.name}</span>
          {t.gameName && (
            <Badge variant="secondary" className="shrink-0">
              {t.gameName}
            </Badge>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {t.members.map((m) => (
            <span key={m.userId} className="flex items-center gap-1.5">
              <Avatar src={m.image} name={m.name} size={18} />
              <span className="text-sm">{m.name}</span>
              <span className="text-sm font-bold tabular-nums">{m.score}</span>
            </span>
          ))}
          {t.members.length < 2 && (
            <span className="text-muted-foreground text-xs">waiting for a player</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {t.status === "completed" ? (
          <Badge variant="secondary" className="text-success gap-1">
            <RiTrophyFill className="size-3" />
            {winner ? winner.name : "Ended"}
          </Badge>
        ) : needsMe ? (
          <Badge className="gap-1">
            <RiCheckLine className="size-3" />
            Confirm
          </Badge>
        ) : (
          <Badge variant="outline">First to {t.target}</Badge>
        )}
        <RiArrowRightSLine className="text-muted-foreground size-5" />
      </div>
    </Link>
  )
}

function NotificationSettings({ me }: { me: Me }) {
  const { updateSettings, notifyTest } = useMeMutations()
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState("")

  const save = () => {
    if (topic.trim() === "") return
    updateSettings.mutate({ ntfyTopic: topic.trim() }, { onSuccess: () => setTopic("") })
  }

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 text-sm transition-colors"
      >
        <span className="flex items-center gap-2">
          <RiNotification3Line className="size-4" />
          Notifications
          {me.settings.ntfyTopic && (
            <Badge variant="secondary" className="text-success">
              On
            </Badge>
          )}
        </span>
        <RiArrowRightSLine className={`size-5 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <Card className="animate-in fade-in slide-in-from-top-1 mt-3 duration-200">
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-muted-foreground text-xs">
              Get a push (via ntfy) when a result needs your confirmation or a tournament is
              decided. Use a long random topic; ntfy has no login, so a guessable name is not
              private.
            </p>
            <div className="flex gap-2">
              <Input
                value={topic}
                placeholder={me.settings.ntfyTopic ? "Enter a new topic to change" : "mmt-9f3a..."}
                onChange={(e) => setTopic(e.target.value)}
                className="h-11"
              />
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setTopic(randomTopic())}
              >
                <RiShuffleLine />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                className="h-11 flex-1"
                onClick={save}
                disabled={updateSettings.isPending || topic.trim() === ""}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                className="h-11 flex-1"
                onClick={() => notifyTest.mutate()}
                disabled={notifyTest.isPending || !me.settings.ntfyTopic}
              >
                Send test
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
