CREATE TABLE `alarmLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alarmRecordId` int NOT NULL,
	`operationType` enum('acknowledge','ignore','resolve','auto_resolve') NOT NULL,
	`operatorId` int,
	`remark` text,
	`operatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alarmLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `alarmRecords` MODIFY COLUMN `alarmType` enum('overweight','offline') NOT NULL;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `instrumentId` int;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `channelId` int;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `rawValue` float;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `calibratedValue` float;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `threshold` float;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `exceedValue` float;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `handlingStatus` enum('pending','handled','auto_resolved') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `alarmLogId` int;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `firstOccurredAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `lastOccurredAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `occurrenceCount` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `alarmRecords` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `alarmRecords` DROP COLUMN `weightChangeRecordId`;--> statement-breakpoint
ALTER TABLE `alarmRecords` DROP COLUMN `alarmMessage`;--> statement-breakpoint
ALTER TABLE `alarmRecords` DROP COLUMN `isHandled`;--> statement-breakpoint
ALTER TABLE `alarmRecords` DROP COLUMN `handledBy`;--> statement-breakpoint
ALTER TABLE `alarmRecords` DROP COLUMN `handledAt`;--> statement-breakpoint
ALTER TABLE `gateways` DROP COLUMN `ipAddress`;--> statement-breakpoint
ALTER TABLE `gateways` DROP COLUMN `port`;