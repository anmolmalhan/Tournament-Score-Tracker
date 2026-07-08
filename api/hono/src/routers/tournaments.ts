import { sValidator } from "@hono/standard-validator"
import type { Session } from "@packages/auth"
import { db, tournamentEvents, tournamentMembers, tournaments } from "@packages/db"
import { env } from "@packages/env/api-hono"
import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import { z } from "zod"

import { ApiError, authErrorResponses, validationErrorResponses } from "@/lib/error"
import { sendNtfyAll } from "@/lib/ntfy"
import {
  buildDetail,
  generateJoinCode,
  getMembers,
  getMembership,
  getMemberTopics,
  getPendingEvent,
  listMyTournaments,
} from "@/lib/tournament"
import { authMiddleware } from "@/middlewares"

const MAX_LABEL = 40
const MAX_TARGET = 999
const KINDS = ["win", "undo", "reset"] as const
type Kind = (typeof KINDS)[number]

const webOrigin = env.HONO_TRUSTED_ORIGINS[0]

const createSchema = z.object({
  name: z.string().trim().min(1).max(MAX_LABEL).optional(),
  gameName: z.string().trim().max(MAX_LABEL).optional(),
  target: z.number().int().min(1).max(MAX_TARGET).optional(),
})
const requestSchema = z.object({ kind: z.enum(KINDS) })
const resolveSchema = z.object({ action: z.enum(["confirm", "reject"]) })
// Join by the short 4-digit code (from the dashboard) or the long link token.
const joinSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{4}$/)
      .optional(),
    token: z.string().trim().min(1).optional(),
  })
  .refine((v) => Boolean(v.code || v.token), { message: "Provide a code or an invite link" })

// --- OpenAPI shapes (kept loose; the RPC client derives exact types) ---
const memberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  score: z.number(),
  role: z.string(),
})
const eventSchema = z.object({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
  claimantUserId: z.string(),
  claimantName: z.string(),
  resolvedByUserId: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
})
const detailSchema = z.object({
  id: z.string(),
  name: z.string(),
  gameName: z.string(),
  target: z.number(),
  ownerId: z.string(),
  status: z.string(),
  winnerUserId: z.string().nullable(),
  joinCode: z.string().nullable(),
  createdAt: z.string(),
  endedAt: z.string().nullable(),
  inviteToken: z.string(),
  members: z.array(memberSchema),
  events: z.array(eventSchema),
  pending: z.any().nullable(),
})
const okDetail = {
  200: {
    description: "OK",
    content: { "application/json": { schema: resolver(z.object({ data: detailSchema })) } },
  },
  ...authErrorResponses,
}

async function requireMember(tournamentId: string, userId: string) {
  const member = await getMembership(tournamentId, userId)
  if (!member) {
    throw new ApiError(403, "FORBIDDEN", "You are not a member of this tournament")
  }
  return member
}

