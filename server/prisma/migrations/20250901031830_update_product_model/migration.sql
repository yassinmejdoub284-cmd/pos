/*
  Warnings:

  - You are about to drop the column `category_id` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `cost` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `image_url` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `max_stock_level` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `min_stock_level` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `sku` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `product_categories` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[reference]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `famille` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prix_vente_ttc` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reference` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `products` DROP FOREIGN KEY `products_category_id_fkey`;

-- DropIndex
DROP INDEX `products_category_id_fkey` ON `products`;

-- DropIndex
DROP INDEX `products_sku_key` ON `products`;

-- Add new columns with default values first
ALTER TABLE `products` 
    ADD COLUMN `actif` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `allergenes` TEXT NULL,
    ADD COLUMN `duree_conservation` INTEGER NULL,
    ADD COLUMN `famille` VARCHAR(100) NOT NULL DEFAULT 'Général',
    ADD COLUMN `photo` VARCHAR(255) NULL,
    ADD COLUMN `poids` DECIMAL(8, 3) NULL,
    ADD COLUMN `prix_vente_ttc` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `reference` VARCHAR(50) NOT NULL DEFAULT 'TEMP',
    ADD COLUMN `tva` DECIMAL(5, 2) NOT NULL DEFAULT 19,
    ADD COLUMN `unite` VARCHAR(20) NOT NULL DEFAULT 'pcs';

-- Update existing data
UPDATE `products` SET 
    `prix_vente_ttc` = `price`,
    `reference` = CONCAT('PROD', LPAD(id, 6, '0')),
    `famille` = 'Général',
    `actif` = `is_active`,
    `unite` = `unit`,
    `photo` = `image_url`;

-- Now drop old columns
ALTER TABLE `products` 
    DROP COLUMN `category_id`,
    DROP COLUMN `cost`,
    DROP COLUMN `image_url`,
    DROP COLUMN `is_active`,
    DROP COLUMN `max_stock_level`,
    DROP COLUMN `min_stock_level`,
    DROP COLUMN `price`,
    DROP COLUMN `sku`,
    DROP COLUMN `unit`;

-- DropTable
DROP TABLE `product_categories`;

-- CreateIndex
CREATE UNIQUE INDEX `products_reference_key` ON `products`(`reference`);
