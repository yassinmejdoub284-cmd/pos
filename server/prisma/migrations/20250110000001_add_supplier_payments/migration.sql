SET FOREIGN_KEY_CHECKS=0;

-- CreateTable (with explicit engine and indexes to satisfy MySQL FK requirements)
CREATE TABLE IF NOT EXISTS `supplier_payments` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `supplier_id` INT NOT NULL,
    `amount` DECIMAL(12, 3) NOT NULL,
    `payment_date` DATETIME(3) NOT NULL,
    `payment_method` VARCHAR(20) NOT NULL DEFAULT 'CASH',
    `reference` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `user_id` INT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_supplier_payments_supplier_id` (`supplier_id`),
    INDEX `idx_supplier_payments_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `supplier_payments`
  ADD CONSTRAINT `supplier_payments_supplier_id_fkey`
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments`
  ADD CONSTRAINT `supplier_payments_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS=1;
