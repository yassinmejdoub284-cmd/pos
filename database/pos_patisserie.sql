-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : sam. 27 sep. 2025 à 20:46
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

--
-- Déchargement des données de la table `attendance_days`
--

INSERT INTO `attendance_days` (`id`, `userId`, `depotId`, `date`, `firstCheckIn`, `lastCheckOut`, `pausesSeconds`, `workedSeconds`, `overtimeSeconds`, `isLate`, `isAbsent`, `isComplete`, `created_at`, `updated_at`) VALUES
(1, 4, 1, '2025-09-27', '2025-09-27 18:23:37.574', NULL, 0, 14, 0, 1, 0, 1, '2025-09-27 18:23:19.532', '2025-09-27 18:23:37.582');

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

--
-- Déchargement des données de la table `attendance_punches`
--

INSERT INTO `attendance_punches` (`id`, `userId`, `type`, `timestamp`, `source`, `created_at`) VALUES
(1, 4, 'CHECK_IN', '2025-09-27 17:23:19', 'SYSTEM', '2025-09-27 18:23:19.523'),
(2, 4, 'CHECK_OUT', '2025-09-27 17:23:24', 'SYSTEM', '2025-09-27 18:23:24.458'),
(3, 4, 'CHECK_OUT', '2025-09-27 17:23:33', 'SYSTEM', '2025-09-27 18:23:33.624'),
(4, 4, 'CHECK_IN', '2025-09-27 17:23:37', 'SYSTEM', '2025-09-27 18:23:37.576');

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

