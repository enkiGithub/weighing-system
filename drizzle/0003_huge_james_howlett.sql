CREATE TABLE `cabinetGroupGatewayBindings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cabinetGroupId` int NOT NULL,
	`gatewayComPortId` int NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cabinetGroupGatewayBindings_id` PRIMARY KEY(`id`),
	CONSTRAINT `cabinetGroupGatewayBindings_cabinetGroupId_unique` UNIQUE(`cabinetGroupId`)
);
--> statement-breakpoint
CREATE TABLE `cabinetGroupSensorBindings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cabinetGroupId` int NOT NULL,
	`instrumentId` int NOT NULL,
	`sensorChannel` int NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cabinetGroupSensorBindings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gatewayComPorts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gatewayId` int NOT NULL,
	`portNumber` varchar(10) NOT NULL,
	`baudRate` int NOT NULL DEFAULT 9600,
	`dataBits` int NOT NULL DEFAULT 8,
	`stopBits` int NOT NULL DEFAULT 1,
	`parity` varchar(10) NOT NULL DEFAULT 'none',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gatewayComPorts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `weighingInstruments` ADD `modelType` enum('DY7001','DY7004') NOT NULL;--> statement-breakpoint
ALTER TABLE `weighingInstruments` ADD `gatewayComPortId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `cabinetGroups` DROP COLUMN `instrumentId`;--> statement-breakpoint
ALTER TABLE `weighingInstruments` DROP COLUMN `gatewayId`;