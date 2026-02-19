CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(100),
	`action` varchar(50) NOT NULL,
	`targetType` varchar(50) NOT NULL,
	`targetId` int,
	`summary` text NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `groupChannelBindings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`channelId` int NOT NULL,
	`coefficient` float NOT NULL DEFAULT 1,
	`offset` float NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `groupChannelBindings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instrumentChannels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instrumentId` int NOT NULL,
	`channelNo` int NOT NULL,
	`label` varchar(50) NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`scale` float NOT NULL DEFAULT 1,
	`offset` float NOT NULL DEFAULT 0,
	`unit` varchar(10) NOT NULL DEFAULT 'kg',
	`precision` int NOT NULL DEFAULT 2,
	`currentValue` float DEFAULT 0,
	`lastReadAt` timestamp,
	`remark` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `instrumentChannels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `cabinetGroupGatewayBindings`;--> statement-breakpoint
DROP TABLE `cabinetGroupLayouts`;--> statement-breakpoint
DROP TABLE `cabinetGroupSensorBindings`;--> statement-breakpoint
DROP TABLE `cabinets`;--> statement-breakpoint
ALTER TABLE `cabinetGroups` MODIFY COLUMN `initialWeight` float NOT NULL;--> statement-breakpoint
ALTER TABLE `cabinetGroups` MODIFY COLUMN `initialWeight` float NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `cabinetGroups` MODIFY COLUMN `currentWeight` float NOT NULL;--> statement-breakpoint
ALTER TABLE `cabinetGroups` MODIFY COLUMN `currentWeight` float NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `cabinetGroups` MODIFY COLUMN `alarmThreshold` float NOT NULL DEFAULT 5;--> statement-breakpoint
ALTER TABLE `weighingInstruments` MODIFY COLUMN `name` varchar(100);--> statement-breakpoint
ALTER TABLE `weightChangeRecords` MODIFY COLUMN `previousWeight` float NOT NULL;--> statement-breakpoint
ALTER TABLE `weightChangeRecords` MODIFY COLUMN `currentWeight` float NOT NULL;--> statement-breakpoint
ALTER TABLE `weightChangeRecords` MODIFY COLUMN `changeValue` float NOT NULL;--> statement-breakpoint
ALTER TABLE `cabinetGroups` ADD `assetCode` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `cabinetGroups` ADD `remark` text;--> statement-breakpoint
ALTER TABLE `gatewayComPorts` ADD `protocolType` varchar(30) DEFAULT 'modbus_rtu' NOT NULL;--> statement-breakpoint
ALTER TABLE `gatewayComPorts` ADD `timeoutMs` int DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `gatewayComPorts` ADD `retryCount` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `gatewayComPorts` ADD `remark` text;--> statement-breakpoint
ALTER TABLE `gateways` ADD `model` varchar(50);--> statement-breakpoint
ALTER TABLE `gateways` ADD `remark` text;--> statement-breakpoint
ALTER TABLE `weighingInstruments` ADD `deviceCode` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `weighingInstruments` ADD `slaveId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `weighingInstruments` ADD `comPortId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `weighingInstruments` ADD `location` text;--> statement-breakpoint
ALTER TABLE `weighingInstruments` ADD `remark` text;--> statement-breakpoint
ALTER TABLE `weightChangeRecords` ADD `channelDetails` text;--> statement-breakpoint
ALTER TABLE `cabinetGroups` ADD CONSTRAINT `cabinetGroups_assetCode_unique` UNIQUE(`assetCode`);--> statement-breakpoint
ALTER TABLE `weighingInstruments` ADD CONSTRAINT `weighingInstruments_deviceCode_unique` UNIQUE(`deviceCode`);--> statement-breakpoint
ALTER TABLE `cabinetGroups` DROP COLUMN `positionX`;--> statement-breakpoint
ALTER TABLE `cabinetGroups` DROP COLUMN `positionY`;--> statement-breakpoint
ALTER TABLE `cabinetGroups` DROP COLUMN `positionZ`;--> statement-breakpoint
ALTER TABLE `cabinetGroups` DROP COLUMN `description`;--> statement-breakpoint
ALTER TABLE `gatewayComPorts` DROP COLUMN `description`;--> statement-breakpoint
ALTER TABLE `gateways` DROP COLUMN `description`;--> statement-breakpoint
ALTER TABLE `weighingInstruments` DROP COLUMN `gatewayComPortId`;--> statement-breakpoint
ALTER TABLE `weighingInstruments` DROP COLUMN `slaveAddress`;--> statement-breakpoint
ALTER TABLE `weighingInstruments` DROP COLUMN `description`;