--
-- Déchargement des données de la table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `table_name`, `record_id`, `action`, `old_values`, `new_values`, `user_id`, `ip_address`, `user_agent`, `created_at`) VALUES
(1, 'session_caisse', 1, 'CREATE', NULL, '{\"posId\":1,\"openingFund\":\"0\",\"note\":\"Session automatique\"}', 1, NULL, NULL, '2025-09-27 18:20:21.892'),
(2, 'stock_documents', 1, 'CREATE', NULL, '{\"id\":1,\"numero\":\"BEXP-202509-7332\",\"type\":\"BON_EXPEDITION\",\"status\":\"PREPARED\",\"emetteurId\":1,\"destinataireId\":2,\"notes\":null,\"createdAt\":\"2025-09-27T18:21:07.348Z\",\"updatedAt\":\"2025-09-27T18:21:07.348Z\",\"emetteur\":{\"id\":1,\"name\":\"Dépôt Principal Sfax\",\"code\":\"SFX-MAIN\",\"type\":\"MAIN\",\"address\":\"123 Rue de la Liberté\",\"city\":\"Sfax\",\"phone\":\"+216 74 123 456\",\"email\":\"sfax@patisserie.tn\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T18:07:19.743Z\",\"updatedAt\":\"2025-09-27T18:07:19.743Z\",\"companyId\":null},\"destinataire\":{\"id\":2,\"name\":\"Dépôt Tunis\",\"code\":\"TUN-BRANCH\",\"type\":\"BRANCH\",\"address\":\"456 Avenue Habib Bourguiba\",\"city\":\"Tunis\",\"phone\":\"+216 71 234 567\",\"email\":\"tunis@patisserie.tn\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T18:07:19.743Z\",\"updatedAt\":\"2025-09-27T18:07:19.743Z\",\"companyId\":null},\"items\":[{\"id\":1,\"documentId\":1,\"productId\":1,\"famille\":\"SCAN\",\"quantity\":\"89.101\",\"batch\":null,\"notes\":null,\"barcode\":null,\"purchasePrice\":null,\"count\":1,\"montantHT\":\"748.748\",\"montantTTC\":\"891.01\",\"montantTVA\":\"142.262\",\"prixUnitaire\":\"10\",\"tva\":\"19\",\"product\":{\"id\":1,\"name\":\"Croissant Classique\",\"description\":\"Croissant au beurre traditionnel\",\"barcode\":\"1234567890123\",\"createdAt\":\"2025-09-27T18:07:19.782Z\",\"updatedAt\":\"2025-09-27T18:07:19.782Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"1.2\",\"tva\":\"19\",\"unite\":\"pcs\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":null,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":1,\"designation_legale\":null,\"prix_achat\":\"0.72\"}}]}', 1, NULL, NULL, '2025-09-27 18:21:07.365'),
(3, 'attendance_punches', 1, 'CREATE', NULL, '{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-27T18:23:19.522Z\"}', 4, NULL, NULL, '2025-09-27 18:23:19.537'),
(4, 'attendance_punches', 2, 'CREATE', NULL, '{\"type\":\"CHECK_OUT\",\"timestamp\":\"2025-09-27T18:23:24.456Z\"}', 4, NULL, NULL, '2025-09-27 18:23:24.470'),
(5, 'attendance_punches', 3, 'CREATE', NULL, '{\"type\":\"CHECK_OUT\",\"timestamp\":\"2025-09-27T18:23:33.623Z\"}', 4, NULL, NULL, '2025-09-27 18:23:33.636'),
(6, 'attendance_punches', 4, 'CREATE', NULL, '{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-27T18:23:37.574Z\"}', 4, NULL, NULL, '2025-09-27 18:23:37.586'),
(7, 'stock_documents', 2, 'CREATE', NULL, '{\"id\":2,\"numero\":\"BEXP-202509-6640\",\"type\":\"BON_EXPEDITION\",\"status\":\"PREPARED\",\"emetteurId\":3,\"destinataireId\":2,\"notes\":null,\"createdAt\":\"2025-09-27T18:37:16.677Z\",\"updatedAt\":\"2025-09-27T18:37:16.677Z\",\"emetteur\":{\"id\":3,\"name\":\"Boutique Centre Ville\",\"code\":\"SHOP-CV\",\"type\":\"SHOP\",\"address\":\"789 Place de la République\",\"city\":\"Sfax\",\"phone\":\"+216 74 345 678\",\"email\":\"shop@patisserie.tn\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T18:07:19.743Z\",\"updatedAt\":\"2025-09-27T18:07:19.743Z\",\"companyId\":null},\"destinataire\":{\"id\":2,\"name\":\"Dépôt Tunis\",\"code\":\"TUN-BRANCH\",\"type\":\"BRANCH\",\"address\":\"456 Avenue Habib Bourguiba\",\"city\":\"Tunis\",\"phone\":\"+216 71 234 567\",\"email\":\"tunis@patisserie.tn\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T18:07:19.743Z\",\"updatedAt\":\"2025-09-27T18:07:19.743Z\",\"companyId\":null},\"items\":[{\"id\":2,\"documentId\":2,\"productId\":1,\"famille\":\"SCAN\",\"quantity\":\"89.101\",\"batch\":null,\"notes\":null,\"barcode\":null,\"purchasePrice\":null,\"count\":1,\"montantHT\":\"0\",\"montantTTC\":\"0\",\"montantTVA\":\"0\",\"prixUnitaire\":\"0\",\"tva\":\"19\",\"product\":{\"id\":1,\"name\":\"Croissant Classique\",\"description\":\"Croissant au beurre traditionnel\",\"barcode\":\"1234567890123\",\"createdAt\":\"2025-09-27T18:07:19.782Z\",\"updatedAt\":\"2025-09-27T18:07:19.782Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"1.2\",\"tva\":\"19\",\"unite\":\"pcs\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":null,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":1,\"designation_legale\":null,\"prix_achat\":\"0.72\"}}]}', 4, NULL, NULL, '2025-09-27 18:37:16.697');

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
(1, 'CLI001', 'Ali', 'Ben Salem', 'ali.bensalem@email.tn', '+216 74 111 222', '15 Rue de la Paix, Sfax', NULL, NULL, NULL, 'INDIVIDUAL', 150, 0.000, NULL, NULL, NULL, 1, '2025-09-27 18:07:21.014', '2025-09-27 18:07:21.014', NULL, 1, 0.000, NULL, NULL),
(2, 'CLI002', 'Amina', 'Karray', 'amina.karray@email.tn', '+216 74 333 444', '28 Avenue de l\'Indépendance, Sfax', NULL, NULL, NULL, 'INDIVIDUAL', 75, 0.000, NULL, NULL, NULL, 1, '2025-09-27 18:07:21.017', '2025-09-27 18:07:21.017', NULL, 1, 0.000, NULL, NULL),
(3, 'CLI003', 'Hassan', 'Trabelsi', 'hassan.trabelsi@email.tn', '+216 74 555 666', '7 Rue du Commerce, Sfax', NULL, NULL, NULL, 'INDIVIDUAL', 200, 0.000, NULL, NULL, NULL, 1, '2025-09-27 18:07:21.021', '2025-09-27 18:07:21.021', NULL, 1, 0.000, NULL, NULL);

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
(3, 'Boutique Centre Ville', 'SHOP-CV', 'SHOP', '789 Place de la République', 'Sfax', '+216 74 345 678', 'shop@patisserie.tn', NULL, 1, '2025-09-27 18:07:19.743', '2025-09-27 18:07:19.743', NULL);

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

--
-- Déchargement des données de la table `document_status_history`
--

INSERT INTO `document_status_history` (`id`, `document_id`, `status`, `user_id`, `notes`, `created_at`) VALUES
(1, 1, 'PREPARED', 1, 'Document créé par scan', '2025-09-27 18:21:07.348'),
(2, 2, 'PREPARED', 4, 'Document créé par scan', '2025-09-27 18:37:16.677');

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

--
-- Déchargement des données de la table `drivers`
--

