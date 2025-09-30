-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(50) NOT NULL,
    `last_name` VARCHAR(50) NOT NULL,
    `role` ENUM('ADMIN', 'MANAGER', 'CASHIER', 'STOCK_MANAGER', 'EMPLOYEE') NOT NULL,
    `depot_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `pin` VARCHAR(8) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_pin_key`(`pin`),
    INDEX `users_depot_id_fkey`(`depot_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `depots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `type` ENUM('MAIN', 'BRANCH', 'SHOP', 'WAREHOUSE') NOT NULL,
    `address` TEXT NOT NULL,
    `city` VARCHAR(50) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `manager_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `company_id` INTEGER NULL,

    UNIQUE INDEX `depots_code_key`(`code`),
    UNIQUE INDEX `depots_manager_id_key`(`manager_id`),
    INDEX `depots_company_id_fkey`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `companies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `raisonSociale` VARCHAR(200) NOT NULL,
    `formeJuridique` VARCHAR(50) NOT NULL,
    `activite` VARCHAR(200) NULL,
    `dateCreation` DATETIME(3) NULL,
    `logoUrl` VARCHAR(255) NULL,
    `brandColor` VARCHAR(20) NULL,
    `statut` ENUM('ACTIF', 'ARCHIVE') NOT NULL DEFAULT 'ACTIF',
    `adresse` TEXT NULL,
    `ville` VARCHAR(100) NULL,
    `delegation` VARCHAR(100) NULL,
    `gouvernorat` VARCHAR(100) NULL,
    `codePostal` VARCHAR(10) NULL,
    `telephone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `siteWeb` VARCHAR(150) NULL,
    `matriculeFiscal` VARCHAR(50) NOT NULL,
    `rne` VARCHAR(50) NOT NULL,
    `registreCommerce` VARCHAR(50) NULL,
    `tvaAssujetti` BOOLEAN NOT NULL DEFAULT false,
    `numeroTva` VARCHAR(50) NULL,
    `tauxTva` DECIMAL(5, 2) NOT NULL DEFAULT 19.00,
    `capitalSocial` DECIMAL(14, 3) NOT NULL DEFAULT 0.000,
    `representantNom` VARCHAR(100) NULL,
    `representantCin` VARCHAR(20) NULL,
    `rib` VARCHAR(50) NULL,
    `banque` VARCHAR(100) NULL,
    `bic` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `barcode` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `duree_conservation` INTEGER NULL,
    `photo` VARCHAR(255) NULL,
    `prix_vente_ttc` DECIMAL(10, 2) NOT NULL,
    `tva` DECIMAL(5, 2) NOT NULL DEFAULT 19.00,
    `unite` VARCHAR(20) NOT NULL DEFAULT 'pcs',
    `is_stockable` BOOLEAN NOT NULL DEFAULT true,
    `original_product_id` INTEGER NULL,
    `is_vrac` BOOLEAN NOT NULL DEFAULT false,
    `display_index` INTEGER NULL,
    `bundle_price` DECIMAL(10, 2) NULL,
    `bundle_size` INTEGER NULL,
    `is_wholesale` BOOLEAN NOT NULL DEFAULT false,
    `min_margin` DECIMAL(5, 2) NULL,
    `requires_approval` BOOLEAN NOT NULL DEFAULT false,
    `famille_id` INTEGER NOT NULL,
    `designation_legale` VARCHAR(200) NULL,
    `prix_achat` DECIMAL(10, 3) NULL,

    UNIQUE INDEX `products_barcode_key`(`barcode`),
    INDEX `products_famille_id_fkey`(`famille_id`),
    INDEX `products_original_product_id_fkey`(`original_product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_depots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `depot_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_depots_product_id_fkey`(`product_id`),
    INDEX `product_depots_depot_id_fkey`(`depot_id`),
    UNIQUE INDEX `product_depots_product_id_depot_id_key`(`product_id`, `depot_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_conservation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `depot_id` INTEGER NOT NULL,
    `batch_quantity` DECIMAL(10, 3) NOT NULL,
    `remaining_quantity` DECIMAL(10, 3) NOT NULL,
    `production_date` DATETIME(3) NOT NULL,
    `expiration_date` DATETIME(3) NOT NULL,
    `is_expired` BOOLEAN NOT NULL DEFAULT false,
    `is_warning_shown` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_conservation_depot_id_fkey`(`depot_id`),
    INDEX `product_conservation_product_id_fkey`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produits_de_caisse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `product_ids` LONGTEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `barcode` VARCHAR(50) NULL,
    `bundle_price` DECIMAL(10, 2) NULL,
    `bundle_size` INTEGER NULL,
    `description` TEXT NULL,
    `designation_legale` VARCHAR(200) NULL,
    `display_index` INTEGER NULL,
    `duree_conservation` INTEGER NULL,
    `famille_id` INTEGER NOT NULL,
    `initial_stock` DECIMAL(10, 3) NULL,
    `is_stockable` BOOLEAN NOT NULL DEFAULT true,
    `is_vrac` BOOLEAN NOT NULL DEFAULT false,
    `is_vraguable` BOOLEAN NOT NULL DEFAULT false,
    `is_wholesale` BOOLEAN NOT NULL DEFAULT false,
    `max_stock` DECIMAL(10, 3) NULL,
    `min_stock` DECIMAL(10, 3) NULL,
    `original_product_id` INTEGER NULL,
    `photo` VARCHAR(255) NULL,
    `prix_achat` DECIMAL(10, 3) NULL,
    `prix_vente_ttc` DECIMAL(10, 2) NOT NULL,
    `tva` DECIMAL(5, 2) NOT NULL DEFAULT 19.00,
    `unite` VARCHAR(20) NOT NULL DEFAULT 'pcs',
    `parent_product_id` INTEGER NULL,

    UNIQUE INDEX `produits_de_caisse_barcode_key`(`barcode`),
    INDEX `produits_de_caisse_famille_id_fkey`(`famille_id`),
    INDEX `produits_de_caisse_original_product_id_fkey`(`original_product_id`),
    INDEX `produits_de_caisse_parent_product_id_fkey`(`parent_product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produit_de_caisse_depot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `produit_de_caisse_id` INTEGER NOT NULL,
    `depot_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `produit_de_caisse_depot_depot_id_fkey`(`depot_id`),
    UNIQUE INDEX `unique_produit_depot`(`produit_de_caisse_id`, `depot_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vrac_prices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vrac_prices_product_id_fkey`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `depot_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
    `reserved_quantity` DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
    `last_updated` DATETIME(3) NOT NULL,

    INDEX `inventory_product_id_fkey`(`product_id`),
    UNIQUE INDEX `inventory_depot_id_product_id_key`(`depot_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `first_name` VARCHAR(50) NOT NULL,
    `last_name` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(50) NULL,
    `matricule_fiscal` VARCHAR(50) NULL,
    `postal_code` VARCHAR(10) NULL,
    `birthday` DATE NULL,
    `client_type` ENUM('INDIVIDUAL', 'BUSINESS', 'WHOLESALE') NOT NULL DEFAULT 'INDIVIDUAL',
    `loyalty_points` INTEGER NOT NULL DEFAULT 0,
    `total_spent` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    `favorite_products` TEXT NULL,
    `allergies` TEXT NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `age_group` VARCHAR(20) NULL,
    `allow_debt` BOOLEAN NOT NULL DEFAULT true,
    `current_debt` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    `max_debt` DECIMAL(12, 3) NULL,
    `depot_id` INTEGER NULL,

    UNIQUE INDEX `clients_code_key`(`code`),
    UNIQUE INDEX `clients_email_key`(`email`),
    INDEX `clients_depot_id_fkey`(`depot_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

    INDEX `client_debt_transactions_client_id_fkey`(`client_id`),
    INDEX `client_debt_transactions_sale_id_fkey`(`sale_id`),
    INDEX `client_debt_transactions_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_name` VARCHAR(200) NULL,
    `logo_url` VARCHAR(255) NULL,
    `loyalty_enabled` BOOLEAN NOT NULL DEFAULT false,
    `loyalty_rate` DECIMAL(8, 3) NOT NULL DEFAULT 1.000,
    `max_discount_percent` DECIMAL(5, 2) NOT NULL DEFAULT 50.00,
    `default_client_max_debt` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    `keyboardShortcuts` LONGTEXT NULL,
    `devices_config` LONGTEXT NULL,
    `audit_retention_days` INTEGER NOT NULL DEFAULT 90,
    `variance_threshold` DECIMAL(8, 3) NOT NULL DEFAULT 5.000,
    `default_fonds` DECIMAL(12, 3) NOT NULL DEFAULT 50.000,
    `denominations` LONGTEXT NULL,
    `require_approval_for_variance` BOOLEAN NOT NULL DEFAULT true,
    `ticket_width` INTEGER NOT NULL DEFAULT 58,
    `droit_de_timbre` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `company_address` TEXT NULL,
    `company_email` VARCHAR(100) NULL,
    `company_mf` VARCHAR(50) NULL,
    `company_phone` VARCHAR(20) NULL,
    `company_rc` VARCHAR(50) NULL,
    `print_settings` LONGTEXT NULL,
    `is_desktop_version` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_methods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `type` ENUM('CASH', 'CARD', 'MOBILE', 'BANK_TRANSFER') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `total` DECIMAL(10, 3) NOT NULL,
    `discount` DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
    `final_total` DECIMAL(10, 3) NOT NULL,
    `payment_method_id` INTEGER NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'TEMPORARY', 'PENDING_ADMIN', 'CADEAU', 'CMD_TERMINEE') NOT NULL DEFAULT 'PENDING',
    `depot_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `expected_date` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `client_id` INTEGER NULL,
    `user_id` INTEGER NOT NULL,
    `advance_payment` DECIMAL(10, 3) NULL DEFAULT 0.000,
    `advance_payment_date` DATETIME(3) NULL,
    `advance_payment_method_id` INTEGER NULL,
    `advance_payment_notes` TEXT NULL,
    `payment_type` ENUM('COMPTANT', 'CREDIT') NOT NULL DEFAULT 'COMPTANT',
    `session_id` INTEGER NULL,
    `is_wholesale` BOOLEAN NOT NULL DEFAULT false,
    `daily_ticket_number` VARCHAR(50) NULL,

    INDEX `sales_advance_payment_method_id_fkey`(`advance_payment_method_id`),
    INDEX `sales_client_id_fkey`(`client_id`),
    INDEX `sales_depot_id_fkey`(`depot_id`),
    INDEX `sales_payment_method_id_fkey`(`payment_method_id`),
    INDEX `sales_session_id_fkey`(`session_id`),
    INDEX `sales_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sale_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `product_name` VARCHAR(200) NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `bundle_price` DECIMAL(10, 2) NULL,
    `bundle_quantity` DECIMAL(10, 3) NULL,
    `bundle_size` INTEGER NULL,
    `is_approved` BOOLEAN NOT NULL DEFAULT false,
    `is_wholesale` BOOLEAN NOT NULL DEFAULT false,
    `margin_percent` DECIMAL(5, 2) NULL,
    `requires_approval` BOOLEAN NOT NULL DEFAULT false,

    INDEX `sale_items_product_id_fkey`(`product_id`),
    INDEX `sale_items_sale_id_fkey`(`sale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `depot_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `type` ENUM('IN', 'OUT', 'TRANSFER') NOT NULL,
    `from_depot_id` INTEGER NULL,
    `to_depot_id` INTEGER NULL,
    `reason` VARCHAR(200) NOT NULL,
    `reference` VARCHAR(100) NULL,
    `user_id` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movements_depot_id_fkey`(`depot_id`),
    INDEX `stock_movements_from_depot_id_fkey`(`from_depot_id`),
    INDEX `stock_movements_product_id_fkey`(`product_id`),
    INDEX `stock_movements_to_depot_id_fkey`(`to_depot_id`),
    INDEX `stock_movements_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `from_depot_id` INTEGER NOT NULL,
    `to_depot_id` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'TRANSFERRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `requested_by` INTEGER NOT NULL,
    `approved_by` INTEGER NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved_at` DATETIME(3) NULL,
    `transferred_at` DATETIME(3) NULL,
    `notes` TEXT NULL,

    INDEX `stock_transfers_approved_by_fkey`(`approved_by`),
    INDEX `stock_transfers_from_depot_id_fkey`(`from_depot_id`),
    INDEX `stock_transfers_requested_by_fkey`(`requested_by`),
    INDEX `stock_transfers_to_depot_id_fkey`(`to_depot_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfer_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transfer_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `transferred_quantity` DECIMAL(10, 3) NOT NULL DEFAULT 0.000,

    INDEX `stock_transfer_items_product_id_fkey`(`product_id`),
    INDEX `stock_transfer_items_transfer_id_fkey`(`transfer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(20) NOT NULL,
    `icon` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `contact_name` VARCHAR(100) NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(50) NULL,
    `postal_code` VARCHAR(10) NULL,
    `tax_number` VARCHAR(50) NULL,
    `payment_terms` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `current_debt` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplier_id` INTEGER NOT NULL,
    `amount` DECIMAL(12, 3) NOT NULL,
    `payment_date` DATETIME(3) NOT NULL,
    `payment_method` VARCHAR(20) NOT NULL DEFAULT 'CASH',
    `reference` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `supplier_payments_supplier_id_fkey`(`supplier_id`),
    INDEX `supplier_payments_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_debt_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplier_id` INTEGER NOT NULL,
    `expense_id` INTEGER NULL,
    `amount` DECIMAL(12, 3) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `notes` TEXT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `supplier_debt_transactions_expense_id_fkey`(`expense_id`),
    INDEX `supplier_debt_transactions_supplier_id_fkey`(`supplier_id`),
    INDEX `supplier_debt_transactions_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DECIMAL(10, 2) NOT NULL,
    `description` VARCHAR(200) NOT NULL,
    `category_id` INTEGER NOT NULL,
    `depot_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receipt_url` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `is_approved` BOOLEAN NOT NULL DEFAULT false,
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `collection_date` DATETIME(3) NULL,
    `payment_type` ENUM('CASH', 'CHECK', 'BANK_TRANSFER', 'WIRE_TRANSFER') NOT NULL DEFAULT 'CASH',
    `due_date` DATETIME(3) NULL,
    `is_paid` BOOLEAN NOT NULL DEFAULT false,
    `paid_at` DATETIME(3) NULL,
    `paid_by` INTEGER NULL,
    `supplier_id` INTEGER NULL,
    `is_advance` BOOLEAN NOT NULL DEFAULT false,

    INDEX `expenses_approved_by_fkey`(`approved_by`),
    INDEX `expenses_category_id_fkey`(`category_id`),
    INDEX `expenses_depot_id_fkey`(`depot_id`),
    INDEX `expenses_paid_by_fkey`(`paid_by`),
    INDEX `expenses_supplier_id_fkey`(`supplier_id`),
    INDEX `expenses_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `table_name` VARCHAR(100) NOT NULL,
    `record_id` INTEGER NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `old_values` LONGTEXT NULL,
    `new_values` LONGTEXT NULL,
    `user_id` INTEGER NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(50) NOT NULL,
    `type` ENUM('BON_EXPEDITION', 'BON_ENTREE_DEPOT', 'BON_TRANSFERT', 'BON_ENTREE_MAGASIN') NOT NULL,
    `status` ENUM('PREPARED', 'SENT', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'PREPARED',
    `emetteur_id` INTEGER NOT NULL,
    `destinataire_id` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_documents_numero_key`(`numero`),
    INDEX `stock_documents_destinataire_id_fkey`(`destinataire_id`),
    INDEX `stock_documents_emetteur_id_fkey`(`emetteur_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_document_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `document_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `famille` VARCHAR(100) NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `batch` VARCHAR(50) NULL,
    `notes` TEXT NULL,
    `barcode` VARCHAR(50) NULL,
    `purchase_price` DECIMAL(10, 3) NULL,
    `count` INTEGER NULL DEFAULT 1,
    `montant_ht` DECIMAL(10, 3) NULL,
    `montant_ttc` DECIMAL(10, 3) NULL,
    `montant_tva` DECIMAL(10, 3) NULL,
    `prix_unitaire` DECIMAL(10, 3) NULL,
    `tva` DECIMAL(5, 2) NULL DEFAULT 19.00,

    UNIQUE INDEX `stock_document_items_barcode_key`(`barcode`),
    INDEX `stock_document_items_document_id_fkey`(`document_id`),
    INDEX `stock_document_items_product_id_fkey`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_status_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `document_id` INTEGER NOT NULL,
    `status` ENUM('PREPARED', 'SENT', 'RECEIVED', 'CANCELLED') NOT NULL,
    `user_id` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_status_history_document_id_fkey`(`document_id`),
    INDEX `document_status_history_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_document_links` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source_document_id` INTEGER NOT NULL,
    `target_document_id` INTEGER NOT NULL,
    `linkType` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_document_links_target_document_id_fkey`(`target_document_id`),
    UNIQUE INDEX `stock_document_links_source_document_id_target_document_id_key`(`source_document_id`, `target_document_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(50) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED') NOT NULL DEFAULT 'PENDING',
    `depot_id` INTEGER NOT NULL,
    `requested_by_id` INTEGER NOT NULL,
    `approved_by_id` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `original_sale_id` INTEGER NULL,
    `original_sale_total` DECIMAL(10, 2) NULL,

    UNIQUE INDEX `return_requests_numero_key`(`numero`),
    INDEX `return_requests_approved_by_id_fkey`(`approved_by_id`),
    INDEX `return_requests_depot_id_fkey`(`depot_id`),
    INDEX `return_requests_requested_by_id_fkey`(`requested_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `requested_qty` DECIMAL(10, 3) NOT NULL,
    `disposition` ENUM('NONE', 'NON_REBUT', 'REBUT') NULL DEFAULT 'NONE',
    `non_rebut_qty` DECIMAL(10, 3) NULL,
    `rebut_qty` DECIMAL(10, 3) NULL,
    `reason` TEXT NULL,

    INDEX `return_items_product_id_fkey`(`product_id`),
    INDEX `return_items_request_id_fkey`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rebut_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `depot_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `status` ENUM('PENDING_AUTHORITY', 'ARCHIVED') NOT NULL DEFAULT 'PENDING_AUTHORITY',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `authority_approved_at` DATETIME(3) NULL,

    UNIQUE INDEX `rebut_records_item_id_key`(`item_id`),
    INDEX `rebut_records_depot_id_fkey`(`depot_id`),
    INDEX `rebut_records_product_id_fkey`(`product_id`),
    INDEX `rebut_records_request_id_fkey`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
    INDEX `inventory_sessions_closed_by_fkey`(`closed_by`),
    INDEX `inventory_sessions_depot_id_fkey`(`depot_id`),
    INDEX `inventory_sessions_posted_by_fkey`(`posted_by`),
    INDEX `inventory_sessions_started_by_fkey`(`started_by`),
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

    INDEX `inventory_items_counted_by_fkey`(`counted_by`),
    INDEX `inventory_items_product_id_fkey`(`product_id`),
    UNIQUE INDEX `inventory_items_session_id_product_id_key`(`session_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_caisse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pos_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `depot_id` INTEGER NULL,
    `magasin_id` INTEGER NULL,
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,
    `opening_fund` DECIMAL(12, 3) NOT NULL,
    `expected_cash` DECIMAL(12, 3) NOT NULL,
    `counted_cash` DECIMAL(12, 3) NULL,
    `variance` DECIMAL(12, 3) NULL,
    `status` ENUM('OPEN', 'CLOSED', 'REOPENED', 'ADMIN_CORRECTED') NOT NULL DEFAULT 'OPEN',
    `x_seq` INTEGER NOT NULL DEFAULT 0,
    `z_seq` INTEGER NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `original_counted_cash` DECIMAL(12, 3) NULL,

    INDEX `session_caisse_depot_id_fkey`(`depot_id`),
    INDEX `session_caisse_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_punches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` ENUM('CHECK_IN', 'CHECK_OUT', 'PAUSE_START', 'PAUSE_END') NOT NULL,
    `timestamp` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
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
    INDEX `attendance_corrections_day_id_fkey`(`day_id`),
    INDEX `attendance_corrections_requested_by_fkey`(`requested_by`),
    INDEX `attendance_corrections_reviewed_by_fkey`(`reviewed_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_movements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `type` ENUM('ENTREE', 'SORTIE', 'DEPOT_COFFRE', 'RETRAIT_CENTRALE', 'AJUSTEMENT') NOT NULL,
    `amount` DECIMAL(12, 3) NOT NULL,
    `reason` VARCHAR(200) NOT NULL,
    `ticket_id` INTEGER NULL,
    `created_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cash_movements_created_by_id_fkey`(`created_by_id`),
    INDEX `cash_movements_session_id_fkey`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `change_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(50) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `requested_by` INTEGER NOT NULL,
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `rejection_notes` TEXT NULL,
    `rejection_reason_code` VARCHAR(50) NULL,

    INDEX `change_requests_approved_by_fkey`(`approved_by`),
    INDEX `change_requests_requested_by_fkey`(`requested_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `data` LONGTEXT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outbox` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `event_type` VARCHAR(100) NOT NULL,
    `aggregate_id` VARCHAR(100) NOT NULL,
    `event_data` LONGTEXT NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `last_attempt` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
    `company_id` INTEGER NULL,

    UNIQUE INDEX `invoices_invoice_number_key`(`invoice_number`),
    INDEX `invoices_client_id_fkey`(`client_id`),
    INDEX `invoices_company_id_fkey`(`company_id`),
    INDEX `invoices_created_by_id_fkey`(`created_by_id`),
    INDEX `invoices_depot_id_fkey`(`depot_id`),
    INDEX `invoices_sale_id_fkey`(`sale_id`),
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

    INDEX `invoice_lines_invoice_id_fkey`(`invoice_id`),
    INDEX `invoice_lines_product_id_fkey`(`product_id`),
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
    INDEX `invoice_requests_approved_by_id_fkey`(`approved_by_id`),
    INDEX `invoice_requests_requested_by_id_fkey`(`requested_by_id`),
    INDEX `invoice_requests_sale_id_fkey`(`sale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicle_brands` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `models` LONGTEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `logoUrl` VARCHAR(255) NULL,

    UNIQUE INDEX `vehicle_brands_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(20) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `brand_id` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vehicles_matricule_key`(`matricule`),
    INDEX `vehicles_brand_id_fkey`(`brand_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `drivers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(100) NOT NULL,
    `prenom` VARCHAR(100) NOT NULL,
    `cin` VARCHAR(8) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `licenseNumber` VARCHAR(50) NULL,
    `licenseExpiry` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `depot_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `drivers_cin_key`(`cin`),
    INDEX `drivers_depot_id_fkey`(`depot_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `depots` ADD CONSTRAINT `depots_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `depots` ADD CONSTRAINT `depots_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_famille_id_fkey` FOREIGN KEY (`famille_id`) REFERENCES `product_families`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_original_product_id_fkey` FOREIGN KEY (`original_product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_depots` ADD CONSTRAINT `product_depots_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_depots` ADD CONSTRAINT `product_depots_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_conservation` ADD CONSTRAINT `product_conservation_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_conservation` ADD CONSTRAINT `product_conservation_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produits_de_caisse` ADD CONSTRAINT `produits_de_caisse_famille_id_fkey` FOREIGN KEY (`famille_id`) REFERENCES `product_families`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produits_de_caisse` ADD CONSTRAINT `produits_de_caisse_original_product_id_fkey` FOREIGN KEY (`original_product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produits_de_caisse` ADD CONSTRAINT `produits_de_caisse_parent_product_id_fkey` FOREIGN KEY (`parent_product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produit_de_caisse_depot` ADD CONSTRAINT `produit_de_caisse_depot_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produit_de_caisse_depot` ADD CONSTRAINT `produit_de_caisse_depot_produit_de_caisse_id_fkey` FOREIGN KEY (`produit_de_caisse_id`) REFERENCES `produits_de_caisse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vrac_prices` ADD CONSTRAINT `vrac_prices_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_debt_transactions` ADD CONSTRAINT `client_debt_transactions_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_debt_transactions` ADD CONSTRAINT `client_debt_transactions_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_debt_transactions` ADD CONSTRAINT `client_debt_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_advance_payment_method_id_fkey` FOREIGN KEY (`advance_payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_payment_method_id_fkey` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `session_caisse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_from_depot_id_fkey` FOREIGN KEY (`from_depot_id`) REFERENCES `depots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_to_depot_id_fkey` FOREIGN KEY (`to_depot_id`) REFERENCES `depots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_from_depot_id_fkey` FOREIGN KEY (`from_depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_to_depot_id_fkey` FOREIGN KEY (`to_depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_transfer_id_fkey` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_debt_transactions` ADD CONSTRAINT `supplier_debt_transactions_expense_id_fkey` FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_debt_transactions` ADD CONSTRAINT `supplier_debt_transactions_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_debt_transactions` ADD CONSTRAINT `supplier_debt_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_paid_by_fkey` FOREIGN KEY (`paid_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_documents` ADD CONSTRAINT `stock_documents_destinataire_id_fkey` FOREIGN KEY (`destinataire_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_documents` ADD CONSTRAINT `stock_documents_emetteur_id_fkey` FOREIGN KEY (`emetteur_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_document_items` ADD CONSTRAINT `stock_document_items_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `stock_documents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_document_items` ADD CONSTRAINT `stock_document_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_status_history` ADD CONSTRAINT `document_status_history_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `stock_documents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_status_history` ADD CONSTRAINT `document_status_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_document_links` ADD CONSTRAINT `stock_document_links_source_document_id_fkey` FOREIGN KEY (`source_document_id`) REFERENCES `stock_documents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_document_links` ADD CONSTRAINT `stock_document_links_target_document_id_fkey` FOREIGN KEY (`target_document_id`) REFERENCES `stock_documents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `return_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rebut_records` ADD CONSTRAINT `rebut_records_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rebut_records` ADD CONSTRAINT `rebut_records_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `return_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rebut_records` ADD CONSTRAINT `rebut_records_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rebut_records` ADD CONSTRAINT `rebut_records_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `return_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_sessions` ADD CONSTRAINT `inventory_sessions_closed_by_fkey` FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_sessions` ADD CONSTRAINT `inventory_sessions_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_sessions` ADD CONSTRAINT `inventory_sessions_posted_by_fkey` FOREIGN KEY (`posted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_sessions` ADD CONSTRAINT `inventory_sessions_started_by_fkey` FOREIGN KEY (`started_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_counted_by_fkey` FOREIGN KEY (`counted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `inventory_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_caisse` ADD CONSTRAINT `session_caisse_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_caisse` ADD CONSTRAINT `session_caisse_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_punches` ADD CONSTRAINT `attendance_punches_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_days` ADD CONSTRAINT `attendance_days_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `depots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_days` ADD CONSTRAINT `attendance_days_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_corrections` ADD CONSTRAINT `attendance_corrections_day_id_fkey` FOREIGN KEY (`day_id`) REFERENCES `attendance_days`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_corrections` ADD CONSTRAINT `attendance_corrections_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_corrections` ADD CONSTRAINT `attendance_corrections_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_movements` ADD CONSTRAINT `cash_movements_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_movements` ADD CONSTRAINT `cash_movements_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `session_caisse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `change_requests` ADD CONSTRAINT `change_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `change_requests` ADD CONSTRAINT `change_requests_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_requests` ADD CONSTRAINT `invoice_requests_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_requests` ADD CONSTRAINT `invoice_requests_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_requests` ADD CONSTRAINT `invoice_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_requests` ADD CONSTRAINT `invoice_requests_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `vehicle_brands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drivers` ADD CONSTRAINT `drivers_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
