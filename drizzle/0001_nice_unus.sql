CREATE TABLE `alarmRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cabinetGroupId` int NOT NULL,
	`weightChangeRecordId` int NOT NULL,
	`alarmType` enum('threshold_exceeded','device_offline') NOT NULL,
	`alarmMessage` text NOT NULL,
	`isHandled` int NOT NULL DEFAULT 0,
	`handledBy` int,
	`handledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alarmRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cabinetGroups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`instrumentId` int NOT NULL,
	`initialWeight` int NOT NULL,
	`currentWeight` int NOT NULL,
	`alarmThreshold` int NOT NULL,
	`positionX` int NOT NULL DEFAULT 0,
	`positionY` int NOT NULL DEFAULT 0,
	`positionZ` int NOT NULL DEFAULT 0,
	`status` enum('normal','warning','alarm') NOT NULL DEFAULT 'normal',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cabinetGroups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gateways` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`port` int NOT NULL,
	`status` enum('online','offline') NOT NULL DEFAULT 'offline',
	`lastHeartbeat` timestamp,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gateways_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weighingInstruments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`gatewayId` int NOT NULL,
	`slaveAddress` int NOT NULL,
	`status` enum('online','offline') NOT NULL DEFAULT 'offline',
	`lastHeartbeat` timestamp,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weighingInstruments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weightChangeRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cabinetGroupId` int NOT NULL,
	`previousWeight` int NOT NULL,
	`currentWeight` int NOT NULL,
	`changeValue` int NOT NULL,
	`isAlarm` int NOT NULL DEFAULT 0,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weightChangeRecords_id` PRIMARY KEY(`id`)
);
