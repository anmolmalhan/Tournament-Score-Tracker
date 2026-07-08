import { randomInt } from "node:crypto"

import {
  db,
  tournamentEvents,
  tournamentMembers,
  tournaments,
  user,
  userSettings,
} from "@packages/db"
import { and, desc, eq, inArray, ne } from "drizzle-orm"

// A short 4-digit join code, unique among tournaments that currently hold one
// (completed tournaments release theirs). Retries on the rare collision.
export async function generateJoinCode(): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const code = String(randomInt(0, 10000)).padStart(4, "0")
    const existing = await db.query.tournaments.findFirst({
      where: eq(tournaments.joinCode, code),
    })
    if (!existing) return code
  }
  // Extremely unlikely; fall back to a longer numeric string to stay unique.
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

// Shared queries for the tournament routers. Everything is keyed to GitHub-backed
// user ids; membership is the access boundary (checked by the callers).

export type MemberView = {
  userId: string
  name: string
  image: string | null
  score: number
  role: string
}

export type EventView = {
  id: string
  kind: string
  status: string
  claimantUserId: string
  claimantName: string
  resolvedByUserId: string | null
  createdAt: string
  resolvedAt: string | null
}

// Members of a tournament with their GitHub name/avatar and running score.
export async function getMembers(tournamentId: string): Promise<MemberView[]> {
  const rows = await db
    .select({
      userId: tournamentMembers.userId,
      name: user.name,
      image: user.image,
      score: tournamentMembers.score,
      role: tournamentMembers.role,
      joinedAt: tournamentMembers.joinedAt,
    })
    .from(tournamentMembers)
    .innerJoin(user, eq(user.id, tournamentMembers.userId))
    .where(eq(tournamentMembers.tournamentId, tournamentId))
    .orderBy(tournamentMembers.joinedAt)
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    image: r.image,
    score: r.score,
    role: r.role,
  }))
}

// The permanent match log, newest first, with the claimant's GitHub name.
export async function getEvents(tournamentId: string): Promise<EventView[]> {
  const rows = await db
    .select({
      id: tournamentEvents.id,
      kind: tournamentEvents.kind,
      status: tournamentEvents.status,
      claimantUserId: tournamentEvents.claimantUserId,
      claimantName: user.name,
      resolvedByUserId: tournamentEvents.resolvedByUserId,
      createdAt: tournamentEvents.createdAt,
      resolvedAt: tournamentEvents.resolvedAt,
    })
    .from(tournamentEvents)
    .innerJoin(user, eq(user.id, tournamentEvents.claimantUserId))
    .where(eq(tournamentEvents.tournamentId, tournamentId))
    .orderBy(desc(tournamentEvents.createdAt))
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    claimantUserId: r.claimantUserId,
    claimantName: r.claimantName,
    resolvedByUserId: r.resolvedByUserId,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  }))
}

export async function getPendingEvent(tournamentId: string) {
  return db.query.tournamentEvents.findFirst({
    where: and(
      eq(tournamentEvents.tournamentId, tournamentId),
      eq(tournamentEvents.status, "pending"),
    ),
    orderBy: desc(tournamentEvents.createdAt),
  })
}

export async function getMembership(tournamentId: string, userId: string) {
  return db.query.tournamentMembers.findFirst({
    where: and(
      eq(tournamentMembers.tournamentId, tournamentId),
      eq(tournamentMembers.userId, userId),
    ),
  })
}

// ntfy topics for a tournament's members (optionally excluding one user, e.g. the
// claimant who does not need to be told about their own claim).
export async function getMemberTopics(
  tournamentId: string,
  excludeUserId?: string,
): Promise<string[]> {
  const rows = await db
    .select({ topic: userSettings.ntfyTopic, userId: tournamentMembers.userId })
    .from(tournamentMembers)
    .innerJoin(userSettings, eq(userSettings.userId, tournamentMembers.userId))
    .where(
      excludeUserId
        ? and(
            eq(tournamentMembers.tournamentId, tournamentId),
            ne(tournamentMembers.userId, excludeUserId),
          )
        : eq(tournamentMembers.tournamentId, tournamentId),
    )
  return rows.map((r) => r.topic).filter((t): t is string => Boolean(t))
}

type TournamentRow = typeof tournaments.$inferSelect

function tournamentBase(t: TournamentRow) {
  return {
    id: t.id,
    name: t.name,
    gameName: t.gameName,
    target: t.target,
    ownerId: t.ownerId,
    status: t.status as "active" | "completed",
    winnerUserId: t.winnerUserId,
    joinCode: t.joinCode,
    createdAt: t.createdAt.toISOString(),
    endedAt: t.endedAt ? t.endedAt.toISOString() : null,
  }
}

