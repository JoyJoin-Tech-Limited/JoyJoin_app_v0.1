CREATE TABLE "subscribe_message_sends" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"pool_id" varchar NOT NULL,
	"moment" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"errcode" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "subscribe_message_sends_user_moment_pool_uniq" UNIQUE("user_id","moment","pool_id")
);
--> statement-breakpoint
ALTER TABLE "subscribe_message_sends" ADD CONSTRAINT "subscribe_message_sends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscribe_message_sends_pool_idx" ON "subscribe_message_sends" USING btree ("pool_id");