export const tournamentsRouter = new Hono<{ Variables: Session }>()
  .use("/*", authMiddleware)
  .get(
    "/",
    describeRoute({
      tags: ["Tournaments"],
      description: "List the tournaments the signed-in user belongs to (active and completed).",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(z.object({ data: z.object({ tournaments: z.array(z.any()) }) })),
            },
          },
        },
        ...authErrorResponses,
      },
    }),
    async (c) => {
      const u = c.get("user")
      const list = await listMyTournaments(u.id)
      return c.json({ data: { tournaments: list } })
    },
  )
  .post(
    "/",
    describeRoute({
      tags: ["Tournaments"],
      description: "Create a tournament. The creator becomes its owner and first member.",
      responses: { ...okDetail, ...validationErrorResponses },
    }),
    sValidator("json", createSchema, (result) => {
      if (!result.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid tournament", {
          issues: (result as { error?: unknown }).error,
        })
      }
    }),
    async (c) => {
      const u = c.get("user")
      const body = c.req.valid("json")
      const [created] = await db
        .insert(tournaments)
        .values({
          name: body.name ?? "My Tournament",
          gameName: body.gameName ?? "",
          target: body.target ?? 11,
          ownerId: u.id,
          joinCode: await generateJoinCode(),
        })
        .returning()
      await db
        .insert(tournamentMembers)
        .values({ tournamentId: created.id, userId: u.id, role: "owner" })
      const detail = await buildDetail(created.id)
      return c.json({ data: detail })
    },
  )
  .post(
    "/join",
    describeRoute({
      tags: ["Tournaments"],
      description: "Join a private tournament using its 4-digit code or invite token.",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(z.object({ data: z.object({ tournamentId: z.string() }) })),
            },
          },
        },
        ...validationErrorResponses,
        ...authErrorResponses,
      },
    }),
    sValidator("json", joinSchema, (result) => {
      if (!result.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid invite", {
          issues: (result as { error?: unknown }).error,
        })
      }
    }),
    async (c) => {
      const u = c.get("user")
      const { code, token } = c.req.valid("json") as { code?: string; token?: string }
      const tournament = await db.query.tournaments.findFirst({
        where: code ? eq(tournaments.joinCode, code) : eq(tournaments.inviteToken, token!),
      })
      if (!tournament) {
        throw new ApiError(
          404,
          "NOT_FOUND",
          code ? "No tournament found for that code" : "Invite not found",
        )
      }
      await db
        .insert(tournamentMembers)
        .values({ tournamentId: tournament.id, userId: u.id, role: "player" })
        .onConflictDoNothing()
      return c.json({ data: { tournamentId: tournament.id } })
    },
  )
  .get(
    "/:id",
    describeRoute({
      tags: ["Tournaments"],
      description: "Full detail of a tournament. Members only; others get 403.",
      responses: okDetail,
    }),
    async (c) => {
      const u = c.get("user")
      const id = c.req.param("id")
      await requireMember(id, u.id)
      const detail = await buildDetail(id)
      if (!detail) throw new ApiError(404, "NOT_FOUND", "Tournament not found")
      return c.json({ data: detail })
    },
  )
  .post(
    "/:id/invite",
    describeRoute({
      tags: ["Tournaments"],
      description: "Get the 4-digit join code and invite link for a tournament. Members only.",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  data: z.object({
                    code: z.string().nullable(),
                    token: z.string(),
                    url: z.string(),
                  }),
                }),
              ),
            },
          },
        },
        ...authErrorResponses,
      },
    }),
    async (c) => {
      const u = c.get("user")
      const id = c.req.param("id")
      await requireMember(id, u.id)
      const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) })
      if (!tournament) throw new ApiError(404, "NOT_FOUND", "Tournament not found")
      return c.json({
        data: {
          code: tournament.joinCode,
          token: tournament.inviteToken,
          url: `${webOrigin}/join/${tournament.inviteToken}`,
        },
      })
    },
  )
  .post(
    "/:id/requests",
    describeRoute({
      tags: ["Tournaments"],
      description:
        "Create a pending score request (win, undo, or reset). Members only. Notifies the other members. Does not change any score.",
      responses: { ...okDetail, ...validationErrorResponses },
    }),
    sValidator("json", requestSchema, (result) => {
      if (!result.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid request", {
          issues: (result as { error?: unknown }).error,
        })
      }
    }),
    async (c) => {
      const u = c.get("user")
      const id = c.req.param("id")
      const member = await requireMember(id, u.id)
      const { kind } = c.req.valid("json") as { kind: Kind }

      const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) })
      if (!tournament) throw new ApiError(404, "NOT_FOUND", "Tournament not found")
      if (tournament.status === "completed") {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          "This tournament is complete. Start a rematch to play again.",
        )
      }
      const existing = await getPendingEvent(id)
      if (existing) {
        throw new ApiError(400, "BAD_REQUEST", "A request is already pending confirmation")
      }
      if (kind === "undo" && member.score <= 0) {
        throw new ApiError(400, "BAD_REQUEST", "There are no wins to undo")
      }

      await db.insert(tournamentEvents).values({ tournamentId: id, kind, claimantUserId: u.id })

      const label = tournament.name
      const messages: Record<Kind, { title: string; message: string; tags: string[] }> = {
        win: {
          title: `Win claimed: ${label}`,
          message: `${u.name} claimed a win in ${label}. Open the tracker to confirm or reject.`,
          tags: ["crossed_swords"],
        },
        undo: {
          title: `Correction requested: ${label}`,
          message: `${u.name} wants to remove one of their wins in ${label}. Open the tracker to confirm or reject.`,
          tags: ["rewind"],
        },
        reset: {
          title: `Reset requested: ${label}`,
          message: `${u.name} requested a reset of ${label}. Open the tracker to confirm or reject.`,
          tags: ["arrows_counterclockwise"],
        },
      }
      const topics = await getMemberTopics(id, u.id)
      await sendNtfyAll(topics, { ...messages[kind], priority: "high" })

      const detail = await buildDetail(id)
      return c.json({ data: detail })
    },
  )
  .post(
    "/:id/requests/resolve",
    describeRoute({
      tags: ["Tournaments"],
      description:
        "Confirm or reject the pending request. Members only, and never the claimant (you cannot confirm your own claim). Only a confirm changes scores.",
      responses: { ...okDetail, ...validationErrorResponses },
    }),
    sValidator("json", resolveSchema, (result) => {
      if (!result.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid resolution", {
          issues: (result as { error?: unknown }).error,
        })
      }
    }),
    async (c) => {
      const u = c.get("user")
      const id = c.req.param("id")
      await requireMember(id, u.id)
      const { action } = c.req.valid("json")

      const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) })
      if (!tournament) throw new ApiError(404, "NOT_FOUND", "Tournament not found")
      const pending = await getPendingEvent(id)
      if (!pending) throw new ApiError(400, "BAD_REQUEST", "There is no pending request")
      // Core rule: you cannot confirm (or reject) your own claim.
      if (pending.claimantUserId === u.id) {
        throw new ApiError(403, "FORBIDDEN", "You cannot resolve your own claim")
      }

      const kind = pending.kind as Kind
      const label = tournament.name
      const topics = await getMemberTopics(id)

      if (action === "reject") {
        await db
          .update(tournamentEvents)
          .set({ status: "rejected", resolvedByUserId: u.id, resolvedAt: new Date() })
          .where(eq(tournamentEvents.id, pending.id))
        await sendNtfyAll(topics, {
          title: `Request rejected: ${label}`,
          message:
            kind === "reset"
              ? `Reset request rejected in ${label}. Scores unchanged.`
              : `Win request rejected in ${label}. Score was not changed.`,
          tags: ["x"],
        })
        const detail = await buildDetail(id)
        return c.json({ data: detail })
      }

      // Confirm: apply the effect. This is the only place a score changes.
      const claimant = await getMembership(id, pending.claimantUserId)
      if (kind === "reset") {
        await db
          .update(tournamentMembers)
          .set({ score: 0 })
          .where(eq(tournamentMembers.tournamentId, id))
      } else if (claimant) {
        const delta = kind === "win" ? 1 : -1
        const next = Math.max(0, claimant.score + delta)
        await db
          .update(tournamentMembers)
          .set({ score: next })
          .where(
            and(
              eq(tournamentMembers.tournamentId, id),
              eq(tournamentMembers.userId, pending.claimantUserId),
            ),
          )
      }
      await db
        .update(tournamentEvents)
        .set({ status: "confirmed", resolvedByUserId: u.id, resolvedAt: new Date() })
        .where(eq(tournamentEvents.id, pending.id))

      // Did this confirm decide the tournament?
      const members = await getMembers(id)
      const winner = members.find((m) => m.score >= tournament.target)
      if (winner && kind === "win") {
        await db
          .update(tournaments)
          // Release the join code so its 4-digit value can be reused elsewhere.
          .set({
            status: "completed",
            winnerUserId: winner.userId,
            joinCode: null,
            endedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tournaments.id, id))
      }

      const claimantView = members.find((m) => m.userId === pending.claimantUserId)
      const confirmMessage: Record<Kind, string> = {
        win: `Match confirmed in ${label}. ${claimantView?.name ?? "A player"} is now on ${claimantView?.score ?? 0}.`,
        undo: `Correction confirmed in ${label}. ${claimantView?.name ?? "A player"} is now on ${claimantView?.score ?? 0}.`,
        reset: `${label} was reset. All scores are back to 0.`,
      }
      await sendNtfyAll(topics, {
        title: `Confirmed: ${label}`,
        message: confirmMessage[kind],
        tags: ["white_check_mark"],
      })
      if (winner && kind === "win") {
        await sendNtfyAll(topics, {
          title: `Champion: ${label}`,
          message: `${winner.name} reached ${tournament.target} wins and won ${label}!`,
          tags: ["trophy"],
          priority: "max",
        })
      }

      const detail = await buildDetail(id)
      return c.json({ data: detail })
    },
  )
  .post(
    "/:id/rematch",
    describeRoute({
      tags: ["Tournaments"],
      description:
        "Start a new tournament carrying over this one's name, game, target, and members. Members only.",
      responses: okDetail,
    }),
    async (c) => {
      const u = c.get("user")
      const id = c.req.param("id")
      await requireMember(id, u.id)
      const source = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) })
      if (!source) throw new ApiError(404, "NOT_FOUND", "Tournament not found")

      const [created] = await db
        .insert(tournaments)
        .values({
          name: source.name,
          gameName: source.gameName,
          target: source.target,
          ownerId: source.ownerId,
          joinCode: await generateJoinCode(),
        })
        .returning()
      const sourceMembers = await getMembers(id)
      await db.insert(tournamentMembers).values(
        sourceMembers.map((m) => ({
          tournamentId: created.id,
          userId: m.userId,
          role: m.userId === source.ownerId ? "owner" : "player",
        })),
      )
      const detail = await buildDetail(created.id)
      return c.json({ data: detail })
    },
  )
  .delete(
    "/:id",
    describeRoute({
      tags: ["Tournaments"],
      description:
        "Permanently delete a tournament and its match history. Only the owner (who created it) may delete it.",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(z.object({ data: z.object({ deleted: z.boolean() }) })),
            },
          },
        },
        ...authErrorResponses,
      },
    }),
    async (c) => {
      const u = c.get("user")
      const id = c.req.param("id")
      const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) })
      if (!tournament) throw new ApiError(404, "NOT_FOUND", "Tournament not found")
      // Only the creator can delete; a player who merely joined cannot.
      if (tournament.ownerId !== u.id) {
        throw new ApiError(403, "FORBIDDEN", "Only the tournament owner can delete it")
      }
      // Cascades to members and the event log via the schema's onDelete: cascade.
      await db.delete(tournaments).where(eq(tournaments.id, id))
      return c.json({ data: { deleted: true } })
    },
  )
