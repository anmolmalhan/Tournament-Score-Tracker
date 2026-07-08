import { sValidator } from "@hono/standard-validator"
import type { Session } from "@packages/auth"
import { db, userSettings } from "@packages/db"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import { z } from "zod"

import { ApiError, authErrorResponses, validationErrorResponses } from "@/lib/error"
import { sendNtfy } from "@/lib/ntfy"
import { computeStats } from "@/lib/tournament"
import { authMiddleware } from "@/middlewares"

const TOPIC_RE = /^[A-Za-z0-9_-]{1,64}$/

async function getSettings(userId: string) {
  return db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) })
}

const settingsSchema = z.object({
  // "" clears the topic; a non-empty value must match the ntfy charset.
  ntfyTopic: z.union([z.literal(""), z.string().trim().regex(TOPIC_RE)]),
})

const statsSchema = z.object({
  tournamentsPlayed: z.number(),
  tournamentsWon: z.number(),
  tournamentsLost: z.number(),
  matchesPlayed: z.number(),
  matchesWon: z.number(),
  matchesLost: z.number(),
  winPercentage: z.number(),
})

const meSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    email: z.string(),
  }),
  settings: z.object({ ntfyTopic: z.string().nullable() }),
  stats: statsSchema,
})

export const meRouter = new Hono<{ Variables: Session }>()
  .use("/*", authMiddleware)
  .get(
    "/",
    describeRoute({
      tags: ["Me"],
      description: "The signed-in GitHub user's profile, ntfy settings, and lifetime statistics.",
      responses: {
        200: {
          description: "OK",
          content: { "application/json": { schema: resolver(z.object({ data: meSchema })) } },
        },
        ...authErrorResponses,
      },
    }),
    async (c) => {
      const u = c.get("user")
      const [settings, stats] = await Promise.all([getSettings(u.id), computeStats(u.id)])
      return c.json({
        data: {
          user: { id: u.id, name: u.name, image: u.image ?? null, email: u.email },
          settings: { ntfyTopic: settings?.ntfyTopic ?? null },
          stats,
        },
      })
    },
  )
  .put(
    "/settings",
    describeRoute({
      tags: ["Me"],
      description: "Update the signed-in user's ntfy topic (where they receive push alerts).",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(z.object({ data: z.object({ ntfyTopic: z.string().nullable() }) })),
            },
          },
        },
        ...validationErrorResponses,
        ...authErrorResponses,
      },
    }),
    sValidator("json", settingsSchema, (result) => {
      if (!result.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid ntfy topic", {
          issues: (result as { error?: unknown }).error,
        })
      }
    }),
    async (c) => {
      const u = c.get("user")
      const { ntfyTopic } = c.req.valid("json")
      const value = ntfyTopic || null
      await db
        .insert(userSettings)
        .values({ userId: u.id, ntfyTopic: value })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: { ntfyTopic: value, updatedAt: new Date() },
        })
      return c.json({ data: { ntfyTopic: value } })
    },
  )
  .post(
    "/notify-test",
    describeRoute({
      tags: ["Me"],
      description: "Send a test notification to the signed-in user's ntfy topic.",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(z.object({ data: z.object({ message: z.string() }) })),
            },
          },
        },
        ...authErrorResponses,
      },
    }),
    async (c) => {
      const u = c.get("user")
      const settings = await getSettings(u.id)
      if (!settings?.ntfyTopic) {
        throw new ApiError(400, "BAD_REQUEST", "Set an ntfy topic first")
      }
      await sendNtfy(settings.ntfyTopic, {
        title: "Match Tracker",
        message: `Test notification for ${u.name}. Notifications are working.`,
        tags: ["bell"],
      })
      return c.json({ data: { message: "sent" } })
    },
  )
