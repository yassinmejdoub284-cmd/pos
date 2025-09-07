-- AlterTable
ALTER TABLE `sales` ADD COLUMN `advance_payment` DECIMAL(10, 3) NULL DEFAULT 0,
    ADD COLUMN `advance_payment_date` DATETIME(3) NULL,
    ADD COLUMN `advance_payment_method_id` INTEGER NULL,
    ADD COLUMN `advance_payment_notes` TEXT NULL;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_advance_payment_method_id_fkey` FOREIGN KEY (`advance_payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
