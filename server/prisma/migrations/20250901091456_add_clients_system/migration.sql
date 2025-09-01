/*
  Warnings:

  - You are about to drop the column `cashier_id` on the `sales` table. All the data in the column will be lost.
  - You are about to drop the column `customer_id` on the `sales` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `sales` table. All the data in the column will be lost.
  - You are about to alter the column `total` on the `sales` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,3)`.
  - You are about to alter the column `discount` on the `sales` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,3)`.
  - You are about to alter the column `final_total` on the `sales` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,3)`.
  - You are about to drop the `customers` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `user_id` to the `sales` table without a default value. This is not possible if the table is not empty.

*/

-- First, create the clients table
CREATE TABLE `clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `first_name` VARCHAR(50) NOT NULL,
    `last_name` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(50) NULL,
    `postal_code` VARCHAR(10) NULL,
    `birthday` DATE NULL,
    `client_type` ENUM('INDIVIDUAL', 'BUSINESS', 'WHOLESALE') NOT NULL DEFAULT 'INDIVIDUAL',
    `loyalty_points` INTEGER NOT NULL DEFAULT 0,
    `total_spent` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `favorite_products` TEXT NULL,
    `allergies` TEXT NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clients_code_key`(`code`),
    UNIQUE INDEX `clients_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing customers to clients
INSERT INTO `clients` (`code`, `first_name`, `last_name`, `email`, `phone`, `address`, `loyalty_points`, `is_active`, `created_at`, `updated_at`)
SELECT 
    CONCAT('CUST', LPAD(id, 4, '0')) as code,
    SUBSTRING_INDEX(name, ' ', 1) as first_name,
    CASE 
        WHEN LOCATE(' ', name) > 0 THEN SUBSTRING(name, LOCATE(' ', name) + 1)
        ELSE ''
    END as last_name,
    email,
    phone,
    address,
    loyalty_points,
    is_active,
    created_at,
    updated_at
FROM `customers`;

-- Get the first user ID for default assignment
SET @default_user_id = (SELECT id FROM users LIMIT 1);

-- Add new columns to sales table
ALTER TABLE `sales` 
    ADD COLUMN `client_id` INTEGER NULL,
    ADD COLUMN `user_id` INTEGER NOT NULL DEFAULT @default_user_id;

-- Migrate customer_id to client_id
UPDATE `sales` s
JOIN `customers` c ON s.customer_id = c.id
JOIN `clients` cl ON cl.email = c.email
SET s.client_id = cl.id
WHERE s.customer_id IS NOT NULL;

-- Drop foreign keys and indexes
ALTER TABLE `sales` DROP FOREIGN KEY `sales_cashier_id_fkey`;
ALTER TABLE `sales` DROP FOREIGN KEY `sales_customer_id_fkey`;
DROP INDEX `sales_cashier_id_fkey` ON `sales`;
DROP INDEX `sales_customer_id_fkey` ON `sales`;

-- Modify sales table
ALTER TABLE `sales` 
    DROP COLUMN `cashier_id`,
    DROP COLUMN `customer_id`,
    DROP COLUMN `tax`,
    MODIFY `total` DECIMAL(10, 3) NOT NULL,
    MODIFY `discount` DECIMAL(10, 3) NOT NULL DEFAULT 0,
    MODIFY `final_total` DECIMAL(10, 3) NOT NULL;

-- Drop customers table
DROP TABLE `customers`;

-- Add foreign key constraints
ALTER TABLE `sales` ADD CONSTRAINT `sales_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales` ADD CONSTRAINT `sales_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
