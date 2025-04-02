CREATE TABLE `takes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` integer NOT NULL,
	`paused_at` integer,
	`completed_at` integer,
	`duration_minutes` integer DEFAULT 5 NOT NULL,
	`paused_time_ms` integer DEFAULT 0 NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
