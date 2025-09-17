-- AlterTable
ALTER TABLE `app_settings` ADD COLUMN `company_address` TEXT NULL,
    ADD COLUMN `company_email` VARCHAR(100) NULL,
    ADD COLUMN `company_mf` VARCHAR(50) NULL,
    ADD COLUMN `company_phone` VARCHAR(20) NULL,
    ADD COLUMN `company_rc` VARCHAR(50) NULL;
