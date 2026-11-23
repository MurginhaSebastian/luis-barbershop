ALTER TABLE "barbers" ADD COLUMN "is_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "barbers_one_owner_idx" ON "barbers" USING btree ("is_owner") WHERE "barbers"."is_owner";
--> statement-breakpoint
UPDATE "barbers" SET "is_owner" = true WHERE "id" = (SELECT "id" FROM "barbers" WHERE "name" = 'Luis' LIMIT 1) AND NOT EXISTS (SELECT 1 FROM "barbers" WHERE "is_owner");
