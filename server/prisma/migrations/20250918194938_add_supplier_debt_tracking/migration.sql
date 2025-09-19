/*
  Warnings:

  - You are about to drop the column `is_temporary` on the `invoices` table. All the data in the column will be lost.
  - The values [PDF_IMPORT] on the enum `invoices_source` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `invoices` DROP COLUMN `is_temporary`,
    MODIFY `source` ENUM('DAILY_EXTRACT', 'TICKET_REQUEST') NOT NULL;

-- AlterTable
ALTER TABLE `suppliers` ADD COLUMN `current_debt` DECIMAL(12, 3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `supplier_debt_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplier_id` INTEGER NOT NULL,
    `expense_id` INTEGER NULL,
    `amount` DECIMAL(12, 3) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `notes` TEXT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `supplier_debt_transactions` ADD CONSTRAINT `supplier_debt_transactions_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_debt_transactions` ADD CONSTRAINT `supplier_debt_transactions_expense_id_fkey` FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_debt_transactions` ADD CONSTRAINT `supplier_debt_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
