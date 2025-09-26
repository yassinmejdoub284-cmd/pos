-- AlterTable
ALTER TABLE `attendance_punches` ALTER COLUMN `timestamp` DROP DEFAULT;

-- AlterTable
ALTER TABLE `vehicle_brands` ADD COLUMN `logoUrl` VARCHAR(255) NULL;
