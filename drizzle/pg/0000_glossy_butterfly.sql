CREATE TABLE "cart_items" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"item_name" text NOT NULL,
	"resource_id" text,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"estimated_price_paise" bigint NOT NULL,
	"target_purchase_date" text,
	"financial_goal_id" varchar(255),
	"priority" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_adaptations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"daily_execution_id" varchar(255) NOT NULL,
	"date" text NOT NULL,
	"capacity_mode" text NOT NULL,
	"available_minutes" integer,
	"reason" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_executions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"date" text NOT NULL,
	"doctrine_version_id" varchar(255),
	"day_of_week" text,
	"water_liters" double precision DEFAULT 0 NOT NULL,
	"tahajjud" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"current_capacity_mode" text DEFAULT 'NORMAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_summaries" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"date" text NOT NULL,
	"summary" text NOT NULL,
	"completion_percentage" double precision DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"total_tasks_count" integer DEFAULT 0 NOT NULL,
	"provider" text DEFAULT 'gemini' NOT NULL,
	"model" text DEFAULT 'gemini-2.5-flash' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "de_learning_sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"date" text NOT NULL,
	"module_name" text NOT NULL,
	"topic_name" text NOT NULL,
	"subtopic_name" text NOT NULL,
	"planned_minutes" integer DEFAULT 60 NOT NULL,
	"actual_minutes" integer DEFAULT 0 NOT NULL,
	"learning_resource" text DEFAULT '' NOT NULL,
	"what_i_learned" text NOT NULL,
	"confidence_rating" integer DEFAULT 3 NOT NULL,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"active_recall_text" text DEFAULT '',
	"code_evidence" text DEFAULT '',
	"ai_evaluation_text" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctrine_versions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"title" text DEFAULT 'Doctrine v1' NOT NULL,
	"payload" text NOT NULL,
	"active_from" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_decisions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"recommendation_type" text NOT NULL,
	"payload" text NOT NULL,
	"date" text NOT NULL,
	"user_decision" text DEFAULT 'PENDING' NOT NULL,
	"cart_item_id" varchar(255),
	"financial_goal_id" varchar(255),
	"purchase_record_id" varchar(255),
	"outcome" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_goals" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"target_price_paise" bigint NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"urgency" text DEFAULT 'MEDIUM' NOT NULL,
	"deadline_date" text,
	"desired_purchase_date" text,
	"allocated_amount_paise" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_preferences" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"daily_workday_income_paise" bigint DEFAULT 22000 NOT NULL,
	"transport_daily_cost_paise" bigint DEFAULT 5000 NOT NULL,
	"transport_reserve_day" text DEFAULT 'THURSDAY' NOT NULL,
	"transport_reserve_amount_paise" bigint DEFAULT 10000 NOT NULL,
	"workdays_json" text DEFAULT '["MONDAY","TUESDAY","WEDNESDAY","THURSDAY"]' NOT NULL,
	"weekly_budget_limit_paise" bigint DEFAULT 0 NOT NULL,
	"auto_approve_threshold_paise" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"amount_paise" bigint NOT NULL,
	"date" text NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"financial_goal_id" varchar(255),
	"cart_item_id" varchar(255),
	"purchase_record_id" varchar(255),
	"resource_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_milestones" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"goal_id" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"target_value" double precision DEFAULT 1 NOT NULL,
	"current_value" double precision DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" text,
	"due_date" text,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_task_mappings" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"goal_id" varchar(255) NOT NULL,
	"milestone_id" varchar(255),
	"task_key" text NOT NULL,
	"category" text,
	"weight" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"parent_id" varchar(255),
	"life_area_id" varchar(255),
	"level" text DEFAULT 'GOAL' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"target_date" text,
	"financial_goal_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_areas" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"is_system_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_photos" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"weekly_review_id" varchar(255) NOT NULL,
	"week_start_date" text NOT NULL,
	"category" text NOT NULL,
	"photo_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_records" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"cart_item_id" varchar(255),
	"financial_transaction_id" varchar(255),
	"resource_id" text,
	"item_name" text NOT NULL,
	"quantity" double precision NOT NULL,
	"actual_price_paise" bigint NOT NULL,
	"purchase_date" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"resource_id" text NOT NULL,
	"resource_name" text NOT NULL,
	"event_type" text NOT NULL,
	"amount" double precision NOT NULL,
	"unit" text NOT NULL,
	"date" text NOT NULL,
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_stock" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"resource_id" text NOT NULL,
	"current_qty" double precision NOT NULL,
	"in_cart" boolean DEFAULT false NOT NULL,
	"last_purchased" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_entries" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"schedule_id" varchar(255) NOT NULL,
	"task_id" varchar(255) NOT NULL,
	"timing_type" text NOT NULL,
	"recurrence_pattern" text NOT NULL,
	"day_of_week" text,
	"active_date" text,
	"start_minutes" integer,
	"end_minutes" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active_from_date" text,
	"active_to_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"sess" text,
	"expires_at" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_executions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"daily_execution_id" varchar(255) NOT NULL,
	"task_key" text NOT NULL,
	"category" text NOT NULL,
	"task_name" text,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"completed_at" text,
	"deferred_to_date" text,
	"source_task_execution_id" varchar(255),
	"task_id" varchar(255),
	"schedule_entry_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_failure_reasons" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"task_execution_id" varchar(255),
	"date" text NOT NULL,
	"task_key" text NOT NULL,
	"task_name" text,
	"category" text,
	"reason" text NOT NULL,
	"user_note" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"task_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"default_priority" integer NOT NULL,
	"default_duration_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"custom_display_name" text,
	"bio" text DEFAULT '',
	"custom_avatar_url" text,
	"theme" text DEFAULT 'light' NOT NULL,
	"time_format" text DEFAULT '12h' NOT NULL,
	"week_start" text DEFAULT 'MONDAY' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"google_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"week_start_date" text NOT NULL,
	"week_end_date" text NOT NULL,
	"body_weight_kg" double precision,
	"flexed_bicep_cm" double precision,
	"chest_cm" double precision,
	"thigh_cm" double precision,
	"morning_height_cm" double precision,
	"workout_performance" text DEFAULT 'STRONGER',
	"complexion" text DEFAULT 'BRIGHTER',
	"active_breakouts" integer DEFAULT 0,
	"hair_shedding" text DEFAULT 'LESS',
	"new_baby_hairs" boolean DEFAULT true,
	"sleep_quality" text DEFAULT 'BETTER',
	"digestion" text DEFAULT 'BETTER',
	"energy_levels" text DEFAULT 'HIGHER',
	"protocol_compliance_pct" double precision DEFAULT 100,
	"verdict" text DEFAULT 'ON_TRACK',
	"refinement_notes" text DEFAULT '',
	"finances_saved" double precision DEFAULT 0,
	"finances_spent" double precision DEFAULT 0,
	"finances_what_on" text DEFAULT '',
	"finances_why" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_summaries" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"weekly_review_id" varchar(255) NOT NULL,
	"week_start_date" text NOT NULL,
	"summary" text NOT NULL,
	"completion_percentage" double precision DEFAULT 0 NOT NULL,
	"provider" text DEFAULT 'gemini' NOT NULL,
	"model" text DEFAULT 'gemini-2.5-flash' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_financial_goal_id_financial_goals_id_fk" FOREIGN KEY ("financial_goal_id") REFERENCES "public"."financial_goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_adaptations" ADD CONSTRAINT "daily_adaptations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_adaptations" ADD CONSTRAINT "daily_adaptations_daily_execution_id_daily_executions_id_fk" FOREIGN KEY ("daily_execution_id") REFERENCES "public"."daily_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_executions" ADD CONSTRAINT "daily_executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_executions" ADD CONSTRAINT "daily_executions_doctrine_version_id_doctrine_versions_id_fk" FOREIGN KEY ("doctrine_version_id") REFERENCES "public"."doctrine_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "de_learning_sessions" ADD CONSTRAINT "de_learning_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctrine_versions" ADD CONSTRAINT "doctrine_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_decisions" ADD CONSTRAINT "financial_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_decisions" ADD CONSTRAINT "financial_decisions_cart_item_id_cart_items_id_fk" FOREIGN KEY ("cart_item_id") REFERENCES "public"."cart_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_decisions" ADD CONSTRAINT "financial_decisions_financial_goal_id_financial_goals_id_fk" FOREIGN KEY ("financial_goal_id") REFERENCES "public"."financial_goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_decisions" ADD CONSTRAINT "financial_decisions_purchase_record_id_purchase_records_id_fk" FOREIGN KEY ("purchase_record_id") REFERENCES "public"."purchase_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_preferences" ADD CONSTRAINT "financial_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_financial_goal_id_financial_goals_id_fk" FOREIGN KEY ("financial_goal_id") REFERENCES "public"."financial_goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_cart_item_id_cart_items_id_fk" FOREIGN KEY ("cart_item_id") REFERENCES "public"."cart_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_purchase_record_id_purchase_records_id_fk" FOREIGN KEY ("purchase_record_id") REFERENCES "public"."purchase_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_task_mappings" ADD CONSTRAINT "goal_task_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_task_mappings" ADD CONSTRAINT "goal_task_mappings_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_task_mappings" ADD CONSTRAINT "goal_task_mappings_milestone_id_goal_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."goal_milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_id_goals_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_financial_goal_id_financial_goals_id_fk" FOREIGN KEY ("financial_goal_id") REFERENCES "public"."financial_goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_areas" ADD CONSTRAINT "life_areas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_weekly_review_id_weekly_reviews_id_fk" FOREIGN KEY ("weekly_review_id") REFERENCES "public"."weekly_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_cart_item_id_cart_items_id_fk" FOREIGN KEY ("cart_item_id") REFERENCES "public"."cart_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_financial_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("financial_transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_events" ADD CONSTRAINT "resource_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_stock" ADD CONSTRAINT "resource_stock_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_daily_execution_id_daily_executions_id_fk" FOREIGN KEY ("daily_execution_id") REFERENCES "public"."daily_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_source_task_execution_id_task_executions_id_fk" FOREIGN KEY ("source_task_execution_id") REFERENCES "public"."task_executions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_schedule_entry_id_schedule_entries_id_fk" FOREIGN KEY ("schedule_entry_id") REFERENCES "public"."schedule_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_failure_reasons" ADD CONSTRAINT "task_failure_reasons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_failure_reasons" ADD CONSTRAINT "task_failure_reasons_task_execution_id_task_executions_id_fk" FOREIGN KEY ("task_execution_id") REFERENCES "public"."task_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_weekly_review_id_weekly_reviews_id_fk" FOREIGN KEY ("weekly_review_id") REFERENCES "public"."weekly_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cart_items_user_status_idx" ON "cart_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "cart_items_user_resource_idx" ON "cart_items" USING btree ("user_id","resource_id");--> statement-breakpoint
CREATE INDEX "cart_items_user_goal_idx" ON "cart_items" USING btree ("user_id","financial_goal_id");--> statement-breakpoint
CREATE INDEX "daily_adaptations_user_date_idx" ON "daily_adaptations" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "daily_adaptations_daily_exec_idx" ON "daily_adaptations" USING btree ("daily_execution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_executions_user_date_idx" ON "daily_executions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "daily_executions_user_idx" ON "daily_executions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_executions_date_idx" ON "daily_executions" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_summaries_user_date_idx" ON "daily_summaries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "daily_summaries_user_idx" ON "daily_summaries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "de_learning_sessions_user_subtopic_idx" ON "de_learning_sessions" USING btree ("user_id","subtopic_name");--> statement-breakpoint
CREATE INDEX "de_learning_sessions_date_idx" ON "de_learning_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "doctrine_versions_user_idx" ON "doctrine_versions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "financial_decisions_user_date_idx" ON "financial_decisions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "financial_decisions_user_decision_idx" ON "financial_decisions" USING btree ("user_id","user_decision");--> statement-breakpoint
CREATE INDEX "financial_goals_user_status_idx" ON "financial_goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "financial_goals_user_priority_idx" ON "financial_goals" USING btree ("user_id","priority");--> statement-breakpoint
CREATE INDEX "financial_transactions_user_date_idx" ON "financial_transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "financial_transactions_user_cat_idx" ON "financial_transactions" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "financial_transactions_user_goal_idx" ON "financial_transactions" USING btree ("user_id","financial_goal_id");--> statement-breakpoint
CREATE INDEX "goal_milestones_goal_idx" ON "goal_milestones" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goal_milestones_user_idx" ON "goal_milestones" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goal_task_mappings_goal_task_idx" ON "goal_task_mappings" USING btree ("goal_id","task_key");--> statement-breakpoint
CREATE INDEX "goal_task_mappings_milestone_idx" ON "goal_task_mappings" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "goal_task_mappings_user_task_idx" ON "goal_task_mappings" USING btree ("user_id","task_key");--> statement-breakpoint
CREATE INDEX "goals_user_status_idx" ON "goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "goals_user_area_idx" ON "goals" USING btree ("user_id","life_area_id");--> statement-breakpoint
CREATE INDEX "goals_parent_idx" ON "goals" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "life_areas_user_key_idx" ON "life_areas" USING btree ("user_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_photos_review_cat_idx" ON "progress_photos" USING btree ("weekly_review_id","category");--> statement-breakpoint
CREATE INDEX "progress_photos_user_idx" ON "progress_photos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "purchase_records_user_date_idx" ON "purchase_records" USING btree ("user_id","purchase_date");--> statement-breakpoint
CREATE INDEX "purchase_records_user_resource_idx" ON "purchase_records" USING btree ("user_id","resource_id");--> statement-breakpoint
CREATE INDEX "resource_events_user_res_idx" ON "resource_events" USING btree ("user_id","resource_id");--> statement-breakpoint
CREATE INDEX "resource_events_user_date_idx" ON "resource_events" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_stock_user_res_idx" ON "resource_stock" USING btree ("user_id","resource_id");--> statement-breakpoint
CREATE INDEX "schedule_entries_sched_day_idx" ON "schedule_entries" USING btree ("schedule_id","day_of_week");--> statement-breakpoint
CREATE INDEX "schedule_entries_task_idx" ON "schedule_entries" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "schedules_user_idx" ON "schedules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "task_executions_daily_exec_idx" ON "task_executions" USING btree ("daily_execution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_executions_key_idx" ON "task_executions" USING btree ("daily_execution_id","task_key");--> statement-breakpoint
CREATE INDEX "task_executions_source_task_idx" ON "task_executions" USING btree ("source_task_execution_id");--> statement-breakpoint
CREATE INDEX "task_executions_task_id_idx" ON "task_executions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_executions_sched_entry_idx" ON "task_executions" USING btree ("schedule_entry_id");--> statement-breakpoint
CREATE INDEX "task_failure_reasons_user_date_idx" ON "task_failure_reasons" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "task_failure_reasons_user_task_idx" ON "task_failure_reasons" USING btree ("user_id","task_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_user_task_key_idx" ON "tasks" USING btree ("user_id","task_key");--> statement-breakpoint
CREATE INDEX "tasks_user_idx" ON "tasks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_id_idx" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reviews_user_week_idx" ON "weekly_reviews" USING btree ("user_id","week_start_date");--> statement-breakpoint
CREATE INDEX "weekly_reviews_user_idx" ON "weekly_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_summaries_user_week_idx" ON "weekly_summaries" USING btree ("user_id","week_start_date");