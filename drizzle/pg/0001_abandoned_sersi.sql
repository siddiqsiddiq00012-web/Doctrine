CREATE TABLE "task_resource_requirements" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"task_key" text NOT NULL,
	"task_id" varchar(255),
	"resource_id" text NOT NULL,
	"quantity_consumed" double precision NOT NULL,
	"unit" text NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_resource_requirements" ADD CONSTRAINT "task_resource_requirements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_resource_requirements" ADD CONSTRAINT "task_resource_requirements_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_res_req_user_task_res_idx" ON "task_resource_requirements" USING btree ("user_id","task_key","resource_id");--> statement-breakpoint
CREATE INDEX "task_res_req_user_task_idx" ON "task_resource_requirements" USING btree ("user_id","task_key");--> statement-breakpoint
CREATE INDEX "task_res_req_user_resource_idx" ON "task_resource_requirements" USING btree ("user_id","resource_id");