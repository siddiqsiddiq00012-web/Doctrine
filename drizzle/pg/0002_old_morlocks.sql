CREATE TABLE "automation_processing_logs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"handler_id" text NOT NULL,
	"status" text NOT NULL,
	"error_details" text,
	"execution_duration_ms" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"event_type" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"payload" text NOT NULL,
	"correlation_id" text NOT NULL,
	"causation_id" text,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"occurred_at" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_processing_logs" ADD CONSTRAINT "automation_processing_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_processing_logs" ADD CONSTRAINT "automation_processing_logs_event_id_domain_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."domain_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auto_logs_user_evt_handler_idx" ON "automation_processing_logs" USING btree ("user_id","event_id","handler_id");--> statement-breakpoint
CREATE INDEX "auto_logs_user_event_idx" ON "automation_processing_logs" USING btree ("user_id","event_id");--> statement-breakpoint
CREATE INDEX "domain_events_user_type_idx" ON "domain_events" USING btree ("user_id","event_type");--> statement-breakpoint
CREATE INDEX "domain_events_user_corr_idx" ON "domain_events" USING btree ("user_id","correlation_id");--> statement-breakpoint
CREATE INDEX "domain_events_user_occ_idx" ON "domain_events" USING btree ("user_id","occurred_at");