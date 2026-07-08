"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { apiClient, unwrap } from "@/lib/api/client"

// Typed client hooks for the tournament API. All routes are auth-gated; the RPC
// client sends the session cookie automatically (credentials: "include").

export type RequestKind = "win" | "undo" | "reset"

export type PlayerStats = {
  tournamentsPlayed: number
  tournamentsWon: number
  tournamentsLost: number
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  winPercentage: number
}

export type Me = {
  user: { id: string; name: string; image: string | null; email: string }
  settings: { ntfyTopic: string | null }
  stats: PlayerStats
}

export type Member = {
  userId: string
  name: string
  image: string | null
  score: number
  role: string
}

export type EventItem = {
  id: string
  kind: RequestKind
  status: "pending" | "confirmed" | "rejected"
  claimantUserId: string
  claimantName: string
  resolvedByUserId: string | null
  createdAt: string
  resolvedAt: string | null
}

export type Pending = {
  id: string
  kind: RequestKind
  claimantUserId: string
  createdAt: string
} | null

export type TournamentDetail = {
  id: string
  name: string
  gameName: string
  target: number
  ownerId: string
  status: "active" | "completed"
  winnerUserId: string | null
  joinCode: string | null
  createdAt: string
  endedAt: string | null
  inviteToken: string
  members: Member[]
  events: EventItem[]
  pending: Pending
}

export type TournamentSummary = {
  id: string
  name: string
  gameName: string
  target: number
  ownerId: string
  status: "active" | "completed"
  winnerUserId: string | null
  joinCode: string | null
  createdAt: string
  endedAt: string | null
  members: Member[]
  myScore: number
  pending: Pending
}

async function unwrapOrThrow<T>(
  promise: Promise<{ data: unknown; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data as T
}

export function useMe() {
  return useQuery<Me>({
    queryKey: ["me"],
    queryFn: () => unwrapOrThrow<Me>(unwrap(apiClient.me.$get())),
  })
}

export function useMeMutations() {
  const qc = useQueryClient()
  const updateSettings = useMutation({
    mutationFn: (input: { ntfyTopic: string }) =>
      unwrapOrThrow(unwrap(apiClient.me.settings.$put({ json: input }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] })
      toast.success("Notification settings saved")
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const notifyTest = useMutation({
    mutationFn: () => unwrapOrThrow(unwrap(apiClient.me["notify-test"].$post())),
    onSuccess: () => toast.success("Test notification sent"),
    onError: (e: Error) => toast.error(e.message),
  })
  return { updateSettings, notifyTest }
}

export function useTournaments() {
  return useQuery<TournamentSummary[]>({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const data = await unwrapOrThrow<{ tournaments: TournamentSummary[] }>(
        unwrap(apiClient.tournaments.$get()),
      )
      return data.tournaments
    },
    refetchInterval: 5000,
  })
}

export function useCreateTournament() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name?: string; gameName?: string; target?: number }) =>
      unwrapOrThrow<TournamentDetail>(unwrap(apiClient.tournaments.$post({ json: input }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] })
      qc.invalidateQueries({ queryKey: ["me"] })
      toast.success("Tournament created")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useJoin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { code?: string; token?: string }) =>
      unwrapOrThrow<{ tournamentId: string }>(
        unwrap(apiClient.tournaments.join.$post({ json: input })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] })
      qc.invalidateQueries({ queryKey: ["me"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useTournament(id: string) {
  return useQuery<TournamentDetail>({
    queryKey: ["tournament", id],
    queryFn: () =>
      unwrapOrThrow<TournamentDetail>(unwrap(apiClient.tournaments[":id"].$get({ param: { id } }))),
    refetchInterval: 4000,
  })
}

export function useTournamentActions(id: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tournament", id] })
    qc.invalidateQueries({ queryKey: ["tournaments"] })
    qc.invalidateQueries({ queryKey: ["me"] })
  }

  const createRequest = useMutation({
    mutationFn: (kind: RequestKind) =>
      unwrapOrThrow<TournamentDetail>(
        unwrap(apiClient.tournaments[":id"].requests.$post({ param: { id }, json: { kind } })),
      ),
    onSuccess: (_d, kind) => {
      invalidate()
      const label = kind === "win" ? "Win" : kind === "undo" ? "Correction" : "Reset"
      toast.success(`${label} request sent`, {
        description: "Waiting for another player to confirm.",
      })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resolve = useMutation({
    mutationFn: (action: "confirm" | "reject") =>
      unwrapOrThrow<TournamentDetail>(
        unwrap(
          apiClient.tournaments[":id"].requests.resolve.$post({ param: { id }, json: { action } }),
        ),
      ),
    onSuccess: (_d, action) => {
      invalidate()
      toast.success(action === "confirm" ? "Confirmed" : "Rejected")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rematch = useMutation({
    mutationFn: () =>
      unwrapOrThrow<TournamentDetail>(
        unwrap(apiClient.tournaments[":id"].rematch.$post({ param: { id } })),
      ),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  })

  const getInvite = useMutation({
    mutationFn: () =>
      unwrapOrThrow<{ code: string | null; token: string; url: string }>(
        unwrap(apiClient.tournaments[":id"].invite.$post({ param: { id } })),
      ),
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: () =>
      unwrapOrThrow<{ deleted: boolean }>(
        unwrap(apiClient.tournaments[":id"].$delete({ param: { id } })),
      ),
    onSuccess: () => {
      invalidate()
      toast.success("Tournament deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return { createRequest, resolve, rematch, getInvite, remove }
}

// Long random ntfy topic. ntfy has no login, so an unguessable topic is the only
// thing keeping notifications private.
export function randomTopic(prefix = "mmt"): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${prefix}-${hex}`
}
