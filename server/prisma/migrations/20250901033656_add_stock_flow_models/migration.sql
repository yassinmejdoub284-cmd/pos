/*
  Warnings:

  - You are about to alter the column `batch` on the `stock_document_items` table. The data in that column could be lost. The data in that column will be cast from `VarChar(100)` to `VarChar(50)`.
  - You are about to drop the `stock_document_status` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `stock_document_status` DROP FOREIGN KEY `stock_document_status_document_id_fkey`;

-- DropForeignKey
ALTER TABLE `stock_document_status` DROP FOREIGN KEY `stock_document_status_user_id_fkey`;

-- AlterTable
ALTER TABLE `stock_document_items` MODIFY `batch` VARCHAR(50) NULL;

-- DropTable
DROP TABLE `stock_document_status`;

-- CreateTable
CREATE TABLE `document_status_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `document_id` INTEGER NOT NULL,
    `status` ENUM('PREPARED', 'SENT', 'RECEIVED', 'CANCELLED') NOT NULL,
    `user_id` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `document_status_history` ADD CONSTRAINT `document_status_history_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `stock_documents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_status_history` ADD CONSTRAINT `document_status_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
