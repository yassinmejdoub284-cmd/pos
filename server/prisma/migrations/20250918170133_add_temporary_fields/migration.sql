-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `is_temporary` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `is_temporary` BOOLEAN NOT NULL DEFAULT false;
