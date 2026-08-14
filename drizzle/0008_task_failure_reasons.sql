CREATE TABLE `task_failure_reasons` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`task_execution_id` text,
	`date` text NOT NULL,
	`task_key` text NOT NULL,
	`task_name` text,
	`category` text,
	`reason` text NOT NULL,
	`user_note` text DEFAULT '',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_execution_id`) REFERENCES `task_executions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_failure_reasons_user_date_idx` ON `task_failure_reasons` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `task_failure_reasons_user_task_idx` ON `task_failure_reasons` (`user_id`,`task_key`);
