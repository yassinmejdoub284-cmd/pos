-- AlterTable
ALTER TABLE `products` ADD COLUMN `bundle_price` DECIMAL(10, 2) NULL,
    ADD COLUMN `bundle_size` INTEGER NULL,
    ADD COLUMN `is_wholesale` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `min_margin` DECIMAL(5, 2) NULL,
    ADD COLUMN `requires_approval` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `sale_items` ADD COLUMN `bundle_price` DECIMAL(10, 2) NULL,
    ADD COLUMN `bundle_quantity` DECIMAL(10, 3) NULL,
    ADD COLUMN `bundle_size` INTEGER NULL,
    ADD COLUMN `is_approved` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_wholesale` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `margin_percent` DECIMAL(5, 2) NULL,
    ADD COLUMN `requires_approval` BOOLEAN NOT NULL DEFAULT false;
