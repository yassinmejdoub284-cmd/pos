-- DropForeignKey
ALTER TABLE `sales` DROP FOREIGN KEY `sales_payment_method_id_fkey`;

-- DropIndex
DROP INDEX `sales_payment_method_id_fkey` ON `sales`;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `expected_date` DATETIME(3) NULL,
    ADD COLUMN `notes` TEXT NULL,
    MODIFY `payment_method_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_payment_method_id_fkey` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
