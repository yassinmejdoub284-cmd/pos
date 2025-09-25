-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('ADMIN', 'MANAGER', 'CASHIER', 'STOCK_MANAGER', 'EMPLOYEE') NOT NULL;

-- CreateTable
CREATE TABLE `attendance_punches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` ENUM('CHECK_IN', 'CHECK_OUT', 'PAUSE_START', 'PAUSE_END') NOT NULL,
    `timestamp` TIMESTAMP(0) NOT NULL,
    `source` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_punches_userId_timestamp_idx`(`userId`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_days` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `depotId` INTEGER NULL,
    `date` DATE NOT NULL,
    `firstCheckIn` DATETIME(3) NULL,
    `lastCheckOut` DATETIME(3) NULL,
    `pausesSeconds` INTEGER NOT NULL DEFAULT 0,
    `workedSeconds` INTEGER NOT NULL DEFAULT 0,
    `overtimeSeconds` INTEGER NOT NULL DEFAULT 0,
    `isLate` BOOLEAN NOT NULL DEFAULT false,
    `isAbsent` BOOLEAN NOT NULL DEFAULT false,
    `isComplete` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_days_depotId_date_idx`(`depotId`, `date`),
    UNIQUE INDEX `attendance_days_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_corrections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `day_id` INTEGER NOT NULL,
    `requested_by` INTEGER NOT NULL,
    `reviewed_by` INTEGER NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reason` TEXT NOT NULL,
    `proposed_first_in` DATETIME(3) NULL,
    `proposed_last_out` DATETIME(3) NULL,
    `proposedPauses` TEXT NULL,
    `review_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewed_at` DATETIME(3) NULL,

    INDEX `attendance_corrections_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attendance_punches` ADD CONSTRAINT `attendance_punches_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_days` ADD CONSTRAINT `attendance_days_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_days` ADD CONSTRAINT `attendance_days_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `depots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_corrections` ADD CONSTRAINT `attendance_corrections_day_id_fkey` FOREIGN KEY (`day_id`) REFERENCES `attendance_days`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_corrections` ADD CONSTRAINT `attendance_corrections_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_corrections` ADD CONSTRAINT `attendance_corrections_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
