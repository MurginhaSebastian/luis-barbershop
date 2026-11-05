-- Las citas ya guardadas toman el nombre de su cliente; desde ahora cada cita guarda el suyo.
ALTER TABLE "appointments" ADD COLUMN "customer_name" text;
--> statement-breakpoint
UPDATE "appointments" a SET "customer_name" = c."name" FROM "customers" c WHERE c."id" = a."customer_id";
--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "customer_name" SET NOT NULL;
