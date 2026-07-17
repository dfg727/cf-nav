CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pid` integer,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`is_public` integer DEFAULT true,
	`is_expand` integer DEFAULT false,
	`status` integer DEFAULT 1,
	`created_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_categories_pid` ON `categories` (`pid`);--> statement-breakpoint
CREATE INDEX `idx_categories_public_status_sort` ON `categories` (`is_public`,`status`,`sort_order`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`inner_url` text,
	`description` text,
	`icon` text,
	`tags` text,
	`status` integer DEFAULT 1,
	`is_public` integer DEFAULT true,
	`sort_order` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sites_category_id` ON `sites` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_sites_public_status_sort` ON `sites` (`is_public`,`status`,`sort_order`);