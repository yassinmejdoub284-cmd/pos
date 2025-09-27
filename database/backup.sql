-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : sam. 27 sep. 2025 à 19:21
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
  `keyboardShortcuts` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`keyboardShortcuts`)),
  `devices_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`devices_config`)),
  `audit_retention_days` int(11) NOT NULL DEFAULT 90,
  `variance_threshold` decimal(8,3) NOT NULL DEFAULT 5.000,
  `default_fonds` decimal(12,3) NOT NULL DEFAULT 50.000,
  `denominations` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`denominations`)),
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
  `print_settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`print_settings`)),
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
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
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
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
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

--
-- Déchargement des données de la table `clients`
--

INSERT INTO `clients` (`id`, `code`, `first_name`, `last_name`, `email`, `phone`, `address`, `city`, `postal_code`, `birthday`, `client_type`, `loyalty_points`, `total_spent`, `favorite_products`, `allergies`, `notes`, `is_active`, `created_at`, `updated_at`, `age_group`, `allow_debt`, `current_debt`, `max_debt`, `depot_id`) VALUES
(1, 'CLI001', 'Ali', 'Ben Salem', 'ali.bensalem@email.tn', '+216 74 111 222', '15 Rue de la Paix, Sfax', NULL, NULL, NULL, 'INDIVIDUAL', 150, 0.000, NULL, NULL, NULL, 1, '2025-09-27 17:21:09.896', '2025-09-27 17:21:09.896', NULL, 1, 0.000, NULL, NULL),
(2, 'CLI002', 'Amina', 'Karray', 'amina.karray@email.tn', '+216 74 333 444', '28 Avenue de l\'Indépendance, Sfax', NULL, NULL, NULL, 'INDIVIDUAL', 75, 0.000, NULL, NULL, NULL, 1, '2025-09-27 17:21:09.901', '2025-09-27 17:21:09.901', NULL, 1, 0.000, NULL, NULL),
(3, 'CLI003', 'Hassan', 'Trabelsi', 'hassan.trabelsi@email.tn', '+216 74 555 666', '7 Rue du Commerce, Sfax', NULL, NULL, NULL, 'INDIVIDUAL', 200, 0.000, NULL, NULL, NULL, 1, '2025-09-27 17:21:09.907', '2025-09-27 17:21:09.907', NULL, 1, 0.000, NULL, NULL);

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
(1, 'Dépôt Principal Sfax', 'SFX-MAIN', 'MAIN', '123 Rue de la Liberté', 'Sfax', '+216 74 123 456', 'sfax@patisserie.tn', NULL, 1, '2025-09-27 17:21:08.654', '2025-09-27 17:21:08.654', NULL),
(2, 'Boutique Centre Ville', 'SHOP-CV', 'SHOP', '789 Place de la République', 'Sfax', '+216 74 345 678', 'shop@patisserie.tn', NULL, 1, '2025-09-27 17:21:08.654', '2025-09-27 17:21:08.654', NULL),
(3, 'Dépôt Tunis', 'TUN-BRANCH', 'BRANCH', '456 Avenue Habib Bourguiba', 'Tunis', '+216 71 234 567', 'tunis@patisserie.tn', NULL, 1, '2025-09-27 17:21:08.654', '2025-09-27 17:21:08.654', NULL);

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

--
-- Déchargement des données de la table `expenses`
--

