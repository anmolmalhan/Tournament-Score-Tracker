ALTER TABLE "tournaments" ADD COLUMN "join_code" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_join_code_unique" UNIQUE("join_code");