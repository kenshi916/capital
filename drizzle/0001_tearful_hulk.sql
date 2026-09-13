CREATE TABLE `capital_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`body` text NOT NULL,
	`parent_id` integer,
	`created_at` integer NOT NULL,
	`hidden_at` integer,
	`hidden_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_capital_message_request` ON `capital_messages` (`user_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `idx_capital_message_user_time` ON `capital_messages` (`user_id`,`created_at`);