-- AlterTable
ALTER TABLE `change_requests` ADD COLUMN `rejection_notes` TEXT NULL,
    ADD COLUMN `rejection_reason_code` VARCHAR(50) NULL;
