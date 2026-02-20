ALTER TABLE `cabinetGroups` DROP INDEX `cabinetGroups_assetCode_unique`;--> statement-breakpoint
ALTER TABLE `cabinetGroups` ADD `area` varchar(100) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cabinetGroups` DROP COLUMN `assetCode`;