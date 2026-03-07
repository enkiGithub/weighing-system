ALTER TABLE `gatewayComPorts` ADD `networkPort` int NOT NULL;--> statement-breakpoint
ALTER TABLE `gatewayComPorts` DROP COLUMN `tcpPort`;