/*
  Warnings:

  - You are about to drop the column `actif` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `allergenes` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `poids` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `reference` on the `products` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `products_reference_key` ON `products`;

-- AlterTable
ALTER TABLE `products` DROP COLUMN `actif`,
    DROP COLUMN `allergenes`,
    DROP COLUMN `poids`,
    DROP COLUMN `reference`;

-- CreateTable
CREATE TABLE `product_conservation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `depot_id` INTEGER NOT NULL,
    `batch_quantity` DECIMAL(10, 3) NOT NULL,
    `remaining_quantity` DECIMAL(10, 3) NOT NULL,
    `production_date` DATETIME(3) NOT NULL,
    `expiration_date` DATETIME(3) NOT NULL,
    `is_expired` BOOLEAN NOT NULL DEFAULT false,
    `is_warning_shown` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_conservation` ADD CONSTRAINT `product_conservation_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_conservation` ADD CONSTRAINT `product_conservation_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