INSERT INTO `drivers` (`id`, `nom`, `prenom`, `cin`, `phone`, `email`, `address`, `licenseNumber`, `licenseExpiry`, `is_active`, `depot_id`, `created_at`, `updated_at`) VALUES
(2, '123', '1231', '12345678', NULL, NULL, NULL, NULL, NULL, 1, 3, '2025-09-27 18:08:25.065', '2025-09-27 18:08:25.065');

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
(1, 150.00, 'Achat fournitures de bureau', 1, 1, 1, '2024-01-15 00:00:00.000', NULL, 'Papeterie et matériel de bureau', 0, NULL, NULL, '2025-09-27 18:07:21.250', '2025-09-27 18:07:21.250', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(2, 89.50, 'Facture électricité janvier', 2, 1, 1, '2024-01-20 00:00:00.000', NULL, 'Consommation électrique du mois', 0, NULL, NULL, '2025-09-27 18:07:21.254', '2025-09-27 18:07:21.254', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(3, 45.00, 'Facture eau', 3, 1, 1, '2024-01-25 00:00:00.000', NULL, 'Consommation d\'eau', 0, NULL, NULL, '2025-09-27 18:07:21.258', '2025-09-27 18:07:21.258', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(4, 1200.00, 'Loyer boutique centre ville', 4, 3, 3, '2024-01-01 00:00:00.000', NULL, 'Loyer mensuel boutique', 1, 4, '2024-01-02 00:00:00.000', '2025-09-27 18:07:21.260', '2025-09-27 18:07:21.260', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(5, 85.00, 'Frais de transport livraison', 6, 1, 2, '2024-01-18 00:00:00.000', NULL, 'Carburant pour livraisons', 0, NULL, NULL, '2025-09-27 18:07:21.263', '2025-09-27 18:07:21.263', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(6, 35.00, 'Facture téléphone', 7, 1, 1, '2024-01-22 00:00:00.000', NULL, 'Forfait mobile professionnel', 0, NULL, NULL, '2025-09-27 18:07:21.266', '2025-09-27 18:07:21.266', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(7, 200.00, 'Assurance responsabilité civile', 8, 1, 1, '2024-01-10 00:00:00.000', NULL, 'Assurance annuelle', 1, 4, '2024-01-11 00:00:00.000', '2025-09-27 18:07:21.268', '2025-09-27 18:07:21.268', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0),
(8, 75.50, 'Maintenance équipement', 9, 3, 3, '2024-01-28 00:00:00.000', NULL, 'Réparation four à pâtisserie', 0, NULL, NULL, '2025-09-27 18:07:21.271', '2025-09-27 18:07:21.271', NULL, 'CASH', NULL, 0, NULL, NULL, NULL, 0);

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
(1, 'Fournitures', 'Fournitures de bureau et matériel', 'red', '🏪', 1, '2025-09-27 18:07:19.923', '2025-09-27 18:07:19.923'),
(2, 'Électricité', 'Factures d\'électricité', 'blue', '⚡', 1, '2025-09-27 18:07:19.927', '2025-09-27 18:07:19.927'),
(3, 'Eau', 'Factures d\'eau', 'green', '💧', 1, '2025-09-27 18:07:19.931', '2025-09-27 18:07:19.931'),
(4, 'Loyer', 'Loyer des locaux', 'purple', '🏢', 1, '2025-09-27 18:07:19.935', '2025-09-27 18:07:19.935'),
(5, 'Salaire', 'Salaires et rémunérations', 'orange', '👥', 1, '2025-09-27 18:07:19.939', '2025-09-27 18:07:19.939'),
(6, 'Transport', 'Frais de transport et livraison', 'pink', '🚚', 1, '2025-09-27 18:07:19.944', '2025-09-27 18:07:19.944'),
(7, 'Téléphone', 'Frais de télécommunication', 'teal', '📱', 1, '2025-09-27 18:07:19.948', '2025-09-27 18:07:19.948'),
(8, 'Assurance', 'Assurances diverses', 'indigo', '🛡️', 1, '2025-09-27 18:07:19.952', '2025-09-27 18:07:19.952'),
(9, 'Autre', 'Autres dépenses', 'yellow', '➕', 1, '2025-09-27 18:07:19.957', '2025-09-27 18:07:19.957');

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
(1, 1, 1, 112.899, 0.000, '2025-09-27 18:21:07.359'),
(2, 1, 2, 239.000, 0.000, '2025-09-27 18:07:21.027'),
(3, 1, 3, 99.000, 0.000, '2025-09-27 18:07:21.030'),
(4, 1, 4, 158.000, 0.000, '2025-09-27 18:07:21.031'),
(5, 1, 5, 179.000, 0.000, '2025-09-27 18:07:21.033'),
(6, 1, 6, 144.000, 0.000, '2025-09-27 18:07:21.035'),
(7, 1, 7, 209.000, 0.000, '2025-09-27 18:07:21.037'),
(8, 1, 8, 53.000, 0.000, '2025-09-27 18:07:21.039'),
(9, 1, 9, 58.000, 0.000, '2025-09-27 18:07:21.041'),
(10, 1, 10, 220.000, 0.000, '2025-09-27 18:07:21.043'),
(11, 1, 11, 171.000, 0.000, '2025-09-27 18:07:21.045'),
(12, 1, 12, 105.000, 0.000, '2025-09-27 18:07:21.047'),
(13, 1, 13, 213.000, 0.000, '2025-09-27 18:07:21.049'),
(14, 1, 14, 183.000, 0.000, '2025-09-27 18:07:21.050'),
(15, 1, 15, 143.000, 0.000, '2025-09-27 18:07:21.052'),
(16, 1, 16, 238.000, 0.000, '2025-09-27 18:07:21.053'),
(17, 1, 17, 118.000, 0.000, '2025-09-27 18:07:21.055'),
(18, 1, 18, 101.000, 0.000, '2025-09-27 18:07:21.057'),
(19, 1, 19, 161.000, 0.000, '2025-09-27 18:07:21.058'),
(20, 1, 20, 158.000, 0.000, '2025-09-27 18:07:21.059'),
(21, 1, 21, 248.000, 0.000, '2025-09-27 18:07:21.061'),
(22, 1, 22, 166.000, 0.000, '2025-09-27 18:07:21.064'),
(23, 1, 23, 84.000, 0.000, '2025-09-27 18:07:21.066'),
(24, 1, 24, 184.000, 0.000, '2025-09-27 18:07:21.068'),
(25, 1, 25, 92.000, 0.000, '2025-09-27 18:07:21.070'),
(26, 1, 26, 68.000, 0.000, '2025-09-27 18:07:21.071'),
(27, 1, 27, 195.000, 0.000, '2025-09-27 18:07:21.073'),
(28, 1, 28, 201.000, 0.000, '2025-09-27 18:07:21.075'),
(29, 1, 29, 163.000, 0.000, '2025-09-27 18:07:21.077'),
(30, 1, 30, 222.000, 0.000, '2025-09-27 18:07:21.078'),
(31, 1, 31, 247.000, 0.000, '2025-09-27 18:07:21.080'),
(32, 1, 32, 217.000, 0.000, '2025-09-27 18:07:21.081'),
(33, 1, 33, 92.000, 0.000, '2025-09-27 18:07:21.083'),
(34, 1, 34, 220.000, 0.000, '2025-09-27 18:07:21.085'),
(35, 1, 35, 214.000, 0.000, '2025-09-27 18:07:21.087'),
(36, 1, 36, 52.000, 0.000, '2025-09-27 18:07:21.088'),
(37, 1, 37, 166.000, 0.000, '2025-09-27 18:07:21.090'),
(38, 1, 38, 149.000, 0.000, '2025-09-27 18:07:21.092'),
(39, 1, 39, 242.000, 0.000, '2025-09-27 18:07:21.094'),
(40, 1, 40, 112.000, 0.000, '2025-09-27 18:07:21.096'),
(41, 2, 1, 31.000, 0.000, '2025-09-27 18:07:21.098'),
(42, 2, 2, 155.000, 0.000, '2025-09-27 18:07:21.099'),
(43, 2, 3, 155.000, 0.000, '2025-09-27 18:07:21.101'),
(44, 2, 4, 155.000, 0.000, '2025-09-27 18:07:21.104'),
(45, 2, 5, 87.000, 0.000, '2025-09-27 18:07:21.106'),
(46, 2, 6, 152.000, 0.000, '2025-09-27 18:07:21.108'),
(47, 2, 7, 77.000, 0.000, '2025-09-27 18:07:21.110'),
(48, 2, 8, 126.000, 0.000, '2025-09-27 18:07:21.112'),
(49, 2, 9, 165.000, 0.000, '2025-09-27 18:07:21.114'),
(50, 2, 10, 153.000, 0.000, '2025-09-27 18:07:21.116'),
(51, 2, 11, 68.000, 0.000, '2025-09-27 18:07:21.118'),
(52, 2, 12, 125.000, 0.000, '2025-09-27 18:07:21.120'),
(53, 2, 13, 171.000, 0.000, '2025-09-27 18:07:21.122'),
(54, 2, 14, 84.000, 0.000, '2025-09-27 18:07:21.124'),
(55, 2, 15, 38.000, 0.000, '2025-09-27 18:07:21.126'),
(56, 2, 16, 171.000, 0.000, '2025-09-27 18:07:21.128'),
(57, 2, 17, 35.000, 0.000, '2025-09-27 18:07:21.130'),
(58, 2, 18, 148.000, 0.000, '2025-09-27 18:07:21.133'),
(59, 2, 19, 65.000, 0.000, '2025-09-27 18:07:21.134'),
(60, 2, 20, 90.000, 0.000, '2025-09-27 18:07:21.136'),
(61, 2, 21, 101.000, 0.000, '2025-09-27 18:07:21.138'),
(62, 2, 22, 155.000, 0.000, '2025-09-27 18:07:21.140'),
(63, 2, 23, 146.000, 0.000, '2025-09-27 18:07:21.142'),
(64, 2, 24, 61.000, 0.000, '2025-09-27 18:07:21.144'),
(65, 2, 25, 132.000, 0.000, '2025-09-27 18:07:21.146'),
(66, 2, 26, 92.000, 0.000, '2025-09-27 18:07:21.148'),
(67, 2, 27, 176.000, 0.000, '2025-09-27 18:07:21.150'),
(68, 2, 28, 92.000, 0.000, '2025-09-27 18:07:21.152'),
(69, 2, 29, 119.000, 0.000, '2025-09-27 18:07:21.154'),
(70, 2, 30, 174.000, 0.000, '2025-09-27 18:07:21.156'),
(71, 2, 31, 171.000, 0.000, '2025-09-27 18:07:21.158'),
(72, 2, 32, 121.000, 0.000, '2025-09-27 18:07:21.160'),
(73, 2, 33, 112.000, 0.000, '2025-09-27 18:07:21.161'),
(74, 2, 34, 163.000, 0.000, '2025-09-27 18:07:21.163'),
(75, 2, 35, 103.000, 0.000, '2025-09-27 18:07:21.165'),
(76, 2, 36, 158.000, 0.000, '2025-09-27 18:07:21.168'),
(77, 2, 37, 33.000, 0.000, '2025-09-27 18:07:21.170'),
(78, 2, 38, 144.000, 0.000, '2025-09-27 18:07:21.172'),
(79, 2, 39, 65.000, 0.000, '2025-09-27 18:07:21.174'),
(80, 2, 40, 33.000, 0.000, '2025-09-27 18:07:21.175'),
(81, 3, 1, -23.101, 0.000, '2025-09-27 18:37:16.689'),
(82, 3, 2, 119.000, 0.000, '2025-09-27 18:07:21.179'),
(83, 3, 3, 54.000, 0.000, '2025-09-27 18:07:21.181'),
(84, 3, 4, 93.000, 0.000, '2025-09-27 18:07:21.183'),
(85, 3, 5, 103.000, 0.000, '2025-09-27 18:07:21.185'),
(86, 3, 6, 62.000, 0.000, '2025-09-27 18:07:21.187'),
(87, 3, 7, 30.000, 0.000, '2025-09-27 18:07:21.189'),
(88, 3, 8, 95.000, 0.000, '2025-09-27 18:07:21.190'),
(89, 3, 9, 91.000, 0.000, '2025-09-27 18:07:21.192'),
(90, 3, 10, 35.000, 0.000, '2025-09-27 18:07:21.194'),
(91, 3, 11, 106.000, 0.000, '2025-09-27 18:07:21.196'),
(92, 3, 12, 73.000, 0.000, '2025-09-27 18:07:21.197'),
(93, 3, 13, 21.000, 0.000, '2025-09-27 18:07:21.199'),
(94, 3, 14, 48.000, 0.000, '2025-09-27 18:07:21.201'),
(95, 3, 15, 115.000, 0.000, '2025-09-27 18:07:21.203'),
(96, 3, 16, 64.000, 0.000, '2025-09-27 18:07:21.206'),
(97, 3, 17, 111.000, 0.000, '2025-09-27 18:07:21.208'),
(98, 3, 18, 84.000, 0.000, '2025-09-27 18:07:21.210'),
(99, 3, 19, 68.000, 0.000, '2025-09-27 18:07:21.211'),
(100, 3, 20, 59.000, 0.000, '2025-09-27 18:07:21.213'),
(101, 3, 21, 75.000, 0.000, '2025-09-27 18:07:21.215'),
(102, 3, 22, 27.000, 0.000, '2025-09-27 18:07:21.217'),
(103, 3, 23, 50.000, 0.000, '2025-09-27 18:07:21.219'),
(104, 3, 24, 21.000, 0.000, '2025-09-27 18:07:21.221'),
(105, 3, 25, 62.000, 0.000, '2025-09-27 18:07:21.223'),
(106, 3, 26, 108.000, 0.000, '2025-09-27 18:07:21.224'),
(107, 3, 27, 60.000, 0.000, '2025-09-27 18:07:21.226'),
(108, 3, 28, 119.000, 0.000, '2025-09-27 18:07:21.227'),
(109, 3, 29, 49.000, 0.000, '2025-09-27 18:07:21.229'),
(110, 3, 30, 24.000, 0.000, '2025-09-27 18:07:21.231'),
(111, 3, 31, 65.000, 0.000, '2025-09-27 18:07:21.232'),
(112, 3, 32, 118.000, 0.000, '2025-09-27 18:07:21.234'),
(113, 3, 33, 97.000, 0.000, '2025-09-27 18:07:21.236'),
(114, 3, 34, 69.000, 0.000, '2025-09-27 18:07:21.237'),
(115, 3, 35, 41.000, 0.000, '2025-09-27 18:07:21.239'),
(116, 3, 36, 88.000, 0.000, '2025-09-27 18:07:21.241'),
(117, 3, 37, 111.000, 0.000, '2025-09-27 18:07:21.242'),
(118, 3, 38, 82.000, 0.000, '2025-09-27 18:07:21.244'),
(119, 3, 39, 61.000, 0.000, '2025-09-27 18:07:21.245'),
(120, 3, 40, 46.000, 0.000, '2025-09-27 18:07:21.247');

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
(1, 'Croissant Classique', 'Croissant au beurre traditionnel', '1234567890123', '2025-09-27 18:07:19.782', '2025-09-27 18:07:19.782', NULL, NULL, 1.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 1, NULL, 0.720),
(2, 'Pain au Chocolat', 'Pain au chocolat noir', '1234567890124', '2025-09-27 18:07:19.785', '2025-09-27 18:07:19.785', NULL, NULL, 1.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 1, NULL, 0.900),
(3, 'Éclair au Chocolat', 'Éclair garni de crème pâtissière et chocolat', '1234567890125', '2025-09-27 18:07:19.788', '2025-09-27 18:07:19.788', NULL, NULL, 2.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 1.500),
(4, 'Mille-Feuille', 'Mille-feuille à la vanille', '1234567890126', '2025-09-27 18:07:19.792', '2025-09-27 18:07:19.792', NULL, NULL, 3.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 1.800),
(5, 'Tarte aux Pommes', 'Tarte aux pommes traditionnelle', '1234567890127', '2025-09-27 18:07:19.795', '2025-09-27 18:07:19.795', NULL, NULL, 4.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 2.700),
(6, 'Café Expresso', 'Expresso italien', '1234567890128', '2025-09-27 18:07:19.799', '2025-09-27 18:07:19.799', NULL, NULL, 1.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 3, NULL, 1.080),
(7, 'Thé à la Menthe', 'Thé vert à la menthe fraîche', '1234567890129', '2025-09-27 18:07:19.802', '2025-09-27 18:07:19.802', NULL, NULL, 2.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 3, NULL, 1.200),
(8, 'Cookie Chocolat', 'Cookie aux pépites de chocolat', '1234567890130', '2025-09-27 18:07:19.805', '2025-09-27 18:07:19.805', NULL, NULL, 1.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 4, NULL, 0.600),
(9, 'Gâteau au Chocolat', 'Gâteau moelleux au chocolat noir', '1234567890131', '2025-09-27 18:07:19.808', '2025-09-27 18:07:19.808', NULL, NULL, 5.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.300),
(10, 'Tarte Tatin', 'Tarte tatin aux pommes caramélisées', '1234567890132', '2025-09-27 18:07:19.812', '2025-09-27 18:07:19.812', NULL, NULL, 6.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.600),
(11, 'Profiteroles', 'Profiteroles à la crème chantilly et chocolat', '1234567890133', '2025-09-27 18:07:19.815', '2025-09-27 18:07:19.815', NULL, NULL, 4.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 2.880),
(12, 'Cheesecake', 'Cheesecake aux fruits rouges', '1234567890134', '2025-09-27 18:07:19.818', '2025-09-27 18:07:19.818', NULL, NULL, 5.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.120),
(13, 'Tiramisu', 'Tiramisu classique italien', '1234567890135', '2025-09-27 18:07:19.821', '2025-09-27 18:07:19.821', NULL, NULL, 6.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.900),
(14, 'Macarons Assortis', 'Macarons aux saveurs variées', '1234567890136', '2025-09-27 18:07:19.823', '2025-09-27 18:07:19.823', NULL, NULL, 8.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 4.800),
(15, 'Opéra', 'Gâteau Opéra aux amandes et café', '1234567890137', '2025-09-27 18:07:19.826', '2025-09-27 18:07:19.826', NULL, NULL, 7.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 4.500),
(16, 'Saint-Honoré', 'Saint-Honoré à la crème chiboust', '1234567890138', '2025-09-27 18:07:19.828', '2025-09-27 18:07:19.828', NULL, NULL, 6.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 4.080),
(17, 'Paris-Brest', 'Paris-Brest aux noisettes', '1234567890139', '2025-09-27 18:07:19.832', '2025-09-27 18:07:19.832', NULL, NULL, 5.90, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 3.540),
(18, 'Religieuse', 'Religieuse au chocolat et café', '1234567890140', '2025-09-27 18:07:19.835', '2025-09-27 18:07:19.835', NULL, NULL, 4.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 2, NULL, 2.520),
(19, 'Baklava', 'Baklava aux noix et miel', '1234567890141', '2025-09-27 18:07:19.837', '2025-09-27 18:07:19.837', NULL, NULL, 3.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 2.100),
(20, 'Makroudh', 'Makroudh aux dattes et semoule', '1234567890142', '2025-09-27 18:07:19.839', '2025-09-27 18:07:19.839', NULL, NULL, 2.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.680),
(21, 'Zlabia', 'Zlabia frite au miel', '1234567890143', '2025-09-27 18:07:19.842', '2025-09-27 18:07:19.842', NULL, NULL, 1.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 0.900),
(22, 'Ghrayba', 'Ghrayba aux amandes', '1234567890144', '2025-09-27 18:07:19.845', '2025-09-27 18:07:19.845', NULL, NULL, 2.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.320),
(23, 'Kaak Warka', 'Kaak warka aux amandes', '1234567890145', '2025-09-27 18:07:19.849', '2025-09-27 18:07:19.849', NULL, NULL, 3.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.800),
(24, 'Samsa', 'Samsa aux amandes et miel', '1234567890146', '2025-09-27 18:07:19.854', '2025-09-27 18:07:19.854', NULL, NULL, 2.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.500),
(25, 'Cornes de Gazelle', 'Cornes de gazelle aux amandes', '1234567890147', '2025-09-27 18:07:19.860', '2025-09-27 18:07:19.860', NULL, NULL, 4.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 2.400),
(26, 'Mhalbiya', 'Mhalbiya à la rose', '1234567890148', '2025-09-27 18:07:19.865', '2025-09-27 18:07:19.865', NULL, NULL, 2.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.680),
(27, 'Assida', 'Assida au beurre et miel', '1234567890149', '2025-09-27 18:07:19.870', '2025-09-27 18:07:19.870', NULL, NULL, 3.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.920),
(28, 'Bambalouni', 'Bambalouni frit au sucre', '1234567890150', '2025-09-27 18:07:19.874', '2025-09-27 18:07:19.874', NULL, NULL, 1.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 6, NULL, 1.080),
(29, 'Jus d\'Orange Frais', 'Jus d\'orange pressé', '1234567890151', '2025-09-27 18:07:19.877', '2025-09-27 18:07:19.877', NULL, NULL, 3.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.100),
(30, 'Jus de Pomme', 'Jus de pomme naturel', '1234567890152', '2025-09-27 18:07:19.880', '2025-09-27 18:07:19.880', NULL, NULL, 3.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 1.800),
(31, 'Jus de Grenade', 'Jus de grenade frais', '1234567890153', '2025-09-27 18:07:19.884', '2025-09-27 18:07:19.884', NULL, NULL, 4.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.700),
(32, 'Jus de Citron', 'Jus de citron pressé', '1234567890154', '2025-09-27 18:07:19.887', '2025-09-27 18:07:19.887', NULL, NULL, 2.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 1.500),
(33, 'Smoothie Banane', 'Smoothie banane et lait', '1234567890155', '2025-09-27 18:07:19.891', '2025-09-27 18:07:19.891', NULL, NULL, 4.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.400),
(34, 'Smoothie Fraise', 'Smoothie fraise et yaourt', '1234567890156', '2025-09-27 18:07:19.893', '2025-09-27 18:07:19.893', NULL, NULL, 4.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.520),
(35, 'Smoothie Mangue', 'Smoothie mangue et ananas', '1234567890157', '2025-09-27 18:07:19.897', '2025-09-27 18:07:19.897', NULL, NULL, 4.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.880),
(36, 'Jus de Carotte', 'Jus de carotte frais', '1234567890158', '2025-09-27 18:07:19.899', '2025-09-27 18:07:19.899', NULL, NULL, 3.20, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 1.920),
(37, 'Jus de Betterave', 'Jus de betterave et pomme', '1234567890159', '2025-09-27 18:07:19.902', '2025-09-27 18:07:19.902', NULL, NULL, 3.80, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.280),
(38, 'Smoothie Vert', 'Smoothie épinards et kiwi', '1234567890160', '2025-09-27 18:07:19.905', '2025-09-27 18:07:19.905', NULL, NULL, 5.00, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 3.000),
(39, 'Jus de Raisin', 'Jus de raisin naturel', '1234567890161', '2025-09-27 18:07:19.908', '2025-09-27 18:07:19.908', NULL, NULL, 3.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 2.100),
(40, 'Smoothie Tropical', 'Smoothie fruits tropicaux', '1234567890162', '2025-09-27 18:07:19.910', '2025-09-27 18:07:19.910', NULL, NULL, 5.50, 19.00, 'pcs', 1, NULL, 0, NULL, NULL, NULL, 0, NULL, 0, 7, NULL, 3.300);

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
(1, 'Viennoiserie', 'Viennoiseries et croissants', NULL, 1, '2025-09-27 18:07:19.759', '2025-09-27 18:07:19.759'),
(2, 'Pâtisserie', 'Pâtisseries et gâteaux', NULL, 1, '2025-09-27 18:07:19.762', '2025-09-27 18:07:19.762'),
(3, 'Boissons', 'Cafés et boissons', NULL, 1, '2025-09-27 18:07:19.766', '2025-09-27 18:07:19.766'),
(4, 'Boulangerie', 'Pain et boulangerie', NULL, 1, '2025-09-27 18:07:19.769', '2025-09-27 18:07:19.769'),
(5, 'Vrac', 'Produits vrac - vente au poids', NULL, 1, '2025-09-27 18:07:19.772', '2025-09-27 18:07:19.772'),
(6, 'Pâtisserie Tunisienne', 'Pâtisseries traditionnelles tunisiennes', NULL, 1, '2025-09-27 18:07:19.774', '2025-09-27 18:07:19.774'),
(7, 'Jus et Smoothies', 'Jus de fruits frais et smoothies', NULL, 1, '2025-09-27 18:07:19.776', '2025-09-27 18:07:19.776');

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
(1, '123', '[]', 1, '2025-09-27 18:12:35.475', '2025-09-27 18:12:35.475', '', NULL, NULL, '', '', NULL, NULL, 1, NULL, 1, 0, 0, 0, NULL, NULL, NULL, NULL, 0.001, 10.00, 19.00, 'pcs', 40);

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
(1, 1, 1, '2025-09-27 18:12:35.475', '2025-09-27 18:12:35.475');

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

--
-- Déchargement des données de la table `session_caisse`
--

INSERT INTO `session_caisse` (`id`, `pos_id`, `user_id`, `depot_id`, `magasin_id`, `opened_at`, `closed_at`, `opening_fund`, `expected_cash`, `counted_cash`, `variance`, `status`, `x_seq`, `z_seq`, `note`, `created_at`, `updated_at`, `original_counted_cash`) VALUES
(1, 1, 1, 1, NULL, '2025-09-27 18:20:21.888', NULL, 0.000, 0.000, NULL, NULL, 'OPEN', 0, 0, 'Session automatique', '2025-09-27 18:20:21.888', '2025-09-27 18:20:21.888', NULL);

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

--
-- Déchargement des données de la table `stock_documents`
--

INSERT INTO `stock_documents` (`id`, `numero`, `type`, `status`, `emetteur_id`, `destinataire_id`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'BEXP-202509-7332', 'BON_EXPEDITION', 'PREPARED', 1, 2, NULL, '2025-09-27 18:21:07.348', '2025-09-27 18:21:07.348'),
(2, 'BEXP-202509-6640', 'BON_EXPEDITION', 'PREPARED', 3, 2, NULL, '2025-09-27 18:37:16.677', '2025-09-27 18:37:16.677');

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

--
-- Déchargement des données de la table `stock_document_items`
--

INSERT INTO `stock_document_items` (`id`, `document_id`, `product_id`, `famille`, `quantity`, `batch`, `notes`, `barcode`, `purchase_price`, `count`, `montant_ht`, `montant_ttc`, `montant_tva`, `prix_unitaire`, `tva`) VALUES
(1, 1, 1, 'SCAN', 89.101, NULL, NULL, NULL, NULL, 1, 748.748, 891.010, 142.262, 10.000, 19.00),
(2, 2, 1, 'SCAN', 89.101, NULL, NULL, NULL, NULL, 1, 0.000, 0.000, 0.000, 0.000, 19.00);

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

--
-- Déchargement des données de la table `stock_movements`
--

INSERT INTO `stock_movements` (`id`, `product_id`, `depot_id`, `quantity`, `type`, `from_depot_id`, `to_depot_id`, `reason`, `reference`, `user_id`, `date`) VALUES
(1, 1, 1, -89.101, 'OUT', 1, 2, 'EXPEDITION_SCAN', 'BEXP-202509-7332', 1, '2025-09-27 18:21:07.361'),
(2, 1, 3, -89.101, 'OUT', 3, 2, 'EXPEDITION_SCAN', 'BEXP-202509-6640', 4, '2025-09-27 18:37:16.692');

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
(1, 'manager', 'manager@patisserie.tn', '$2a$12$AXcHIfSeGgrgTTZqv4.7nOLCK.273dXIw3TNHUZq83WKrtsFOj6IC', 'Ahmed', 'Ben Ali', 'MANAGER', 1, 1, NULL, '2025-09-27 18:07:21.001', '2025-09-27 18:07:21.001', '00020002'),
(2, 'stock', 'stock@patisserie.tn', '$2a$12$iUTL/UgzyHigeKschOCPwOhpFUubK8kWsTNZJonDOWZZzZ6bjG35u', 'Mohamed', 'Hassan', 'STOCK_MANAGER', 1, 1, NULL, '2025-09-27 18:07:21.001', '2025-09-27 18:07:21.001', '00040004'),
(3, 'cashier', 'cashier@patisserie.tn', '$2a$12$5ginyrHJIUbrfJU.nqA.ned0Ai/4WB7wM3PWdxnk/kzEzhsyV0eBK', 'Fatma', 'Trabelsi', 'CASHIER', 3, 1, NULL, '2025-09-27 18:07:21.001', '2025-09-27 18:07:21.001', '00030003'),
(4, 'admin', 'admin@patisserie.tn', '$2a$12$7Av.XZBSYNocA9jMW2mKiOk8nwh1OzlDIwk6GdA0rrdVXeZJ/MsOa', 'Admin', 'Principal', 'ADMIN', 1, 1, '2025-09-27 18:23:37.461', '2025-09-27 18:07:21.001', '2025-09-27 18:23:37.462', '1100');

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

--
-- Déchargement des données de la table `vehicles`
--

INSERT INTO `vehicles` (`id`, `matricule`, `model`, `brand_id`, `is_active`, `created_at`, `updated_at`) VALUES
(1, '126 TU 1250', 'aa', 1, 1, '2025-09-27 18:18:35.766', '2025-09-27 18:18:35.766');

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

--
-- Déchargement des données de la table `vehicle_brands`
--

INSERT INTO `vehicle_brands` (`id`, `name`, `models`, `is_active`, `created_at`, `updated_at`, `logoUrl`) VALUES
(1, 'aa', '[\"aa\"]', 1, '2025-09-27 18:18:27.028', '2025-09-27 18:18:27.028', NULL);

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `attendance_punches`
--
ALTER TABLE `attendance_punches`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `drivers`
--
ALTER TABLE `drivers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `produit_de_caisse_depot`
--
ALTER TABLE `produit_de_caisse_depot`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `stock_documents`
--
ALTER TABLE `stock_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `stock_document_items`
--
ALTER TABLE `stock_document_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `stock_document_links`
--
ALTER TABLE `stock_document_links`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stock_movements`
--
ALTER TABLE `stock_movements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `vehicle_brands`
--
ALTER TABLE `vehicle_brands`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

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
