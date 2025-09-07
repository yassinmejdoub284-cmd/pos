-- AlterTable
ALTER TABLE `products` ADD COLUMN `is_stockable` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `is_vrac` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `original_product_id` INTEGER NULL;

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
ALTER TABLE `products` ADD CONSTRAINT `products_original_product_id_fkey` FOREIGN KEY (`original_product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vrac_prices` ADD CONSTRAINT `vrac_prices_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
