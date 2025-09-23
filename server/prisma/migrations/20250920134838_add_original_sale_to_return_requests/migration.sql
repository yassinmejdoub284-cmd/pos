-- AlterTable
ALTER TABLE `return_requests` ADD COLUMN `original_sale_id` INTEGER NULL,
    ADD COLUMN `original_sale_total` DECIMAL(10, 2) NULL;
