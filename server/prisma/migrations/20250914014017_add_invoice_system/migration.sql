-- CreateTable
CREATE TABLE `invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_number` VARCHAR(50) NOT NULL,
    `status` ENUM('DRAFT', 'ISSUED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `source` ENUM('DAILY_EXTRACT', 'TICKET_REQUEST') NOT NULL,
    `issue_date` DATETIME(3) NOT NULL,
    `due_date` DATETIME(3) NULL,
    `payment_method` VARCHAR(50) NULL,
    `company_name` VARCHAR(200) NOT NULL,
    `company_address` TEXT NOT NULL,
    `company_matricule` VARCHAR(50) NULL,
    `customer_name` VARCHAR(200) NOT NULL,
    `customer_address` TEXT NULL,
    `customer_matricule` VARCHAR(50) NULL,
    `subtotal_htva` DECIMAL(12, 3) NOT NULL,
    `total_tva` DECIMAL(12, 3) NOT NULL,
    `total_ttc` DECIMAL(12, 3) NOT NULL,
    `amount_in_words` TEXT NULL,
    `depot_id` INTEGER NOT NULL,
    `client_id` INTEGER NULL,
    `created_by_id` INTEGER NOT NULL,
    `sale_id` INTEGER NULL,
    `notes` TEXT NULL,
    `quantity_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_invoice_number_key`(`invoice_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_lines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `famille_name` VARCHAR(100) NOT NULL,
    `product_name` VARCHAR(200) NOT NULL,
    `legal_designation` VARCHAR(200) NULL,
    `unite` VARCHAR(20) NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `prix_vente_ttc` DECIMAL(10, 2) NOT NULL,
    `prix_vente_htva` DECIMAL(10, 2) NOT NULL,
    `tva_percent` DECIMAL(5, 2) NOT NULL,
    `montant_tva` DECIMAL(10, 2) NOT NULL,
    `sous_total_ttc` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `invoice_number` VARCHAR(50) NULL,
    `sale_id` INTEGER NOT NULL,
    `requested_by_id` INTEGER NOT NULL,
    `approved_by_id` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `invoice_id` INTEGER NULL,
    `request_notes` TEXT NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoice_requests_invoice_id_key`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_requests` ADD CONSTRAINT `invoice_requests_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_requests` ADD CONSTRAINT `invoice_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_requests` ADD CONSTRAINT `invoice_requests_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_requests` ADD CONSTRAINT `invoice_requests_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
