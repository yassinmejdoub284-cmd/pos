/*
  Warnings:

  - You are about to drop the column `is_vrac` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `vrac_prices` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `vrac_prices` DROP FOREIGN KEY `vrac_prices_product_id_fkey`;

-- AlterTable
ALTER TABLE `products` DROP COLUMN `is_vrac`,
    ADD COLUMN `is_vrac` BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE `vrac_prices`;

-- CreateTable
CREATE TABLE `vrac_prices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vrac_prices` ADD CONSTRAINT `vrac_prices_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
