/*
  Warnings:

  - Added the required column `depot_id` to the `produits_de_caisse` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `attendance_punches` ALTER COLUMN `timestamp` DROP DEFAULT;

-- AlterTable
ALTER TABLE `produits_de_caisse` ADD COLUMN `depot_id` INTEGER;

-- Update existing records to use the first available depot
UPDATE `produits_de_caisse` SET `depot_id` = (SELECT id FROM `depots` WHERE `is_active` = true LIMIT 1) WHERE `depot_id` IS NULL;

-- Make the column NOT NULL after updating existing records
ALTER TABLE `produits_de_caisse` MODIFY COLUMN `depot_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `produits_de_caisse` ADD CONSTRAINT `produits_de_caisse_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
