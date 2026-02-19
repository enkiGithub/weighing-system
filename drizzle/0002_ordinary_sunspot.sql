CREATE TABLE `cabinetGroupLayouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaultLayoutId` int NOT NULL,
	`cabinetGroupId` int NOT NULL,
	`positionX` int NOT NULL DEFAULT 0,
	`positionY` int NOT NULL DEFAULT 0,
	`positionZ` int NOT NULL DEFAULT 0,
	`rotationX` int NOT NULL DEFAULT 0,
	`rotationY` int NOT NULL DEFAULT 0,
	`rotationZ` int NOT NULL DEFAULT 0,
	`scaleX` int NOT NULL DEFAULT 100,
	`scaleY` int NOT NULL DEFAULT 100,
	`scaleZ` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cabinetGroupLayouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cabinets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`depth` int NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cabinets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vaultLayouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`layoutData` text NOT NULL,
	`isActive` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vaultLayouts_id` PRIMARY KEY(`id`)
);
