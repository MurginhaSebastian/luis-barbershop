CREATE TABLE "assistant_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "assistant_messages_role" CHECK ("assistant_messages"."role" IN ('user', 'assistant'))
);
--> statement-breakpoint
CREATE INDEX "assistant_messages_phone_idx" ON "assistant_messages" USING btree ("phone","created_at");