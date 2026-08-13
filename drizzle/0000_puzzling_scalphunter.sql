CREATE TABLE `daily_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`doctrine_version_id` text,
	`day_of_week` text,
	`water_liters` real DEFAULT 0 NOT NULL,
	`tahajjud` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`doctrine_version_id`) REFERENCES `doctrine_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_executions_user_date_idx` ON `daily_executions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `daily_executions_user_idx` ON `daily_executions` (`user_id`);--> statement-breakpoint
CREATE INDEX `daily_executions_date_idx` ON `daily_executions` (`date`);--> statement-breakpoint
CREATE TABLE `doctrine_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`version_number` integer DEFAULT 1 NOT NULL,
	`title` text DEFAULT 'Doctrine v1' NOT NULL,
	`payload` text NOT NULL,
	`active_from` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `doctrine_versions_user_idx` ON `doctrine_versions` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `task_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`daily_execution_id` text NOT NULL,
	`task_key` text NOT NULL,
	`category` text NOT NULL,
	`task_name` text,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`daily_execution_id`) REFERENCES `daily_executions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_executions_daily_exec_idx` ON `task_executions` (`daily_execution_id`);--> statement-breakpoint
CREATE INDEX `task_executions_key_idx` ON `task_executions` (`daily_execution_id`,`task_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_login_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_idx` ON `users` (`google_id`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);