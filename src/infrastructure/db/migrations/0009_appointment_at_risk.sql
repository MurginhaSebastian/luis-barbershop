ALTER TYPE "public"."appointment_status" ADD VALUE 'AT_RISK';--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
-- Solo PENDING y CONFIRMED ocupan agenda: una cita en riesgo (AT_RISK) deja que otro cliente tome su hueco.
-- Los estados deben coincidir con BLOCKING_STATUSES de src/core/entities/appointment.ts.
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_no_overlap";--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist ("barber_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));
