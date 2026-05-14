CREATE TABLE `analysis_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`period_type` enum('all','year','quarter','month','custom') NOT NULL,
	`start_date` timestamp NOT NULL,
	`end_date` timestamp NOT NULL,
	`summary` text,
	`insights_json` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysis_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `golf_course_holes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`golf_course_id` int NOT NULL,
	`hole_number` int NOT NULL,
	`par` int NOT NULL,
	`handicap_index` int,
	`yardage` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `golf_course_holes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `golf_courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`club_name` varchar(255) NOT NULL,
	`course_name` varchar(255) NOT NULL,
	`source_url` text,
	`verified_status` enum('verified','unverified','pending') NOT NULL DEFAULT 'unverified',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `golf_courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scorecard_holes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scorecard_id` int NOT NULL,
	`hole_number` int NOT NULL,
	`strokes` int,
	`par` int,
	`matched_course_hole_id` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scorecard_holes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scorecards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`played_at` timestamp NOT NULL,
	`golf_club_name` varchar(255),
	`course_name` varchar(255),
	`golf_course_id` int,
	`source_type` enum('image','file','manual') NOT NULL,
	`original_file_url` text,
	`ocr_status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`review_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`total_score` int,
	`front_nine_score` int,
	`back_nine_score` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scorecards_id` PRIMARY KEY(`id`)
);
