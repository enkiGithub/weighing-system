CREATE TABLE `collectionData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instrumentId` int NOT NULL,
	`channelId` int NOT NULL,
	`rawValue` float NOT NULL,
	`calibratedValue` float NOT NULL,
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collectionData_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deviceConnectionStatus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`comPortId` int NOT NULL,
	`status` enum('online','offline') NOT NULL DEFAULT 'offline',
	`lastSuccessAt` timestamp,
	`lastFailureAt` timestamp,
	`failureReason` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deviceConnectionStatus_id` PRIMARY KEY(`id`),
	CONSTRAINT `deviceConnectionStatus_comPortId_unique` UNIQUE(`comPortId`)
);
--> statement-breakpoint
ALTER TABLE `gatewayComPorts` ADD `ipAddress` varchar(45) NOT NULL;--> statement-breakpoint
ALTER TABLE `gatewayComPorts` ADD `tcpPort` int NOT NULL;--> statement-breakpoint
ALTER TABLE `gatewayComPorts` ADD `collectionIntervalMs` int DEFAULT 500 NOT NULL;