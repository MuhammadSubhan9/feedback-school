CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`event` text NOT NULL,
	`actor` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_history_submission` ON `history` (`submission_id`);--> statement-breakpoint
CREATE INDEX `idx_history_created` ON `history` (`created_at`);--> statement-breakpoint
CREATE TABLE `internal_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`body` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notes_submission` ON `internal_notes` (`submission_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_expiry` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_code` text NOT NULL,
	`submission_key` text NOT NULL,
	`category` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`priority` text NOT NULL,
	`location` text,
	`status` text DEFAULT 'New' NOT NULL,
	`flags` text DEFAULT '[]' NOT NULL,
	`public_update` text DEFAULT '' NOT NULL,
	`last_mutation` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`resolved_at` text,
	`archived_at` text,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submissions_reference` ON `submissions` (`reference_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submissions_retry` ON `submissions` (`submission_key`);--> statement-breakpoint
CREATE INDEX `idx_submissions_status_created` ON `submissions` (`archived_at`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_submissions_updated` ON `submissions` (`updated_at`);