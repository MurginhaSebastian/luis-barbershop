CREATE TABLE "booking_confirmations" (
	"appointment_id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"confirm_by" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_confirmations" ADD CONSTRAINT "booking_confirmations_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_confirmations_code_idx" ON "booking_confirmations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "booking_confirmations_confirm_by_idx" ON "booking_confirmations" USING btree ("confirm_by");