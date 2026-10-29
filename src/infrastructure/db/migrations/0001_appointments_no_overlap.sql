-- Un barbero no puede tener dos citas que ocupan agenda solapadas, ni aunque lleguen a la vez.
-- Los estados deben coincidir con BLOCKING_STATUSES de src/core/entities/appointment.ts.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist ("barber_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" IN ('PENDING', 'CONFIRMED', 'COMPLETED'));
