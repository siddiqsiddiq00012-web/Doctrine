CREATE TABLE `daily_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`summary` text NOT NULL,
	`completion_percentage` real DEFAULT 0 NOT NULL,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`total_tasks_count` integer DEFAULT 0 NOT NULL,
	`provider` text DEFAULT 'gemini' NOT NULL,
	`model` text DEFAULT 'gemini-2.5-flash' NOT NULL,
	`generated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_summaries_user_date_idx` ON `daily_summaries` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `daily_summaries_user_idx` ON `daily_summaries` (`user_id`);