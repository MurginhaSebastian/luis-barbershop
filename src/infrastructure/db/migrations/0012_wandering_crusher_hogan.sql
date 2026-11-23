ALTER TABLE "barbers" ADD COLUMN "areas" text[] DEFAULT '{barberia}' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "area" text DEFAULT 'barberia' NOT NULL;--> statement-breakpoint
ALTER TABLE "barbers" ADD CONSTRAINT "barbers_areas_valid" CHECK (cardinality("barbers"."areas") > 0 and "barbers"."areas" <@ array['barberia','spa']);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_area_valid" CHECK ("services"."area" in ('barberia','spa'));