// Full detail for one tournament (members, permanent event log, current pending).
export async function buildDetail(tournamentId: string) {
  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) })
  if (!t) return null
  const [members, events] = await Promise.all([getMembers(tournamentId), getEvents(tournamentId)])
  const pending = events.find((e) => e.status === "pending") ?? null
  return { ...tournamentBase(t), inviteToken: t.inviteToken, members, events, pending }
}

// Summaries of every tournament a user belongs to (for the dashboard lists).
export async function listMyTournaments(userId: string) {
  const memberships = await db
    .select({ tournamentId: tournamentMembers.tournamentId })
    .from(tournamentMembers)
    .where(eq(tournamentMembers.userId, userId))
  const ids = memberships.map((m) => m.tournamentId)
  if (ids.length === 0) return []

  const [ts, allMembers, pendingEvents] = await Promise.all([
    db
      .select()
      .from(tournaments)
      .where(inArray(tournaments.id, ids))
      .orderBy(desc(tournaments.createdAt)),
    db
      .select({
        tournamentId: tournamentMembers.tournamentId,
        userId: tournamentMembers.userId,
        name: user.name,
        image: user.image,
        score: tournamentMembers.score,
        role: tournamentMembers.role,
        joinedAt: tournamentMembers.joinedAt,
      })
      .from(tournamentMembers)
      .innerJoin(user, eq(user.id, tournamentMembers.userId))
      .where(inArray(tournamentMembers.tournamentId, ids))
      .orderBy(tournamentMembers.joinedAt),
    db
      .select()
      .from(tournamentEvents)
      .where(
        and(inArray(tournamentEvents.tournamentId, ids), eq(tournamentEvents.status, "pending")),
      ),
  ])

  return ts.map((t) => {
    const members = allMembers
      .filter((m) => m.tournamentId === t.id)
      .map((m) => ({
        userId: m.userId,
        name: m.name,
        image: m.image,
        score: m.score,
        role: m.role,
      }))
    const pendingRow = pendingEvents.find((e) => e.tournamentId === t.id)
    const myScore = members.find((m) => m.userId === userId)?.score ?? 0
    return {
      ...tournamentBase(t),
      members,
      myScore,
      pending: pendingRow
        ? {
            id: pendingRow.id,
            kind: pendingRow.kind,
            claimantUserId: pendingRow.claimantUserId,
            createdAt: pendingRow.createdAt.toISOString(),
          }
        : null,
    }
  })
}

export type PlayerStats = {
  tournamentsPlayed: number
  tournamentsWon: number
  tournamentsLost: number
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  winPercentage: number
}

// Per-user statistics, aggregated across every tournament they belong to. Matches
// won/lost come from board scores (net of corrections/resets); tournament wins from
// completed outcomes.
export async function computeStats(userId: string): Promise<PlayerStats> {
  const memberships = await db
    .select({ tournamentId: tournamentMembers.tournamentId })
    .from(tournamentMembers)
    .where(eq(tournamentMembers.userId, userId))
  const ids = memberships.map((m) => m.tournamentId)
  const empty: PlayerStats = {
    tournamentsPlayed: 0,
    tournamentsWon: 0,
    tournamentsLost: 0,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    winPercentage: 0,
  }
  if (ids.length === 0) return empty

  const [ts, allMembers] = await Promise.all([
    db.select().from(tournaments).where(inArray(tournaments.id, ids)),
    db
      .select({ userId: tournamentMembers.userId, score: tournamentMembers.score })
      .from(tournamentMembers)
      .where(inArray(tournamentMembers.tournamentId, ids)),
  ])

  let matchesWon = 0
  let matchesLost = 0
  for (const m of allMembers) {
    if (m.userId === userId) matchesWon += m.score
    else matchesLost += m.score
  }
  const completed = ts.filter((t) => t.status === "completed")
  const tournamentsWon = completed.filter((t) => t.winnerUserId === userId).length
  const tournamentsLost = completed.filter(
    (t) => t.winnerUserId && t.winnerUserId !== userId,
  ).length
  const matchesPlayed = matchesWon + matchesLost
  return {
    tournamentsPlayed: ts.length,
    tournamentsWon,
    tournamentsLost,
    matchesPlayed,
    matchesWon,
    matchesLost,
    winPercentage: matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0,
  }
}
