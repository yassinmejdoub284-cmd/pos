-- AlterTable
ALTER TABLE `clients` ADD COLUMN `allow_debt` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `current_debt` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    ADD COLUMN `max_debt` DECIMAL(12, 3) NULL;

-- CreateTable
CREATE TABLE `client_debt_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `sale_id` INTEGER NULL,
    `amount` DECIMAL(12, 3) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `notes` TEXT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_name` VARCHAR(200) NULL,
    `logo_url` VARCHAR(255) NULL,
    `loyalty_enabled` BOOLEAN NOT NULL DEFAULT false,
    `loyalty_rate` DECIMAL(8, 3) NOT NULL DEFAULT 1,
    `max_discount_percent` DECIMAL(5, 2) NOT NULL DEFAULT 50,
    `default_client_max_debt` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `keyboardShortcuts` JSON NULL,
    `devices_config` JSON NULL,
    `audit_retention_days` INTEGER NOT NULL DEFAULT 90,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `client_debt_transactions` ADD CONSTRAINT `client_debt_transactions_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_debt_transactions` ADD CONSTRAINT `client_debt_transactions_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_debt_transactions` ADD CONSTRAINT `client_debt_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
