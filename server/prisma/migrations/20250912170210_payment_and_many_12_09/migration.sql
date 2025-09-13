-- AlterTable
ALTER TABLE `expenses` ADD COLUMN `is_advance` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `inventory_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(50) NOT NULL,
    `depot_id` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'IN_PROGRESS', 'CLOSED', 'POSTED') NOT NULL DEFAULT 'DRAFT',
    `started_by` INTEGER NOT NULL,
    `closed_by` INTEGER NULL,
    `posted_by` INTEGER NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,
    `posted_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `total_ecart_value` DECIMAL(12, 3) NULL,
    `total_ecart_qty` DECIMAL(10, 3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_sessions_numero_key`(`numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `theoretical_quantity` DECIMAL(10, 3) NOT NULL,
    `counted_quantity` DECIMAL(10, 3) NULL,
    `ecart_quantity` DECIMAL(10, 3) NULL,
    `ecart_value` DECIMAL(12, 3) NULL,
    `reason` ENUM('PHYSICAL_COUNT_DIFFERENCE', 'SUSPICION_OF_ANOMALY') NULL DEFAULT 'PHYSICAL_COUNT_DIFFERENCE',
    `notes` TEXT NULL,
    `counted_at` DATETIME(3) NULL,
    `counted_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_items_session_id_product_id_key`(`session_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inventory_sessions` ADD CONSTRAINT `inventory_sessions_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_sessions` ADD CONSTRAINT `inventory_sessions_started_by_fkey` FOREIGN KEY (`started_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_sessions` ADD CONSTRAINT `inventory_sessions_closed_by_fkey` FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_sessions` ADD CONSTRAINT `inventory_sessions_posted_by_fkey` FOREIGN KEY (`posted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `inventory_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_counted_by_fkey` FOREIGN KEY (`counted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
