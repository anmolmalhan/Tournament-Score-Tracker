ALTER TABLE "matches" ADD COLUMN "tournament_name" text DEFAULT 'My Tournament' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "game_name" text DEFAULT '' NOT NULL;