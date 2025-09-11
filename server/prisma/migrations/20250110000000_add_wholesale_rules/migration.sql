-- CreateTable
CREATE TABLE `wholesale_rules` (
    `id` VARCHAR(191) NOT NULL,
    `rule_type` VARCHAR(20) NOT NULL,
    `value` DECIMAL(10, 3) NOT NULL,
    `description` VARCHAR(200) NOT NULL,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
