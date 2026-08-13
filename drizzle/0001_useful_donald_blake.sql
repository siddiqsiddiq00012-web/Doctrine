CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`custom_display_name` text,
	`theme` text DEFAULT 'light' NOT NULL,
	`time_format` text DEFAULT '12h' NOT NULL,
	`week_start` text DEFAULT 'MONDAY' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
