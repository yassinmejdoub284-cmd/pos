/*
  Warnings:

  - You are about to drop the column `notes_after_advance` on the `sales` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pin]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pin` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `expenses` ADD COLUMN `due_date` DATETIME(3) NULL,
    ADD COLUMN `is_paid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `paid_at` DATETIME(3) NULL,
    ADD COLUMN `paid_by` INTEGER NULL,
    ADD COLUMN `supplier_id` INTEGER NULL,
    MODIFY `collection_date` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `sales` DROP COLUMN `notes_after_advance`,
    MODIFY `status` ENUM('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'TEMPORARY', 'PENDING_ADMIN', 'CADEAU', 'CMD_TERMINEE') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `pin` VARCHAR(6) NOT NULL DEFAULT '0000';

-- Update existing users with specific PINs
UPDATE `users` SET `pin` = '0001' WHERE `username` = 'admin';
UPDATE `users` SET `pin` = '0002' WHERE `username` = 'manager';
UPDATE `users` SET `pin` = '0003' WHERE `username` = 'cashier';
UPDATE `users` SET `pin` = '0004' WHERE `username` = 'stock';

-- CreateTable
CREATE TABLE `suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `contact_name` VARCHAR(100) NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(50) NULL,
    `postal_code` VARCHAR(10) NULL,
    `tax_number` VARCHAR(50) NULL,
    `payment_terms` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_pin_key` ON `users`(`pin`);

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_paid_by_fkey` FOREIGN KEY (`paid_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
