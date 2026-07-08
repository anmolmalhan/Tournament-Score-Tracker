CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"player1_name" text DEFAULT 'Player 1' NOT NULL,
	"player2_name" text DEFAULT 'Player 2' NOT NULL,
	"player1_score" integer DEFAULT 0 NOT NULL,
	"player2_score" integer DEFAULT 0 NOT NULL,
	"target" integer DEFAULT 11 NOT NULL,
	"player1_topic" text,
	"player2_topic" text,
	"player1_pin_hash" text,
	"player2_pin_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"kind" text NOT NULL,
	"claimant" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "result_requests" ADD CONSTRAINT "result_requests_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "result_requests_match_id_idx" ON "result_requests" USING btree ("match_id");