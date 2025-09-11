-- DropForeignKey
ALTER TABLE `supplier_payments` DROP FOREIGN KEY `supplier_payments_supplier_id_fkey`;

-- DropForeignKey
ALTER TABLE `supplier_payments` DROP FOREIGN KEY `supplier_payments_user_id_fkey`;

-- DropIndex
DROP INDEX `idx_supplier_payments_supplier_id` ON `supplier_payments`;

-- DropIndex
DROP INDEX `idx_supplier_payments_user_id` ON `supplier_payments`;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