INSERT INTO `expenses` (`id`, `amount`, `description`, `category_id`, `depot_id`, `user_id`, `date`, `receipt_url`, `notes`, `is_approved`, `approved_by`, `approved_at`, `created_at`, `updated_at`, `collection_date`, `payment_type`, `due_date`, `is_paid`, `paid_at`, `paid_by`, `supplier_id`, `is_advance`) VALUES
(1, 150.00, 'Achat fournitures de bureau', 1, 1, 3, '2024-01-15 00:00:00.000', NULL, 'Papeterie et matériel de bureau', 0, NULL, NULL, '2025-09-27 17:21:10.198', '2025-09-27 17:21:10.198', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(2, 89.50, 'Facture électricité janvier', 2, 1, 3, '2024-01-20 00:00:00.000', NULL, 'Consommation électrique du mois', 0, NULL, NULL, '2025-09-27 17:21:10.203', '2025-09-27 17:21:10.203', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(3, 45.00, 'Facture eau', 3, 1, 3, '2024-01-25 00:00:00.000', NULL, 'Consommation d\'eau', 0, NULL, NULL, '2025-09-27 17:21:10.205', '2025-09-27 17:21:10.205', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(4, 1200.00, 'Loyer boutique centre ville', 4, 2, 4, '2024-01-01 00:00:00.000', NULL, 'Loyer mensuel boutique', 1, 2, '2024-01-02 00:00:00.000', '2025-09-27 17:21:10.208', '2025-09-27 17:21:10.208', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(5, 85.00, 'Frais de transport livraison', 6, 1, 1, '2024-01-18 00:00:00.000', NULL, 'Carburant pour livraisons', 0, NULL, NULL, '2025-09-27 17:21:10.210', '2025-09-27 17:21:10.210', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(6, 35.00, 'Facture téléphone', 7, 1, 3, '2024-01-22 00:00:00.000', NULL, 'Forfait mobile professionnel', 0, NULL, NULL, '2025-09-27 17:21:10.213', '2025-09-27 17:21:10.213', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(7, 200.00, 'Assurance responsabilité civile', 8, 1, 3, '2024-01-10 00:00:00.000', NULL, 'Assurance annuelle', 1, 2, '2024-01-11 00:00:00.000', '2025-09-27 17:21:10.214', '2025-09-27 17:21:10.214', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(8, 75.50, 'Maintenance équipement', 9, 2, 4, '2024-01-28 00:00:00.000', NULL, 'Réparation four à pâtisserie', 0, NULL, NULL, '2025-09-27 17:21:10.217', '2025-09-27 17:21:10.217', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0);

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

--
-- Déchargement des données de la table `expense_categories`
--

INSERT INTO `expense_categories` (`id`, `name`, `description`, `color`, `icon`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Fournitures', 'Fournitures de bureau et matériel', 'red', '🏪', 1, '2025-09-27 17:21:08.818', '2025-09-27 17:21:08.818'),
(2, 'Électricité', 'Factures d\'électricité', 'blue', '⚡', 1, '2025-09-27 17:21:08.821', '2025-09-27 17:21:08.821'),
(3, 'Eau', 'Factures d\'eau', 'green', '💧', 1, '2025-09-27 17:21:08.824', '2025-09-27 17:21:08.824'),
(4, 'Loyer', 'Loyer des locaux', 'purple', '🏢', 1, '2025-09-27 17:21:08.826', '2025-09-27 17:21:08.826'),
(5, 'Salaire', 'Salaires et rémunérations', 'orange', '👥', 1, '2025-09-27 17:21:08.828', '2025-09-27 17:21:08.828'),
(6, 'Transport', 'Frais de transport et livraison', 'pink', '🚚', 1, '2025-09-27 17:21:08.830', '2025-09-27 17:21:08.830'),
(7, 'Téléphone', 'Frais de télécommunication', 'teal', '📱', 1, '2025-09-27 17:21:08.835', '2025-09-27 17:21:08.835'),
(8, 'Assurance', 'Assurances diverses', 'indigo', '🛡️', 1, '2025-09-27 17:21:08.838', '2025-09-27 17:21:08.838'),
(9, 'Autre', 'Autres dépenses', 'yellow', '➕', 1, '2025-09-27 17:21:08.840', '2025-09-27 17:21:08.840');

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

--
-- Déchargement des données de la table `inventory`
--

INSERT INTO `inventory` (`id`, `depot_id`, `product_id`, `quantity`, `reserved_quantity`, `last_updated`) VALUES
(1, 1, 1, 123.000, 0.000, '2025-09-27 17:21:09.910'),
(2, 1, 2, 54.000, 0.000, '2025-09-27 17:21:09.916'),
(3, 1, 3, 223.000, 0.000, '2025-09-27 17:21:09.920'),
(4, 1, 4, 235.000, 0.000, '2025-09-27 17:21:09.923'),
(5, 1, 5, 195.000, 0.000, '2025-09-27 17:21:09.927'),
(6, 1, 6, 160.000, 0.000, '2025-09-27 17:21:09.930'),
(7, 1, 7, 88.000, 0.000, '2025-09-27 17:21:09.933'),
(8, 1, 8, 162.000, 0.000, '2025-09-27 17:21:09.937'),
(9, 1, 9, 109.000, 0.000, '2025-09-27 17:21:09.940'),
(10, 1, 10, 223.000, 0.000, '2025-09-27 17:21:09.943'),
(11, 1, 11, 193.000, 0.000, '2025-09-27 17:21:09.947'),
(12, 1, 12, 136.000, 0.000, '2025-09-27 17:21:09.950'),
(13, 1, 13, 221.000, 0.000, '2025-09-27 17:21:09.953'),
(14, 1, 14, 135.000, 0.000, '2025-09-27 17:21:09.957'),
(15, 1, 15, 192.000, 0.000, '2025-09-27 17:21:09.959'),
(16, 1, 16, 69.000, 0.000, '2025-09-27 17:21:09.962'),
(17, 1, 17, 179.000, 0.000, '2025-09-27 17:21:09.964'),
(18, 1, 18, 237.000, 0.000, '2025-09-27 17:21:09.966'),
(19, 1, 19, 77.000, 0.000, '2025-09-27 17:21:09.968'),
(20, 1, 20, 226.000, 0.000, '2025-09-27 17:21:09.970'),
(21, 1, 21, 57.000, 0.000, '2025-09-27 17:21:09.972'),
(22, 1, 22, 126.000, 0.000, '2025-09-27 17:21:09.974'),
(23, 1, 23, 168.000, 0.000, '2025-09-27 17:21:09.977'),
(24, 1, 24, 153.000, 0.000, '2025-09-27 17:21:09.978'),
(25, 1, 25, 73.000, 0.000, '2025-09-27 17:21:09.980'),
(26, 1, 26, 195.000, 0.000, '2025-09-27 17:21:09.983'),
(27, 1, 27, 64.000, 0.000, '2025-09-27 17:21:09.985'),
(28, 1, 28, 117.000, 0.000, '2025-09-27 17:21:09.987'),
(29, 1, 29, 185.000, 0.000, '2025-09-27 17:21:09.990'),
(30, 1, 30, 125.000, 0.000, '2025-09-27 17:21:09.992'),
(31, 1, 31, 201.000, 0.000, '2025-09-27 17:21:09.994'),
(32, 1, 32, 209.000, 0.000, '2025-09-27 17:21:09.996'),
(33, 1, 33, 73.000, 0.000, '2025-09-27 17:21:09.998'),
(34, 1, 34, 226.000, 0.000, '2025-09-27 17:21:10.000'),
(35, 1, 35, 216.000, 0.000, '2025-09-27 17:21:10.004'),
(36, 1, 36, 192.000, 0.000, '2025-09-27 17:21:10.006'),
(37, 1, 37, 193.000, 0.000, '2025-09-27 17:21:10.008'),
(38, 1, 38, 155.000, 0.000, '2025-09-27 17:21:10.010'),
(39, 1, 39, 153.000, 0.000, '2025-09-27 17:21:10.012'),
(40, 1, 40, 174.000, 0.000, '2025-09-27 17:21:10.014'),
(41, 3, 1, 172.000, 0.000, '2025-09-27 17:21:10.016'),
(42, 3, 2, 90.000, 0.000, '2025-09-27 17:21:10.019'),
(43, 3, 3, 159.000, 0.000, '2025-09-27 17:21:10.020'),
(44, 3, 4, 137.000, 0.000, '2025-09-27 17:21:10.023'),
(45, 3, 5, 166.000, 0.000, '2025-09-27 17:21:10.025'),
(46, 3, 6, 144.000, 0.000, '2025-09-27 17:21:10.027'),
(47, 3, 7, 74.000, 0.000, '2025-09-27 17:21:10.029'),
(48, 3, 8, 41.000, 0.000, '2025-09-27 17:21:10.031'),
(49, 3, 9, 99.000, 0.000, '2025-09-27 17:21:10.033'),
(50, 3, 10, 60.000, 0.000, '2025-09-27 17:21:10.035'),
(51, 3, 11, 133.000, 0.000, '2025-09-27 17:21:10.038'),
(52, 3, 12, 104.000, 0.000, '2025-09-27 17:21:10.040'),
(53, 3, 13, 91.000, 0.000, '2025-09-27 17:21:10.042'),
(54, 3, 14, 71.000, 0.000, '2025-09-27 17:21:10.044'),
(55, 3, 15, 95.000, 0.000, '2025-09-27 17:21:10.046'),
(56, 3, 16, 40.000, 0.000, '2025-09-27 17:21:10.048'),
(57, 3, 17, 75.000, 0.000, '2025-09-27 17:21:10.051'),
(58, 3, 18, 34.000, 0.000, '2025-09-27 17:21:10.053'),
(59, 3, 19, 110.000, 0.000, '2025-09-27 17:21:10.055'),
(60, 3, 20, 103.000, 0.000, '2025-09-27 17:21:10.057'),
(61, 3, 21, 42.000, 0.000, '2025-09-27 17:21:10.060'),
(62, 3, 22, 51.000, 0.000, '2025-09-27 17:21:10.061'),
(63, 3, 23, 98.000, 0.000, '2025-09-27 17:21:10.064'),
(64, 3, 24, 171.000, 0.000, '2025-09-27 17:21:10.066'),
(65, 3, 25, 147.000, 0.000, '2025-09-27 17:21:10.068'),
(66, 3, 26, 168.000, 0.000, '2025-09-27 17:21:10.070'),
(67, 3, 27, 95.000, 0.000, '2025-09-27 17:21:10.072'),
(68, 3, 28, 97.000, 0.000, '2025-09-27 17:21:10.074'),
(69, 3, 29, 136.000, 0.000, '2025-09-27 17:21:10.076'),
(70, 3, 30, 46.000, 0.000, '2025-09-27 17:21:10.078'),
(71, 3, 31, 175.000, 0.000, '2025-09-27 17:21:10.081'),
(72, 3, 32, 38.000, 0.000, '2025-09-27 17:21:10.083'),
(73, 3, 33, 117.000, 0.000, '2025-09-27 17:21:10.086'),
(74, 3, 34, 165.000, 0.000, '2025-09-27 17:21:10.088'),
(75, 3, 35, 46.000, 0.000, '2025-09-27 17:21:10.090'),
(76, 3, 36, 71.000, 0.000, '2025-09-27 17:21:10.093'),
(77, 3, 37, 122.000, 0.000, '2025-09-27 17:21:10.095'),
(78, 3, 38, 40.000, 0.000, '2025-09-27 17:21:10.097'),
(79, 3, 39, 179.000, 0.000, '2025-09-27 17:21:10.101'),
(80, 3, 40, 96.000, 0.000, '2025-09-27 17:21:10.103'),
(81, 2, 1, 53.000, 0.000, '2025-09-27 17:21:10.106'),
(82, 2, 2, 118.000, 0.000, '2025-09-27 17:21:10.109'),
(83, 2, 3, 75.000, 0.000, '2025-09-27 17:21:10.112'),
(84, 2, 4, 55.000, 0.000, '2025-09-27 17:21:10.115'),
(85, 2, 5, 49.000, 0.000, '2025-09-27 17:21:10.117'),
(86, 2, 6, 48.000, 0.000, '2025-09-27 17:21:10.119'),
(87, 2, 7, 81.000, 0.000, '2025-09-27 17:21:10.122'),
(88, 2, 8, 26.000, 0.000, '2025-09-27 17:21:10.124'),
(89, 2, 9, 39.000, 0.000, '2025-09-27 17:21:10.126'),
(90, 2, 10, 97.000, 0.000, '2025-09-27 17:21:10.129'),
(91, 2, 11, 40.000, 0.000, '2025-09-27 17:21:10.131'),
(92, 2, 12, 114.000, 0.000, '2025-09-27 17:21:10.134'),
(93, 2, 13, 42.000, 0.000, '2025-09-27 17:21:10.137'),
(94, 2, 14, 104.000, 0.000, '2025-09-27 17:21:10.139'),
(95, 2, 15, 35.000, 0.000, '2025-09-27 17:21:10.141'),
(96, 2, 16, 46.000, 0.000, '2025-09-27 17:21:10.143'),
(97, 2, 17, 117.000, 0.000, '2025-09-27 17:21:10.145'),
(98, 2, 18, 99.000, 0.000, '2025-09-27 17:21:10.147'),
(99, 2, 19, 102.000, 0.000, '2025-09-27 17:21:10.150'),
(100, 2, 20, 118.000, 0.000, '2025-09-27 17:21:10.151'),
(101, 2, 21, 33.000, 0.000, '2025-09-27 17:21:10.153'),
(102, 2, 22, 34.000, 0.000, '2025-09-27 17:21:10.155'),
(103, 2, 23, 104.000, 0.000, '2025-09-27 17:21:10.157'),
(104, 2, 24, 50.000, 0.000, '2025-09-27 17:21:10.159'),
(105, 2, 25, 23.000, 0.000, '2025-09-27 17:21:10.161'),
(106, 2, 26, 34.000, 0.000, '2025-09-27 17:21:10.163'),
(107, 2, 27, 75.000, 0.000, '2025-09-27 17:21:10.165'),
(108, 2, 28, 106.000, 0.000, '2025-09-27 17:21:10.168'),
(109, 2, 29, 112.000, 0.000, '2025-09-27 17:21:10.171'),
(110, 2, 30, 72.000, 0.000, '2025-09-27 17:21:10.173'),
(111, 2, 31, 101.000, 0.000, '2025-09-27 17:21:10.175'),
(112, 2, 32, 54.000, 0.000, '2025-09-27 17:21:10.177'),
(113, 2, 33, 65.000, 0.000, '2025-09-27 17:21:10.179'),
(114, 2, 34, 52.000, 0.000, '2025-09-27 17:21:10.181'),
(115, 2, 35, 21.000, 0.000, '2025-09-27 17:21:10.183'),
(116, 2, 36, 119.000, 0.000, '2025-09-27 17:21:10.186'),
(117, 2, 37, 30.000, 0.000, '2025-09-27 17:21:10.188'),
(118, 2, 38, 92.000, 0.000, '2025-09-27 17:21:10.191'),
(119, 2, 39, 47.000, 0.000, '2025-09-27 17:21:10.193'),
(120, 2, 40, 36.000, 0.000, '2025-09-27 17:21:10.195');

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
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`data`)),
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
  `event_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`event_data`)),
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
(1, 'Espèces', 'CASH', 1, '2025-09-27 17:21:08.807'),
(2, 'Carte Bancaire', 'CARD', 1, '2025-09-27 17:21:08.810'),
(3, 'Mobile Money', 'MOBILE', 1, '2025-09-27 17:21:08.812'),
(4, 'Virement Bancaire', 'BANK_TRANSFER', 1, '2025-09-27 17:21:08.814');

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
(1, 'Croissant Classique', 'Croissant au beurre traditionnel', '1234567890123', '2025-09-27 17:21:08.687', '2025-09-27 17:21:08.687', NULL, NULL, 1.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 1, NULL, 0.720),
(2, 'Pain au Chocolat', 'Pain au chocolat noir', '1234567890124', '2025-09-27 17:21:08.691', '2025-09-27 17:21:08.691', NULL, NULL, 1.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 1, NULL, 0.900),
(3, 'Éclair au Chocolat', 'Éclair garni de crème pâtissière et chocolat', '1234567890125', '2025-09-27 17:21:08.694', '2025-09-27 17:21:08.694', NULL, NULL, 2.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 1.500),
(4, 'Mille-Feuille', 'Mille-feuille à la vanille', '1234567890126', '2025-09-27 17:21:08.698', '2025-09-27 17:21:08.698', NULL, NULL, 3.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 1.800),
(5, 'Tarte aux Pommes', 'Tarte aux pommes traditionnelle', '1234567890127', '2025-09-27 17:21:08.702', '2025-09-27 17:21:08.702', NULL, NULL, 4.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 2.700),
(6, 'Café Expresso', 'Expresso italien', '1234567890128', '2025-09-27 17:21:08.705', '2025-09-27 17:21:08.705', NULL, NULL, 1.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 3, NULL, 1.080),
(7, 'Thé à la Menthe', 'Thé vert à la menthe fraîche', '1234567890129', '2025-09-27 17:21:08.708', '2025-09-27 17:21:08.708', NULL, NULL, 2.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 3, NULL, 1.200),
(8, 'Cookie Chocolat', 'Cookie aux pépites de chocolat', '1234567890130', '2025-09-27 17:21:08.712', '2025-09-27 17:21:08.712', NULL, NULL, 1.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 4, NULL, 0.600),
(9, 'Gâteau au Chocolat', 'Gâteau moelleux au chocolat noir', '1234567890131', '2025-09-27 17:21:08.715', '2025-09-27 17:21:08.715', NULL, NULL, 5.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.300),
(10, 'Tarte Tatin', 'Tarte tatin aux pommes caramélisées', '1234567890132', '2025-09-27 17:21:08.719', '2025-09-27 17:21:08.719', NULL, NULL, 6.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.600),
(11, 'Profiteroles', 'Profiteroles à la crème chantilly et chocolat', '1234567890133', '2025-09-27 17:21:08.721', '2025-09-27 17:21:08.721', NULL, NULL, 4.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 2.880),
(12, 'Cheesecake', 'Cheesecake aux fruits rouges', '1234567890134', '2025-09-27 17:21:08.724', '2025-09-27 17:21:08.724', NULL, NULL, 5.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.120),
(13, 'Tiramisu', 'Tiramisu classique italien', '1234567890135', '2025-09-27 17:21:08.727', '2025-09-27 17:21:08.727', NULL, NULL, 6.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.900),
(14, 'Macarons Assortis', 'Macarons aux saveurs variées', '1234567890136', '2025-09-27 17:21:08.730', '2025-09-27 17:21:08.730', NULL, NULL, 8.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 4.800),
(15, 'Opéra', 'Gâteau Opéra aux amandes et café', '1234567890137', '2025-09-27 17:21:08.733', '2025-09-27 17:21:08.733', NULL, NULL, 7.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 4.500),
(16, 'Saint-Honoré', 'Saint-Honoré à la crème chiboust', '1234567890138', '2025-09-27 17:21:08.735', '2025-09-27 17:21:08.735', NULL, NULL, 6.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 4.080),
(17, 'Paris-Brest', 'Paris-Brest aux noisettes', '1234567890139', '2025-09-27 17:21:08.738', '2025-09-27 17:21:08.738', NULL, NULL, 5.90, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.540),
(18, 'Religieuse', 'Religieuse au chocolat et café', '1234567890140', '2025-09-27 17:21:08.741', '2025-09-27 17:21:08.741', NULL, NULL, 4.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 2.520),
(19, 'Baklava', 'Baklava aux noix et miel', '1234567890141', '2025-09-27 17:21:08.743', '2025-09-27 17:21:08.743', NULL, NULL, 3.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 2.100),
(20, 'Makroudh', 'Makroudh aux dattes et semoule', '1234567890142', '2025-09-27 17:21:08.745', '2025-09-27 17:21:08.745', NULL, NULL, 2.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.680),
(21, 'Zlabia', 'Zlabia frite au miel', '1234567890143', '2025-09-27 17:21:08.748', '2025-09-27 17:21:08.748', NULL, NULL, 1.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 0.900),
(22, 'Ghrayba', 'Ghrayba aux amandes', '1234567890144', '2025-09-27 17:21:08.750', '2025-09-27 17:21:08.750', NULL, NULL, 2.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.320),
(23, 'Kaak Warka', 'Kaak warka aux amandes', '1234567890145', '2025-09-27 17:21:08.753', '2025-09-27 17:21:08.753', NULL, NULL, 3.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.800),
(24, 'Samsa', 'Samsa aux amandes et miel', '1234567890146', '2025-09-27 17:21:08.756', '2025-09-27 17:21:08.756', NULL, NULL, 2.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.500),
(25, 'Cornes de Gazelle', 'Cornes de gazelle aux amandes', '1234567890147', '2025-09-27 17:21:08.758', '2025-09-27 17:21:08.758', NULL, NULL, 4.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 2.400),
(26, 'Mhalbiya', 'Mhalbiya à la rose', '1234567890148', '2025-09-27 17:21:08.761', '2025-09-27 17:21:08.761', NULL, NULL, 2.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.680),
(27, 'Assida', 'Assida au beurre et miel', '1234567890149', '2025-09-27 17:21:08.764', '2025-09-27 17:21:08.764', NULL, NULL, 3.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.920),
(28, 'Bambalouni', 'Bambalouni frit au sucre', '1234567890150', '2025-09-27 17:21:08.766', '2025-09-27 17:21:08.766', NULL, NULL, 1.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.080),
(29, 'Jus d\'Orange Frais', 'Jus d\'orange pressé', '1234567890151', '2025-09-27 17:21:08.769', '2025-09-27 17:21:08.769', NULL, NULL, 3.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.100),
(30, 'Jus de Pomme', 'Jus de pomme naturel', '1234567890152', '2025-09-27 17:21:08.771', '2025-09-27 17:21:08.771', NULL, NULL, 3.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 1.800),
(31, 'Jus de Grenade', 'Jus de grenade frais', '1234567890153', '2025-09-27 17:21:08.775', '2025-09-27 17:21:08.775', NULL, NULL, 4.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.700),
(32, 'Jus de Citron', 'Jus de citron pressé', '1234567890154', '2025-09-27 17:21:08.777', '2025-09-27 17:21:08.777', NULL, NULL, 2.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 1.500),
(33, 'Smoothie Banane', 'Smoothie banane et lait', '1234567890155', '2025-09-27 17:21:08.780', '2025-09-27 17:21:08.780', NULL, NULL, 4.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.400),
(34, 'Smoothie Fraise', 'Smoothie fraise et yaourt', '1234567890156', '2025-09-27 17:21:08.783', '2025-09-27 17:21:08.783', NULL, NULL, 4.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.520),
(35, 'Smoothie Mangue', 'Smoothie mangue et ananas', '1234567890157', '2025-09-27 17:21:08.785', '2025-09-27 17:21:08.785', NULL, NULL, 4.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.880),
(36, 'Jus de Carotte', 'Jus de carotte frais', '1234567890158', '2025-09-27 17:21:08.789', '2025-09-27 17:21:08.789', NULL, NULL, 3.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 1.920),
(37, 'Jus de Betterave', 'Jus de betterave et pomme', '1234567890159', '2025-09-27 17:21:08.792', '2025-09-27 17:21:08.792', NULL, NULL, 3.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.280),
(38, 'Smoothie Vert', 'Smoothie épinards et kiwi', '1234567890160', '2025-09-27 17:21:08.794', '2025-09-27 17:21:08.794', NULL, NULL, 5.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 3.000),
(39, 'Jus de Raisin', 'Jus de raisin naturel', '1234567890161', '2025-09-27 17:21:08.797', '2025-09-27 17:21:08.797', NULL, NULL, 3.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.100),
(40, 'Smoothie Tropical', 'Smoothie fruits tropicaux', '1234567890162', '2025-09-27 17:21:08.801', '2025-09-27 17:21:08.801', NULL, NULL, 5.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 3.300);

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
(1, 'Viennoiserie', 'Viennoiseries et croissants', NULL, 1, '2025-09-27 17:21:08.663', '2025-09-27 17:21:08.663'),
(2, 'Pâtisserie', 'Pâtisseries et gâteaux', NULL, 1, '2025-09-27 17:21:08.666', '2025-09-27 17:21:08.666'),
(3, 'Boissons', 'Cafés et boissons', NULL, 1, '2025-09-27 17:21:08.671', '2025-09-27 17:21:08.671'),
(4, 'Boulangerie', 'Pain et boulangerie', NULL, 1, '2025-09-27 17:21:08.674', '2025-09-27 17:21:08.674'),
(5, 'Vrac', 'Produits vrac - vente au poids', NULL, 1, '2025-09-27 17:21:08.677', '2025-09-27 17:21:08.677'),
(6, 'Pâtisserie Tunisienne', 'Pâtisseries traditionnelles tunisiennes', NULL, 1, '2025-09-27 17:21:08.679', '2025-09-27 17:21:08.679'),
(7, 'Jus et Smoothies', 'Jus de fruits frais et smoothies', NULL, 1, '2025-09-27 17:21:08.682', '2025-09-27 17:21:08.682');

-- --------------------------------------------------------

--
-- Structure de la table `produits_de_caisse`
--

CREATE TABLE `produits_de_caisse` (
  `id` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `product_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`product_ids`)),
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
  `is_wholesale` tinyint(1) NOT NULL DEFAULT 0
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
(1, 'stock', 'stock@patisserie.tn', '$2a$12$o1z7K8SgGUwVtQi/WNzsl.9MKeMYOhilIqVIxxFCZi1GqeoO4nhZ6', 'Mohamed', 'Hassan', 'STOCK_MANAGER', 1, 1, NULL, '2025-09-27 17:21:09.884', '2025-09-27 17:21:09.884', '00040004'),
(2, 'admin', 'admin@patisserie.tn', '$2a$12$wTBv1IIAUwEwcxjjo8EG..Vbo9siMeFyesa2Qb9bKPM5m5..Yvpf6', 'Admin', 'Principal', 'ADMIN', 1, 1, NULL, '2025-09-27 17:21:09.884', '2025-09-27 17:21:09.884', '00010001'),
(3, 'manager', 'manager@patisserie.tn', '$2a$12$rMZX55scFcx17ylknbquq.cvj.cLsAcOVHJtEyYqVLlKDvL9/K/Ki', 'Ahmed', 'Ben Ali', 'MANAGER', 1, 1, NULL, '2025-09-27 17:21:09.884', '2025-09-27 17:21:09.884', '00020002'),
(4, 'cashier', 'cashier@patisserie.tn', '$2a$12$rVPF0FjM1Z7ZCbqhr2r5rOjeDf49GV8Q.lQPKwqFOfyfrb8M3SQiG', 'Fatma', 'Trabelsi', 'CASHIER', 2, 1, NULL, '2025-09-27 17:21:09.884', '2025-09-27 17:21:09.884', '00030003');

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
  `models` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`models`)),
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
('0983baf1-0c1e-4f82-b942-6ec2d87c04b3', '2d012c595a0bd0d96bc03b8041493fc505bba02d75cc22be4fec36c13cb8e244', '2025-09-27 17:21:04.808', '20250901043227_add_product_conservation', NULL, NULL, '2025-09-27 17:21:04.743', 1),
('0dd32983-112c-4ae8-ad9d-61d790c9aee6', '13da36435e573fa55587ea261d44caafdc1a31fad8a39c0bae46ecd53436ee9e', '2025-09-27 17:21:04.742', '20250901033656_add_stock_flow_models', NULL, NULL, '2025-09-27 17:21:04.652', 1),
('0ebb979b-06f2-4ce6-9e1f-b8367252d1c7', '7cdf2e3631a83202b791adf4aa20500ceee1555e56a2230b5d152020e4d4a8c6', '2025-09-27 17:21:06.672', '20250915151528_add_purchase_price_to_stock_document_items', NULL, NULL, '2025-09-27 17:21:06.666', 1),
('1538a270-91b9-42ac-b505-deea654117fc', '2ec8603f329e60cf8b67e0485083ef0a050fc9c5d2860ed6272531cbe04db1f7', '2025-09-27 17:21:07.249', '20250925191954_caisseproduits', NULL, NULL, '2025-09-27 17:21:07.243', 1),
('15c4583a-23be-4261-91e3-f373f067964e', '93c9a54bbaf79411018cb22ea42fccc9e9b4c6dd5292134de4852c13a98a551e', '2025-09-27 17:21:06.845', '20250924062039_companies', NULL, NULL, '2025-09-27 17:21:06.815', 1),
('17b787a2-ea16-47ab-a47b-6dc31314e663', '4f8105ea02c8a1fb97b3bafbe1516c20f0ef9fab890230399f46119c9e6abb09', '2025-09-27 17:21:04.878', '20250901083701_add_temporary_to_sale_status', NULL, NULL, '2025-09-27 17:21:04.872', 1),
('1e1709ec-b91f-4aba-b371-f1124a43a336', '37a6aeaab260c62b7925320c56cdd52a24a84ddeb5fc97bee3d4338d2990020b', '2025-09-27 17:21:06.802', '20250920134838_add_original_sale_to_return_requests', NULL, NULL, '2025-09-27 17:21:06.798', 1),
('21b1e5a4-b60e-4405-8ee0-7e438dd4661a', '588a590d3afa219bae76fa48f6af8386c887a83d11c61893834ed0535dbea176', '2025-09-27 17:21:04.367', '20250901012326_add_payment_fields', NULL, NULL, '2025-09-27 17:21:04.361', 1),
('23c41cd6-124f-491d-af01-50efd9a4fddc', '4d97d7c28a369b666448412e6d4616e911925cc896bff336918edfcf0252a91a', '2025-09-27 17:21:06.088', '20250913223910_add_customer_type_field', NULL, NULL, '2025-09-27 17:21:06.081', 1),
('25be6c0c-b605-4a67-91b4-61fdfdf4e993', 'b399f6b6eaa7d7d5cd4b806f8cfea818c5dfee1fd4d9cfb2f4158d1e5902108b', '2025-09-27 17:21:06.080', '20250912170210_payment_and_many_12_09', NULL, NULL, '2025-09-27 17:21:05.831', 1),
('284710e0-048c-4c19-9bb5-50249e893587', 'd89ff3216f68d0a70edc6cfe8b7c08fefda96f3d09904225f71b7a913ef9bebe', '2025-09-27 17:21:03.483', '20250101120000_add_produits_de_caisse', NULL, NULL, '2025-09-27 17:21:03.478', 1),
('2903ab82-dfda-4f6d-b763-e1a9312237cc', 'eb8a4f73862e6679bc50eec43ae09fc924e002edd2870bc5b5fb902dfdf1bc33', '2025-09-27 17:21:06.814', '20250923221236_add_is_desktop_version', NULL, NULL, '2025-09-27 17:21:06.808', 1),
('29b42947-de23-4c41-a2df-c62751be993f', 'a87bf55bc81458ebc3aea94573d70444e1cc25e802c4e0564a80dc9eb8edbf33', '2025-09-27 17:21:04.360', '20250901005756_add_audit_logging', NULL, NULL, '2025-09-27 17:21:04.328', 1),
('2d013688-e67a-4f89-a847-80c99c15d2f0', '7e6bb1571f349120e45affe1f03eb7bbd1f24c45a3552bec33d866dff663877c', '2025-09-27 17:21:03.519', '20250110000001_add_supplier_payments', NULL, NULL, '2025-09-27 17:21:03.490', 1),
('2f5cf739-347a-44f5-b587-4ef31caf5d65', 'ef5c87050371e11d0e65a00aad73f301295f2f6a610a1aa0f5a68080b9a91117', '2025-09-27 17:21:06.137', '20250913231733_add_designation_legale_field', NULL, NULL, '2025-09-27 17:21:06.124', 1),
('34a53b7d-f313-4b91-959e-145a35c0ca76', 'ebde64b90ea62d42e0f2c41ffe1458fea16b72adfd04b00760da07780dee131d', '2025-09-27 17:21:05.818', '20250911163421_add_rejection_fields_to_change_requests', NULL, NULL, '2025-09-27 17:21:05.812', 1),
('3f6919d4-1d28-408a-979c-c2e55412c911', '0812402f554f569be89b168f58193f90eabb58d18472d79b59dfbf93f07b086b', '2025-09-27 17:21:07.755', '20250926162157_update_produits_de_caisse_structure', NULL, NULL, '2025-09-27 17:21:07.514', 1),
('442d7371-d814-4248-b2f3-596ba4e67edf', '6bd2facb3a17f92d3246da2334e3b446dcd485cef1059db8bc226c3fa814816d', '2025-09-27 17:21:05.050', '20250901091846_client', NULL, NULL, '2025-09-27 17:21:05.046', 1),
('4672154c-99b6-4cf7-a484-893ec4aa12f3', '7dbad0764dcd74a4de3f89f990f72f0fcee0eaab4b1df69aaf33cd7f27464d6a', '2025-09-27 17:21:06.693', '20250918170133_add_temporary_fields', NULL, NULL, '2025-09-27 17:21:06.685', 1),
('4bc745fe-b7e6-4077-bdc0-412538731c41', '2ec8603f329e60cf8b67e0485083ef0a050fc9c5d2860ed6272531cbe04db1f7', '2025-09-27 17:21:07.761', '20250926162311_produits_caisse_update', NULL, NULL, '2025-09-27 17:21:07.756', 1),
('4e0e9319-4e2a-40aa-b27e-3eabf123ba99', '196877ed6754935da3622a1367966377bf8af3a8851888c68b90939e5d330e73', '2025-09-27 17:21:07.767', '20250926184421_add_pricing_fields_to_stock_document_items', NULL, NULL, '2025-09-27 17:21:07.761', 1),
('4eee0533-5aa6-4d67-8274-2d417b055029', '0c6b8bc6f6e2643b2e3a260e71360129e9d177da0c5aac1f5b062b9774cdb5da', '2025-09-27 17:21:05.198', '20250906221101_add_notes_after_advance', NULL, NULL, '2025-09-27 17:21:05.191', 1),
('51194d7d-0365-40f7-8d2e-f9483ada03f4', '4e8fad771526e051ff0fb41bde92e9bc54e4b202b32f307dfd720cb9f4b60963', '2025-09-27 17:21:06.124', '20250913224442_update_client_depot_reference', NULL, NULL, '2025-09-27 17:21:06.088', 1),
('527c0be5-4ecc-4712-8e64-e72dc80b9c5a', '45b40864581a7d24f80857238d128e9e3622c967693a00b0b7570aa1cd024a10', '2025-09-27 17:21:06.403', '20250914014017_add_invoice_system', NULL, NULL, '2025-09-27 17:21:06.137', 1),
('5363d4ef-301a-42b0-89fb-d9c0076760ac', 'b16ab48096d85079d512209f57f37633673a9d082555dc6185c0f5732ab34b40', '2025-09-27 17:21:05.045', '20250901091456_add_clients_system', NULL, NULL, '2025-09-27 17:21:04.884', 1),
('54cf30ce-3310-4dc3-9b6d-dd9826c41662', 'b345519af304bb23fa4fa14c14230b52d4ca6407c76e182b42ca241a6eb4540a', '2025-09-27 17:21:06.409', '20250914040153_add_direct_creation_invoice_source', NULL, NULL, '2025-09-27 17:21:06.403', 1),
('5c0dc8e7-7469-4e07-b702-69baca848c0b', '9b028e45d05b4defe9264e32b049a150054a51158b44737806426e66ca99ba48', '2025-09-27 17:21:05.281', '20250907014543_add_pin_field', NULL, NULL, '2025-09-27 17:21:05.199', 1),
('5d1dc358-eb56-444b-bea3-af4015b76ca3', '223312e506d10e945cc8e43dab6d0cd5392d587af3f69018fa7f234b7720c120', '2025-09-27 17:21:06.698', '20250918170249_add_pdf_import_source', NULL, NULL, '2025-09-27 17:21:06.694', 1),
('629bf9ca-cd65-4982-b1d3-b16de04d6615', '8418de4823556353ca5f541286f829dc5494c089b0ce789b48f670f76253e3b6', '2025-09-27 17:21:06.684', '20250917051601_add_is_wholesale_to_sales', NULL, NULL, '2025-09-27 17:21:06.679', 1),
('652a51a9-a56e-494c-975a-b8fd5084b618', 'a613bf03cd1163e86d5bf3150e86cb7f796072acf954c76d34ba3187ccb39b28', '2025-09-27 17:21:05.110', '20250904153622_add_vrague_support', NULL, NULL, '2025-09-27 17:21:05.056', 1),
('665de0e5-5f29-4c87-9b7c-cb80514ef51f', '134bdff1778c855e46400bef6343a45a42a559736c2cf1553cdf7fc8386776cf', '2025-09-27 17:21:06.704', '20250918174833_add_is_temporary_to_invoice', NULL, NULL, '2025-09-27 17:21:06.698', 1),
('6891f0d3-bade-45b5-bcc9-5b0320f139bb', '454879a599f94a21faf295445b34f6efb7c625838f924b6f43bb2c7c4778f1eb', '2025-09-27 17:21:06.666', '20250915151458_add_purchase_price_to_products', NULL, NULL, '2025-09-27 17:21:06.410', 1),
('69ab213f-f00f-4dac-83b2-8972e7f370ee', 'e12a1ae6a10050a2df6c77fc656313a08eb0f78e22b440e6d3cb2fc6eeb385a0', '2025-09-27 17:21:24.330', '20250927172124_add_product_depot_model', NULL, NULL, '2025-09-27 17:21:24.153', 1),
('6f5f9e83-b4ac-406e-bc28-05a13d8d9d8c', '69910eed7d5715ee2b13dc7a1fcff60e09294ae1b0d6508ed4a3e314838257ba', '2025-09-27 17:21:06.678', '20250915171355_add_company_details_to_app_settings', NULL, NULL, '2025-09-27 17:21:06.672', 1),
('78bb57cb-db9c-4afc-b8c5-6cd6f1480139', '13da12dc99d999f79b9d2fa168b44f31e4191b130e2797e8fb2ae0657a6854e7', '2025-09-27 17:21:05.056', '20250901095412_add_client_age_group', NULL, NULL, '2025-09-27 17:21:05.051', 1),
('8034ed3f-5a1c-482f-bff2-61a1a83510e8', '3881a71efa0640e46bcf7743045b61ced63273cc41e79e72a5e97fe2f62cad74', '2025-09-27 17:21:05.449', '20250909155718_add_wholesale_bundle_support', NULL, NULL, '2025-09-27 17:21:05.441', 1),
('8a3198e8-a486-4093-9795-e9bce83c4368', 'f7efe11130000229a594bfab02ae0d695bacf00fee0ca77c25bc73613b6b011a', '2025-09-27 17:21:04.396', '20250901031830_update_product_model', NULL, NULL, '2025-09-27 17:21:04.368', 1),
('8ccafea4-41ca-46fc-8a0d-7f4ddd64c09b', 'b8c8cb6664c4e0de2d2cc0b160b332a38f0b6f147e4ad7f7ca2e3db834996a9b', '2025-09-27 17:21:04.400', '20250901031920_product', NULL, NULL, '2025-09-27 17:21:04.396', 1),
('937e2526-ca4e-4957-a9f6-a789811da117', '41288c373a558b20b7e03d670bd6e2f0061d178cc077db992bed684844903a97', '2025-09-27 17:21:04.327', '20250831235945_add_expense_models', NULL, NULL, '2025-09-27 17:21:03.519', 1),
('93b90316-fbee-40fc-b18a-3e04a498cc87', '32532a9ee02079bfccd712db1af1ef7d5e9efb4a9fd2cb1758a8bba3105048ce', '2025-09-27 17:21:06.808', '20250921120225_add_print_settings', NULL, NULL, '2025-09-27 17:21:06.803', 1),
('950f7674-ec5e-4525-8fee-4f1e99d96c95', 'bcf2678d61dc4f4c4fb3df4692bc5719b7c07c0102cf1a8f980786363a973c0b', '2025-09-27 17:21:07.502', '20250925195439_add_driver_model', NULL, NULL, '2025-09-27 17:21:07.328', 1),
('9d6841bd-f3e2-4d07-a564-0611d30539b6', 'e62e27842ad73901f14c292db17df81e9a18d3a4731ffc77462c2e42b5c16a0a', '2025-09-27 17:21:05.159', '20250906191718_update_vrague_to_vrac', NULL, NULL, '2025-09-27 17:21:05.111', 1),
('a3254799-3b95-44c6-b036-107b2d86ffa3', 'a0dbdb2b8da63503fcff4bcccfed3b16b9a2131d5f3cd5f0fb574c7a6211fdc1', '2025-09-27 17:21:07.322', '20250925192547_add_depot_to_produits_de_caisse', NULL, NULL, '2025-09-27 17:21:07.250', 1),
('a3addd20-78c6-4528-a8a0-7207aa9be22f', '75875d8c8d0eee66554d09764ac2de3867f6fcf02bb2b03f66ab8758857e6b81', '2025-09-27 17:21:06.875', '20250924071122_add_company_to_invoices', NULL, NULL, '2025-09-27 17:21:06.846', 1),
('a3ea09cf-f178-4d54-841a-906b0f786223', '417fb07376abe991c289ed1b741cd0bd63ee08aef322a6305cfc353a73ede419', '2025-09-27 17:21:05.509', '20250911083213_reset', NULL, NULL, '2025-09-27 17:21:05.450', 1),
('a6edcc90-4270-4c01-b764-07c3025ef41c', '2ec8603f329e60cf8b67e0485083ef0a050fc9c5d2860ed6272531cbe04db1f7', '2025-09-27 17:21:07.506', '20250925195759_add_vehicles', NULL, NULL, '2025-09-27 17:21:07.503', 1),
('a7c57864-1932-49ed-b947-76995d3ec783', '8f09154ade53e5f88d07d37ebdb7eeb53c3bfcea381a87a11210e38add455206', '2025-09-27 17:21:05.812', '20250911105756_add_sale_payment_type', NULL, NULL, '2025-09-27 17:21:05.510', 1),
('aca4d276-5d7a-45c5-9bb2-4473020bd3a7', 'a9e16ad4c8a7fc947fc73d68404d3f82d608564ffa6270ce1b2af18aa55b13ad', '2025-09-27 17:21:04.652', '20250901032620_add_stock_documents', NULL, NULL, '2025-09-27 17:21:04.401', 1),
('ae634c2e-fac8-4d91-8383-04e831a9b1ac', '0b4c085a89b9efe58952bd22e6b8aad1461a19476f7fd31bed89d423bf8ba651', '2025-09-27 17:21:04.883', '20250901085213_add_gift_statuses', NULL, NULL, '2025-09-27 17:21:04.879', 1),
('bbc75749-2cfc-458d-bbd1-5f7ca565c212', 'f264e925494fd9031b6efaa7ae41be037eba8dda72804caa972b883ee2c1b630', '2025-09-27 17:21:05.830', '20250911172545_add_original_counted_cash', NULL, NULL, '2025-09-27 17:21:05.825', 1),
('c102093f-acb5-401a-8ff0-180750cea529', '7bcc446f10c62646be4b8e8e271a2da6a8bc586607aa86fcac8dd9e796809de3', '2025-09-27 17:21:05.440', '20250908025255_add_display_index', NULL, NULL, '2025-09-27 17:21:05.435', 1),
('c737c3e3-dc38-4a06-8980-d17183cacda6', '2ec8603f329e60cf8b67e0485083ef0a050fc9c5d2860ed6272531cbe04db1f7', '2025-09-27 17:21:07.242', '20250925175627_pc_bar', NULL, NULL, '2025-09-27 17:21:07.237', 1),
('ca36e024-4f98-4eda-8ca0-cae2103be444', 'b80e1b86766bd3f88f6107e69f4d08f28cf8aee15a7d83e81b8b204f5f3a0b5e', '2025-09-27 17:21:04.871', '20250901082823_add_temporary_sale_fields', NULL, NULL, '2025-09-27 17:21:04.809', 1),
('db2450e7-9388-4692-83ac-02d6bce19dcf', '2ec8603f329e60cf8b67e0485083ef0a050fc9c5d2860ed6272531cbe04db1f7', '2025-09-27 17:21:07.236', '20250924182601_attendance', NULL, NULL, '2025-09-27 17:21:07.232', 1),
('dcaa80b6-534f-4830-953e-e45c581a9e54', 'e8030d5aa0a1c660aa7d970ce15462c49b8a4dd12e225b2747df4a7106d08d65', '2025-09-27 17:21:05.434', '20250907034552_support_decimal_quantities', NULL, NULL, '2025-09-27 17:21:05.287', 1),
('e0e4e7c7-fcac-4338-8d23-3340094fdff5', 'c1ba88461ee0b44197eff4b7af5405d5f7c4d7de2f504163c2528f1d9c3b996d', '2025-09-27 17:21:07.513', '20250925201856_add_logo_url_to_vehicle_brands', NULL, NULL, '2025-09-27 17:21:07.507', 1),
('e3819fe1-5a4a-482f-8a2b-0317cd6da12f', '615731d70451782d05fd76ef6d0a27fd17bf631499a2188827f2c56db5b25254', '2025-09-27 17:21:05.286', '20250907015147_update_pin_length_to_8', NULL, NULL, '2025-09-27 17:21:05.282', 1),
('e57be02f-398f-41a6-b04c-7de5f22256b8', 'ec8af58448cde05aae3a6e8399a6b7f806ca26552d0dce4b5e93b83d67ffc332', '2025-09-27 17:21:06.797', '20250918194938_add_supplier_debt_tracking', NULL, NULL, '2025-09-27 17:21:06.705', 1),
('ea72f26c-e9e8-4efd-a0de-52f1fff216b9', '2ec8603f329e60cf8b67e0485083ef0a050fc9c5d2860ed6272531cbe04db1f7', '2025-09-27 17:21:07.327', '20250925193044_caisse', NULL, NULL, '2025-09-27 17:21:07.323', 1),
('f77deb0c-45e0-4afa-bf12-615a6909e847', '1bef08c0ce01b19a6ecc6dc027883a6d44d5b5e078d9d0a0e78b4ad9651d2c72', '2025-09-27 17:21:07.231', '20250924164836_presence', NULL, NULL, '2025-09-27 17:21:06.876', 1),
('f888c720-03e8-45db-800a-79264c03ad5a', '4cf04f919970fca28b934be428895cef9e3d814d380cbf10f995bba66b22b1db', '2025-09-27 17:21:05.824', '20250911163730_add_admin_corrected_session_status', NULL, NULL, '2025-09-27 17:21:05.819', 1),
('f9abda02-8ae2-40d4-bbec-6076407028ab', '54f41c4de744dfc69d71d0314a85bbd00d1fb01065d97b1e29b2b51d21dd3882', '2025-09-27 17:21:03.489', '20250110000000_add_wholesale_rules', NULL, NULL, '2025-09-27 17:21:03.484', 1),
('fb8e4ed9-08a0-4875-bc62-ee19bb1d0260', '0210987db7c10049668b621eb0d7156cf67fe83b70d2142c4b28d9f95ad286bb', '2025-09-27 17:21:05.190', '20250906214845_add_advance_payment_support', NULL, NULL, '2025-09-27 17:21:05.160', 1);

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
  ADD KEY `cash_movements_session_id_fkey` (`session_id`),
  ADD KEY `cash_movements_created_by_id_fkey` (`created_by_id`);

--
-- Index pour la table `change_requests`
--
ALTER TABLE `change_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `change_requests_requested_by_fkey` (`requested_by`),
  ADD KEY `change_requests_approved_by_fkey` (`approved_by`);

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
  ADD UNIQUE KEY `drivers_cin_key` (`cin`);

--
-- Index pour la table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `expenses_category_id_fkey` (`category_id`),
  ADD KEY `expenses_depot_id_fkey` (`depot_id`),
  ADD KEY `expenses_user_id_fkey` (`user_id`),
  ADD KEY `expenses_approved_by_fkey` (`approved_by`),
  ADD KEY `expenses_supplier_id_fkey` (`supplier_id`),
  ADD KEY `expenses_paid_by_fkey` (`paid_by`);

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
  ADD KEY `inventory_items_product_id_fkey` (`product_id`),
  ADD KEY `inventory_items_counted_by_fkey` (`counted_by`);

--
-- Index pour la table `inventory_sessions`
--
ALTER TABLE `inventory_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `inventory_sessions_numero_key` (`numero`),
  ADD KEY `inventory_sessions_depot_id_fkey` (`depot_id`),
  ADD KEY `inventory_sessions_started_by_fkey` (`started_by`),
  ADD KEY `inventory_sessions_closed_by_fkey` (`closed_by`),
  ADD KEY `inventory_sessions_posted_by_fkey` (`posted_by`);

--
-- Index pour la table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoices_invoice_number_key` (`invoice_number`),
  ADD KEY `invoices_depot_id_fkey` (`depot_id`),
  ADD KEY `invoices_client_id_fkey` (`client_id`),
  ADD KEY `invoices_created_by_id_fkey` (`created_by_id`),
  ADD KEY `invoices_sale_id_fkey` (`sale_id`),
  ADD KEY `invoices_company_id_fkey` (`company_id`);

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
  ADD KEY `invoice_requests_sale_id_fkey` (`sale_id`),
  ADD KEY `invoice_requests_requested_by_id_fkey` (`requested_by_id`),
  ADD KEY `invoice_requests_approved_by_id_fkey` (`approved_by_id`);

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
  ADD KEY `products_original_product_id_fkey` (`original_product_id`),
  ADD KEY `products_famille_id_fkey` (`famille_id`);

--
-- Index pour la table `product_conservation`
--
ALTER TABLE `product_conservation`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_conservation_product_id_fkey` (`product_id`),
  ADD KEY `product_conservation_depot_id_fkey` (`depot_id`);

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
  ADD KEY `rebut_records_request_id_fkey` (`request_id`),
  ADD KEY `rebut_records_product_id_fkey` (`product_id`),
  ADD KEY `rebut_records_depot_id_fkey` (`depot_id`);

--
-- Index pour la table `return_items`
--
ALTER TABLE `return_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `return_items_request_id_fkey` (`request_id`),
  ADD KEY `return_items_product_id_fkey` (`product_id`);

--
-- Index pour la table `return_requests`
--
ALTER TABLE `return_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `return_requests_numero_key` (`numero`),
  ADD KEY `return_requests_depot_id_fkey` (`depot_id`),
  ADD KEY `return_requests_requested_by_id_fkey` (`requested_by_id`),
  ADD KEY `return_requests_approved_by_id_fkey` (`approved_by_id`);

--
-- Index pour la table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sales_depot_id_fkey` (`depot_id`),
  ADD KEY `sales_payment_method_id_fkey` (`payment_method_id`),
  ADD KEY `sales_user_id_fkey` (`user_id`),
  ADD KEY `sales_client_id_fkey` (`client_id`),
  ADD KEY `sales_advance_payment_method_id_fkey` (`advance_payment_method_id`),
  ADD KEY `sales_session_id_fkey` (`session_id`);

--
-- Index pour la table `sale_items`
--
ALTER TABLE `sale_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sale_items_sale_id_fkey` (`sale_id`),
  ADD KEY `sale_items_product_id_fkey` (`product_id`);

--
-- Index pour la table `session_caisse`
--
ALTER TABLE `session_caisse`
  ADD PRIMARY KEY (`id`),
  ADD KEY `session_caisse_user_id_fkey` (`user_id`),
  ADD KEY `session_caisse_depot_id_fkey` (`depot_id`);

--
-- Index pour la table `stock_documents`
--
ALTER TABLE `stock_documents`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `stock_documents_numero_key` (`numero`),
  ADD KEY `stock_documents_emetteur_id_fkey` (`emetteur_id`),
  ADD KEY `stock_documents_destinataire_id_fkey` (`destinataire_id`);

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
  ADD KEY `stock_movements_product_id_fkey` (`product_id`),
  ADD KEY `stock_movements_depot_id_fkey` (`depot_id`),
  ADD KEY `stock_movements_from_depot_id_fkey` (`from_depot_id`),
  ADD KEY `stock_movements_to_depot_id_fkey` (`to_depot_id`),
  ADD KEY `stock_movements_user_id_fkey` (`user_id`);

--
-- Index pour la table `stock_transfers`
--
ALTER TABLE `stock_transfers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `stock_transfers_from_depot_id_fkey` (`from_depot_id`),
  ADD KEY `stock_transfers_to_depot_id_fkey` (`to_depot_id`),
  ADD KEY `stock_transfers_requested_by_fkey` (`requested_by`),
  ADD KEY `stock_transfers_approved_by_fkey` (`approved_by`);

--
-- Index pour la table `stock_transfer_items`
--
ALTER TABLE `stock_transfer_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `stock_transfer_items_transfer_id_fkey` (`transfer_id`),
  ADD KEY `stock_transfer_items_product_id_fkey` (`product_id`);

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
  ADD KEY `supplier_debt_transactions_supplier_id_fkey` (`supplier_id`),
  ADD KEY `supplier_debt_transactions_expense_id_fkey` (`expense_id`),
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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT pour la table `expense_categories`
--
ALTER TABLE `expense_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT pour la table `inventory`
--
ALTER TABLE `inventory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=121;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT pour la table `product_conservation`
--
ALTER TABLE `product_conservation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `product_depots`
--
ALTER TABLE `product_depots`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `product_families`
--
ALTER TABLE `product_families`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT pour la table `produits_de_caisse`
--
ALTER TABLE `produits_de_caisse`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `produit_de_caisse_depot`
--
ALTER TABLE `produit_de_caisse_depot`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

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
