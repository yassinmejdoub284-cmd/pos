-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : dim. 28 sep. 2025 à 08:32
-- Version du serveur : 10.4.32-MariaDB
-- Version de PHP : 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `pos_patisserie`
--

-- --------------------------------------------------------

--
-- Structure de la table `app_settings`
--

CREATE TABLE `app_settings` (
  `id` int(11) NOT NULL,
  `company_name` varchar(200) DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `loyalty_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `loyalty_rate` decimal(8,3) NOT NULL DEFAULT 1.000,
  `max_discount_percent` decimal(5,2) NOT NULL DEFAULT 50.00,
  `default_client_max_debt` decimal(12,3) NOT NULL DEFAULT 0.000,
  `keyboardShortcuts` longtext DEFAULT NULL,
  `devices_config` longtext DEFAULT NULL,
  `audit_retention_days` int(11) NOT NULL DEFAULT 90,
  `variance_threshold` decimal(8,3) NOT NULL DEFAULT 5.000,
  `default_fonds` decimal(12,3) NOT NULL DEFAULT 50.000,
  `denominations` longtext DEFAULT NULL,
  `require_approval_for_variance` tinyint(1) NOT NULL DEFAULT 1,
  `ticket_width` int(11) NOT NULL DEFAULT 58,
  `droit_de_timbre` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `company_address` text DEFAULT NULL,
  `company_email` varchar(100) DEFAULT NULL,
  `company_mf` varchar(50) DEFAULT NULL,
  `company_phone` varchar(20) DEFAULT NULL,
  `company_rc` varchar(50) DEFAULT NULL,
  `print_settings` longtext DEFAULT NULL,
  `is_desktop_version` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `attendance_corrections`
--

CREATE TABLE `attendance_corrections` (
  `id` int(11) NOT NULL,
  `day_id` int(11) NOT NULL,
  `requested_by` int(11) NOT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `reason` text NOT NULL,
  `proposed_first_in` datetime(3) DEFAULT NULL,
  `proposed_last_out` datetime(3) DEFAULT NULL,
  `proposedPauses` text DEFAULT NULL,
  `review_notes` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `reviewed_at` datetime(3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `attendance_days`
--

CREATE TABLE `attendance_days` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `depotId` int(11) DEFAULT NULL,
  `date` date NOT NULL,
  `firstCheckIn` datetime(3) DEFAULT NULL,
  `lastCheckOut` datetime(3) DEFAULT NULL,
  `pausesSeconds` int(11) NOT NULL DEFAULT 0,
  `workedSeconds` int(11) NOT NULL DEFAULT 0,
  `overtimeSeconds` int(11) NOT NULL DEFAULT 0,
  `isLate` tinyint(1) NOT NULL DEFAULT 0,
  `isAbsent` tinyint(1) NOT NULL DEFAULT 0,
  `isComplete` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `attendance_punches`
--

CREATE TABLE `attendance_punches` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `type` enum('CHECK_IN','CHECK_OUT','PAUSE_START','PAUSE_END') NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  `source` varchar(50) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL,
  `table_name` varchar(100) NOT NULL,
  `record_id` int(11) NOT NULL,
  `action` varchar(20) NOT NULL,
  `old_values` longtext DEFAULT NULL,
  `new_values` longtext DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `cash_movements`
--

CREATE TABLE `cash_movements` (
  `id` int(11) NOT NULL,
  `session_id` int(11) NOT NULL,
  `type` enum('ENTREE','SORTIE','DEPOT_COFFRE','RETRAIT_CENTRALE','AJUSTEMENT') NOT NULL,
  `amount` decimal(12,3) NOT NULL,
  `reason` varchar(200) NOT NULL,
  `ticket_id` int(11) DEFAULT NULL,
  `created_by_id` int(11) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `change_requests`
--

CREATE TABLE `change_requests` (
  `id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL,
  `entity_id` int(11) NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `reason` text NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `requested_by` int(11) NOT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `rejection_notes` text DEFAULT NULL,
  `rejection_reason_code` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `clients`
--

CREATE TABLE `clients` (
  `id` int(11) NOT NULL,
  `code` varchar(20) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `birthday` date DEFAULT NULL,
  `client_type` enum('INDIVIDUAL','BUSINESS','WHOLESALE') NOT NULL DEFAULT 'INDIVIDUAL',
  `loyalty_points` int(11) NOT NULL DEFAULT 0,
  `total_spent` decimal(12,3) NOT NULL DEFAULT 0.000,
  `favorite_products` text DEFAULT NULL,
  `allergies` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `age_group` varchar(20) DEFAULT NULL,
  `allow_debt` tinyint(1) NOT NULL DEFAULT 1,
  `current_debt` decimal(12,3) NOT NULL DEFAULT 0.000,
  `max_debt` decimal(12,3) DEFAULT NULL,
  `depot_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `client_debt_transactions`
--

CREATE TABLE `client_debt_transactions` (
  `id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `sale_id` int(11) DEFAULT NULL,
  `amount` decimal(12,3) NOT NULL,
  `type` varchar(20) NOT NULL,
  `notes` text DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `companies`
--

CREATE TABLE `companies` (
  `id` int(11) NOT NULL,
  `raisonSociale` varchar(200) NOT NULL,
  `formeJuridique` varchar(50) NOT NULL,
  `activite` varchar(200) DEFAULT NULL,
  `dateCreation` datetime(3) DEFAULT NULL,
  `logoUrl` varchar(255) DEFAULT NULL,
  `brandColor` varchar(20) DEFAULT NULL,
  `statut` enum('ACTIF','ARCHIVE') NOT NULL DEFAULT 'ACTIF',
  `adresse` text DEFAULT NULL,
  `ville` varchar(100) DEFAULT NULL,
  `delegation` varchar(100) DEFAULT NULL,
  `gouvernorat` varchar(100) DEFAULT NULL,
  `codePostal` varchar(10) DEFAULT NULL,
  `telephone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `siteWeb` varchar(150) DEFAULT NULL,
  `matriculeFiscal` varchar(50) NOT NULL,
  `rne` varchar(50) NOT NULL,
  `registreCommerce` varchar(50) DEFAULT NULL,
  `tvaAssujetti` tinyint(1) NOT NULL DEFAULT 0,
  `numeroTva` varchar(50) DEFAULT NULL,
  `tauxTva` decimal(5,2) NOT NULL DEFAULT 19.00,
  `capitalSocial` decimal(14,3) NOT NULL DEFAULT 0.000,
  `representantNom` varchar(100) DEFAULT NULL,
  `representantCin` varchar(20) DEFAULT NULL,
  `rib` varchar(50) DEFAULT NULL,
  `banque` varchar(100) DEFAULT NULL,
  `bic` varchar(20) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `depots`
--

CREATE TABLE `depots` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `code` varchar(20) NOT NULL,
  `type` enum('MAIN','BRANCH','SHOP','WAREHOUSE') NOT NULL,
  `address` text NOT NULL,
  `city` varchar(50) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `manager_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `company_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `depots`
--

INSERT INTO `depots` (`id`, `name`, `code`, `type`, `address`, `city`, `phone`, `email`, `manager_id`, `is_active`, `created_at`, `updated_at`, `company_id`) VALUES
(1, 'Dépôt Principal Sfax', 'SFX-MAIN', 'MAIN', '123 Rue de la Liberté', 'Sfax', '+216 74 123 456', 'sfax@patisserie.tn', NULL, 1, '2025-09-27 18:07:19.743', '2025-09-27 18:07:19.743', NULL),
(2, 'Dépôt Tunis', 'TUN-BRANCH', 'BRANCH', '456 Avenue Habib Bourguiba', 'Tunis', '+216 71 234 567', 'tunis@patisserie.tn', NULL, 1, '2025-09-27 18:07:19.743', '2025-09-27 18:07:19.743', NULL),
(3, 'Boutique Centre Ville', 'SHOP-CV', 'SHOP', '789 Place de la République', 'Sfax', '+216 74 345 678', 'shop@patisserie.tn', NULL, 1, '2025-09-27 18:07:19.743', '2025-09-27 21:12:45.279', NULL),
(4, 'Boutique Ariana', '002', 'SHOP', 'Avenue sidi Ammar Ariana Tunis', 'TUNIS ARIANA', '22212319', 'groupehentati.contact@gmail.com', NULL, 1, '2025-09-27 21:09:50.321', '2025-09-27 21:09:50.321', NULL);

-- --------------------------------------------------------

--
-- Structure de la table `document_status_history`
--

CREATE TABLE `document_status_history` (
  `id` int(11) NOT NULL,
  `document_id` int(11) NOT NULL,
  `status` enum('PREPARED','SENT','RECEIVED','CANCELLED') NOT NULL,
  `user_id` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `drivers`
--

CREATE TABLE `drivers` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `prenom` varchar(100) NOT NULL,
  `cin` varchar(8) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `licenseNumber` varchar(50) DEFAULT NULL,
  `licenseExpiry` datetime(3) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `depot_id` int(11) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `expenses`
--

CREATE TABLE `expenses` (
  `id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `description` varchar(200) NOT NULL,
  `category_id` int(11) NOT NULL,
  `depot_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `receipt_url` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_approved` tinyint(1) NOT NULL DEFAULT 0,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `collection_date` datetime(3) DEFAULT NULL,
  `payment_type` enum('CASH','CHECK','BANK_TRANSFER','WIRE_TRANSFER') NOT NULL DEFAULT 'CASH',
  `due_date` datetime(3) DEFAULT NULL,
  `is_paid` tinyint(1) NOT NULL DEFAULT 0,
  `paid_at` datetime(3) DEFAULT NULL,
  `paid_by` int(11) DEFAULT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `is_advance` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `expense_categories`
--

CREATE TABLE `expense_categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `color` varchar(20) NOT NULL,
  `icon` varchar(50) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `inventory`
--

CREATE TABLE `inventory` (
  `id` int(11) NOT NULL,
  `depot_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` decimal(10,3) NOT NULL DEFAULT 0.000,
  `reserved_quantity` decimal(10,3) NOT NULL DEFAULT 0.000,
  `last_updated` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `inventory_items`
--

CREATE TABLE `inventory_items` (
  `id` int(11) NOT NULL,
  `session_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `theoretical_quantity` decimal(10,3) NOT NULL,
  `counted_quantity` decimal(10,3) DEFAULT NULL,
  `ecart_quantity` decimal(10,3) DEFAULT NULL,
  `ecart_value` decimal(12,3) DEFAULT NULL,
  `reason` enum('PHYSICAL_COUNT_DIFFERENCE','SUSPICION_OF_ANOMALY') DEFAULT 'PHYSICAL_COUNT_DIFFERENCE',
  `notes` text DEFAULT NULL,
  `counted_at` datetime(3) DEFAULT NULL,
  `counted_by` int(11) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `inventory_sessions`
--

CREATE TABLE `inventory_sessions` (
  `id` int(11) NOT NULL,
  `numero` varchar(50) NOT NULL,
  `depot_id` int(11) NOT NULL,
  `status` enum('DRAFT','IN_PROGRESS','CLOSED','POSTED') NOT NULL DEFAULT 'DRAFT',
  `started_by` int(11) NOT NULL,
  `closed_by` int(11) DEFAULT NULL,
  `posted_by` int(11) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `closed_at` datetime(3) DEFAULT NULL,
  `posted_at` datetime(3) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `total_ecart_value` decimal(12,3) DEFAULT NULL,
  `total_ecart_qty` decimal(10,3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `invoices`
--

CREATE TABLE `invoices` (
  `id` int(11) NOT NULL,
  `invoice_number` varchar(50) NOT NULL,
  `status` enum('DRAFT','ISSUED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `source` enum('DAILY_EXTRACT','TICKET_REQUEST') NOT NULL,
  `issue_date` datetime(3) NOT NULL,
  `due_date` datetime(3) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `company_name` varchar(200) NOT NULL,
  `company_address` text NOT NULL,
  `company_matricule` varchar(50) DEFAULT NULL,
  `customer_name` varchar(200) NOT NULL,
  `customer_address` text DEFAULT NULL,
  `customer_matricule` varchar(50) DEFAULT NULL,
  `subtotal_htva` decimal(12,3) NOT NULL,
  `total_tva` decimal(12,3) NOT NULL,
  `total_ttc` decimal(12,3) NOT NULL,
  `amount_in_words` text DEFAULT NULL,
  `depot_id` int(11) NOT NULL,
  `client_id` int(11) DEFAULT NULL,
  `created_by_id` int(11) NOT NULL,
  `sale_id` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `quantity_note` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `company_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `invoice_lines`
--

CREATE TABLE `invoice_lines` (
  `id` int(11) NOT NULL,
  `invoice_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `famille_name` varchar(100) NOT NULL,
  `product_name` varchar(200) NOT NULL,
  `legal_designation` varchar(200) DEFAULT NULL,
  `unite` varchar(20) NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `prix_vente_ttc` decimal(10,2) NOT NULL,
  `prix_vente_htva` decimal(10,2) NOT NULL,
  `tva_percent` decimal(5,2) NOT NULL,
  `montant_tva` decimal(10,2) NOT NULL,
  `sous_total_ttc` decimal(10,2) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `invoice_requests`
--

CREATE TABLE `invoice_requests` (
  `id` int(11) NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `invoice_number` varchar(50) DEFAULT NULL,
  `sale_id` int(11) NOT NULL,
  `requested_by_id` int(11) NOT NULL,
  `approved_by_id` int(11) DEFAULT NULL,
  `approved_at` datetime(3) DEFAULT NULL,
  `invoice_id` int(11) DEFAULT NULL,
  `request_notes` text DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `data` longtext DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `outbox`
--

CREATE TABLE `outbox` (
  `id` int(11) NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `aggregate_id` varchar(100) NOT NULL,
  `event_data` longtext NOT NULL,
  `status` enum('PENDING','PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  `retry_count` int(11) NOT NULL DEFAULT 0,
  `last_attempt` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `processed_at` datetime(3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `payment_methods`
--

CREATE TABLE `payment_methods` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `type` enum('CASH','CARD','MOBILE','BANK_TRANSFER') NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `payment_methods`
--

INSERT INTO `payment_methods` (`id`, `name`, `type`, `is_active`, `created_at`) VALUES
(1, 'Espèces', 'CASH', 1, '2025-09-27 18:07:19.914'),
(2, 'Carte Bancaire', 'CARD', 1, '2025-09-27 18:07:19.915'),
(3, 'Mobile Money', 'MOBILE', 1, '2025-09-27 18:07:19.917'),
(4, 'Virement Bancaire', 'BANK_TRANSFER', 1, '2025-09-27 18:07:19.919');

-- --------------------------------------------------------

--
-- Structure de la table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `barcode` varchar(50) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `duree_conservation` int(11) DEFAULT NULL,
  `photo` varchar(255) DEFAULT NULL,
  `prix_vente_ttc` decimal(10,2) NOT NULL,
  `tva` decimal(5,2) NOT NULL DEFAULT 19.00,
  `unite` varchar(20) NOT NULL DEFAULT 'pcs',
  `is_stockable` tinyint(1) NOT NULL DEFAULT 1,
  `original_product_id` int(11) DEFAULT NULL,
  `is_vrac` tinyint(1) NOT NULL DEFAULT 0,
  `display_index` int(11) DEFAULT NULL,
  `bundle_price` decimal(10,2) DEFAULT NULL,
  `bundle_size` int(11) DEFAULT NULL,
  `is_wholesale` tinyint(1) NOT NULL DEFAULT 0,
  `min_margin` decimal(5,2) DEFAULT NULL,
  `requires_approval` tinyint(1) NOT NULL DEFAULT 0,
  `famille_id` int(11) NOT NULL,
  `designation_legale` varchar(200) DEFAULT NULL,
  `prix_achat` decimal(10,3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `products`
--

INSERT INTO `products` (`id`, `name`, `description`, `barcode`, `created_at`, `updated_at`, `duree_conservation`, `photo`, `prix_vente_ttc`, `tva`, `unite`, `is_stockable`, `original_product_id`, `is_vrac`, `display_index`, `bundle_price`, `bundle_size`, `is_wholesale`, `min_margin`, `requires_approval`, `famille_id`, `designation_legale`, `prix_achat`) VALUES
(1, 'AJNAB BAKLAWA KAKAWIA', NULL, NULL, '2025-09-28 06:32:30.353', '2025-09-28 05:54:42.435', NULL, NULL, 12.00, 0.07, 'NON', 1, NULL, 0, 28, NULL, NULL, 0, NULL, 0, 5, NULL, 9.000),
(2, 'AJNAB BAKLAWA LOUZ', NULL, NULL, '2025-09-28 06:32:30.362', '2025-09-28 05:54:42.435', NULL, NULL, 24.00, 0.07, 'NON', 1, NULL, 0, 27, NULL, NULL, 0, NULL, 0, 6, NULL, 17.000),
(3, 'ARGENT', NULL, NULL, '2025-09-28 06:32:30.363', '2025-09-28 05:54:42.435', NULL, NULL, 1.00, 0.00, 'NON', 0, NULL, 0, 26, NULL, NULL, 0, NULL, 0, 1, NULL, 1.000),
(4, 'CHAHRAZED 1.7 KG AM', NULL, NULL, '2025-09-28 06:32:30.365', '2025-09-28 06:32:30.365', NULL, NULL, 31.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 26.660),
(5, 'CHAHRAZED 1.7 KG CHO', NULL, NULL, '2025-09-28 06:32:30.366', '2025-09-28 06:32:30.366', NULL, NULL, 26.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 22.790),
(6, 'CHAHRAZED 1.7 KG COLORE', NULL, NULL, '2025-09-28 06:32:30.367', '2025-09-28 06:32:30.367', NULL, NULL, 25.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 20.100),
(7, 'CHAHRAZED 2 KG AM', NULL, NULL, '2025-09-28 06:32:30.368', '2025-09-28 06:32:30.368', NULL, NULL, 34.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 29.670),
(8, 'CHAHRAZED 2 KG AM COLORE MET', NULL, NULL, '2025-09-28 06:32:30.369', '2025-09-28 06:32:30.369', NULL, NULL, 37.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 31.820),
(9, 'CHAHRAZED 2 KG FS', NULL, NULL, '2025-09-28 06:32:30.370', '2025-09-28 06:32:30.370', NULL, NULL, 54.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 43.407),
(10, 'CHAHRAZED 2 KG ROYAL', NULL, NULL, '2025-09-28 06:32:30.371', '2025-09-28 06:32:30.371', NULL, NULL, 73.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 63.538),
(11, 'CHAHRAZED 2 KG SPECIAL', NULL, NULL, '2025-09-28 06:32:30.371', '2025-09-28 06:32:30.371', NULL, NULL, 34.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 29.240),
(12, 'CHAHRAZED 200 GR AM', NULL, NULL, '2025-09-28 06:32:30.372', '2025-09-28 06:32:30.372', NULL, NULL, 5.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.725),
(13, 'CHAHRAZED 200 GR FS', NULL, NULL, '2025-09-28 06:32:30.373', '2025-09-28 06:32:30.373', NULL, NULL, 6.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 4.572),
(14, 'CHAHRAZED 200 GR LIGHT', NULL, NULL, '2025-09-28 06:32:30.374', '2025-09-28 06:32:30.374', NULL, NULL, 6.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 4.800),
(15, 'CHAHRAZED 200 GR N', NULL, NULL, '2025-09-28 06:32:30.375', '2025-09-28 06:32:30.375', NULL, NULL, 4.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.200),
(16, 'CHAHRAZED 350 GR AM', NULL, NULL, '2025-09-28 06:32:30.375', '2025-09-28 06:32:30.375', NULL, NULL, 8.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 6.880),
(17, 'CHAHRAZED 350 GR CHOC', NULL, NULL, '2025-09-28 06:32:30.376', '2025-09-28 06:32:30.376', NULL, NULL, 7.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 6.020),
(18, 'CHAHRAZED 350 GR LIGHT', NULL, NULL, '2025-09-28 06:32:30.377', '2025-09-28 06:32:30.377', NULL, NULL, 10.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 8.600),
(19, 'CHAHRAZED 400 GR AM', NULL, NULL, '2025-09-28 06:32:30.378', '2025-09-28 06:32:30.378', NULL, NULL, 8.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 6.438),
(20, 'CHAHRAZED 400 GR FS', NULL, NULL, '2025-09-28 06:32:30.379', '2025-09-28 06:32:30.379', NULL, NULL, 9.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 8.170),
(21, 'CHAHRAZED 400 GR LIGHT', NULL, NULL, '2025-09-28 06:32:30.380', '2025-09-28 06:32:30.380', NULL, NULL, 10.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 8.229),
(22, 'CHAHRAZED 400 GR N', NULL, NULL, '2025-09-28 06:32:30.382', '2025-09-28 06:32:30.382', NULL, NULL, 7.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 5.388),
(23, 'CHAHRAZED 800 GR AM', NULL, NULL, '2025-09-28 06:32:30.383', '2025-09-28 06:32:30.383', NULL, NULL, 15.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 12.596),
(24, 'CHAHRAZED 800 GR FS', NULL, NULL, '2025-09-28 06:32:30.384', '2025-09-28 06:32:30.384', NULL, NULL, 16.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 14.276),
(25, 'CHAHRAZED 800 GR LIGHT', NULL, NULL, '2025-09-28 06:32:30.386', '2025-09-28 06:32:30.386', NULL, NULL, 19.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 16.340),
(26, 'CHAHRAZED 800 GR N', NULL, NULL, '2025-09-28 06:32:30.387', '2025-09-28 06:32:30.387', NULL, NULL, 13.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 11.180),
(27, 'CHEMIA VRAC 100GR', NULL, NULL, '2025-09-28 06:32:30.388', '2025-09-28 06:32:30.388', NULL, NULL, 1.70, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 3, NULL, 1.200),
(28, 'CHWINGUM', NULL, NULL, '2025-09-28 06:32:30.389', '2025-09-28 06:32:30.389', NULL, NULL, 12.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 10.300),
(29, 'CROCANT', NULL, NULL, '2025-09-28 06:32:30.390', '2025-09-28 05:54:42.435', NULL, NULL, 12.00, 0.07, '1', 1, NULL, 0, 25, NULL, NULL, 1, NULL, 0, 4, NULL, 9.000),
(30, 'EAU 0.5L', NULL, NULL, '2025-09-28 06:32:30.391', '2025-09-28 05:54:42.435', NULL, NULL, 0.60, 0.00, 'NON', 1, NULL, 0, 1, NULL, NULL, 0, NULL, 0, 7, NULL, 0.450),
(31, 'EAU 1.5L', NULL, NULL, '2025-09-28 06:32:30.391', '2025-09-28 05:54:42.435', NULL, NULL, 1.00, 0.00, 'NON', 1, NULL, 0, 24, NULL, NULL, 0, NULL, 0, 7, NULL, 0.700),
(32, 'GATEAUX SOWABAA', NULL, NULL, '2025-09-28 06:32:30.392', '2025-09-28 05:54:42.435', NULL, NULL, 12.00, 0.07, '1', 1, NULL, 0, 23, NULL, NULL, 1, NULL, 0, 8, NULL, 9.000),
(33, 'HALKOUM 200 G AM', NULL, NULL, '2025-09-28 06:32:30.393', '2025-09-28 06:32:30.393', NULL, NULL, 4.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 9, NULL, 2.500),
(34, 'HALKOUM 200 G N', NULL, NULL, '2025-09-28 06:32:30.394', '2025-09-28 06:32:30.394', NULL, NULL, 3.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 9, NULL, 2.500),
(35, 'HALKOUM VRAC', NULL, NULL, '2025-09-28 06:32:30.395', '2025-09-28 06:32:30.395', NULL, NULL, 17.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 9, NULL, 13.000),
(36, 'HALWA GRAND', NULL, NULL, '2025-09-28 06:32:30.396', '2025-09-28 06:32:30.396', NULL, NULL, 9.50, 0.19, 'NON', 1, NULL, 1, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 8.210),
(37, 'HALWA GRAND SPECIAL', NULL, NULL, '2025-09-28 06:32:30.398', '2025-09-28 06:32:30.398', NULL, NULL, 10.50, 0.19, 'NON', 1, NULL, 1, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 8.500),
(38, 'HALWA PETIT', NULL, NULL, '2025-09-28 06:32:30.399', '2025-09-28 06:32:30.399', NULL, NULL, 4.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 3.094),
(39, 'HLOU ARBI', NULL, NULL, '2025-09-28 06:32:30.400', '2025-09-28 05:54:42.435', NULL, NULL, 18.00, 0.07, '1', 1, NULL, 0, 22, NULL, NULL, 1, NULL, 0, 10, NULL, 12.000),
(40, 'HLOU KAKAWIA', NULL, NULL, '2025-09-28 06:32:30.402', '2025-09-28 05:54:42.435', NULL, NULL, 30.00, 0.07, '1', 1, NULL, 0, 20, NULL, NULL, 1, NULL, 0, 11, NULL, 22.000),
(41, 'HLOU LOUZ', NULL, NULL, '2025-09-28 06:32:30.402', '2025-09-28 05:54:42.435', NULL, NULL, 58.00, 0.07, '1', 1, NULL, 0, 21, NULL, NULL, 1, NULL, 0, 12, NULL, 42.000),
(42, 'JUS 1L CITRON', NULL, NULL, '2025-09-28 06:32:30.403', '2025-09-28 05:54:42.435', NULL, NULL, 8.00, 0.19, '6', 1, NULL, 1, 19, NULL, NULL, 1, NULL, 0, 13, NULL, 6.290),
(43, 'JUS 1L CITRON AMANDE', NULL, NULL, '2025-09-28 06:32:30.404', '2025-09-28 05:54:42.435', NULL, NULL, 8.50, 0.19, '6', 1, NULL, 1, 18, NULL, NULL, 1, NULL, 0, 13, NULL, 6.800),
(44, 'JUS 1L FRUIT IMPORTER', NULL, NULL, '2025-09-28 06:32:30.405', '2025-09-28 05:54:42.435', NULL, NULL, 9.00, 0.19, '6', 1, NULL, 1, 17, NULL, NULL, 1, NULL, 0, 13, NULL, 7.650),
(45, 'JUS 1L FRUIT LOCAL', NULL, NULL, '2025-09-28 06:32:30.406', '2025-09-28 05:54:42.435', NULL, NULL, 9.00, 0.19, '6', 1, NULL, 1, 16, NULL, NULL, 1, NULL, 0, 13, NULL, 7.395),
(46, 'JUS 3L CITRON', NULL, NULL, '2025-09-28 06:32:30.407', '2025-09-28 05:54:42.435', NULL, NULL, 23.50, 0.19, '1', 1, NULL, 1, 15, NULL, NULL, 1, NULL, 0, 13, NULL, 18.275),
(47, 'JUS 3L CITRON AMANDE', NULL, NULL, '2025-09-28 06:32:30.408', '2025-09-28 05:54:42.435', NULL, NULL, 25.00, 0.19, '1', 1, NULL, 1, 14, NULL, NULL, 1, NULL, 0, 13, NULL, 19.975),
(48, 'JUS 3L FRUIT IMPORTER', NULL, NULL, '2025-09-28 06:32:30.409', '2025-09-28 05:54:42.435', NULL, NULL, 26.50, 0.19, '1', 1, NULL, 1, 13, NULL, NULL, 1, NULL, 0, 13, NULL, 22.100),
(49, 'JUS 3L FRUIT LOCAL', NULL, NULL, '2025-09-28 06:32:30.410', '2025-09-28 05:54:42.435', NULL, NULL, 26.50, 0.19, '1', 1, NULL, 1, 12, NULL, NULL, 1, NULL, 0, 13, NULL, 21.250),
(50, 'JUS 5L CITRON', NULL, NULL, '2025-09-28 06:32:30.411', '2025-09-28 05:54:42.435', NULL, NULL, 35.00, 0.19, '1', 1, NULL, 1, 11, NULL, NULL, 1, NULL, 0, 13, NULL, 29.452),
(51, 'JUS 5L CITRON AMANDE', NULL, NULL, '2025-09-28 06:32:30.412', '2025-09-28 05:54:42.435', NULL, NULL, 37.00, 0.19, '1', 1, NULL, 1, 10, NULL, NULL, 1, NULL, 0, 13, NULL, 32.002),
(52, 'JUS 5L FRUIT IMPORTER', NULL, NULL, '2025-09-28 06:32:30.413', '2025-09-28 05:54:42.435', NULL, NULL, 40.00, 0.19, '1', 1, NULL, 1, 9, NULL, NULL, 1, NULL, 0, 13, NULL, 35.870),
(53, 'JUS 5L FRUIT LOCAL', NULL, NULL, '2025-09-28 06:32:30.414', '2025-09-28 05:54:42.435', NULL, NULL, 40.00, 0.19, '1', 1, NULL, 1, 8, NULL, NULL, 1, NULL, 0, 13, NULL, 35.020),
(54, 'LOUZIA', NULL, NULL, '2025-09-28 06:32:30.415', '2025-09-28 05:54:42.435', NULL, NULL, 1.20, 0.07, 'NON', 1, NULL, 0, 7, NULL, NULL, 0, NULL, 0, 16, NULL, 0.700),
(55, 'NA3OURA 2 KG AM', NULL, NULL, '2025-09-28 06:32:30.416', '2025-09-28 06:32:30.416', NULL, NULL, 37.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 31.820),
(56, 'NA3OURA 2 KG FS', NULL, NULL, '2025-09-28 06:32:30.418', '2025-09-28 06:32:30.418', NULL, NULL, 57.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 49.020),
(57, 'NA3OURA 2 KG N', NULL, NULL, '2025-09-28 06:32:30.419', '2025-09-28 06:32:30.419', NULL, NULL, 32.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 27.520),
(58, 'NA3OURA 2 KG SPECIAL', NULL, NULL, '2025-09-28 06:32:30.420', '2025-09-28 06:32:30.420', NULL, NULL, 37.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 32.250),
(59, 'NA3OURA 400GR AM', NULL, NULL, '2025-09-28 06:32:30.421', '2025-09-28 06:32:30.421', NULL, NULL, 8.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 7.473),
(60, 'NA3OURA 400GR N', NULL, NULL, '2025-09-28 06:32:30.423', '2025-09-28 06:32:30.423', NULL, NULL, 7.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 5.978),
(61, 'NA3OURA 5 KG NATURE', NULL, NULL, '2025-09-28 06:32:30.424', '2025-09-28 06:32:30.424', NULL, NULL, 64.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 55.040),
(62, 'NA3OURA 5 KG SPECIAL', NULL, NULL, '2025-09-28 06:32:30.425', '2025-09-28 06:32:30.425', NULL, NULL, 70.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 60.200),
(63, 'NA3OURA 800GR AM', NULL, NULL, '2025-09-28 06:32:30.426', '2025-09-28 06:32:30.426', NULL, NULL, 16.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 14.325),
(64, 'NA3OURA 800GR N', NULL, NULL, '2025-09-28 06:32:30.427', '2025-09-28 06:32:30.427', NULL, NULL, 13.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 15, NULL, 11.158),
(65, 'PETIT FOUR', NULL, NULL, '2025-09-28 06:32:30.429', '2025-09-28 05:54:42.435', NULL, NULL, 18.00, 0.07, '1', 1, NULL, 0, 6, NULL, NULL, 1, NULL, 0, 16, NULL, 12.000),
(66, 'SABLE', NULL, NULL, '2025-09-28 06:32:30.430', '2025-09-28 05:54:42.435', NULL, NULL, 18.00, 0.07, '1', 1, NULL, 0, 5, NULL, NULL, 1, NULL, 0, 17, NULL, 10.000),
(67, 'SEAU 2.350 GR', NULL, NULL, '2025-09-28 06:32:30.432', '2025-09-28 06:32:30.432', NULL, NULL, 28.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 22.737),
(68, 'SEAU 2.350 GR CHOC', NULL, NULL, '2025-09-28 06:32:30.433', '2025-09-28 06:32:30.433', NULL, NULL, 30.00, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 25.800),
(69, 'TAHINA 400GR', NULL, NULL, '2025-09-28 06:32:30.434', '2025-09-28 06:32:30.434', NULL, NULL, 9.50, 0.19, 'NON', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 8.170),
(70, 'VERRE 20CL', NULL, NULL, '2025-09-28 06:32:30.436', '2025-09-28 05:54:42.435', NULL, NULL, 1.30, 0.19, 'NON', 1, NULL, 0, 4, NULL, NULL, 0, NULL, 0, 14, NULL, 0.500),
(71, 'VERRE 25CL', NULL, NULL, '2025-09-28 06:32:30.437', '2025-09-28 05:54:42.435', NULL, NULL, 2.00, 0.19, 'NON', 1, NULL, 0, 3, NULL, NULL, 0, NULL, 0, 14, NULL, 0.750),
(72, 'VERRE GRANITE', NULL, NULL, '2025-09-28 06:32:30.438', '2025-09-28 05:54:42.435', NULL, NULL, 2.50, 0.19, 'NON', 1, NULL, 0, 2, NULL, NULL, 0, NULL, 0, 14, NULL, 0.850);

-- --------------------------------------------------------

--
-- Structure de la table `product_conservation`
--

CREATE TABLE `product_conservation` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `depot_id` int(11) NOT NULL,
  `batch_quantity` decimal(10,3) NOT NULL,
  `remaining_quantity` decimal(10,3) NOT NULL,
  `production_date` datetime(3) NOT NULL,
  `expiration_date` datetime(3) NOT NULL,
  `is_expired` tinyint(1) NOT NULL DEFAULT 0,
  `is_warning_shown` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `product_depots`
--

CREATE TABLE `product_depots` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `depot_id` int(11) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product_depots`
--

INSERT INTO `product_depots` (`id`, `product_id`, `depot_id`, `created_at`, `updated_at`) VALUES
(1, 1, 1, '2025-09-28 06:33:28.700', '2025-09-28 06:33:28.700'),
(2, 1, 2, '2025-09-28 06:33:28.707', '2025-09-28 06:33:28.707'),
(3, 1, 3, '2025-09-28 06:33:28.708', '2025-09-28 06:33:28.708'),
(4, 1, 4, '2025-09-28 06:33:28.710', '2025-09-28 06:33:28.710'),
(5, 2, 1, '2025-09-28 06:33:28.710', '2025-09-28 06:33:28.710'),
(6, 2, 2, '2025-09-28 06:33:28.711', '2025-09-28 06:33:28.711'),
(7, 2, 3, '2025-09-28 06:33:28.712', '2025-09-28 06:33:28.712'),
(8, 2, 4, '2025-09-28 06:33:28.712', '2025-09-28 06:33:28.712'),
(9, 3, 3, '2025-09-28 06:33:28.713', '2025-09-28 06:33:28.713'),
(10, 3, 4, '2025-09-28 06:33:28.714', '2025-09-28 06:33:28.714'),
(11, 4, 3, '2025-09-28 06:33:28.714', '2025-09-28 06:33:28.714'),
(12, 5, 3, '2025-09-28 06:33:28.715', '2025-09-28 06:33:28.715'),
(13, 6, 3, '2025-09-28 06:33:28.716', '2025-09-28 06:33:28.716'),
(14, 7, 3, '2025-09-28 06:33:28.716', '2025-09-28 06:33:28.716'),
(15, 8, 3, '2025-09-28 06:33:28.717', '2025-09-28 06:33:28.717'),
(16, 9, 3, '2025-09-28 06:33:28.717', '2025-09-28 06:33:28.717'),
(17, 10, 3, '2025-09-28 06:33:28.718', '2025-09-28 06:33:28.718'),
(18, 11, 3, '2025-09-28 06:33:28.719', '2025-09-28 06:33:28.719'),
(19, 12, 3, '2025-09-28 06:33:28.719', '2025-09-28 06:33:28.719'),
(20, 13, 3, '2025-09-28 06:33:28.720', '2025-09-28 06:33:28.720'),
(21, 14, 3, '2025-09-28 06:33:28.720', '2025-09-28 06:33:28.720'),
(22, 15, 3, '2025-09-28 06:33:28.721', '2025-09-28 06:33:28.721'),
(23, 16, 3, '2025-09-28 06:33:28.722', '2025-09-28 06:33:28.722'),
(24, 17, 3, '2025-09-28 06:33:28.722', '2025-09-28 06:33:28.722'),
(25, 18, 3, '2025-09-28 06:33:28.723', '2025-09-28 06:33:28.723'),
(26, 19, 3, '2025-09-28 06:33:28.725', '2025-09-28 06:33:28.725'),
(27, 20, 3, '2025-09-28 06:33:28.726', '2025-09-28 06:33:28.726'),
(28, 21, 3, '2025-09-28 06:33:28.727', '2025-09-28 06:33:28.727'),
(29, 22, 3, '2025-09-28 06:33:28.727', '2025-09-28 06:33:28.727'),
(30, 23, 3, '2025-09-28 06:33:28.728', '2025-09-28 06:33:28.728'),
(31, 24, 3, '2025-09-28 06:33:28.729', '2025-09-28 06:33:28.729'),
(32, 25, 3, '2025-09-28 06:33:28.730', '2025-09-28 06:33:28.730'),
(33, 26, 3, '2025-09-28 06:33:28.731', '2025-09-28 06:33:28.731'),
(34, 27, 3, '2025-09-28 06:33:28.732', '2025-09-28 06:33:28.732'),
(35, 28, 3, '2025-09-28 06:33:28.733', '2025-09-28 06:33:28.733'),
(36, 29, 1, '2025-09-28 06:33:28.733', '2025-09-28 06:33:28.733'),
(37, 29, 2, '2025-09-28 06:33:28.734', '2025-09-28 06:33:28.734'),
(38, 29, 3, '2025-09-28 06:33:28.735', '2025-09-28 06:33:28.735'),
(39, 29, 4, '2025-09-28 06:33:28.736', '2025-09-28 06:33:28.736'),
(40, 30, 2, '2025-09-28 06:33:28.736', '2025-09-28 06:33:28.736'),
(41, 30, 3, '2025-09-28 06:33:28.737', '2025-09-28 06:33:28.737'),
(42, 30, 4, '2025-09-28 06:33:28.738', '2025-09-28 06:33:28.738'),
(43, 31, 2, '2025-09-28 06:33:28.738', '2025-09-28 06:33:28.738'),
(44, 31, 3, '2025-09-28 06:33:28.739', '2025-09-28 06:33:28.739'),
(45, 31, 4, '2025-09-28 06:33:28.740', '2025-09-28 06:33:28.740'),
(46, 32, 1, '2025-09-28 06:33:28.740', '2025-09-28 06:33:28.740'),
(47, 32, 2, '2025-09-28 06:33:28.741', '2025-09-28 06:33:28.741'),
(48, 32, 3, '2025-09-28 06:33:28.742', '2025-09-28 06:33:28.742'),
(49, 32, 4, '2025-09-28 06:33:28.742', '2025-09-28 06:33:28.742'),
(50, 33, 3, '2025-09-28 06:33:28.743', '2025-09-28 06:33:28.743'),
(51, 34, 3, '2025-09-28 06:33:28.744', '2025-09-28 06:33:28.744'),
(52, 35, 3, '2025-09-28 06:33:28.745', '2025-09-28 06:33:28.745'),
(53, 36, 3, '2025-09-28 06:33:28.746', '2025-09-28 06:33:28.746'),
(54, 37, 3, '2025-09-28 06:33:28.746', '2025-09-28 06:33:28.746'),
(55, 38, 3, '2025-09-28 06:33:28.747', '2025-09-28 06:33:28.747'),
(56, 39, 1, '2025-09-28 06:33:28.748', '2025-09-28 06:33:28.748'),
(57, 39, 2, '2025-09-28 06:33:28.749', '2025-09-28 06:33:28.749'),
(58, 39, 3, '2025-09-28 06:33:28.750', '2025-09-28 06:33:28.750'),
(59, 39, 4, '2025-09-28 06:33:28.750', '2025-09-28 06:33:28.750'),
(60, 40, 1, '2025-09-28 06:33:28.751', '2025-09-28 06:33:28.751'),
(61, 40, 2, '2025-09-28 06:33:28.752', '2025-09-28 06:33:28.752'),
(62, 40, 3, '2025-09-28 06:33:28.753', '2025-09-28 06:33:28.753'),
(63, 40, 4, '2025-09-28 06:33:28.754', '2025-09-28 06:33:28.754'),
(64, 41, 1, '2025-09-28 06:33:28.754', '2025-09-28 06:33:28.754'),
(65, 41, 2, '2025-09-28 06:33:28.755', '2025-09-28 06:33:28.755'),
(66, 41, 3, '2025-09-28 06:33:28.756', '2025-09-28 06:33:28.756'),
(67, 41, 4, '2025-09-28 06:33:28.757', '2025-09-28 06:33:28.757'),
(68, 42, 2, '2025-09-28 06:33:28.757', '2025-09-28 06:33:28.757'),
(69, 42, 3, '2025-09-28 06:33:28.758', '2025-09-28 06:33:28.758'),
(70, 42, 4, '2025-09-28 06:33:28.759', '2025-09-28 06:33:28.759'),
(71, 43, 2, '2025-09-28 06:33:28.760', '2025-09-28 06:33:28.760'),
(72, 43, 3, '2025-09-28 06:33:28.760', '2025-09-28 06:33:28.760'),
(73, 43, 4, '2025-09-28 06:33:28.761', '2025-09-28 06:33:28.761'),
(74, 44, 2, '2025-09-28 06:33:28.762', '2025-09-28 06:33:28.762'),
(75, 44, 3, '2025-09-28 06:33:28.763', '2025-09-28 06:33:28.763'),
(76, 44, 4, '2025-09-28 06:33:28.763', '2025-09-28 06:33:28.763'),
(77, 45, 2, '2025-09-28 06:33:28.764', '2025-09-28 06:33:28.764'),
(78, 45, 3, '2025-09-28 06:33:28.765', '2025-09-28 06:33:28.765'),
(79, 45, 4, '2025-09-28 06:33:28.766', '2025-09-28 06:33:28.766'),
(80, 46, 2, '2025-09-28 06:33:28.767', '2025-09-28 06:33:28.767'),
(81, 46, 3, '2025-09-28 06:33:28.767', '2025-09-28 06:33:28.767'),
(82, 46, 4, '2025-09-28 06:33:28.768', '2025-09-28 06:33:28.768'),
(83, 47, 2, '2025-09-28 06:33:28.769', '2025-09-28 06:33:28.769'),
(84, 47, 3, '2025-09-28 06:33:28.770', '2025-09-28 06:33:28.770'),
(85, 47, 4, '2025-09-28 06:33:28.771', '2025-09-28 06:33:28.771'),
(86, 48, 2, '2025-09-28 06:33:28.772', '2025-09-28 06:33:28.772'),
(87, 48, 3, '2025-09-28 06:33:28.772', '2025-09-28 06:33:28.772'),
(88, 48, 4, '2025-09-28 06:33:28.773', '2025-09-28 06:33:28.773'),
(89, 49, 2, '2025-09-28 06:33:28.774', '2025-09-28 06:33:28.774'),
(90, 49, 3, '2025-09-28 06:33:28.775', '2025-09-28 06:33:28.775'),
(91, 49, 4, '2025-09-28 06:33:28.776', '2025-09-28 06:33:28.776'),
(92, 50, 2, '2025-09-28 06:33:28.776', '2025-09-28 06:33:28.776'),
(93, 50, 3, '2025-09-28 06:33:28.777', '2025-09-28 06:33:28.777'),
(94, 50, 4, '2025-09-28 06:33:28.778', '2025-09-28 06:33:28.778'),
(95, 51, 2, '2025-09-28 06:33:28.779', '2025-09-28 06:33:28.779'),
(96, 51, 3, '2025-09-28 06:33:28.779', '2025-09-28 06:33:28.779'),
(97, 51, 4, '2025-09-28 06:33:28.780', '2025-09-28 06:33:28.780'),
(98, 52, 2, '2025-09-28 06:33:28.781', '2025-09-28 06:33:28.781'),
(99, 52, 3, '2025-09-28 06:33:28.781', '2025-09-28 06:33:28.781'),
(100, 52, 4, '2025-09-28 06:33:28.782', '2025-09-28 06:33:28.782'),
(101, 53, 2, '2025-09-28 06:33:28.783', '2025-09-28 06:33:28.783'),
(102, 53, 3, '2025-09-28 06:33:28.784', '2025-09-28 06:33:28.784'),
(103, 53, 4, '2025-09-28 06:33:28.784', '2025-09-28 06:33:28.784'),
(104, 54, 1, '2025-09-28 06:33:28.785', '2025-09-28 06:33:28.785'),
(105, 54, 2, '2025-09-28 06:33:28.786', '2025-09-28 06:33:28.786'),
(106, 54, 3, '2025-09-28 06:33:28.787', '2025-09-28 06:33:28.787'),
(107, 54, 4, '2025-09-28 06:33:28.787', '2025-09-28 06:33:28.787'),
(108, 55, 3, '2025-09-28 06:33:28.788', '2025-09-28 06:33:28.788'),
(109, 56, 3, '2025-09-28 06:33:28.789', '2025-09-28 06:33:28.789'),
(110, 57, 3, '2025-09-28 06:33:28.790', '2025-09-28 06:33:28.790'),
(111, 58, 3, '2025-09-28 06:33:28.791', '2025-09-28 06:33:28.791'),
(112, 59, 3, '2025-09-28 06:33:28.792', '2025-09-28 06:33:28.792'),
(113, 60, 3, '2025-09-28 06:33:28.792', '2025-09-28 06:33:28.792'),
(114, 61, 3, '2025-09-28 06:33:28.793', '2025-09-28 06:33:28.793'),
(115, 62, 3, '2025-09-28 06:33:28.794', '2025-09-28 06:33:28.794'),
(116, 63, 3, '2025-09-28 06:33:28.795', '2025-09-28 06:33:28.795'),
(117, 64, 3, '2025-09-28 06:33:28.796', '2025-09-28 06:33:28.796'),
(118, 65, 1, '2025-09-28 06:33:28.796', '2025-09-28 06:33:28.796'),
(119, 65, 2, '2025-09-28 06:33:28.797', '2025-09-28 06:33:28.797'),
(120, 65, 3, '2025-09-28 06:33:28.798', '2025-09-28 06:33:28.798'),
(121, 65, 4, '2025-09-28 06:33:28.799', '2025-09-28 06:33:28.799'),
(122, 66, 1, '2025-09-28 06:33:28.800', '2025-09-28 06:33:28.800'),
(123, 66, 2, '2025-09-28 06:33:28.800', '2025-09-28 06:33:28.800'),
(124, 66, 3, '2025-09-28 06:33:28.801', '2025-09-28 06:33:28.801'),
(125, 66, 4, '2025-09-28 06:33:28.802', '2025-09-28 06:33:28.802'),
(126, 67, 3, '2025-09-28 06:33:28.803', '2025-09-28 06:33:28.803'),
(127, 68, 3, '2025-09-28 06:33:28.803', '2025-09-28 06:33:28.803'),
(128, 69, 3, '2025-09-28 06:33:28.804', '2025-09-28 06:33:28.804'),
(129, 70, 3, '2025-09-28 06:33:28.804', '2025-09-28 06:33:28.804'),
(130, 70, 4, '2025-09-28 06:33:28.805', '2025-09-28 06:33:28.805'),
(131, 71, 3, '2025-09-28 06:33:28.806', '2025-09-28 06:33:28.806'),
(132, 71, 4, '2025-09-28 06:33:28.806', '2025-09-28 06:33:28.806'),
(133, 72, 3, '2025-09-28 06:33:28.807', '2025-09-28 06:33:28.807'),
(134, 72, 4, '2025-09-28 06:33:28.808', '2025-09-28 06:33:28.808');

-- --------------------------------------------------------

--
-- Structure de la table `product_families`
--

CREATE TABLE `product_families` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `photo` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product_families`
--

INSERT INTO `product_families` (`id`, `name`, `description`, `photo`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'ARGENT', NULL, NULL, 1, '2025-09-28 06:32:21.755', '2025-09-28 06:32:21.755'),
(2, 'CHAHRAZED', NULL, NULL, 1, '2025-09-28 06:32:21.776', '2025-09-28 06:32:21.776'),
(3, 'CHEMIA VRAC', NULL, NULL, 1, '2025-09-28 06:32:21.789', '2025-09-28 06:32:21.789'),
(4, 'CROCANT', NULL, NULL, 1, '2025-09-28 06:32:21.802', '2025-09-28 07:11:32.161'),
(5, 'DECHET KAKAWIA', NULL, NULL, 1, '2025-09-28 06:32:21.814', '2025-09-28 07:11:32.180'),
(6, 'DECHET LOUZ', NULL, NULL, 1, '2025-09-28 06:32:21.826', '2025-09-28 07:11:32.193'),
(7, 'EAU', NULL, NULL, 1, '2025-09-28 06:32:21.838', '2025-09-28 06:32:21.838'),
(8, 'GATEAUX SOWABAA', NULL, NULL, 1, '2025-09-28 06:32:21.849', '2025-09-28 07:11:32.205'),
(9, 'HALKOUM', NULL, NULL, 1, '2025-09-28 06:32:21.859', '2025-09-28 06:32:21.859'),
(10, 'HLOU ARBI', NULL, NULL, 1, '2025-09-28 06:32:21.871', '2025-09-28 07:11:32.217'),
(11, 'HLOU KAKAWIA', NULL, NULL, 1, '2025-09-28 06:32:21.882', '2025-09-28 07:11:32.230'),
(12, 'HLOU LOUZ', NULL, NULL, 1, '2025-09-28 06:32:21.893', '2025-09-28 07:11:32.242'),
(13, 'JUS', NULL, NULL, 1, '2025-09-28 06:32:21.905', '2025-09-28 06:32:21.905'),
(14, 'JUS VRAC', NULL, NULL, 1, '2025-09-28 06:32:21.915', '2025-09-28 06:32:21.915'),
(15, 'NA3OURA', NULL, NULL, 1, '2025-09-28 06:32:21.928', '2025-09-28 06:32:21.928'),
(16, 'PETIT FOUR', NULL, NULL, 1, '2025-09-28 06:32:21.941', '2025-09-28 07:11:32.255'),
(17, 'SABLE', NULL, NULL, 1, '2025-09-28 06:32:21.952', '2025-09-28 07:11:32.267');

-- --------------------------------------------------------

--
-- Structure de la table `produits_de_caisse`
--

CREATE TABLE `produits_de_caisse` (
  `id` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `product_ids` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `barcode` varchar(50) DEFAULT NULL,
  `bundle_price` decimal(10,2) DEFAULT NULL,
  `bundle_size` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `designation_legale` varchar(200) DEFAULT NULL,
  `display_index` int(11) DEFAULT NULL,
  `duree_conservation` int(11) DEFAULT NULL,
  `famille_id` int(11) NOT NULL,
  `initial_stock` decimal(10,3) DEFAULT NULL,
  `is_stockable` tinyint(1) NOT NULL DEFAULT 1,
  `is_vrac` tinyint(1) NOT NULL DEFAULT 0,
  `is_vraguable` tinyint(1) NOT NULL DEFAULT 0,
  `is_wholesale` tinyint(1) NOT NULL DEFAULT 0,
  `max_stock` decimal(10,3) DEFAULT NULL,
  `min_stock` decimal(10,3) DEFAULT NULL,
  `original_product_id` int(11) DEFAULT NULL,
  `photo` varchar(255) DEFAULT NULL,
  `prix_achat` decimal(10,3) DEFAULT NULL,
  `prix_vente_ttc` decimal(10,2) NOT NULL,
  `tva` decimal(5,2) NOT NULL DEFAULT 19.00,
  `unite` varchar(20) NOT NULL DEFAULT 'pcs',
  `parent_product_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `produits_de_caisse`
--

INSERT INTO `produits_de_caisse` (`id`, `name`, `product_ids`, `is_active`, `created_at`, `updated_at`, `barcode`, `bundle_price`, `bundle_size`, `description`, `designation_legale`, `display_index`, `duree_conservation`, `famille_id`, `initial_stock`, `is_stockable`, `is_vrac`, `is_vraguable`, `is_wholesale`, `max_stock`, `min_stock`, `original_product_id`, `photo`, `prix_achat`, `prix_vente_ttc`, `tva`, `unite`, `parent_product_id`) VALUES
(1, 'ABYADH NOISETTE', '', 1, '2025-09-28 07:11:43.449', '2025-09-28 07:11:43.449', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 8.000, 18.00, 19.00, 'pcs', 39),
(2, 'AJNAB BAKLAWA KAKAWIA', '', 1, '2025-09-28 07:11:43.470', '2025-09-28 07:11:43.470', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 7.000, 12.00, 0.07, 'NON', 1),
(3, 'AJNAB BAKLAWA LOUZ', '', 1, '2025-09-28 07:11:43.483', '2025-09-28 07:11:43.483', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 6, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 15.000, 24.00, 0.07, 'NON', 2),
(4, 'BAKLAWA AMANDE', '', 1, '2025-09-28 07:11:43.497', '2025-09-28 07:11:43.497', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 30.000, 58.00, 19.00, 'pcs', 41),
(5, 'BAKLAWA KAKWIA', '', 1, '2025-09-28 07:11:43.511', '2025-09-28 07:11:43.511', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 16.000, 30.00, 19.00, 'pcs', 40),
(6, 'BJEWIYA', '', 1, '2025-09-28 07:11:43.525', '2025-09-28 07:11:43.525', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 30.000, 58.00, 19.00, 'pcs', 41),
(7, 'CHOCOLAT KAKAWIA', '', 1, '2025-09-28 07:11:43.538', '2025-09-28 07:11:43.538', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 16.000, 30.00, 19.00, 'pcs', 40),
(8, 'CROCANT', '', 1, '2025-09-28 07:11:43.554', '2025-09-28 07:11:43.554', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 6.000, 12.00, 0.07, '1', 29),
(9, 'GATEAUX SOWABAA', '', 1, '2025-09-28 07:11:43.571', '2025-09-28 07:11:43.571', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 8, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 6.000, 12.00, 0.07, '1', 32),
(10, 'HLOU KAKAWIA', '', 1, '2025-09-28 07:11:43.589', '2025-09-28 07:11:43.589', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 16.000, 30.00, 0.07, '1', 40),
(11, 'HLOU LOUZ', '', 1, '2025-09-28 07:11:43.606', '2025-09-28 07:11:43.606', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 30.000, 58.00, 0.07, '1', 41),
(12, 'HOMSIA', '', 1, '2025-09-28 07:11:43.623', '2025-09-28 07:11:43.623', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 8.000, 18.00, 19.00, 'pcs', 39),
(13, 'JALJLENIA', '', 1, '2025-09-28 07:11:43.637', '2025-09-28 07:11:43.637', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 16.000, 30.00, 19.00, 'pcs', 40),
(14, 'LOUZIA', '', 1, '2025-09-28 07:11:43.654', '2025-09-28 07:11:43.654', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 16, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 0.500, 1.20, 0.07, 'NON', 65),
(15, 'MAACHAACH', '', 1, '2025-09-28 07:11:43.668', '2025-09-28 07:11:43.668', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 16.000, 30.00, 19.00, 'pcs', 40),
(16, 'MAKROUDH ASMAR', '', 1, '2025-09-28 07:11:43.684', '2025-09-28 07:11:43.684', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 8.000, 18.00, 0.07, '1', 39),
(17, 'MAKROUDH DRO3', '', 1, '2025-09-28 07:11:43.700', '2025-09-28 07:11:43.700', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 8.000, 18.00, 19.00, 'pcs', 39),
(18, 'MARROCAIN', '', 1, '2025-09-28 07:11:43.713', '2025-09-28 07:11:43.713', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 16.000, 30.00, 19.00, 'pcs', 40),
(19, 'MARROCAIN AMANDE', '', 1, '2025-09-28 07:11:43.726', '2025-09-28 07:11:43.726', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 30.000, 58.00, 0.07, '1', 41),
(20, 'PETIT FOUR', '', 1, '2025-09-28 07:11:59.701', '2025-09-28 07:11:59.701', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 16, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 9.000, 18.00, 0.07, '1', 65),
(21, 'SABLE', '', 1, '2025-09-28 07:11:59.717', '2025-09-28 07:11:59.717', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 17, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 7.000, 18.00, 0.07, '1', 66);

-- --------------------------------------------------------

--
-- Structure de la table `produit_de_caisse_depot`
--

CREATE TABLE `produit_de_caisse_depot` (
  `id` int(11) NOT NULL,
  `produit_de_caisse_id` int(11) NOT NULL,
  `depot_id` int(11) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `produit_de_caisse_depot`
--

INSERT INTO `produit_de_caisse_depot` (`id`, `produit_de_caisse_id`, `depot_id`, `created_at`, `updated_at`) VALUES
(1, 1, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(2, 2, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(3, 3, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(4, 4, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(5, 5, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(6, 6, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(7, 7, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(8, 8, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(9, 9, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(10, 10, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(11, 11, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(12, 12, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(13, 13, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(14, 14, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(15, 15, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(16, 16, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(17, 17, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(18, 18, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(19, 19, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(21, 20, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675'),
(22, 21, 1, '2025-09-28 07:12:06.675', '2025-09-28 07:12:06.675');

-- --------------------------------------------------------

--
-- Structure de la table `rebut_records`
--

CREATE TABLE `rebut_records` (
  `id` int(11) NOT NULL,
  `request_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `depot_id` int(11) NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `status` enum('PENDING_AUTHORITY','ARCHIVED') NOT NULL DEFAULT 'PENDING_AUTHORITY',
  `notes` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `authority_approved_at` datetime(3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `return_items`
--

CREATE TABLE `return_items` (
  `id` int(11) NOT NULL,
  `request_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `requested_qty` decimal(10,3) NOT NULL,
  `disposition` enum('NONE','NON_REBUT','REBUT') DEFAULT 'NONE',
  `non_rebut_qty` decimal(10,3) DEFAULT NULL,
  `rebut_qty` decimal(10,3) DEFAULT NULL,
  `reason` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `return_requests`
--

CREATE TABLE `return_requests` (
  `id` int(11) NOT NULL,
  `numero` varchar(50) NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED','PROCESSED') NOT NULL DEFAULT 'PENDING',
  `depot_id` int(11) NOT NULL,
  `requested_by_id` int(11) NOT NULL,
  `approved_by_id` int(11) DEFAULT NULL,
  `approved_at` datetime(3) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `original_sale_id` int(11) DEFAULT NULL,
  `original_sale_total` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `sales`
--

CREATE TABLE `sales` (
  `id` int(11) NOT NULL,
  `total` decimal(10,3) NOT NULL,
  `discount` decimal(10,3) NOT NULL DEFAULT 0.000,
  `final_total` decimal(10,3) NOT NULL,
  `payment_method_id` int(11) DEFAULT NULL,
  `status` enum('PENDING','COMPLETED','CANCELLED','REFUNDED','TEMPORARY','PENDING_ADMIN','CADEAU','CMD_TERMINEE') NOT NULL DEFAULT 'PENDING',
  `depot_id` int(11) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `expected_date` datetime(3) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `client_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `advance_payment` decimal(10,3) DEFAULT 0.000,
  `advance_payment_date` datetime(3) DEFAULT NULL,
  `advance_payment_method_id` int(11) DEFAULT NULL,
  `advance_payment_notes` text DEFAULT NULL,
  `payment_type` enum('COMPTANT','CREDIT') NOT NULL DEFAULT 'COMPTANT',
  `session_id` int(11) DEFAULT NULL,
  `is_wholesale` tinyint(1) NOT NULL DEFAULT 0,
  `daily_ticket_number` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `sale_items`
--

CREATE TABLE `sale_items` (
  `id` int(11) NOT NULL,
  `sale_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `product_name` varchar(200) NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `discount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `bundle_price` decimal(10,2) DEFAULT NULL,
  `bundle_quantity` decimal(10,3) DEFAULT NULL,
  `bundle_size` int(11) DEFAULT NULL,
  `is_approved` tinyint(1) NOT NULL DEFAULT 0,
  `is_wholesale` tinyint(1) NOT NULL DEFAULT 0,
  `margin_percent` decimal(5,2) DEFAULT NULL,
  `requires_approval` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `session_caisse`
--

CREATE TABLE `session_caisse` (
  `id` int(11) NOT NULL,
  `pos_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `depot_id` int(11) DEFAULT NULL,
  `magasin_id` int(11) DEFAULT NULL,
  `opened_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `closed_at` datetime(3) DEFAULT NULL,
  `opening_fund` decimal(12,3) NOT NULL,
  `expected_cash` decimal(12,3) NOT NULL,
  `counted_cash` decimal(12,3) DEFAULT NULL,
  `variance` decimal(12,3) DEFAULT NULL,
  `status` enum('OPEN','CLOSED','REOPENED','ADMIN_CORRECTED') NOT NULL DEFAULT 'OPEN',
  `x_seq` int(11) NOT NULL DEFAULT 0,
  `z_seq` int(11) NOT NULL DEFAULT 0,
  `note` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `original_counted_cash` decimal(12,3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stock_documents`
--

CREATE TABLE `stock_documents` (
  `id` int(11) NOT NULL,
  `numero` varchar(50) NOT NULL,
  `type` enum('BON_EXPEDITION','BON_ENTREE_DEPOT','BON_TRANSFERT','BON_ENTREE_MAGASIN') NOT NULL,
  `status` enum('PREPARED','SENT','RECEIVED','CANCELLED') NOT NULL DEFAULT 'PREPARED',
  `emetteur_id` int(11) NOT NULL,
  `destinataire_id` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stock_document_items`
--

CREATE TABLE `stock_document_items` (
  `id` int(11) NOT NULL,
  `document_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `famille` varchar(100) NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `batch` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `barcode` varchar(50) DEFAULT NULL,
  `purchase_price` decimal(10,3) DEFAULT NULL,
  `count` int(11) DEFAULT 1,
  `montant_ht` decimal(10,3) DEFAULT NULL,
  `montant_ttc` decimal(10,3) DEFAULT NULL,
  `montant_tva` decimal(10,3) DEFAULT NULL,
  `prix_unitaire` decimal(10,3) DEFAULT NULL,
  `tva` decimal(5,2) DEFAULT 19.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stock_document_links`
--

CREATE TABLE `stock_document_links` (
  `id` int(11) NOT NULL,
  `source_document_id` int(11) NOT NULL,
  `target_document_id` int(11) NOT NULL,
  `linkType` varchar(50) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stock_movements`
--

CREATE TABLE `stock_movements` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `depot_id` int(11) NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `type` enum('IN','OUT','TRANSFER') NOT NULL,
  `from_depot_id` int(11) DEFAULT NULL,
  `to_depot_id` int(11) DEFAULT NULL,
  `reason` varchar(200) NOT NULL,
  `reference` varchar(100) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stock_transfers`
--

CREATE TABLE `stock_transfers` (
  `id` int(11) NOT NULL,
  `from_depot_id` int(11) NOT NULL,
  `to_depot_id` int(11) NOT NULL,
  `status` enum('PENDING','APPROVED','TRANSFERRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `requested_by` int(11) NOT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `requested_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `approved_at` datetime(3) DEFAULT NULL,
  `transferred_at` datetime(3) DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stock_transfer_items`
--

CREATE TABLE `stock_transfer_items` (
  `id` int(11) NOT NULL,
  `transfer_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `transferred_quantity` decimal(10,3) NOT NULL DEFAULT 0.000
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `suppliers`
--

CREATE TABLE `suppliers` (
  `id` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `contact_name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `tax_number` varchar(50) DEFAULT NULL,
  `payment_terms` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `current_debt` decimal(12,3) NOT NULL DEFAULT 0.000
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `supplier_debt_transactions`
--

CREATE TABLE `supplier_debt_transactions` (
  `id` int(11) NOT NULL,
  `supplier_id` int(11) NOT NULL,
  `expense_id` int(11) DEFAULT NULL,
  `amount` decimal(12,3) NOT NULL,
  `type` varchar(20) NOT NULL,
  `notes` text DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `supplier_payments`
--

CREATE TABLE `supplier_payments` (
  `id` int(11) NOT NULL,
  `supplier_id` int(11) NOT NULL,
  `amount` decimal(12,3) NOT NULL,
  `payment_date` datetime(3) NOT NULL,
  `payment_method` varchar(20) NOT NULL DEFAULT 'CASH',
  `reference` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `role` enum('ADMIN','MANAGER','CASHIER','STOCK_MANAGER','EMPLOYEE') NOT NULL,
  `depot_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `pin` varchar(8) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `depot_id`, `is_active`, `last_login`, `created_at`, `updated_at`, `pin`) VALUES
(1, 'manager', 'manager@patisserie.tn', '$2a$12$AXcHIfSeGgrgTTZqv4.7nOLCK.273dXIw3TNHUZq83WKrtsFOj6IC', 'Nadhir', 'Hentati', 'MANAGER', 1, 1, NULL, '2025-09-27 18:07:21.001', '2025-09-27 21:13:57.833', '2200'),
(2, 'stock', 'stock@patisserie.tn', '$2a$12$iUTL/UgzyHigeKschOCPwOhpFUubK8kWsTNZJonDOWZZzZ6bjG35u', 'Wael', 'Khemakhem', 'MANAGER', 3, 1, '2025-09-27 21:25:08.597', '2025-09-27 18:07:21.001', '2025-09-27 21:25:08.598', '3300'),
(3, 'cashier', 'cashier@patisserie.tn', '$2a$12$5ginyrHJIUbrfJU.nqA.ned0Ai/4WB7wM3PWdxnk/kzEzhsyV0eBK', 'Safa', 'Bouaziz', 'CASHIER', 3, 1, NULL, '2025-09-27 18:07:21.001', '2025-09-27 21:15:40.314', '4400'),
(4, 'admin', 'admin@patisserie.tn', '$2a$12$7Av.XZBSYNocA9jMW2mKiOk8nwh1OzlDIwk6GdA0rrdVXeZJ/MsOa', 'Admin', 'Principal', 'ADMIN', 1, 1, '2025-09-28 06:18:17.657', '2025-09-27 18:07:21.001', '2025-09-28 06:18:17.658', '1100'),
(5, 'mostpha.mostpha', 'mostpha.mostpha@company.com', '$2a$12$9MtQdjxYQ0zrUdZaUYfZBeCmQo4EBHzk6XsX9bpnuRc5wQeh6V6aC', 'Mostpha', 'Mostpha', 'MANAGER', 4, 1, '2025-09-27 21:25:17.176', '2025-09-27 21:17:05.731', '2025-09-27 21:25:17.177', '5500'),
(6, 'responsable .1', 'responsable .1@company.com', '$2a$12$CIVFXwreVXX5UVrVBcVNP.JWZR2SFo4Gqnt2lzL1p2Au3pwfNfcQS', 'Responsable', '1', 'MANAGER', 2, 1, NULL, '2025-09-27 21:17:58.749', '2025-09-27 21:17:58.749', '6600'),
(7, 'caisier .1', 'caisier .1@company.com', '$2a$12$zURgtNqBbiVCeOgL2Kww3.c2zn22I9Vq2L9D1yjENX2Ll33TJWXne', 'Caisier', '1', 'CASHIER', 4, 1, '2025-09-27 21:25:25.606', '2025-09-27 21:18:58.477', '2025-09-27 21:25:25.607', '7700');

-- --------------------------------------------------------

--
-- Structure de la table `vehicles`
--

CREATE TABLE `vehicles` (
  `id` int(11) NOT NULL,
  `matricule` varchar(20) NOT NULL,
  `model` varchar(100) NOT NULL,
  `brand_id` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `vehicle_brands`
--

CREATE TABLE `vehicle_brands` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `models` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `logoUrl` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `vrac_prices`
--

CREATE TABLE `vrac_prices` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `start_date` datetime(3) NOT NULL,
  `end_date` datetime(3) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `wholesale_rules`
--

CREATE TABLE `wholesale_rules` (
  `id` varchar(191) NOT NULL,
  `rule_type` varchar(20) NOT NULL,
  `value` decimal(10,3) NOT NULL,
  `description` varchar(200) NOT NULL,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `_prisma_migrations`
--

CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `_prisma_migrations`
--

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
('8e33dd46-4ed7-4448-b971-2eba2ab37407', '0cedf75c78d9b0cb5adbedeab92a1a0023893fc593b435f9100084afc896c46d', '2025-09-27 18:07:03.672', '20250101000000_initial_baseline', NULL, NULL, '2025-09-27 18:07:03.670', 1);

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `app_settings`
--
ALTER TABLE `app_settings`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `attendance_corrections`
--
ALTER TABLE `attendance_corrections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `attendance_corrections_status_idx` (`status`),
  ADD KEY `attendance_corrections_day_id_fkey` (`day_id`),
  ADD KEY `attendance_corrections_requested_by_fkey` (`requested_by`),
  ADD KEY `attendance_corrections_reviewed_by_fkey` (`reviewed_by`);

--
-- Index pour la table `attendance_days`
--
ALTER TABLE `attendance_days`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `attendance_days_userId_date_key` (`userId`,`date`),
  ADD KEY `attendance_days_depotId_date_idx` (`depotId`,`date`);

--
-- Index pour la table `attendance_punches`
--
ALTER TABLE `attendance_punches`
  ADD PRIMARY KEY (`id`),
  ADD KEY `attendance_punches_userId_timestamp_idx` (`userId`,`timestamp`);

--
-- Index pour la table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `audit_logs_user_id_fkey` (`user_id`);

--
-- Index pour la table `cash_movements`
--
ALTER TABLE `cash_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cash_movements_created_by_id_fkey` (`created_by_id`),
  ADD KEY `cash_movements_session_id_fkey` (`session_id`);

--
-- Index pour la table `change_requests`
--
ALTER TABLE `change_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `change_requests_approved_by_fkey` (`approved_by`),
  ADD KEY `change_requests_requested_by_fkey` (`requested_by`);

--
-- Index pour la table `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `clients_code_key` (`code`),
  ADD UNIQUE KEY `clients_email_key` (`email`),
  ADD KEY `clients_depot_id_fkey` (`depot_id`);

--
-- Index pour la table `client_debt_transactions`
--
ALTER TABLE `client_debt_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `client_debt_transactions_client_id_fkey` (`client_id`),
  ADD KEY `client_debt_transactions_sale_id_fkey` (`sale_id`),
  ADD KEY `client_debt_transactions_user_id_fkey` (`user_id`);

--
-- Index pour la table `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `depots`
--
ALTER TABLE `depots`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `depots_code_key` (`code`),
  ADD UNIQUE KEY `depots_manager_id_key` (`manager_id`),
  ADD KEY `depots_company_id_fkey` (`company_id`);

--
-- Index pour la table `document_status_history`
--
ALTER TABLE `document_status_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `document_status_history_document_id_fkey` (`document_id`),
  ADD KEY `document_status_history_user_id_fkey` (`user_id`);

--
-- Index pour la table `drivers`
--
ALTER TABLE `drivers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `drivers_cin_key` (`cin`),
  ADD KEY `drivers_depot_id_fkey` (`depot_id`);

--
-- Index pour la table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `expenses_approved_by_fkey` (`approved_by`),
  ADD KEY `expenses_category_id_fkey` (`category_id`),
  ADD KEY `expenses_depot_id_fkey` (`depot_id`),
  ADD KEY `expenses_paid_by_fkey` (`paid_by`),
  ADD KEY `expenses_supplier_id_fkey` (`supplier_id`),
  ADD KEY `expenses_user_id_fkey` (`user_id`);

--
-- Index pour la table `expense_categories`
--
ALTER TABLE `expense_categories`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `inventory`
--
ALTER TABLE `inventory`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `inventory_depot_id_product_id_key` (`depot_id`,`product_id`),
  ADD KEY `inventory_product_id_fkey` (`product_id`);

--
-- Index pour la table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `inventory_items_session_id_product_id_key` (`session_id`,`product_id`),
  ADD KEY `inventory_items_counted_by_fkey` (`counted_by`),
  ADD KEY `inventory_items_product_id_fkey` (`product_id`);

--
-- Index pour la table `inventory_sessions`
--
ALTER TABLE `inventory_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `inventory_sessions_numero_key` (`numero`),
  ADD KEY `inventory_sessions_closed_by_fkey` (`closed_by`),
  ADD KEY `inventory_sessions_depot_id_fkey` (`depot_id`),
  ADD KEY `inventory_sessions_posted_by_fkey` (`posted_by`),
  ADD KEY `inventory_sessions_started_by_fkey` (`started_by`);

--
-- Index pour la table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoices_invoice_number_key` (`invoice_number`),
  ADD KEY `invoices_client_id_fkey` (`client_id`),
  ADD KEY `invoices_company_id_fkey` (`company_id`),
  ADD KEY `invoices_created_by_id_fkey` (`created_by_id`),
  ADD KEY `invoices_depot_id_fkey` (`depot_id`),
  ADD KEY `invoices_sale_id_fkey` (`sale_id`);

--
-- Index pour la table `invoice_lines`
--
ALTER TABLE `invoice_lines`
  ADD PRIMARY KEY (`id`),
  ADD KEY `invoice_lines_invoice_id_fkey` (`invoice_id`),
  ADD KEY `invoice_lines_product_id_fkey` (`product_id`);

--
-- Index pour la table `invoice_requests`
--
ALTER TABLE `invoice_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoice_requests_invoice_id_key` (`invoice_id`),
  ADD KEY `invoice_requests_approved_by_id_fkey` (`approved_by_id`),
  ADD KEY `invoice_requests_requested_by_id_fkey` (`requested_by_id`),
  ADD KEY `invoice_requests_sale_id_fkey` (`sale_id`);

--
-- Index pour la table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `notifications_user_id_fkey` (`user_id`);

--
-- Index pour la table `outbox`
--
ALTER TABLE `outbox`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `payment_methods`
--
ALTER TABLE `payment_methods`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `products_barcode_key` (`barcode`),
  ADD KEY `products_famille_id_fkey` (`famille_id`),
  ADD KEY `products_original_product_id_fkey` (`original_product_id`);

--
-- Index pour la table `product_conservation`
--
ALTER TABLE `product_conservation`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_conservation_depot_id_fkey` (`depot_id`),
  ADD KEY `product_conservation_product_id_fkey` (`product_id`);

--
-- Index pour la table `product_depots`
--
ALTER TABLE `product_depots`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `product_depots_product_id_depot_id_key` (`product_id`,`depot_id`),
  ADD KEY `product_depots_product_id_fkey` (`product_id`),
  ADD KEY `product_depots_depot_id_fkey` (`depot_id`);

--
-- Index pour la table `product_families`
--
ALTER TABLE `product_families`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `product_families_name_key` (`name`);

--
-- Index pour la table `produits_de_caisse`
--
ALTER TABLE `produits_de_caisse`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `produits_de_caisse_barcode_key` (`barcode`),
  ADD KEY `produits_de_caisse_famille_id_fkey` (`famille_id`),
  ADD KEY `produits_de_caisse_original_product_id_fkey` (`original_product_id`),
  ADD KEY `produits_de_caisse_parent_product_id_fkey` (`parent_product_id`);

--
-- Index pour la table `produit_de_caisse_depot`
--
ALTER TABLE `produit_de_caisse_depot`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_produit_depot` (`produit_de_caisse_id`,`depot_id`),
  ADD KEY `produit_de_caisse_depot_depot_id_fkey` (`depot_id`);

--
-- Index pour la table `rebut_records`
--
ALTER TABLE `rebut_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `rebut_records_item_id_key` (`item_id`),
  ADD KEY `rebut_records_depot_id_fkey` (`depot_id`),
  ADD KEY `rebut_records_product_id_fkey` (`product_id`),
  ADD KEY `rebut_records_request_id_fkey` (`request_id`);

--
-- Index pour la table `return_items`
--
ALTER TABLE `return_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `return_items_product_id_fkey` (`product_id`),
  ADD KEY `return_items_request_id_fkey` (`request_id`);

--
-- Index pour la table `return_requests`
--
ALTER TABLE `return_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `return_requests_numero_key` (`numero`),
  ADD KEY `return_requests_approved_by_id_fkey` (`approved_by_id`),
  ADD KEY `return_requests_depot_id_fkey` (`depot_id`),
  ADD KEY `return_requests_requested_by_id_fkey` (`requested_by_id`);

--
-- Index pour la table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sales_advance_payment_method_id_fkey` (`advance_payment_method_id`),
  ADD KEY `sales_client_id_fkey` (`client_id`),
  ADD KEY `sales_depot_id_fkey` (`depot_id`),
  ADD KEY `sales_payment_method_id_fkey` (`payment_method_id`),
  ADD KEY `sales_session_id_fkey` (`session_id`),
  ADD KEY `sales_user_id_fkey` (`user_id`);

--
-- Index pour la table `sale_items`
--
ALTER TABLE `sale_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sale_items_product_id_fkey` (`product_id`),
  ADD KEY `sale_items_sale_id_fkey` (`sale_id`);

--
-- Index pour la table `session_caisse`
--
ALTER TABLE `session_caisse`
  ADD PRIMARY KEY (`id`),
  ADD KEY `session_caisse_depot_id_fkey` (`depot_id`),
  ADD KEY `session_caisse_user_id_fkey` (`user_id`);

--
-- Index pour la table `stock_documents`
--
ALTER TABLE `stock_documents`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `stock_documents_numero_key` (`numero`),
  ADD KEY `stock_documents_destinataire_id_fkey` (`destinataire_id`),
  ADD KEY `stock_documents_emetteur_id_fkey` (`emetteur_id`);

--
-- Index pour la table `stock_document_items`
--
ALTER TABLE `stock_document_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `stock_document_items_barcode_key` (`barcode`),
  ADD KEY `stock_document_items_document_id_fkey` (`document_id`),
  ADD KEY `stock_document_items_product_id_fkey` (`product_id`);

--
-- Index pour la table `stock_document_links`
--
ALTER TABLE `stock_document_links`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `stock_document_links_source_document_id_target_document_id_key` (`source_document_id`,`target_document_id`),
  ADD KEY `stock_document_links_target_document_id_fkey` (`target_document_id`);

--
-- Index pour la table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `stock_movements_depot_id_fkey` (`depot_id`),
  ADD KEY `stock_movements_from_depot_id_fkey` (`from_depot_id`),
  ADD KEY `stock_movements_product_id_fkey` (`product_id`),
  ADD KEY `stock_movements_to_depot_id_fkey` (`to_depot_id`),
  ADD KEY `stock_movements_user_id_fkey` (`user_id`);

--
-- Index pour la table `stock_transfers`
--
ALTER TABLE `stock_transfers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `stock_transfers_approved_by_fkey` (`approved_by`),
  ADD KEY `stock_transfers_from_depot_id_fkey` (`from_depot_id`),
  ADD KEY `stock_transfers_requested_by_fkey` (`requested_by`),
  ADD KEY `stock_transfers_to_depot_id_fkey` (`to_depot_id`);

--
-- Index pour la table `stock_transfer_items`
--
ALTER TABLE `stock_transfer_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `stock_transfer_items_product_id_fkey` (`product_id`),
  ADD KEY `stock_transfer_items_transfer_id_fkey` (`transfer_id`);

--
-- Index pour la table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `supplier_debt_transactions`
--
ALTER TABLE `supplier_debt_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `supplier_debt_transactions_expense_id_fkey` (`expense_id`),
  ADD KEY `supplier_debt_transactions_supplier_id_fkey` (`supplier_id`),
  ADD KEY `supplier_debt_transactions_user_id_fkey` (`user_id`);

--
-- Index pour la table `supplier_payments`
--
ALTER TABLE `supplier_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `supplier_payments_supplier_id_fkey` (`supplier_id`),
  ADD KEY `supplier_payments_user_id_fkey` (`user_id`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_username_key` (`username`),
  ADD UNIQUE KEY `users_email_key` (`email`),
  ADD UNIQUE KEY `users_pin_key` (`pin`),
  ADD KEY `users_depot_id_fkey` (`depot_id`);

--
-- Index pour la table `vehicles`
--
ALTER TABLE `vehicles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `vehicles_matricule_key` (`matricule`),
  ADD KEY `vehicles_brand_id_fkey` (`brand_id`);

--
-- Index pour la table `vehicle_brands`
--
ALTER TABLE `vehicle_brands`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `vehicle_brands_name_key` (`name`);

--
-- Index pour la table `vrac_prices`
--
ALTER TABLE `vrac_prices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `vrac_prices_product_id_fkey` (`product_id`);

--
-- Index pour la table `wholesale_rules`
--
ALTER TABLE `wholesale_rules`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `_prisma_migrations`
--
ALTER TABLE `_prisma_migrations`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `app_settings`
--
ALTER TABLE `app_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `attendance_corrections`
--
ALTER TABLE `attendance_corrections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `attendance_days`
--
ALTER TABLE `attendance_days`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `attendance_punches`
--
ALTER TABLE `attendance_punches`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `cash_movements`
--
ALTER TABLE `cash_movements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `change_requests`
--
ALTER TABLE `change_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `clients`
--
ALTER TABLE `clients`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `client_debt_transactions`
--
ALTER TABLE `client_debt_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `companies`
--
ALTER TABLE `companies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `depots`
--
ALTER TABLE `depots`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `document_status_history`
--
ALTER TABLE `document_status_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `drivers`
--
ALTER TABLE `drivers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `expenses`
--
ALTER TABLE `expenses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `expense_categories`
--
ALTER TABLE `expense_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `inventory`
--
ALTER TABLE `inventory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `inventory_items`
--
ALTER TABLE `inventory_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `inventory_sessions`
--
ALTER TABLE `inventory_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `invoice_lines`
--
ALTER TABLE `invoice_lines`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `invoice_requests`
--
ALTER TABLE `invoice_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `outbox`
--
ALTER TABLE `outbox`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `payment_methods`
--
ALTER TABLE `payment_methods`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=73;

--
-- AUTO_INCREMENT pour la table `product_conservation`
--
ALTER TABLE `product_conservation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `product_depots`
--
ALTER TABLE `product_depots`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=135;

--
-- AUTO_INCREMENT pour la table `product_families`
--
ALTER TABLE `product_families`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT pour la table `produits_de_caisse`
--
ALTER TABLE `produits_de_caisse`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT pour la table `produit_de_caisse_depot`
--
ALTER TABLE `produit_de_caisse_depot`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT pour la table `rebut_records`
--
ALTER TABLE `rebut_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `return_items`
--
ALTER TABLE `return_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `return_requests`
--
ALTER TABLE `return_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `sales`
--
ALTER TABLE `sales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `sale_items`
--
ALTER TABLE `sale_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `session_caisse`
--
ALTER TABLE `session_caisse`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stock_documents`
--
ALTER TABLE `stock_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stock_document_items`
--
ALTER TABLE `stock_document_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stock_document_links`
--
ALTER TABLE `stock_document_links`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stock_movements`
--
ALTER TABLE `stock_movements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stock_transfers`
--
ALTER TABLE `stock_transfers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stock_transfer_items`
--
ALTER TABLE `stock_transfer_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `suppliers`
--
ALTER TABLE `suppliers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `supplier_debt_transactions`
--
ALTER TABLE `supplier_debt_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `supplier_payments`
--
ALTER TABLE `supplier_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT pour la table `vehicles`
--
ALTER TABLE `vehicles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `vehicle_brands`
--
ALTER TABLE `vehicle_brands`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `vrac_prices`
--
ALTER TABLE `vrac_prices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `attendance_corrections`
--
ALTER TABLE `attendance_corrections`
  ADD CONSTRAINT `attendance_corrections_day_id_fkey` FOREIGN KEY (`day_id`) REFERENCES `attendance_days` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `attendance_corrections_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `attendance_corrections_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `attendance_days`
--
ALTER TABLE `attendance_days`
  ADD CONSTRAINT `attendance_days_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `attendance_days_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `attendance_punches`
--
ALTER TABLE `attendance_punches`
  ADD CONSTRAINT `attendance_punches_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `cash_movements`
--
ALTER TABLE `cash_movements`
  ADD CONSTRAINT `cash_movements_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `cash_movements_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `session_caisse` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `change_requests`
--
ALTER TABLE `change_requests`
  ADD CONSTRAINT `change_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `change_requests_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `clients`
--
ALTER TABLE `clients`
  ADD CONSTRAINT `clients_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `client_debt_transactions`
--
ALTER TABLE `client_debt_transactions`
  ADD CONSTRAINT `client_debt_transactions_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `client_debt_transactions_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `client_debt_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `depots`
--
ALTER TABLE `depots`
  ADD CONSTRAINT `depots_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `depots_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `document_status_history`
--
ALTER TABLE `document_status_history`
  ADD CONSTRAINT `document_status_history_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `stock_documents` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `document_status_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `drivers`
--
ALTER TABLE `drivers`
  ADD CONSTRAINT `drivers_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `expenses`
--
ALTER TABLE `expenses`
  ADD CONSTRAINT `expenses_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `expenses_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `expenses_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `expenses_paid_by_fkey` FOREIGN KEY (`paid_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `expenses_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `expenses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `inventory`
--
ALTER TABLE `inventory`
  ADD CONSTRAINT `inventory_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD CONSTRAINT `inventory_items_counted_by_fkey` FOREIGN KEY (`counted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_items_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `inventory_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `inventory_sessions`
--
ALTER TABLE `inventory_sessions`
  ADD CONSTRAINT `inventory_sessions_closed_by_fkey` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_sessions_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_sessions_posted_by_fkey` FOREIGN KEY (`posted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_sessions_started_by_fkey` FOREIGN KEY (`started_by`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `invoices_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `invoices_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `invoices_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `invoices_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `invoice_lines`
--
ALTER TABLE `invoice_lines`
  ADD CONSTRAINT `invoice_lines_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `invoice_lines_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `invoice_requests`
--
ALTER TABLE `invoice_requests`
  ADD CONSTRAINT `invoice_requests_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `invoice_requests_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `invoice_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `invoice_requests_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `products_famille_id_fkey` FOREIGN KEY (`famille_id`) REFERENCES `product_families` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `products_original_product_id_fkey` FOREIGN KEY (`original_product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `product_conservation`
--
ALTER TABLE `product_conservation`
  ADD CONSTRAINT `product_conservation_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `product_conservation_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `product_depots`
--
ALTER TABLE `product_depots`
  ADD CONSTRAINT `product_depots_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `product_depots_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `produits_de_caisse`
--
ALTER TABLE `produits_de_caisse`
  ADD CONSTRAINT `produits_de_caisse_famille_id_fkey` FOREIGN KEY (`famille_id`) REFERENCES `product_families` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `produits_de_caisse_original_product_id_fkey` FOREIGN KEY (`original_product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `produits_de_caisse_parent_product_id_fkey` FOREIGN KEY (`parent_product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `produit_de_caisse_depot`
--
ALTER TABLE `produit_de_caisse_depot`
  ADD CONSTRAINT `produit_de_caisse_depot_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `produit_de_caisse_depot_produit_de_caisse_id_fkey` FOREIGN KEY (`produit_de_caisse_id`) REFERENCES `produits_de_caisse` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `rebut_records`
--
ALTER TABLE `rebut_records`
  ADD CONSTRAINT `rebut_records_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `rebut_records_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `return_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `rebut_records_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `rebut_records_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `return_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `return_items`
--
ALTER TABLE `return_items`
  ADD CONSTRAINT `return_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `return_items_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `return_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `return_requests`
--
ALTER TABLE `return_requests`
  ADD CONSTRAINT `return_requests_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `return_requests_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `return_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_advance_payment_method_id_fkey` FOREIGN KEY (`advance_payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `sales_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `sales_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `sales_payment_method_id_fkey` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `sales_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `session_caisse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `sales_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `sale_items`
--
ALTER TABLE `sale_items`
  ADD CONSTRAINT `sale_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `sale_items_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `session_caisse`
--
ALTER TABLE `session_caisse`
  ADD CONSTRAINT `session_caisse_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `session_caisse_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `stock_documents`
--
ALTER TABLE `stock_documents`
  ADD CONSTRAINT `stock_documents_destinataire_id_fkey` FOREIGN KEY (`destinataire_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_documents_emetteur_id_fkey` FOREIGN KEY (`emetteur_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `stock_document_items`
--
ALTER TABLE `stock_document_items`
  ADD CONSTRAINT `stock_document_items_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `stock_documents` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_document_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `stock_document_links`
--
ALTER TABLE `stock_document_links`
  ADD CONSTRAINT `stock_document_links_source_document_id_fkey` FOREIGN KEY (`source_document_id`) REFERENCES `stock_documents` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_document_links_target_document_id_fkey` FOREIGN KEY (`target_document_id`) REFERENCES `stock_documents` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD CONSTRAINT `stock_movements_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_movements_from_depot_id_fkey` FOREIGN KEY (`from_depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_movements_to_depot_id_fkey` FOREIGN KEY (`to_depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_movements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `stock_transfers`
--
ALTER TABLE `stock_transfers`
  ADD CONSTRAINT `stock_transfers_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_transfers_from_depot_id_fkey` FOREIGN KEY (`from_depot_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_transfers_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_transfers_to_depot_id_fkey` FOREIGN KEY (`to_depot_id`) REFERENCES `depots` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `stock_transfer_items`
--
ALTER TABLE `stock_transfer_items`
  ADD CONSTRAINT `stock_transfer_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_transfer_items_transfer_id_fkey` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `supplier_debt_transactions`
--
ALTER TABLE `supplier_debt_transactions`
  ADD CONSTRAINT `supplier_debt_transactions_expense_id_fkey` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `supplier_debt_transactions_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `supplier_debt_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `supplier_payments`
--
ALTER TABLE `supplier_payments`
  ADD CONSTRAINT `supplier_payments_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `supplier_payments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `vehicles`
--
ALTER TABLE `vehicles`
  ADD CONSTRAINT `vehicles_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `vehicle_brands` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `vrac_prices`
--
ALTER TABLE `vrac_prices`
  ADD CONSTRAINT `vrac_prices_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
