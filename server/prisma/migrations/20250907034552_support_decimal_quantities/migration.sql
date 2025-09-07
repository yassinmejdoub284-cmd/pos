/*
  Warnings:

  - You are about to alter the column `quantity` on the `inventory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(10,3)`.
  - You are about to alter the column `reserved_quantity` on the `inventory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(10,3)`.
  - You are about to alter the column `quantity` on the `sale_items` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(10,3)`.
  - You are about to alter the column `quantity` on the `stock_document_items` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(10,3)`.
  - You are about to alter the column `quantity` on the `stock_movements` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(10,3)`.
  - You are about to alter the column `quantity` on the `stock_transfer_items` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(10,3)`.
  - You are about to alter the column `transferred_quantity` on the `stock_transfer_items` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(10,3)`.

*/
-- AlterTable
ALTER TABLE `inventory` MODIFY `quantity` DECIMAL(10, 3) NOT NULL DEFAULT 0,
    MODIFY `reserved_quantity` DECIMAL(10, 3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sale_items` MODIFY `quantity` DECIMAL(10, 3) NOT NULL;

-- AlterTable
ALTER TABLE `stock_document_items` MODIFY `quantity` DECIMAL(10, 3) NOT NULL;

-- AlterTable
ALTER TABLE `stock_movements` MODIFY `quantity` DECIMAL(10, 3) NOT NULL;

-- AlterTable
ALTER TABLE `stock_transfer_items` MODIFY `quantity` DECIMAL(10, 3) NOT NULL,
    MODIFY `transferred_quantity` DECIMAL(10, 3) NOT NULL DEFAULT 0;
