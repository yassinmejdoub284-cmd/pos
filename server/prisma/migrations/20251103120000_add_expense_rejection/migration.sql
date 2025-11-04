-- Add expense rejection tracking fields

ALTER TABLE `expenses`
  ADD COLUMN `is_rejected` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `rejected_at` DATETIME NULL,
  ADD COLUMN `rejected_by` INT NULL,
  ADD COLUMN `rejection_notes` TEXT NULL;

ALTER TABLE `expenses`
  ADD CONSTRAINT `expenses_rejected_by_fkey`
  FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

