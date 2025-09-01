-- CreateTable
CREATE TABLE `product_families` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `photo` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_families_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create default families from existing product families
INSERT INTO `product_families` (`name`, `description`, `is_active`)
SELECT DISTINCT `famille`, NULL, true
FROM `products`
WHERE `famille` IS NOT NULL AND `famille` != '';

-- Add famille_id column to products table
ALTER TABLE `products` ADD COLUMN `famille_id` INTEGER NULL;

-- Update products to reference the new family table
UPDATE `products` p
JOIN `product_families` pf ON p.famille = pf.name
SET p.famille_id = pf.id;

-- Make famille_id NOT NULL and add foreign key constraint
ALTER TABLE `products` MODIFY COLUMN `famille_id` INTEGER NOT NULL;

-- Add foreign key constraint
ALTER TABLE `products` ADD CONSTRAINT `products_famille_id_fkey` FOREIGN KEY (`famille_id`) REFERENCES `product_families`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop the old famille column
ALTER TABLE `products` DROP COLUMN `famille`;
