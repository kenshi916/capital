CREATE TABLE `capital_admins` (
	`slot` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `capital_round_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_capital_audit_round` ON `capital_round_audit` (`round_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `capital_vote_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`wallet` text NOT NULL,
	`user_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`candidate` text NOT NULL,
	`weight` text NOT NULL,
	`typed_data` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_capital_challenge_user_time` ON `capital_vote_challenges` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `capital_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`revision` integer NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`mutation_id` text NOT NULL,
	`payload` text NOT NULL,
	`opens_at` integer NOT NULL,
	`closes_at` integer NOT NULL,
	`proposal_hash` text,
	`snapshot_number` integer,
	`snapshot_hash` text,
	`snapshot_time` integer,
	`final_results` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_capital_rounds_status` ON `capital_rounds` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_capital_round_parent` ON `capital_rounds` (`parent_id`);--> statement-breakpoint
CREATE TABLE `capital_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`wallet` text NOT NULL,
	`sequence` integer NOT NULL,
	`candidate` text NOT NULL,
	`weight` text NOT NULL,
	`signature` text NOT NULL,
	`typed_data` text NOT NULL,
	`accepted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_capital_vote_wallet_sequence` ON `capital_votes` (`round_id`,`wallet`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_capital_vote_round` ON `capital_votes` (`round_id`,`accepted_at`);