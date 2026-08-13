CREATE TABLE `progress_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`weekly_review_id` text NOT NULL,
	`week_start_date` text NOT NULL,
	`category` text NOT NULL,
	`photo_url` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`weekly_review_id`) REFERENCES `weekly_reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_photos_review_cat_idx` ON `progress_photos` (`weekly_review_id`,`category`);--> statement-breakpoint
CREATE INDEX `progress_photos_user_idx` ON `progress_photos` (`user_id`);--> statement-breakpoint
CREATE TABLE `weekly_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week_start_date` text NOT NULL,
	`week_end_date` text NOT NULL,
	`body_weight_kg` real,
	`flexed_bicep_cm` real,
	`chest_cm` real,
	`thigh_cm` real,
	`morning_height_cm` real,
	`workout_performance` text DEFAULT 'STRONGER',
	`complexion` text DEFAULT 'BRIGHTER',
	`active_breakouts` integer DEFAULT 0,
	`hair_shedding` text DEFAULT 'LESS',
	`new_baby_hairs` integer DEFAULT true,
	`sleep_quality` text DEFAULT 'BETTER',
	`digestion` text DEFAULT 'BETTER',
	`energy_levels` text DEFAULT 'HIGHER',
	`protocol_compliance_pct` real DEFAULT 100,
	`verdict` text DEFAULT 'ON_TRACK',
	`refinement_notes` text DEFAULT '',
	`finances_saved` real DEFAULT 0,
	`finances_spent` real DEFAULT 0,
	`finances_what_on` text DEFAULT '',
	`finances_why` text DEFAULT '',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_reviews_user_week_idx` ON `weekly_reviews` (`user_id`,`week_start_date`);--> statement-breakpoint
CREATE INDEX `weekly_reviews_user_idx` ON `weekly_reviews` (`user_id`);--> statement-breakpoint
CREATE TABLE `weekly_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`weekly_review_id` text NOT NULL,
	`week_start_date` text NOT NULL,
	`summary` text NOT NULL,
	`completion_percentage` real DEFAULT 0 NOT NULL,
	`provider` text DEFAULT 'gemini' NOT NULL,
	`model` text DEFAULT 'gemini-2.5-flash' NOT NULL,
	`generated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`weekly_review_id`) REFERENCES `weekly_reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_summaries_user_week_idx` ON `weekly_summaries` (`user_id`,`week_start_date`);