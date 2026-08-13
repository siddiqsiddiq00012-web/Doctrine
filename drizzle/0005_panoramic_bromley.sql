CREATE TABLE `de_learning_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`module_name` text NOT NULL,
	`topic_name` text NOT NULL,
	`subtopic_name` text NOT NULL,
	`planned_minutes` integer DEFAULT 60 NOT NULL,
	`actual_minutes` integer DEFAULT 0 NOT NULL,
	`learning_resource` text DEFAULT '' NOT NULL,
	`what_i_learned` text NOT NULL,
	`confidence_rating` integer DEFAULT 3 NOT NULL,
	`status` text DEFAULT 'COMPLETED' NOT NULL,
	`active_recall_text` text DEFAULT '',
	`code_evidence` text DEFAULT '',
	`ai_evaluation_text` text DEFAULT '',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `de_learning_sessions_user_subtopic_idx` ON `de_learning_sessions` (`user_id`,`subtopic_name`);--> statement-breakpoint
CREATE INDEX `de_learning_sessions_date_idx` ON `de_learning_sessions` (`user_id`,`date`);