CREATE TABLE `capital_company_interest` (
	`user_id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_capital_interest_company` ON `capital_company_interest` (`company_id`);