CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`is_public` integer DEFAULT true,
	`is_expand` integer DEFAULT false,
	`status` integer DEFAULT 1,
	`created_at` integer
);
--> statement-breakpoint
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
