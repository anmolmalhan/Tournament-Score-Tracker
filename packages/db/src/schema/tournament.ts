import { index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"

import { user } from "@/schema/auth"

// A tournament is owned by a GitHub user and is private to its invited members.
// Everything (scores, the match log, stats) is keyed to GitHub-backed user ids.
export const tournaments = pgTable("tournaments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().default("My Tournament"),
  gameName: text("game_name").notNull().default(""),
  target: integer("target").notNull().default(11),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // "active" (ongoing) or "completed" (a winner reached the target). History is permanent.
  status: text("status").notNull().default("active"),
  winnerUserId: text("winner_user_id").references(() => user.id, { onDelete: "set null" }),
  // Long random join token; only holders of the link can join this private tournament.
  inviteToken: text("invite_token")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  // Short 4-digit code a friend can type to join. Unique among tournaments that
  // currently accept joins; cleared (set null) when the tournament completes.
  joinCode: text("join_code").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// The GitHub users taking part in a tournament, each with their own running score.
export const tournamentMembers = pgTable(
  "tournament_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    score: integer("score").notNull().default(0),
    role: text("role").notNull().default("player"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [
    unique("tournament_members_tournament_user_uq").on(t.tournamentId, t.userId),
    index("tournament_members_tournament_id_idx").on(t.tournamentId),
    index("tournament_members_user_id_idx").on(t.userId),
  ],
)

// The permanent match-by-match log: every win claim, correction, and reset request,
// with who claimed it, who resolved it, and the outcome. Never deleted.
export const tournamentEvents = pgTable(
  "tournament_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "win" | "undo" | "reset"
    claimantUserId: text("claimant_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // "pending" | "confirmed" | "rejected"
    // Who confirmed or rejected it (never the claimant: you cannot confirm your own claim).
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [index("tournament_events_tournament_id_idx").on(t.tournamentId)],
)

// Per-user preferences. ntfy topic is where this user receives push notifications
// across all their tournaments. Stored server-side, never exposed to other users.
export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  ntfyTopic: text("ntfy_topic"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
