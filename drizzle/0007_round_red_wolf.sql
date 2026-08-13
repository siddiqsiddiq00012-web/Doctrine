CREATE TABLE `resource_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`resource_name` text NOT NULL,
	`event_type` text NOT NULL,
	`amount` real NOT NULL,
	`unit` text NOT NULL,
	`date` text NOT NULL,
	`notes` text DEFAULT '',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `resource_events_user_res_idx` ON `resource_events` (`user_id`,`resource_id`);--> statement-breakpoint
CREATE INDEX `resource_events_user_date_idx` ON `resource_events` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `resource_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`current_qty` real NOT NULL,
	`in_cart` integer DEFAULT false NOT NULL,
	`last_purchased` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_stock_user_res_idx` ON `resource_stock` (`user_id`,`resource_id`);