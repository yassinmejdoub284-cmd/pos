/*
  Warnings:

  - The values [DIRECT_CREATION] on the enum `invoices_source` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `invoices` MODIFY `source` ENUM('DAILY_EXTRACT', 'TICKET_REQUEST') NOT NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `prix_achat` DECIMAL(10, 3) NULL;

-- CreateTable
CREATE TABLE `return_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(50) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED') NOT NULL DEFAULT 'PENDING',
    `depot_id` INTEGER NOT NULL,
    `requested_by_id` INTEGER NOT NULL,
    `approved_by_id` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `return_requests_numero_key`(`numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `requested_qty` DECIMAL(10, 3) NOT NULL,
    `disposition` ENUM('NONE', 'NON_REBUT', 'REBUT') NULL DEFAULT 'NONE',
    `non_rebut_qty` DECIMAL(10, 3) NULL,
    `rebut_qty` DECIMAL(10, 3) NULL,
    `reason` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rebut_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `depot_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `status` ENUM('PENDING_AUTHORITY', 'ARCHIVED') NOT NULL DEFAULT 'PENDING_AUTHORITY',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `authority_approved_at` DATETIME(3) NULL,

    UNIQUE INDEX `rebut_records_item_id_key`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `return_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rebut_records` ADD CONSTRAINT `rebut_records_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `return_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rebut_records` ADD CONSTRAINT `rebut_records_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `return_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rebut_records` ADD CONSTRAINT `rebut_records_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rebut_records` ADD CONSTRAINT `rebut_records_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
