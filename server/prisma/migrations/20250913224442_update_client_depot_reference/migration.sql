/*
  Warnings:

  - You are about to drop the column `customer_type` on the `clients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `clients` DROP COLUMN `customer_type`,
    ADD COLUMN `depot_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
